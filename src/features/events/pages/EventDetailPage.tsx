import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Calendar, MapPin, Users, Clock, Share2, Bookmark, Flag, ChevronLeft,
  Star, Shield, Heart, Tag, Info, CheckCircle2, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { cn, formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { PageLoader } from '@/components/common';
import { EventCard } from '@/features/events/components/EventCard';
import { useRazorpay, PaymentStatusModal } from '@/features/payments/RazorpayPayment';
import type { Event, Review, EventAttendee } from '@/types';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [similarEvents, setSimilarEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [attendeeStatus, setAttendeeStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews' | 'attendees'>('about');

  const navigate = useNavigate();
  const location = useLocation();
  const { initiatePayment, isProcessing, paymentStatus } = useRazorpay();
  const [ticketId, setTicketId] = useState<string | undefined>(undefined);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    if (id) loadEvent();
  }, [id]);

  const loadEvent = async () => {
    setIsLoading(true);
    try {
      const { data: eventData } = await supabase
        .from('events')
        .select('*, host:profiles(*), category:event_categories(*), images:event_images(*)')
        .eq('id', id)
        .single();

      if (eventData) {
        setEvent(eventData as Event);

        // Load reviews
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('*, user:profiles(*)')
          .eq('event_id', id)
          .order('created_at', { ascending: false })
          .limit(10);
        setReviews((reviewsData || []) as Review[]);

        // Load attendees
        const { data: attendeesData } = await supabase
          .from('event_attendees')
          .select('*, profile:profiles(*)')
          .eq('event_id', id)
          .eq('status', 'approved')
          .limit(20);
        setAttendees((attendeesData || []) as EventAttendee[]);

        // Check saved status
        if (user) {
          const { data: savedData } = await supabase
            .from('saved_events')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsSaved(!!savedData);

          const { data: attendeeData } = await supabase
            .from('event_attendees')
            .select('status')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setAttendeeStatus(attendeeData?.status || null);
        }

        // Similar events
        if (eventData.category_id) {
          const { data: similarData } = await supabase
            .from('events')
            .select('*, host:profiles(*), category:event_categories(*)')
            .eq('category_id', eventData.category_id)
            .neq('id', id)
            .eq('status', 'published')
            .limit(4);
          setSimilarEvents((similarData || []) as Event[]);
        }
      }
    } catch (error) {
      console.error('Error loading event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: location } });
      return;
    }
    if (!event || !user) return;
    setIsJoining(true);
    try {
      if (event.is_free) {
        await supabase.from('event_attendees').insert({
          event_id: event.id,
          user_id: user.id,
          status: event.approval_type === 'instant' ? 'approved' : 'pending',
        });
        setAttendeeStatus(event.approval_type === 'instant' ? 'approved' : 'pending');
        loadEvent(); // Reload list of attendees
      } else {
        // Paid event - run Razorpay checkout
        try {
          const tId = await initiatePayment(event.id, event.ticket_price);
          setTicketId(tId);
          setShowPaymentModal(true);
          setAttendeeStatus('approved');
        } catch (err: any) {
          console.error('Payment failed/cancelled:', err);
          if (err.message !== 'Payment cancelled') {
            setShowPaymentModal(true);
          }
        }
      }
    } catch (error) {
      console.error('Error joining event:', error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleSave = async () => {
    if (!user || !event) return;
    if (isSaved) {
      await supabase.from('saved_events').delete().eq('event_id', event.id).eq('user_id', user.id);
      setIsSaved(false);
    } else {
      await supabase.from('saved_events').insert({ event_id: event.id, user_id: user.id });
      setIsSaved(true);
    }
  };

  const handleShare = async () => {
    if (navigator.share && event) {
      await navigator.share({
        title: event.title,
        text: event.subtitle || event.description || '',
        url: window.location.href,
      });
    }
  };

  if (isLoading) return <PageLoader />;
  if (!event) return <div className="p-4 text-center text-muted-foreground">Event not found</div>;

  const slotsLeft = event.max_attendees ? event.max_attendees - event.current_attendees : null;
  const isSoldOut = slotsLeft !== null && slotsLeft <= 0;

  return (
    <div className="pb-24">
      {/* Banner */}
      <div className="relative aspect-video sm:aspect-[21/9] bg-secondary overflow-hidden">
        {event.banner_url ? (
          <img src={event.banner_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full gradient-primary opacity-80 flex items-center justify-center">
            <span className="text-6xl">{event.category?.icon || '🎉'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

        {/* Back button */}
        <Link
          to="/"
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        {/* Action buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleSave}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <Bookmark className={cn('w-5 h-5', isSaved && 'fill-white')} />
          </button>
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Category + price badges */}
        <div className="absolute bottom-4 left-4 flex gap-2">
          {event.category && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/40 text-white backdrop-blur-sm">
              {event.category.icon} {event.category.name}
            </span>
          )}
          {event.is_free ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-success/90 text-white">Free</span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/90 text-white">
              {formatCurrency(event.ticket_price)}
            </span>
          )}
        </div>
      </div>

      <div className="px-4">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <h1 className="text-2xl font-bold">{event.title}</h1>
          {event.subtitle && <p className="text-muted-foreground mt-1">{event.subtitle}</p>}
        </motion.div>

        {/* Quick info */}
        <div className="grid grid-cols-1 gap-3 mt-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatDate(event.event_date)}</p>
              <p className="text-xs text-muted-foreground">
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </p>
            </div>
          </div>

          {event.address && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{event.address}</p>
                <p className="text-xs text-muted-foreground">{event.city}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {event.current_attendees}{event.max_attendees ? ` / ${event.max_attendees}` : ''} attending
              </p>
              {slotsLeft !== null && slotsLeft > 0 && (
                <p className="text-xs text-muted-foreground">{t('events.slots', { available: slotsLeft })}</p>
              )}
              {isSoldOut && <p className="text-xs text-destructive font-medium">{t('events.soldOut')}</p>}
            </div>
          </div>
        </div>

        {/* Host */}
        {event.host && (
          <Link
            to={`/profile/${event.host.id}`}
            className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-card border border-border hover:bg-secondary/30 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
              {event.host.avatar_url ? (
                <img src={event.host.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-primary">{event.host.full_name?.[0]}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{event.host.full_name}</p>
                {event.host.is_verified_host && (
                  <Shield className="w-4 h-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Host • {event.host.events_hosted} events</p>
            </div>
            {event.avg_rating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-warning text-warning" />
                <span className="text-sm font-semibold">{event.avg_rating.toFixed(1)}</span>
              </div>
            )}
          </Link>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-6 p-1 rounded-xl bg-secondary/30">
          {(['about', 'reviews', 'attendees'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors capitalize',
                activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              {t(`events.${tab}`)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === 'about' && (
            <div className="space-y-4">
              {event.description && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" /> Description
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {event.rules.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Event Rules</h3>
                  <ul className="space-y-1.5">
                    {event.rules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(event.gender_restriction !== 'anyone' || event.min_age > 18 || event.max_age < 99) && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Restrictions</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.gender_restriction !== 'anyone' && (
                      <span className="px-3 py-1 rounded-full text-xs bg-secondary border border-border">
                        {event.gender_restriction.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full text-xs bg-secondary border border-border">
                      Age: {event.min_age}–{event.max_age}
                    </span>
                  </div>
                </div>
              )}

              {event.refund_policy && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Refund Policy</h3>
                  <p className="text-sm text-muted-foreground">{event.refund_policy}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-3">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review.id} className="p-3 rounded-xl bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{review.user?.full_name?.[0]}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{review.user?.full_name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                        <span className="text-sm font-medium">{review.event_rating}</span>
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">{t('reviews.noReviews')}</p>
              )}
            </div>
          )}

          {activeTab === 'attendees' && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {attendees.map((attendee) => (
                <Link
                  key={attendee.id}
                  to={`/profile/${attendee.user_id}`}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-secondary/30 transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                    {attendee.profile?.avatar_url ? (
                      <img src={attendee.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-primary">{attendee.profile?.full_name?.[0]}</span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-center line-clamp-1">{attendee.profile?.full_name}</p>
                </Link>
              ))}
              {attendees.length === 0 && (
                <p className="col-span-full text-center text-sm text-muted-foreground py-8">No attendees yet</p>
              )}
            </div>
          )}
        </div>

        {/* Similar Events */}
        {similarEvents.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-semibold mb-3">{t('events.similarEvents')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {similarEvents.map((e, i) => (
                <EventCard key={e.id} event={e} variant="compact" index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass-strong safe-bottom border-t border-border/50 p-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1">
            {!event.is_free && (
              <p className="text-lg font-bold">
                {formatCurrency(event.ticket_price)}
                <span className="text-xs text-muted-foreground font-normal ml-1">{t('events.perPerson')}</span>
              </p>
            )}
            {event.is_free && <p className="text-lg font-bold text-success">Free</p>}
          </div>

          {attendeeStatus === 'approved' ? (
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-success/10 text-success font-medium">
              <CheckCircle2 className="w-5 h-5" />
              {t('events.joined')}
            </div>
          ) : attendeeStatus === 'pending' ? (
            <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-warning/10 text-warning font-medium">
              <Clock className="w-5 h-5" />
              {t('events.pendingApproval')}
            </div>
          ) : isSoldOut ? (
            <button
              disabled
              className="px-6 py-3 rounded-xl bg-muted text-muted-foreground font-medium"
            >
              {event.waitlist_enabled ? t('events.waitlist') : t('events.soldOut')}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={isJoining || isProcessing}
              className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/25"
            >
              {(isJoining || isProcessing) && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('events.join')}
            </button>
          )}
        </div>
      </div>

      {showPaymentModal && (
        <PaymentStatusModal
          status={paymentStatus === 'success' ? 'success' : 'failed'}
          ticketId={ticketId}
          onClose={() => {
            setShowPaymentModal(false);
            loadEvent();
          }}
        />
      )}
    </div>
  );
}
