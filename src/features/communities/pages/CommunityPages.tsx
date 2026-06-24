import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus, Users, Calendar, MessageCircle, Globe, Lock, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { EmptyState, PageLoader, CardSkeleton } from '@/components/common';
import { cn } from '@/lib/utils';
import type { Community, CommunityPost } from '@/types';

export function CommunitiesListPage() {
  const { t } = useTranslation();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadCommunities(); }, []);

  const loadCommunities = async () => {
    try {
      const { data } = await supabase.from('communities').select('*, creator:profiles(*), category:event_categories(*)').eq('is_active', true).order('members_count', { ascending: false });
      setCommunities((data || []) as Community[]);
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('communities.title')}</h1>
        <Link to="/communities/create" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          <Plus className="w-4 h-4" /> {t('communities.create')}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      ) : communities.length > 0 ? (
        <div className="space-y-3">
          {communities.map((community, i) => (
            <motion.div key={community.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Link to={`/communities/${community.id}`} className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:bg-secondary/30 transition-colors">
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {community.avatar_url ? (
                    <img src={community.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{community.name}</h3>
                    {community.community_type === 'private' ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Globe className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  {community.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{community.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> {community.members_count}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> {community.events_count} events</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Users className="w-8 h-8 text-muted-foreground" />} title={t('communities.noCommunities')} description={t('communities.noCommunitiesDescription')} />
      )}
    </div>
  );
}

export function CommunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'events' | 'members'>('posts');
  const [newPost, setNewPost] = useState('');

  useEffect(() => { if (id) loadCommunity(); }, [id]);

  const loadCommunity = async () => {
    try {
      const { data } = await supabase.from('communities').select('*, creator:profiles(*)').eq('id', id).single();
      setCommunity(data as Community);

      const { data: postsData } = await supabase.from('community_posts').select('*, author:profiles(*)').eq('community_id', id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(20);
      setPosts((postsData || []) as CommunityPost[]);

      if (user) {
        const { data: memberData } = await supabase.from('community_members').select('id').eq('community_id', id).eq('user_id', user.id).maybeSingle();
        setIsMember(!!memberData);
      }
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const handleJoin = async () => {
    if (!user || !id) return;
    if (isMember) {
      await supabase.from('community_members').delete().eq('community_id', id).eq('user_id', user.id);
      setIsMember(false);
    } else {
      await supabase.from('community_members').insert({ community_id: id, user_id: user.id, role: 'member' });
      setIsMember(true);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() || !user || !id) return;
    await supabase.from('community_posts').insert({ community_id: id, author_id: user.id, content: newPost.trim() });
    setNewPost('');
    loadCommunity();
  };

  if (isLoading) return <PageLoader />;
  if (!community) return <div className="p-4 text-center">Community not found</div>;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center overflow-hidden mb-3">
          {community.avatar_url ? <img src={community.avatar_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-8 h-8 text-primary" />}
        </div>
        <h1 className="text-xl font-bold">{community.name}</h1>
        {community.description && <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{community.description}</p>}
        <div className="flex justify-center gap-6 mt-3 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{community.members_count}</strong> members</span>
          <span><strong className="text-foreground">{community.events_count}</strong> events</span>
          <span><strong className="text-foreground">{community.posts_count}</strong> posts</span>
        </div>
        <button onClick={handleJoin} className={`mt-4 px-6 py-2.5 rounded-xl text-sm font-medium transition-colors ${isMember ? 'bg-secondary border border-border' : 'bg-primary text-primary-foreground'}`}>
          {isMember ? t('communities.leave') : t('communities.join')}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/30 mb-4">
        {(['posts', 'events', 'members'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={cn('flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors capitalize', activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground')}>
            {t(`communities.${tab}`)}
          </button>
        ))}
      </div>

      {/* Posts */}
      {activeTab === 'posts' && (
        <div className="space-y-3">
          {isMember && (
            <div className="p-3 rounded-xl bg-card border border-border">
              <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder={t('communities.writePost')} rows={3} className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none" />
              <div className="flex justify-end mt-2">
                <button onClick={handleCreatePost} disabled={!newPost.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">Post</button>
              </div>
            </div>
          )}
          {posts.map((post) => (
            <div key={post.id} className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{post.author?.full_name?.[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{post.author?.full_name}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
                {post.is_pinned && <span className="ml-auto text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">Pinned</span>}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
            </div>
          ))}
          {posts.length === 0 && <EmptyState icon={<MessageCircle className="w-8 h-8 text-muted-foreground" />} title={t('communities.noPosts')} />}
        </div>
      )}
    </div>
  );
}
