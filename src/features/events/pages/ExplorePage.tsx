import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, X, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLocationContext } from '@/context/LocationContext';
import { EventCard } from '@/features/events/components/EventCard';
import { CardSkeleton, EmptyState } from '@/components/common';
import { RADIUS_OPTIONS, SORT_OPTIONS, GENDER_OPTIONS } from '@/lib/constants';
import type { Event, EventCategory } from '@/types';

export function ExplorePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCity } = useLocationContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');
  const [isFree, setIsFree] = useState<boolean | null>(null);
  const [radius, setRadius] = useState(25);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadEvents(selectedCity);
  }, [search, selectedCategory, sortBy, isFree, selectedCity]);

  const loadCategories = async () => {
    const { data } = await supabase
      .from('event_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    setCategories((data || []) as EventCategory[]);
  };

  const loadEvents = async (city: string) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('events')
        .select('*, host:profiles(*), category:event_categories(*)')
        .eq('status', 'published');

      if (city) {
        query = query.ilike('city', city);
      }

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      if (selectedCategory) {
        const cat = categories.find((c) => c.slug === selectedCategory);
        if (cat) query = query.eq('category_id', cat.id);
      }

      if (isFree !== null) {
        query = query.eq('is_free', isFree);
      }

      switch (sortBy) {
        case 'trending':
          query = query.order('views_count', { ascending: false });
          break;
        case 'popular':
          query = query.order('current_attendees', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('event_date');
      }

      query = query.limit(30);
      const { data } = await query;
      setEvents((data || []) as Event[]);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-4 py-4">
      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('events.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center justify-center w-12 h-12 rounded-xl border transition-colors ${
            showFilters ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary/50 border-border'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        <button
          onClick={() => setSelectedCategory('')}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-foreground border border-border'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.slug === selectedCategory ? '' : cat.slug)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.slug
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary/50 text-foreground border border-border'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="p-4 rounded-2xl bg-card border border-border space-y-4">
              {/* Sort */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('events.sortBy')}</label>
                <div className="flex gap-2 flex-wrap">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSortBy(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        sortBy === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">{t('events.priceRange')}</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsFree(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isFree === null ? 'bg-primary text-primary-foreground' : 'bg-secondary/50'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setIsFree(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isFree === true ? 'bg-primary text-primary-foreground' : 'bg-secondary/50'}`}
                  >
                    Free
                  </button>
                  <button
                    onClick={() => setIsFree(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isFree === false ? 'bg-primary text-primary-foreground' : 'bg-secondary/50'}`}
                  >
                    Paid
                  </button>
                </div>
              </div>

              {/* Radius */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {t('events.distance')}
                </label>
                <div className="flex gap-2">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setRadius(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        radius === opt.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : events.length > 0 ? (
          events.map((event, i) => (
            <EventCard key={event.id} event={event} index={i} />
          ))
        ) : (
          <div className="col-span-full">
            <EmptyState
              icon={<Search className="w-8 h-8 text-muted-foreground" />}
              title={t('common.noResults')}
              description={t('events.noEventsDescription')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
