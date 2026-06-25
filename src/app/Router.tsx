import { Suspense, lazy } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout';
import { ProtectedRoute, GuestRoute } from '@/features/auth/guards/RouteGuards';
import { PageLoader } from '@/components/common';

// Lazy-loaded pages
const HomePage = lazy(() => import('@/features/events/pages/HomePage').then(m => ({ default: m.HomePage })));
const ExplorePage = lazy(() => import('@/features/events/pages/ExplorePage').then(m => ({ default: m.ExplorePage })));
const EventDetailPage = lazy(() => import('@/features/events/pages/EventDetailPage').then(m => ({ default: m.EventDetailPage })));
const CreateEventPage = lazy(() => import('@/features/events/pages/CreateEventPage').then(m => ({ default: m.CreateEventPage })));
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const AuthCallback = lazy(() => import('@/features/auth/pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const OnboardingPage = lazy(() => import('@/features/auth/pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const ProfileEditPage = lazy(() => import('@/features/profile/pages/ProfileEditPage').then(m => ({ default: m.ProfileEditPage })));
const ChatListPage = lazy(() => import('@/features/chat/pages/ChatPages').then(m => ({ default: m.ChatListPage })));
const ChatRoomPage = lazy(() => import('@/features/chat/pages/ChatPages').then(m => ({ default: m.ChatRoomPage })));
const CommunitiesListPage = lazy(() => import('@/features/communities/pages/CommunityPages').then(m => ({ default: m.CommunitiesListPage })));
const CommunityDetailPage = lazy(() => import('@/features/communities/pages/CommunityPages').then(m => ({ default: m.CommunityDetailPage })));
const TicketsPage = lazy(() => import('@/features/tickets/pages/TicketPages').then(m => ({ default: m.TicketsPage })));
const ScanPage = lazy(() => import('@/features/tickets/pages/TicketPages').then(m => ({ default: m.ScanPage })));
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const SavedEventsPage = lazy(() => import('@/features/saved/pages/SavedEventsPage').then(m => ({ default: m.SavedEventsPage })));
const AdminLayout = lazy(() => import('@/features/admin/pages/AdminPages').then(m => ({ default: m.AdminLayout })));
const AdminDashboardPage = lazy(() => import('@/features/admin/pages/AdminPages').then(m => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = lazy(() => import('@/features/admin/pages/AdminPages').then(m => ({ default: m.AdminUsersPage })));
const AdminReportsPage = lazy(() => import('@/features/admin/pages/AdminPages').then(m => ({ default: m.AdminReportsPage })));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      // Public routes
      { path: '/', element: <SuspenseWrapper><HomePage /></SuspenseWrapper> },
      { path: '/explore', element: <SuspenseWrapper><ExplorePage /></SuspenseWrapper> },
      { path: '/events/:id', element: <SuspenseWrapper><EventDetailPage /></SuspenseWrapper> },

      // Auth routes
      { path: '/auth/login', element: <SuspenseWrapper><GuestRoute><LoginPage /></GuestRoute></SuspenseWrapper> },
      { path: '/auth/callback', element: <SuspenseWrapper><AuthCallback /></SuspenseWrapper> },

      // Protected routes
      { path: '/onboarding', element: <SuspenseWrapper><ProtectedRoute><OnboardingPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/create-event', element: <SuspenseWrapper><ProtectedRoute><CreateEventPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/profile', element: <SuspenseWrapper><ProtectedRoute><ProfilePage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/profile/edit', element: <SuspenseWrapper><ProtectedRoute><ProfileEditPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/profile/:id', element: <SuspenseWrapper><ProfilePage /></SuspenseWrapper> },
      { path: '/chat', element: <SuspenseWrapper><ProtectedRoute><ChatListPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/chat/:id', element: <SuspenseWrapper><ProtectedRoute><ChatRoomPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/communities', element: <SuspenseWrapper><CommunitiesListPage /></SuspenseWrapper> },
      { path: '/communities/:id', element: <SuspenseWrapper><CommunityDetailPage /></SuspenseWrapper> },
      { path: '/tickets', element: <SuspenseWrapper><ProtectedRoute><TicketsPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/scan', element: <SuspenseWrapper><ProtectedRoute><ScanPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/notifications', element: <SuspenseWrapper><ProtectedRoute><NotificationsPage /></ProtectedRoute></SuspenseWrapper> },
      { path: '/saved', element: <SuspenseWrapper><ProtectedRoute><SavedEventsPage /></ProtectedRoute></SuspenseWrapper> },

      // Admin routes
      {
        path: '/admin',
        element: <SuspenseWrapper><ProtectedRoute roles={['admin']}><AdminLayout /></ProtectedRoute></SuspenseWrapper>,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'reports', element: <AdminReportsPage /> },
        ],
      },

      // Catch-all
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
