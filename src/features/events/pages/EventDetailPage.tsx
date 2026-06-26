import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, MapPin, Users, Clock, Share2, Bookmark, ChevronLeft,
  Star, Shield, Tag, Info, CheckCircle2, Loader2, Ticket, LogIn, Send, X, Flag
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { cn, formatCurrency, formatDate, formatTime, getDistanceKm } from '@/lib/utils';
import { useLocationContext } from '@/context/LocationContext';
import { PageLoader } from '@/components/common';
import { EventCard } from '@/features/events/components/EventCard';
import { CheckoutModal } from '@/features/payments/RazorpayPayment';
import type { Event, Review, EventAttendee, EventWaitlist } from '@/types';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, isAuthenticated, profile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [pendingAttendees, setPendingAttendees] = useState<EventAttendee[]>([]);
  const [waitlistQueue, setWaitlistQueue] = useState<EventWaitlist[]>([]);
  const [similarEvents, setSimilarEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [attendeeStatus, setAttendeeStatus] = useState<string | null>(null);
  const [hasTicket, setHasTicket] = useState(false);
  const [isOnWaitlist, setIsOnWaitlist] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews' | 'attendees' | 'requests'>('about');
  const [showCheckout, setShowCheckout] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<'spam' | 'scam' | 'harassment' | 'fake_event' | 'inappropriate_content' | 'other'>('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { userCoords } = useLocationContext();

  const distance = userCoords && event?.latitude && event?.longitude
    ? getDistanceKm(userCoords.lat, userCoords.lng, event.latitude, event.longitude)
    : null;

  const allImages = event
    ? [
        ...(event.banner_url ? [event.banner_url] : []),
        ...(event.images || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((img: any) => img.image_url)
      ]
    : [];

  useEffect(() => {
    if (id) loadEvent();
  }, [id, user]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && ['about', 'reviews', 'attendees', 'requests'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [location.search]);

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

        if (user) {
          // Check saved status
          const { data: savedData } = await supabase
            .from('saved_events')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsSaved(!!savedData);

          // Check attendee status
          const { data: attendeeData } = await supabase
            .from('event_attendees')
            .select('status')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setAttendeeStatus(attendeeData?.status || null);

          // Check if active ticket exists
          const { data: ticketData } = await supabase
            .from('event_tickets')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();
          setHasTicket(!!ticketData);

          // Load pending requests and waitlist queue if host
          if (eventData.host_id === user.id) {
            if (eventData.approval_type === 'host_approval') {
              const { data: pendingData } = await supabase
                .from('event_attendees')
                .select('*, profile:profiles(*)')
                .eq('event_id', id)
                .eq('status', 'pending');
              setPendingAttendees((pendingData || []) as EventAttendee[]);
            }
            if (eventData.waitlist_enabled) {
              const { data: waitlistQueueData } = await supabase
                .from('event_waitlists')
                .select('*, profile:profiles(*)')
                .eq('event_id', id)
                .order('position', { ascending: true });
              setWaitlistQueue((waitlistQueueData || []) as EventWaitlist[]);
            }
          }

          // Check if on waitlist
          const { data: waitlistData } = await supabase
            .from('event_waitlists')
            .select('id')
            .eq('event_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setIsOnWaitlist(!!waitlistData);
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

  const handleJoinClick = () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: location } });
      return;
    }

    if (event) {
      // 1. Gender Validation
      if (event.gender_restriction === 'male_only' && profile?.gender !== 'male') {
        alert('This event is restricted to male participants only.');
        return;
      }
      if (event.gender_restriction === 'female_only' && profile?.gender !== 'female') {
        alert('This event is restricted to female participants only.');
        return;
      }

      // 2. Age Validation
      if (profile?.date_of_birth) {
        const birthDate = new Date(profile.date_of_birth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < event.min_age || age > event.max_age) {
          alert(`You must be between ${event.min_age} and ${event.max_age} years old to join this event.`);
          return;
        }
      } else {
        if (event.min_age > 18 || event.max_age < 99) {
          alert('Please complete your profile details (date of birth) to join this event.');
          return;
        }
      }
    }

    setShowCheckout(true);
  };

  const handleCheckoutSuccess = (_ticketId: string) => {
    // Reload to show updated attendee status
    loadEvent();
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
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard?.writeText(window.location.href);
    }
  };

  const handleApproveRequest = async (attendeeId: string, attendeeUserId: string) => {
    if (!event) return;
    try {
      const { error } = await supabase
        .from('event_attendees')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', attendeeId);

      if (error) throw error;

      // If it's a free event, create an active ticket immediately
      if (event.is_free) {
        const ticketNumber = 'VL-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const qrData = `vibeloop:ticket:${ticketNumber}:${event.id}:${attendeeUserId}`;
        await supabase
          .from('event_tickets')
          .insert({
            user_id: attendeeUserId,
            event_id: event.id,
            attendee_id: attendeeId,
            ticket_number: ticketNumber,
            qr_code_data: qrData,
            status: 'active',
          });
      }

      loadEvent();
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request');
    }
  };

  const handleRejectRequest = async (attendeeId: string) => {
    try {
      const { error } = await supabase
        .from('event_attendees')
        .update({ status: 'rejected', cancelled_at: new Date().toISOString() })
        .eq('id', attendeeId);

      if (error) throw error;
      loadEvent();
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Failed to reject request');
    }
  };

  const handleApproveWaitlist = async (waitlistId: string, waitlistUserId: string) => {
    if (!event) return;
    try {
      // 1. Promote to approved attendee (using upsert in case a record already exists)
      const { data: attendeeData, error: attendeeError } = await supabase
        .from('event_attendees')
        .upsert(
          {
            event_id: event.id,
            user_id: waitlistUserId,
            status: 'approved',
            approved_at: new Date().toISOString()
          },
          { onConflict: 'event_id,user_id' }
        )
        .select('id')
        .single();

      if (attendeeError) throw attendeeError;

      // 1.5 Increment max_attendees if event has a limit
      if (event.max_attendees !== null) {
        const { error: maxError } = await supabase
          .from('events')
          .update({ max_attendees: event.max_attendees + 1 })
          .eq('id', event.id);
        if (maxError) throw maxError;
      }

      // 2. Generate ticket if event is free
      if (event.is_free) {
        const ticketNumber = 'VL-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const qrData = `vibeloop:ticket:${ticketNumber}:${event.id}:${waitlistUserId}`;
        await supabase
          .from('event_tickets')
          .insert({
            user_id: waitlistUserId,
            event_id: event.id,
            attendee_id: attendeeData.id,
            ticket_number: ticketNumber,
            qr_code_data: qrData,
            status: 'active',
          });
      }

      // 3. Remove waitlist record
      await supabase
        .from('event_waitlists')
        .delete()
        .eq('id', waitlistId);

      // 4. Reorder remaining waitlist entries
      const { data: remaining } = await supabase
        .from('event_waitlists')
        .select('id')
        .eq('event_id', event.id)
        .order('position', { ascending: true });

      if (remaining && remaining.length > 0) {
        for (let i = 0; i < remaining.length; i++) {
          await supabase
            .from('event_waitlists')
            .update({ position: i + 1 })
            .eq('id', remaining[i].id);
        }
      }

      alert('User successfully promoted from waitlist!');
      loadEvent();
    } catch (err) {
      console.error('Error promoting waitlist user:', err);
      alert('Failed to promote user from waitlist');
    }
  };

  const handleRemoveFromWaitlist = async (waitlistId: string) => {
    if (!event) return;
    const confirmRemove = window.confirm('Are you sure you want to remove this user from the waitlist?');
    if (!confirmRemove) return;

    try {
      // 1. Remove waitlist record
      await supabase
        .from('event_waitlists')
        .delete()
        .eq('id', waitlistId);

      // 2. Reorder remaining waitlist entries
      const { data: remaining } = await supabase
        .from('event_waitlists')
        .select('id')
        .eq('event_id', event.id)
        .order('position', { ascending: true });

      if (remaining && remaining.length > 0) {
        for (let i = 0; i < remaining.length; i++) {
          await supabase
            .from('event_waitlists')
            .update({ position: i + 1 })
            .eq('id', remaining[i].id);
        }
      }

      alert('User removed from waitlist.');
      loadEvent();
    } catch (err) {
      console.error('Error removing waitlist user:', err);
      alert('Failed to remove user from waitlist');
    }
  };

  const handleJoinWaitlist = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: location } });
      return;
    }
    if (!event || !user) return;

    // 1. Gender Validation
    if (event.gender_restriction === 'male_only' && profile?.gender !== 'male') {
      alert('This event is restricted to male participants only.');
      return;
    }
    if (event.gender_restriction === 'female_only' && profile?.gender !== 'female') {
      alert('This event is restricted to female participants only.');
      return;
    }

    // 2. Age Validation
    if (profile?.date_of_birth) {
      const birthDate = new Date(profile.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < event.min_age || age > event.max_age) {
        alert(`You must be between ${event.min_age} and ${event.max_age} years old to join this event.`);
        return;
      }
    } else {
      if (event.min_age > 18 || event.max_age < 99) {
        alert('Please complete your profile details (date of birth) to join this event.');
        return;
      }
    }

    const confirmJoin = window.confirm('Would you like to join the waitlist for this event? We will notify you if a spot opens up.');
    if (!confirmJoin) return;

    try {
      const { count } = await supabase
        .from('event_waitlists')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id);

      const position = (count || 0) + 1;

      const { error } = await supabase
        .from('event_waitlists')
        .insert({
          event_id: event.id,
          user_id: user.id,
          position: position
        });

      if (error) throw error;
      
      alert('You have successfully joined the waitlist!');
      loadEvent();
    } catch (err) {
      console.error('Error joining waitlist:', err);
      alert('Failed to join waitlist. Please try again.');
    }
  };

  const startDirectChat = async (targetUserId: string) => {
    if (!user) {
      alert('Please log in to chat.');
      return;
    }
    if (user.id === targetUserId) {
      alert("You can't chat with yourself.");
      return;
    }

    try {
      // 1. Find rooms where the current user is a member
      const { data: myRooms } = await supabase
        .from('chat_room_members')
        .select('room_id')
        .eq('user_id', user.id);

      const myRoomIds = (myRooms || []).map((r: any) => r.room_id);

      let existingRoomId: string | null = null;

      if (myRoomIds.length > 0) {
        // 2. Find if any of these rooms are of type 'direct' and also have the target user as a member
        const { data: commonRooms } = await supabase
          .from('chat_room_members')
          .select('room_id')
          .in('room_id', myRoomIds)
          .eq('user_id', targetUserId);

        const commonRoomIds = (commonRooms || []).map((r: any) => r.room_id);

        if (commonRoomIds.length > 0) {
          const { data: directRoom } = await supabase
            .from('chat_rooms')
            .select('id')
            .in('id', commonRoomIds)
            .eq('type', 'direct')
            .maybeSingle();

          if (directRoom) {
            existingRoomId = directRoom.id;
          }
        }
      }

      if (existingRoomId) {
        navigate(`/chat/${existingRoomId}`);
      } else {
        // 3. Create a new chat room of type 'direct'
        const { data: newRoom, error: roomError } = await supabase
          .from('chat_rooms')
          .insert({
            type: 'direct',
            name: null,
            is_active: true
          })
          .select('id')
          .single();

        if (roomError) throw roomError;
        if (!newRoom) throw new Error('Failed to create chat room');

        // 4. Add both members to the room
        const { error: membersError } = await supabase
          .from('chat_room_members')
          .insert([
            { room_id: newRoom.id, user_id: user.id },
            { room_id: newRoom.id, user_id: targetUserId }
          ]);

        if (membersError) throw membersError;

        navigate(`/chat/${newRoom.id}`);
      }
    } catch (error) {
      console.error('Error starting direct chat:', error);
      alert('Failed to start chat. Please try again.');
    }
  };

  const handleReportEvent = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { from: location } });
      return;
    }
    if (!event || !user) return;

    setIsReporting(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          target_type: 'event',
          target_id: event.id,
          reason: reportReason,
          description: reportDescription.trim() || null,
          status: 'pending'
        });

      if (error) throw error;

      alert('Thank you. The event has been reported. Our moderators will review it.');
      setShowReportModal(false);
      setReportDescription('');
    } catch (err: any) {
      console.error('Error reporting event:', err);
      alert('Failed to submit report. Please try again.');
    } finally {
      setIsReporting(false);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!event) return (
    <div className="p-8 text-center">
      <p className="text-muted-foreground">Event not found</p>
      <Link to="/" className="mt-4 inline-block text-primary text-sm font-medium">Go Home</Link>
    </div>
  );

  const slotsLeft = event.max_attendees ? event.max_attendees - event.current_attendees : null;
  const isSoldOut = slotsLeft !== null && slotsLeft <= 0;
  const isHost = user?.id === event.host_id;

  const getJoinButtonContent = () => {
    if (isHost) {
      return (
        <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-secondary border border-border text-muted-foreground font-medium text-sm">
          <Shield className="w-4 h-4" />
          Your Event
        </div>
      );
    }

    const needsApproval = event.approval_type === 'host_approval';

    if (attendeeStatus === 'pending') {
      return (
        <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-warning/10 text-warning font-medium">
          <Clock className="w-5 h-5" />
          {t('events.pendingApproval')}
        </div>
      );
    }

    if (attendeeStatus === 'approved') {
      if (!event.is_free && !hasTicket) {
        return (
          <button
            onClick={handleJoinClick}
            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/25"
          >
            <Ticket className="w-4 h-4" />
            Buy Ticket
          </button>
        );
      }

      return (
        <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-success/10 text-success font-medium">
          <CheckCircle2 className="w-5 h-5" />
          {t('events.joined')}
        </div>
      );
    }

    if (isSoldOut) {
      if (isOnWaitlist) {
        return (
          <div className="flex items-center gap-2 px-6 py-3 rounded-xl bg-warning/10 text-warning font-medium">
            <Clock className="w-5 h-5" />
            {t('events.onWaitlist')}
          </div>
        );
      }

      if (event.waitlist_enabled) {
        return (
          <button
            onClick={handleJoinWaitlist}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/25"
          >
            <Clock className="w-4 h-4" />
            {t('events.waitlist')}
          </button>
        );
      }

      return (
        <button
          disabled
          className="px-6 py-3 rounded-xl bg-muted text-muted-foreground font-medium"
        >
          {t('events.soldOut')}
        </button>
      );
    }

    if (!isAuthenticated) {
      return (
        <button
          onClick={handleJoinClick}
          className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/25"
        >
          <LogIn className="w-4 h-4" />
          {needsApproval ? 'Request to Join' : (event.is_free ? 'Join Free' : 'Buy Ticket')}
        </button>
      );
    }

    return (
      <button
        onClick={handleJoinClick}
        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-primary/25"
      >
        <Ticket className="w-4 h-4" />
        {needsApproval ? 'Request to Join' : (event.is_free ? t('events.join') : 'Buy Ticket')}
      </button>
    );
  };

  return (
    <div className="pb-28">
      {/* Banner */}
      <div className="relative aspect-video sm:aspect-[21/9] bg-secondary overflow-hidden group/banner">
        {allImages.length > 0 ? (
          <motion.img 
            key={activeImageIndex}
            src={allImages[activeImageIndex]} 
            alt={event.title} 
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <div className="w-full h-full gradient-primary opacity-80 flex items-center justify-center">
            <span className="text-6xl">{event.category?.icon || '🎉'}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />

        {/* Carousel controls */}
        {allImages.length > 1 && (
          <>
            <button
              onClick={() => setActiveImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors opacity-0 group-hover/banner:opacity-100 z-10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1))}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/60 transition-colors opacity-0 group-hover/banner:opacity-100 z-10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {allImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all cursor-pointer",
                    activeImageIndex === i ? "bg-white w-4" : "bg-white/50"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

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

        {/* Badges */}
        <div className="absolute bottom-4 left-4 flex gap-2 flex-wrap">
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
                <p className="text-sm font-medium truncate">
                  {event.address}
                  {distance !== null && distance !== undefined && ` (${distance.toFixed(1)} km away)`}
                </p>
                <p className="text-xs text-muted-foreground">{event.city}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <span>
                  {event.current_attendees}{event.max_attendees ? ` / ${event.max_attendees}` : ''} attending
                </span>
                {event.waitlist_enabled && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning/10 text-warning uppercase tracking-wider">
                    Waitlist Active
                  </span>
                )}
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
          <div className="flex items-center justify-between mt-4 p-3 rounded-xl bg-card border border-border">
            <Link
              to={`/profile/${event.host.id}`}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {event.host.avatar_url ? (
                  <img src={event.host.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-primary">{event.host.full_name?.[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{event.host.full_name}</p>
                  {event.host.is_verified_host && <Shield className="w-4 h-4 text-primary flex-shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground">Host • {event.host.events_hosted} events</p>
              </div>
            </Link>
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              {event.avg_rating > 0 && (
                <div className="flex items-center gap-1 bg-secondary/50 px-2.5 py-1 rounded-lg flex-shrink-0">
                  <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                  <span className="text-xs font-semibold">{event.avg_rating.toFixed(1)}</span>
                </div>
              )}
              {!isHost && isAuthenticated && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startDirectChat(event.host_id);
                  }}
                  className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                  title="Chat with Host"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-6 p-1 rounded-xl bg-secondary/30">
          {[
            { id: 'about', label: t('events.about') },
            { id: 'reviews', label: t('events.reviews') },
            { id: 'attendees', label: t('events.attendees') },
            ...(isHost && (event.approval_type === 'host_approval' || event.waitlist_enabled) ? [{
              id: 'requests',
              label: event.approval_type === 'host_approval' && event.waitlist_enabled
                ? `Requests & Queue (${pendingAttendees.length + waitlistQueue.length})`
                : event.waitlist_enabled
                  ? `Waitlist Queue (${waitlistQueue.length})`
                  : `Requests (${pendingAttendees.length})`
            }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors capitalize',
                activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              {tab.label}
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
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" /> Restrictions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {event.gender_restriction !== 'anyone' && (
                      <span className="px-3 py-1 rounded-full text-xs bg-secondary border border-border capitalize">
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
            isHost ? (
              <div className="space-y-2">
                {attendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-border/80 transition-colors">
                    <Link to={`/profile/${attendee.user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {attendee.profile?.avatar_url ? (
                          <img src={attendee.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-bold text-primary">{attendee.profile?.full_name?.[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{attendee.profile?.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{attendee.profile?.username}</p>
                      </div>
                    </Link>
                    {attendee.user_id !== user?.id && (
                      <button
                        onClick={() => startDirectChat(attendee.user_id)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors flex-shrink-0 ml-2"
                      >
                        Chat
                      </button>
                    )}
                  </div>
                ))}
                {attendees.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8 bg-card rounded-xl border border-border border-dashed">
                    No attendees yet
                  </p>
                )}
              </div>
            ) : (
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
                  <p className="col-span-full text-center text-sm text-muted-foreground py-8">Be the first to join!</p>
                )}
              </div>
            )
          )}

          {activeTab === 'requests' && (
            <div className="space-y-6">
              {event.approval_type === 'host_approval' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Join Requests ({pendingAttendees.length})
                  </h3>
                  {pendingAttendees.length > 0 ? (
                    pendingAttendees.map((attendee) => (
                      <div key={attendee.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-border/80 transition-colors">
                        <Link to={`/profile/${attendee.user_id}`} className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {attendee.profile?.avatar_url ? (
                              <img src={attendee.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-primary">{attendee.profile?.full_name?.[0]}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{attendee.profile?.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">@{attendee.profile?.username}</p>
                          </div>
                        </Link>
                        <div className="flex gap-2 flex-shrink-0 ml-2">
                          <button
                            onClick={() => startDirectChat(attendee.user_id)}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                          >
                            Chat
                          </button>
                          <button
                            onClick={() => handleRejectRequest(attendee.id)}
                            className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleApproveRequest(attendee.id, attendee.user_id)}
                            className="px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-semibold hover:bg-success/20 transition-colors"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6 bg-card rounded-xl border border-border border-dashed">
                      No pending requests
                    </p>
                  )}
                </div>
              )}

              {event.waitlist_enabled && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Waitlist Queue ({waitlistQueue.length})
                  </h3>
                  {waitlistQueue.length > 0 ? (
                    <div className="space-y-3">
                      {waitlistQueue.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-border/80 transition-colors">
                          <Link to={`/profile/${entry.user_id}`} className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {entry.profile?.avatar_url ? (
                                <img src={entry.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold text-primary">{entry.profile?.full_name?.[0]}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate">{entry.profile?.full_name}</p>
                                <span className="px-2 py-0.5 rounded-md bg-warning/10 text-warning text-[10px] font-bold flex-shrink-0">
                                  #{entry.position}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">@{entry.profile?.username}</p>
                            </div>
                          </Link>
                          <div className="flex gap-2 flex-shrink-0 ml-2">
                            <button
                              onClick={() => startDirectChat(entry.user_id)}
                              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                            >
                              Chat
                            </button>
                            <button
                              onClick={() => handleRemoveFromWaitlist(entry.id)}
                              className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                            >
                              Remove
                            </button>
                            <button
                              onClick={() => handleApproveWaitlist(entry.id, entry.user_id)}
                              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                            >
                              Promote
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-6 bg-card rounded-xl border border-border border-dashed">
                      Waitlist is empty
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Share & Report Option for Public Events */}
        {event.event_type === 'public' && (
          <div className="mt-8 p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-semibold">Share or report this event</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Public events can be shared with anyone or reported if they violate guidelines.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleShare}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate('/auth/login', { state: { from: location } });
                  } else {
                    setShowReportModal(true);
                  }
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                Report
              </button>
            </div>
          </div>
        )}

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
      <div className="fixed bottom-0 left-0 right-0 z-40 glass-strong safe-bottom border-t border-border/50 p-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1">
            {!event.is_free && (
              <p className="text-lg font-bold">
                {formatCurrency(event.ticket_price)}
                <span className="text-xs text-muted-foreground font-normal ml-1">{t('events.perPerson')}</span>
              </p>
            )}
            {event.is_free && <p className="text-lg font-bold text-success">Free Entry</p>}
            {slotsLeft !== null && slotsLeft > 0 && slotsLeft <= 5 && (
              <p className="text-xs text-destructive font-medium">Only {slotsLeft} spots left!</p>
            )}
          </div>

          {getJoinButtonContent()}
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && event && (
        <CheckoutModal
          event={event}
          attendeeStatus={attendeeStatus}
          hasTicket={hasTicket}
          onClose={() => setShowCheckout(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Report Event Modal */}
      <AnimatePresence>
        {showReportModal && event && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isReporting) setShowReportModal(false);
            }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-2xl overflow-hidden border border-border shadow-2xl max-h-[90dvh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border bg-card z-10">
                <div>
                  <h2 className="text-lg font-bold">Report Event</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{event.title}</p>
                </div>
                <button
                  onClick={() => setShowReportModal(false)}
                  disabled={isReporting}
                  className="p-1 rounded-full hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body / Form */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="text-sm font-semibold block mb-2">Why are you reporting this event?</label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'spam', label: 'Spam', desc: 'Repetitive, misleading, or promotional content' },
                      { id: 'scam', label: 'Scam or fraud', desc: 'Financial fraud, ticket scams, or deceptive information' },
                      { id: 'harassment', label: 'Harassment', desc: 'Threatening language or personal attacks' },
                      { id: 'fake_event', label: 'Fake event', desc: 'Event is non-existent, fake location, or hosts won\'t show up' },
                      { id: 'inappropriate_content', label: 'Inappropriate content', desc: 'Explicit, offensive, or hateful content' },
                      { id: 'other', label: 'Other issue', desc: 'Any other violation of terms' },
                    ].map((reason) => (
                      <button
                        key={reason.id}
                        type="button"
                        onClick={() => setReportReason(reason.id as any)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-0.5",
                          reportReason === reason.id
                            ? "border-primary bg-primary/5 text-foreground shadow-sm shadow-primary/5"
                            : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                        )}
                      >
                        <span className={cn("text-xs font-semibold", reportReason === reason.id && "text-primary")}>
                          {reason.label}
                        </span>
                        <span className="text-[10px] opacity-80">{reason.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label className="font-semibold">Description (Optional)</label>
                    <span className={cn(reportDescription.length > 500 ? "text-destructive" : "text-muted-foreground")}>
                      {reportDescription.length}/500
                    </span>
                  </div>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value.slice(0, 500))}
                    placeholder="Provide additional details to help our moderators review this report..."
                    rows={4}
                    disabled={isReporting}
                    className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary disabled:opacity-50 resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-border bg-card flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  disabled={isReporting}
                  className="flex-1 py-3 rounded-xl bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReportEvent}
                  disabled={isReporting}
                  className="flex-1 py-3 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg shadow-destructive/15"
                >
                  {isReporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Report'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
