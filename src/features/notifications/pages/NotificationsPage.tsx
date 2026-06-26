import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, Check, Calendar, CreditCard, MessageCircle, UserPlus, Star, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { EmptyState, PageLoader } from '@/components/common';
import { cn, getRelativeTime } from '@/lib/utils';
import type { Notification } from '@/types';

const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
  event_reminder: <Calendar className="w-5 h-5 text-info" />,
  join_approval: <Check className="w-5 h-5 text-success" />,
  payment_success: <CreditCard className="w-5 h-5 text-success" />,
  event_cancellation: <AlertTriangle className="w-5 h-5 text-destructive" />,
  new_message: <MessageCircle className="w-5 h-5 text-primary" />,
  new_event_by_host: <Calendar className="w-5 h-5 text-primary" />,
  community_activity: <UserPlus className="w-5 h-5 text-accent" />,
  follow_notification: <UserPlus className="w-5 h-5 text-primary" />,
  review_received: <Star className="w-5 h-5 text-warning" />,
  system: <Bell className="w-5 h-5 text-muted-foreground" />,
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { if (user) loadNotifications(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadNotifications = async () => {
    try {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(50);
      setNotifications((data || []) as Notification[]);
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const getNotificationAction = (notification: Notification) => {
    const data = notification.data || {};
    const type = notification.type;
    const title = notification.title || '';
    const body = notification.body || '';

    switch (type) {
      case 'join_approval':
        if (data.event_id) {
          return {
            path: `/events/${data.event_id}`,
            label: 'Click here to view event details',
          };
        }
        break;
      case 'event_cancellation':
        if (data.event_id) {
          return {
            path: `/events/${data.event_id}`,
            label: 'Click here to view event details',
          };
        }
        break;
      case 'new_event_by_host':
        if (data.event_id) {
          return {
            path: `/events/${data.event_id}`,
            label: 'Click here to view and join event',
          };
        }
        break;
      case 'payment_success':
        return {
          path: '/tickets',
          label: 'Click here to view your ticket',
        };
      case 'review_received':
        if (data.event_id) {
          return {
            path: `/events/${data.event_id}?tab=reviews`,
            label: 'Click here to view reviews',
          };
        }
        break;
      case 'follow_notification':
        if (data.follower_id) {
          return {
            path: `/profile/${data.follower_id}`,
            label: 'Click here to view profile',
          };
        }
        break;
      case 'new_message':
        const roomId = data.chat_id || data.room_id || '';
        return {
          path: roomId ? `/chat/${roomId}` : '/chat',
          label: 'Click here to open chat',
        };
      case 'community_activity':
        if (data.event_id) {
          const isJoinRequest = title.toLowerCase().includes('request') || body.toLowerCase().includes('request') || body.toLowerCase().includes('approval required');
          const isWaitlist = title.toLowerCase().includes('waitlist') || body.toLowerCase().includes('waitlist');
          
          if (isJoinRequest) {
            return {
              path: `/events/${data.event_id}?tab=requests`,
              label: 'To accept or reject this request, click here',
            };
          } else if (isWaitlist) {
            return {
              path: `/events/${data.event_id}?tab=requests`,
              label: 'To manage waitlist, click here',
            };
          } else {
            return {
              path: `/events/${data.event_id}?tab=attendees`,
              label: 'Click here to view attendees',
            };
          }
        }
        break;
      default:
        if (data.event_id) {
          return {
            path: `/events/${data.event_id}`,
            label: 'Click here to view details',
          };
        }
    }
    return null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markRead(notification.id);
    }
    const action = getNotificationAction(notification);
    if (action) {
      navigate(action.path);
    }
  };

  if (isLoading) return <PageLoader />;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="px-4 py-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t('notifications.title')}</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-primary font-medium">{t('notifications.markAllRead')}</button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification, i) => {
            const action = getNotificationAction(notification);
            return (
              <motion.button
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  'w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors cursor-pointer',
                  notification.is_read ? 'bg-card border border-border' : 'bg-primary/5 border border-primary/20'
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center flex-shrink-0">
                  {NOTIFICATION_ICONS[notification.type] || <Bell className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !notification.is_read && 'font-semibold')}>{notification.title}</p>
                  {notification.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>}
                  {action && (
                    <p className="text-xs text-primary font-semibold mt-2 hover:underline flex items-center gap-1">
                      👉 {action.label}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1.5">{getRelativeTime(notification.created_at)}</p>
                </div>
                {!notification.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Bell className="w-8 h-8 text-muted-foreground" />}
          title={t('notifications.noNotifications')}
          description={t('notifications.noNotificationsDescription')}
        />
      )}
    </div>
  );
}
