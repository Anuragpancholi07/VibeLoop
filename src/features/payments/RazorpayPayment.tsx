import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Shield, Loader2, CheckCircle2, XCircle,
  Ticket, ArrowRight, Smartphone, Building2, X, QrCode,
  IndianRupee, Calendar, MapPin, Users
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Event } from '@/types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Helper: Generate unique ticket number
function generateTicketNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'VL-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper: Create ticket in Supabase
async function createTicketInDB(
  userId: string,
  eventId: string,
  attendeeId?: string,
  paymentId?: string
): Promise<string> {
  const ticketNumber = generateTicketNumber();
  const qrData = `vibeloop:ticket:${ticketNumber}:${eventId}:${userId}`;

  const { data, error } = await supabase
    .from('event_tickets')
    .insert({
      user_id: userId,
      event_id: eventId,
      attendee_id: attendeeId || null,
      ticket_number: ticketNumber,
      qr_code_data: qrData,
      status: 'active',
      payment_id: paymentId || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// useRazorpay hook
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

  const initiatePayment = useCallback(async (eventId: string, amount: number, currency: string = 'INR') => {
    if (!user) throw new Error('Not authenticated');
    setIsProcessing(true);
    setPaymentStatus('processing');

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load Razorpay');

      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { event_id: eventId, amount, currency },
      });

      if (orderError) throw orderError;

      return new Promise<string>((resolve, reject) => {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'VibeLoop',
          description: 'Event Ticket',
          order_id: orderData.razorpay_order_id,
          prefill: {
            email: user.email || '',
            contact: (profile as any)?.phone || '',
            name: profile?.full_name || '',
          },
          theme: { color: '#7C3AED' },
          handler: async (response: any) => {
            try {
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
              setIsProcessing(false);
              resolve(verifyData.ticket_id);
            } catch (err) {
              setPaymentStatus('failed');
              setIsProcessing(false);
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
  }, [user, profile]);

  return { initiatePayment, isProcessing, paymentStatus, setPaymentStatus };
}

// CheckoutModal Component
interface CheckoutModalProps {
  event: Event;
  onClose: () => void;
  onSuccess: (ticketId: string) => void;
}

type CheckoutStep = 'summary' | 'payment' | 'processing' | 'success' | 'failed';
type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'demo';

export function CheckoutModal({ event, onClose, onSuccess }: CheckoutModalProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('demo');
  const [upiId, setUpiId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [ticketId, setTicketId] = useState<string>('');
  const [error, setError] = useState('');

  const handleFreeJoin = async () => {
    if (!user) return;
    setIsProcessing(true);
    setStep('processing');
    try {
      let attendeeId: string | undefined;

      // Try to insert attendee record
      const { data: attendeeData, error: attendeeError } = await supabase
        .from('event_attendees')
        .insert({
          event_id: event.id,
          user_id: user.id,
          status: event.approval_type === 'instant' ? 'approved' : 'pending',
        })
        .select('id, status')
        .single();

      if (attendeeError) {
        // Already registered - get existing
        const { data: existing } = await supabase
          .from('event_attendees')
          .select('id, status')
          .eq('event_id', event.id)
          .eq('user_id', user.id)
          .single();

        if (!existing) throw attendeeError;
        attendeeId = existing.id;

        if (existing.status === 'approved') {
          // Check if ticket already exists
          const { data: existingTicket } = await supabase
            .from('event_tickets')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (existingTicket) {
            setTicketId(existingTicket.id);
            setStep('success');
            return;
          }
          const tId = await createTicketInDB(user.id, event.id, attendeeId);
          setTicketId(tId);
        }
        setStep('success');
        return;
      }

      attendeeId = attendeeData?.id;

      if (event.approval_type === 'instant') {
        const tId = await createTicketInDB(user.id, event.id, attendeeId);
        setTicketId(tId);
      }

      setStep('success');
    } catch (err: any) {
      console.error('Error joining event:', err);
      setError(err.message || 'Failed to join event');
      setStep('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaidCheckout = async () => {
    if (!user) return;
    setIsProcessing(true);
    setStep('processing');

    try {
      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      const isRazorpayConfigured = razorpayKey && !razorpayKey.includes('xxxxxxxxxxxxx');

      if (isRazorpayConfigured && paymentMethod !== 'demo') {
        // Real Razorpay flow
        const loaded = await new Promise<boolean>((resolve) => {
          if (window.Razorpay) { resolve(true); return; }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

        if (!loaded) throw new Error('Failed to load payment gateway');

        const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
          body: { event_id: event.id, amount: event.ticket_price, currency: 'INR' },
        });

        if (orderError) throw orderError;

        await new Promise<void>((resolve, reject) => {
          const options = {
            key: razorpayKey,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'VibeLoop',
            description: event.title,
            order_id: orderData.razorpay_order_id,
            prefill: { email: user.email || '', name: profile?.full_name || '' },
            theme: { color: '#7C3AED' },
            handler: async (response: any) => {
              try {
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                  body: {
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    payment_id: orderData.payment_id,
                    event_id: event.id,
                  },
                });
                if (verifyError) throw verifyError;
                setTicketId(verifyData.ticket_id);
                resolve();
              } catch (err) { reject(err); }
            },
            modal: {
              ondismiss: () => {
                setIsProcessing(false);
                setStep('payment');
                reject(new Error('Payment cancelled'));
              },
            },
          };
          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (r: any) => {
            reject(new Error(r.error?.description || 'Payment failed'));
          });
          rzp.open();
        });
      } else {
        // Demo / Simulated payment
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: paymentData } = await supabase
          .from('payments')
          .insert({
            user_id: user.id,
            event_id: event.id,
            amount: event.ticket_price,
            currency: event.currency || 'INR',
            status: 'completed',
            payment_method: paymentMethod,
            commission_amount: +(event.ticket_price * 0.05).toFixed(2),
            host_amount: +(event.ticket_price * 0.95).toFixed(2),
          })
          .select('id')
          .maybeSingle();

        const { data: attendeeData } = await supabase
          .from('event_attendees')
          .upsert(
            { event_id: event.id, user_id: user.id, status: 'approved' },
            { onConflict: 'event_id,user_id' }
          )
          .select('id')
          .maybeSingle();

        // Check if ticket already exists
        const { data: existingTicket } = await supabase
          .from('event_tickets')
          .select('id')
          .eq('event_id', event.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingTicket) {
          setTicketId(existingTicket.id);
        } else {
          const tId = await createTicketInDB(user.id, event.id, attendeeData?.id, paymentData?.id);
          setTicketId(tId);
        }
      }

      setStep('success');
    } catch (err: any) {
      if (err.message === 'Payment cancelled') {
        setIsProcessing(false);
        return;
      }
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
      setStep('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && step !== 'processing') onClose();
        }}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl overflow-hidden border border-border shadow-2xl max-h-[90dvh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-lg font-bold">
                {step === 'summary' && 'Confirm Registration'}
                {step === 'payment' && 'Payment Details'}
                {step === 'processing' && 'Processing...'}
                {step === 'success' && "You're In! 🎉"}
                {step === 'failed' && 'Payment Failed'}
              </h2>
              {step === 'summary' && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.title}</p>
              )}
            </div>
            {step !== 'processing' && step !== 'success' && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-5">
            {/* SUMMARY STEP */}
            {step === 'summary' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-medium">{formatDate(event.event_date)}</span>
                  </div>
                  {event.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                      <span className="truncate">{event.address}{event.city ? `, ${event.city}` : ''}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4 text-info flex-shrink-0" />
                    <span>{event.current_attendees} attending{event.max_attendees ? ` of ${event.max_attendees}` : ''}</span>
                  </div>
                </div>

                {/* Attendee Info */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {profile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{profile?.full_name || 'You'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>

                {/* Pricing */}
                {!event.is_free ? (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Ticket Price (1x)</span>
                      <span className="font-medium">{formatCurrency(event.ticket_price)}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-3">
                      <span className="text-muted-foreground">Platform Fee</span>
                      <span className="text-success font-medium">FREE</span>
                    </div>
                    <div className="border-t border-primary/20 pt-3 flex justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="text-lg font-bold text-primary">{formatCurrency(event.ticket_price)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-success/5 border border-success/20 text-center">
                    <p className="text-success font-bold text-xl">Free Event</p>
                    <p className="text-xs text-muted-foreground mt-1">No payment required — get your ticket instantly!</p>
                  </div>
                )}

                {event.approval_type === 'host_approval' && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
                    <Shield className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">This event requires host approval. Your request will be sent to the host.</p>
                  </div>
                )}

                <button
                  onClick={event.is_free ? handleFreeJoin : () => setStep('payment')}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50 text-base"
                >
                  {event.is_free ? (
                    <>
                      <Ticket className="w-5 h-5" />
                      Confirm &amp; Get Ticket
                    </>
                  ) : (
                    <>
                      Proceed to Payment
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* PAYMENT METHOD STEP */}
            {step === 'payment' && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Select your preferred payment method</p>

                <div className="space-y-2">
                  {([
                    { id: 'demo' as PaymentMethod, label: 'Demo / Test Payment', icon: <Shield className="w-5 h-5" />, desc: 'Simulate payment instantly (recommended for testing)' },
                    { id: 'upi' as PaymentMethod, label: 'UPI / GPay / PhonePe', icon: <Smartphone className="w-5 h-5" />, desc: 'Pay via any UPI app' },
                    { id: 'card' as PaymentMethod, label: 'Credit / Debit Card', icon: <CreditCard className="w-5 h-5" />, desc: 'Visa, Mastercard, RuPay' },
                    { id: 'netbanking' as PaymentMethod, label: 'Net Banking', icon: <Building2 className="w-5 h-5" />, desc: 'All major Indian banks' },
                  ]).map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                        paymentMethod === method.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        paymentMethod === method.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground'
                      }`}>
                        {method.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        paymentMethod === method.id ? 'border-primary' : 'border-border'
                      }`}>
                        {paymentMethod === method.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                      </div>
                    </button>
                  ))}
                </div>

                {paymentMethod === 'upi' && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Enter UPI ID</label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@upi"
                      className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40">
                  <span className="text-sm font-medium">Amount to pay</span>
                  <span className="text-xl font-bold text-primary">{formatCurrency(event.ticket_price)}</span>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-success" />
                  <span>100% secure &amp; encrypted payment</span>
                </div>

                <button
                  onClick={handlePaidCheckout}
                  disabled={isProcessing}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity disabled:opacity-50 text-base"
                >
                  <IndianRupee className="w-5 h-5" />
                  Pay {formatCurrency(event.ticket_price)}
                </button>
              </div>
            )}

            {/* PROCESSING STEP */}
            {step === 'processing' && (
              <div className="py-12 text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <h3 className="text-lg font-bold mb-2">
                  {event.is_free ? 'Securing your spot...' : 'Processing payment...'}
                </h3>
                <p className="text-sm text-muted-foreground">Please wait a moment</p>
                <p className="text-xs text-muted-foreground mt-2 opacity-70">Do not close or refresh this page</p>
              </div>
            )}

            {/* SUCCESS STEP */}
            {step === 'success' && (
              <div className="py-4 text-center space-y-5">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="w-24 h-24 mx-auto rounded-full bg-success/10 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-success" />
                </motion.div>

                <div>
                  <h3 className="text-xl font-bold mb-2">
                    {event.approval_type === 'host_approval' && event.is_free
                      ? 'Request Sent!'
                      : "You're All Set!"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {event.approval_type === 'host_approval' && event.is_free
                      ? "Your join request has been sent to the host. You'll be notified when approved."
                      : 'Your registration is confirmed and your ticket is ready!'}
                  </p>
                </div>

                {ticketId && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-5 rounded-2xl bg-secondary/30 border border-border relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
                    <QrCode className="w-20 h-20 mx-auto mb-3 text-foreground relative z-10" />
                    <p className="text-xs text-muted-foreground relative z-10">Your QR ticket is ready to use</p>
                    <div className="mt-2 px-3 py-1.5 rounded-lg bg-primary/10 inline-block">
                      <p className="text-xs font-mono font-bold text-primary">Tap "View Ticket" to see your pass</p>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { onClose(); onSuccess(ticketId); }}
                    className="flex-1 py-3.5 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors"
                  >
                    Done
                  </button>
                  {ticketId && (
                    <button
                      onClick={() => navigate('/tickets')}
                      className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                    >
                      <Ticket className="w-4 h-4" />
                      View Ticket
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* FAILED STEP */}
            {step === 'failed' && (
              <div className="py-4 text-center space-y-5">
                <div className="w-24 h-24 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-12 h-12 text-destructive" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Something went wrong</h3>
                  <p className="text-sm text-muted-foreground">{error || 'Payment could not be processed. Please try again.'}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3.5 rounded-xl bg-secondary border border-border text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { setStep(event.is_free ? 'summary' : 'payment'); setError(''); }}
                    className="flex-1 py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// PaymentStatusModal - kept for backward compatibility
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
            <p className="text-sm text-muted-foreground mb-6">Your ticket has been generated. View it in My Tickets.</p>
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
            <p className="text-sm text-muted-foreground mb-6">Something went wrong. Please try again.</p>
            <button onClick={onClose} className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
              Try Again
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
