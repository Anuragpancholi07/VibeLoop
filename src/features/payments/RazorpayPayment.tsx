import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Shield, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { formatCurrency } from '@/lib/utils';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentPageProps {
  eventId: string;
  eventTitle: string;
  amount: number;
  currency?: string;
}

export function useRazorpay() {
  const { user, profile } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const initiatePayment = async (eventId: string, amount: number, currency: string = 'INR') => {
    if (!user) throw new Error('Not authenticated');

    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      // 1. Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay');

      // 2. Create order via Supabase Edge Function
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { event_id: eventId, amount, currency },
      });

      if (orderError) throw orderError;

      // 3. Open Razorpay checkout
      return new Promise<string>((resolve, reject) => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'VibeLoop',
          description: `Event Ticket`,
          order_id: orderData.razorpay_order_id,
          prefill: {
            email: user.email || '',
            contact: user.phone || '',
            name: profile?.full_name || '',
          },
          theme: {
            color: '#7C3AED',
          },
          handler: async (response: any) => {
            try {
              // 4. Verify payment via Edge Function
              const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  payment_id: orderData.payment_id,
                  event_id: eventId,
                },
              });

              if (verifyError) throw verifyError;

              setPaymentStatus('success');
              resolve(verifyData.ticket_id);
            } catch (err) {
              setPaymentStatus('failed');
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentStatus('idle');
              setIsProcessing(false);
              reject(new Error('Payment cancelled'));
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (response: any) => {
          setPaymentStatus('failed');
          setIsProcessing(false);
          reject(new Error(response.error?.description || 'Payment failed'));
        });
        rzp.open();
      });
    } catch (error) {
      setPaymentStatus('failed');
      setIsProcessing(false);
      throw error;
    }
  };

  return { initiatePayment, isProcessing, paymentStatus };
}

export function PaymentStatusModal({
  status,
  onClose,
  ticketId,
}: {
  status: 'success' | 'failed';
  onClose: () => void;
  ticketId?: string;
}) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-2xl border border-border text-center"
      >
        {status === 'success' ? (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Payment Successful!</h2>
            <p className="text-sm text-muted-foreground mb-6">Your ticket has been generated. You can view it in My Tickets.</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-secondary border border-border text-sm font-medium">
                Close
              </button>
              <button
                onClick={() => navigate('/tickets')}
                className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                View Ticket
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Payment Failed</h2>
            <p className="text-sm text-muted-foreground mb-6">Something went wrong with your payment. Please try again.</p>
            <button onClick={onClose} className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
              Try Again
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
