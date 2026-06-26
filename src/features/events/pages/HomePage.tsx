import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MapPin, ChevronRight, Sparkles, TrendingUp, Clock, Compass } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { EventCard } from '@/features/events/components/EventCard';
import { CardSkeleton } from '@/components/common';
import type { Event, EventCategory } from '@/types';

export function HomePage() {
  const { t } = useTranslation();
  const { isAuthenticated, profile } = useAuth();
  const { selectedCity } = useLocationContext();
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [nearbyEvents, setNearbyEvents] = useState<Event[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData(selectedCity);
  }, [selectedCity]);

  const loadData = async (city: string) => {
    setIsLoading(true);
    try {
      let featQuery = supabase.from('events').select('*, host:profiles(*), category:event_categories(*)').eq('status', 'published').eq('is_featured', true).limit(5);
      let trendQuery = supabase.from('events').select('*, host:profiles(*), category:event_categories(*)').eq('status', 'published').order('views_count', { ascending: false }).limit(10);
      let nearQuery = supabase.from('events').select('*, host:profiles(*), category:event_categories(*)').eq('status', 'published').order('event_date').limit(10);

      if (city) {
        featQuery = featQuery.ilike('city', city);
        trendQuery = trendQuery.ilike('city', city);
        nearQuery = nearQuery.ilike('city', city);
      }

      const [catRes, featRes, trendRes, nearRes] = await Promise.all([
        supabase.from('event_categories').select('*').eq('is_active', true).order('sort_order'),
        featQuery,
        trendQuery,
        nearQuery,
      ]);
      setCategories((catRes.data || []) as EventCategory[]);
      setFeaturedEvents((featRes.data || []) as Event[]);
      setTrendingEvents((trendRes.data || []) as Event[]);
      setNearbyEvents((nearRes.data || []) as Event[]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pb-4">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4 pt-4 pb-6"
      >
        <div className="rounded-3xl gradient-primary p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative z-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              {isAuthenticated ? `Hey, ${profile?.full_name?.split(' ')[0] || 'there'}! 👋` : t('app.tagline')}
            </h1>
            <p className="text-white/80 text-sm sm:text-base mb-4">
              {t('app.description')}
            </p>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <MapPin className="w-4 h-4" />
              <span>{selectedCity || 'All India'}</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Categories Scroll */}
      <section className="px-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" />
            Categories
          </h2>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-20 h-20 rounded-2xl bg-secondary/50 animate-pulse" />
            ))
          ) : (
            categories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/explore?category=${cat.slug}`}
                  className="flex-shrink-0 w-20 flex flex-col items-center gap-1.5 px-2 py-3 rounded-2xl bg-secondary/30 hover:bg-secondary/50 transition-colors border border-border/50"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <span className="text-[10px] font-medium text-foreground text-center line-clamp-1">
                    {cat.name}
                  </span>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Featured Events */}
      {(isLoading || featuredEvents.length > 0) && (
        <section className="px-4 mb-6">
          <SectionHeader
            icon={<Sparkles className="w-4 h-4 text-warning" />}
            title={t('events.featured')}
            linkTo="/explore?sort=featured"
          />
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[300px]"><CardSkeleton /></div>
              ))
            ) : (
              featuredEvents.map((event, i) => (
                <div key={event.id} className="flex-shrink-0 w-[300px]">
                  <EventCard event={event} index={i} />
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* Trending Events */}
      <section className="px-4 mb-6">
        <SectionHeader
          icon={<TrendingUp className="w-4 h-4 text-destructive" />}
          title={t('events.trending')}
          linkTo="/explore?sort=trending"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : (
            trendingEvents.slice(0, 6).map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))
          )}
        </div>
      </section>

      {/* Nearby Events */}
      <section className="px-4 mb-6">
        <SectionHeader
          icon={<Clock className="w-4 h-4 text-info" />}
          title={t('events.nearby')}
          linkTo="/explore?sort=closest"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          ) : nearbyEvents.length > 0 ? (
            nearbyEvents.slice(0, 6).map((event, i) => (
              <EventCard key={event.id} event={event} index={i} />
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              <p className="text-sm">{t('events.noEvents')}</p>
              <p className="text-xs mt-1">{t('events.noEventsDescription')}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ icon, title, linkTo }: { icon: React.ReactNode; title: string; linkTo: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-semibold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <Link
        to={linkTo}
        className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View All <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
