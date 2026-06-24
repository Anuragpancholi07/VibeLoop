import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { BottomNavigation } from './BottomNavigation';

export function AppShell() {
  const location = useLocation();
  const isAuthRoute = location.pathname.startsWith('/auth');
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAuthRoute) {
    return <Outlet />;
  }

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <main className="main-content">
        <Outlet />
      </main>
      {!isAdminRoute && <BottomNavigation />}
    </div>
  );
}
