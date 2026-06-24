import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { EventCard } from '@/features/events/components/EventCard';
import { EmptyState, PageLoader } from '@/components/common';
import type { Event } from '@/types';

export function SavedEventsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { if (user) loadSaved(); }, [user]);

  const loadSaved = async () => {
    try {
      const { data } = await supabase
        .from('saved_events').select('event:events(*, host:profiles(*), category:event_categories(*))')
        .eq('user_id', user!.id).order('created_at', { ascending: false });
      setEvents(((data || []).map((d: any) => ({ ...d.event, is_saved: true })).filter(Boolean)) as Event[]);
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">{t('events.saved')}</h1>
      {events.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {events.map((event, i) => <EventCard key={event.id} event={event} index={i} />)}
        </div>
      ) : (
        <EmptyState
          icon={<Bookmark className="w-8 h-8 text-muted-foreground" />}
          title="No saved events"
          description="Events you save will appear here"
        />
      )}
    </div>
  );
}
