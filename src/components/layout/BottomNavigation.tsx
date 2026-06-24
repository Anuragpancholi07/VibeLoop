import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Plus, MessageCircle, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, labelKey: 'nav.home' },
  { path: '/explore', icon: Search, labelKey: 'nav.explore' },
  { path: '/create-event', icon: Plus, labelKey: 'nav.create', isCreate: true },
  { path: '/chat', icon: MessageCircle, labelKey: 'nav.chat' },
  { path: '/profile', icon: User, labelKey: 'nav.profile' },
];

export function BottomNavigation() {
  const { t } = useTranslation();
  const location = useLocation();

  // Hide on admin and auth routes
  if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/auth')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong safe-bottom border-t border-border/50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 h-16">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          if (item.isCreate) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex items-center justify-center"
              >
                <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25 -mt-4">
                  <Plus className="w-6 h-6 text-white" />
                </div>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 relative"
            >
              {isActive && (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
              <Icon
                className={cn(
                  'w-5 h-5 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {t(item.labelKey)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
