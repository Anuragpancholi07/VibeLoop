import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Settings, Calendar, Users, MapPin, Shield, LogOut, Edit3, UserPlus, UserMinus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { ThemeSwitcher } from '@/themes';
import { EventCard } from '@/features/events/components/EventCard';
import { EmptyState, PageLoader, CardSkeleton } from '@/components/common';
import type { Profile, Event } from '@/types';

export function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user, profile: myProfile, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hostedEvents, setHostedEvents] = useState<Event[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'hosting' | 'attending'>('hosting');

  const isOwnProfile = !id || id === user?.id;
  const profileId = id || user?.id;

  useEffect(() => {
    if (profileId) loadProfile();
  }, [profileId]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      if (isOwnProfile && myProfile) {
        setProfile(myProfile);
      } else {
        const { data } = await supabase.from('profiles').select('*').eq('id', profileId).single();
        setProfile(data as Profile);
      }

      // Hosted events
      const { data: hosted } = await supabase
        .from('events').select('*, category:event_categories(*)')
        .eq('host_id', profileId).order('event_date', { ascending: false }).limit(10);
      setHostedEvents((hosted || []) as Event[]);

      // Attending events
      const { data: attending } = await supabase
        .from('event_attendees').select('event:events(*, category:event_categories(*))')
        .eq('user_id', profileId).eq('status', 'approved').limit(10);
      setAttendingEvents(((attending || []).map((a: any) => a.event).filter(Boolean)) as Event[]);

      // Check follow status
      if (user && !isOwnProfile) {
        const { data: followData } = await supabase
          .from('follows').select('id').eq('follower_id', user.id).eq('following_id', profileId).maybeSingle();
        setIsFollowing(!!followData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !profileId) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profileId);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!profile) return <div className="p-4 text-center">Profile not found</div>;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      {/* Profile Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
        <div className="w-24 h-24 mx-auto rounded-full bg-primary/20 flex items-center justify-center overflow-hidden mb-3 ring-4 ring-primary/10">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-bold text-primary">{profile.full_name?.[0] || '?'}</span>
          )}
        </div>
        <h1 className="text-xl font-bold flex items-center justify-center gap-2">
          {profile.full_name}
          {profile.is_verified_host && <Shield className="w-5 h-5 text-primary" />}
        </h1>
        {profile.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
        {profile.bio && <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">{profile.bio}</p>}
        {profile.city && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3" /> {profile.city}
          </p>
        )}

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-4">
          <div className="text-center">
            <p className="text-lg font-bold">{profile.events_hosted}</p>
            <p className="text-xs text-muted-foreground">Hosted</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{profile.events_attended}</p>
            <p className="text-xs text-muted-foreground">Attended</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{profile.followers_count}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">{profile.following_count}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3 mt-4">
          {isOwnProfile ? (
            <>
              <Link to="/profile/edit" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium hover:bg-secondary/80 transition-colors">
                <Edit3 className="w-4 h-4" /> {t('profile.editProfile')}
              </Link>
              <button onClick={signOut} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors">
                <LogOut className="w-4 h-4" /> {t('auth.logout')}
              </button>
            </>
          ) : (
            <button onClick={handleFollow} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${isFollowing ? 'bg-secondary border border-border' : 'bg-primary text-primary-foreground'}`}>
              {isFollowing ? <><UserMinus className="w-4 h-4" /> {t('profile.unfollow')}</> : <><UserPlus className="w-4 h-4" /> {t('profile.follow')}</>}
            </button>
          )}
        </div>

        {/* Interests */}
        {profile.interests.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
            {profile.interests.map((interest) => (
              <span key={interest} className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary font-medium">
                {interest}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/30 mb-4">
        {(['hosting', 'attending'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}>
            {t(`profile.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {activeTab === 'hosting' ? (
          hostedEvents.length > 0 ? (
            hostedEvents.map((event, i) => <EventCard key={event.id} event={event} variant="compact" index={i} />)
          ) : (
            <EmptyState icon={<Calendar className="w-8 h-8 text-muted-foreground" />} title="No events hosted yet" />
          )
        ) : (
          attendingEvents.length > 0 ? (
            attendingEvents.map((event, i) => <EventCard key={event.id} event={event} variant="compact" index={i} />)
          ) : (
            <EmptyState icon={<Users className="w-8 h-8 text-muted-foreground" />} title="No events attended yet" />
          )
        )}
      </div>
    </div>
  );
}
