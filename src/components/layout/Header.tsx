import { Link, useNavigate } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';
import { ThemeSwitcher } from '@/themes';
import { useAuth } from '@/features/auth/AuthContext';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
  showSearch?: boolean;
  showBack?: boolean;
  className?: string;
}

export function Header({ title, showSearch = true, className }: HeaderProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <header className={cn('sticky top-0 z-40 glass-strong safe-top border-b border-border/50', className)}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-14">
        {/* Logo / Title */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <span className="text-sm font-black text-white">V</span>
          </div>
          <span className="text-lg font-bold gradient-text hidden sm:block">
            {title || 'VibeLoop'}
          </span>
        </Link>

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
              {/* Unread indicator */}
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-destructive" />
            </Link>
          )}

          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
