import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { QrCode, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { EmptyState, PageLoader } from '@/components/common';
import { cn, formatDate } from '@/lib/utils';
import type { EventTicket } from '@/types';

export function TicketsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'used' | 'cancelled'>('active');

  useEffect(() => { if (user) loadTickets(); }, [user]);

  const loadTickets = async () => {
    try {
      const { data } = await supabase
        .from('event_tickets').select('*, event:events(*, category:event_categories(*))')
        .eq('user_id', user!.id).order('created_at', { ascending: false });
      setTickets((data || []) as EventTicket[]);
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const filteredTickets = tickets.filter((t) => t.status === activeTab);

  if (isLoading) return <PageLoader />;

  return (
    <div className="px-4 py-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">{t('tickets.title')}</h1>

      <div className="flex gap-1 p-1 rounded-xl bg-secondary/30 mb-4">
        {(['active', 'used', 'cancelled'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={cn('flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors capitalize', activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>
            {t(`tickets.${tab}`)}
          </button>
        ))}
      </div>

      {filteredTickets.length > 0 ? (
        <div className="space-y-3">
          {filteredTickets.map((ticket, i) => (
            <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="rounded-2xl bg-card border border-border overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">{ticket.event?.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ticket.event?.event_date ? formatDate(ticket.event.event_date) : ''}
                    </p>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold',
                    ticket.status === 'active' ? 'bg-success/20 text-success' :
                    ticket.status === 'used' ? 'bg-info/20 text-info' :
                    'bg-destructive/20 text-destructive'
                  )}>
                    {ticket.status}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-border">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Ticket Number</p>
                    <p className="text-sm font-mono font-semibold">{ticket.ticket_number}</p>
                  </div>
                  <div className="w-16 h-16 rounded-lg bg-white p-1 flex items-center justify-center">
                    <QrCode className="w-12 h-12 text-black" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<QrCode className="w-8 h-8 text-muted-foreground" />}
          title={t('tickets.noTickets')}
          description={t('tickets.noTicketsDescription')}
        />
      )}
    </div>
  );
}

export function ScanPage() {
  const { t } = useTranslation();
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'success' | 'error' | null>(null);

  const handleScan = async (qrData: string) => {
    setScanResult(qrData);
    setIsVerifying(true);
    try {
      const { data: ticket } = await supabase
        .from('event_tickets').select('*, event:events(*)').eq('qr_code_data', qrData).eq('status', 'active').single();
      if (ticket) {
        await supabase.from('event_tickets').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', ticket.id);
        await supabase.from('event_checkins').insert({ event_id: ticket.event_id, ticket_id: ticket.id, user_id: ticket.user_id });
        setVerificationResult('success');
      } else {
        setVerificationResult('error');
      }
    } catch { setVerificationResult('error'); }
    finally { setIsVerifying(false); }
  };

  return (
    <div className="px-4 py-4 max-w-lg mx-auto text-center">
      <h1 className="text-xl font-bold mb-4">{t('tickets.scanQR')}</h1>
      <div className="w-full aspect-square max-w-xs mx-auto rounded-2xl bg-secondary/30 border-2 border-dashed border-border flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <QrCode className="w-16 h-16 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Camera will open here</p>
          <p className="text-xs mt-1">Point at QR code to scan</p>
        </div>
      </div>

      {isVerifying && <div className="mt-6"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>}
      {verificationResult === 'success' && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 p-4 rounded-2xl bg-success/10 border border-success/30">
          <Check className="w-12 h-12 text-success mx-auto mb-2" />
          <p className="text-lg font-bold text-success">Valid Ticket!</p>
          <p className="text-sm text-muted-foreground">Attendance marked</p>
        </motion.div>
      )}
      {verificationResult === 'error' && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/30">
          <X className="w-12 h-12 text-destructive mx-auto mb-2" />
          <p className="text-lg font-bold text-destructive">Invalid Ticket</p>
          <p className="text-sm text-muted-foreground">Ticket not found or already used</p>
        </motion.div>
      )}
    </div>
  );
}
