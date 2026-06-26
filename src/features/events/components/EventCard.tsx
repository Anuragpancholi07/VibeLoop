import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Heart, Bookmark, Send } from 'lucide-react';
import { cn, formatCurrency, formatDate, formatTime, getDistanceKm } from '@/lib/utils';
import { useLocationContext } from '@/context/LocationContext';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event;
  variant?: 'default' | 'compact' | 'featured';
  className?: string;
  index?: number;
}

export function EventCard({ event, variant = 'default', className, index = 0 }: EventCardProps) {
  const isFeatured = variant === 'featured';
  const isCompact = variant === 'compact';
  const { userCoords } = useLocationContext();

  let distance = event.distance_km;
  if (distance === undefined && userCoords && event.latitude && event.longitude) {
    distance = getDistanceKm(userCoords.lat, userCoords.lng, event.latitude, event.longitude);
  }

  const navigate = useNavigate();
  const { user } = useAuth();

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={`/events/${event.id}`}
        className={cn(
          'block rounded-2xl border border-border bg-card overflow-hidden card-hover',
          isFeatured && 'sm:flex',
          className
        )}
      >
        {/* Image */}
        <div
          className={cn(
            'relative overflow-hidden bg-secondary',
            isCompact ? 'aspect-[2/1]' : 'aspect-video',
            isFeatured && 'sm:w-2/5 sm:aspect-auto sm:min-h-[200px]'
          )}
        >
          {event.banner_url ? (
            <img
              src={event.banner_url}
              alt={event.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full gradient-primary opacity-80 flex items-center justify-center">
              <span className="text-4xl">
                {event.category?.icon || '🎉'}
              </span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {event.is_featured && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-warning/90 text-white backdrop-blur-sm">
                ⭐ Featured
              </span>
            )}
            {event.is_free ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-success/90 text-white backdrop-blur-sm">
                Free
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/90 text-white backdrop-blur-sm">
                {formatCurrency(event.ticket_price)}
              </span>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/50 transition-colors"
            aria-label="Save event"
          >
            <Bookmark
              className={cn('w-4 h-4', event.is_saved ? 'fill-white text-white' : 'text-white')}
            />
          </button>

          {/* Category badge */}
          {event.category && (
            <div className="absolute bottom-3 left-3">
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-black/40 text-white backdrop-blur-sm">
                {event.category.icon} {event.category.name}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn('p-4', isFeatured && 'sm:flex-1 sm:p-5')}>
          <h3 className={cn(
            'font-semibold text-foreground line-clamp-2 mb-1',
            isFeatured ? 'text-lg' : 'text-base'
          )}>
            {event.title}
          </h3>

          {event.subtitle && !isCompact && (
            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{event.subtitle}</p>
          )}

          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="truncate">
                {formatDate(event.event_date)} • {formatTime(event.start_time)}
              </span>
            </div>

            {event.city && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                <span className="truncate">
                  {event.address || event.city}
                  {distance !== undefined && ` • ${distance.toFixed(1)} km`}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-3.5 h-3.5 text-info flex-shrink-0" />
              <span>
                {event.current_attendees}
                {event.max_attendees ? ` / ${event.max_attendees}` : ''} attending
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            {/* Host */}
            <div className="flex items-center gap-2">
              {event.host?.avatar_url ? (
                <img
                  src={event.host.avatar_url}
                  alt={event.host.full_name || ''}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">
                    {event.host?.full_name?.[0] || 'H'}
                  </span>
                </div>
              )}
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                {event.host?.full_name || 'Host'}
                {event.host?.is_verified_host && ' ✓'}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Rating */}
              {event.avg_rating > 0 && (
                <div className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 fill-destructive text-destructive" />
                  <span className="text-xs font-medium">{event.avg_rating.toFixed(1)}</span>
                </div>
              )}
              {/* Chat Button */}
              {(!user || user.id !== event.host_id) && (
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    await startDirectChat(event.host_id);
                  }}
                  className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors ml-1 flex items-center justify-center"
                  title="Chat with Host"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
