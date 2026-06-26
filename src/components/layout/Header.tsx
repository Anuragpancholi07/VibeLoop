import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Search, MapPin, ChevronDown } from 'lucide-react';
import { ThemeSwitcher } from '@/themes';
import { useAuth } from '@/features/auth/AuthContext';
import { useLocationContext } from '@/context/LocationContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showBack?: boolean;
  className?: string;
}

export function Header({ title, showSearch = true, className }: HeaderProps) {
  const { isAuthenticated, user } = useAuth();
  const { selectedCity, setSelectedCity, availableCities } = useLocationContext();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);

        if (!error && count !== null) {
          setUnreadCount(count);
        }
      } catch (err) {
        console.error('Error fetching unread notifications count:', err);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel(`header-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user]);

  return (
    <header className={cn('sticky top-0 z-40 glass-strong safe-top border-b border-border/50', className)}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
        {/* Logo and Location Selector */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-sm font-black text-white">V</span>
            </div>
            <span className="text-lg font-bold gradient-text hidden sm:block">
              {title || 'VibeLoop'}
            </span>
          </Link>

          {/* Location Dropdown */}
          <div className="relative flex-shrink-0">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="appearance-none pl-8 pr-7 py-1 rounded-full text-xs font-semibold bg-secondary/50 border border-border text-foreground hover:bg-secondary cursor-pointer transition-all focus:outline-none focus:ring-1 focus:ring-primary min-w-[100px]"
            >
              <option value="">All India</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-primary">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
              <ChevronDown className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Search bar (desktop) */}
        {showSearch && (
          <button
            onClick={() => navigate('/explore')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary/50 border border-border text-muted-foreground hover:bg-secondary transition-colors w-64"
          >
            <Search className="w-4 h-4" />
            <span className="text-sm">Search events...</span>
          </button>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {showSearch && (
            <button
              onClick={() => navigate('/explore')}
              className="sm:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-foreground" />
            </button>
          )}

          {isAuthenticated && (
            <Link
              to="/notifications"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 text-foreground" />
              {/* Unread count badge */}
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center border-2 border-background shadow-md">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          )}

          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}

