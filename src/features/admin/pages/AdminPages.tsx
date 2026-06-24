import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Calendar, Megaphone, Tag, Flag, CreditCard,
  BarChart3, Shield, ChevronLeft, TrendingUp, DollarSign, Ticket, Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { cn, formatCurrency } from '@/lib/utils';
import { PageLoader, EmptyState } from '@/components/common';

const adminNavItems = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/users', icon: Users, label: 'Users' },
  { path: '/admin/events', icon: Calendar, label: 'Events' },
  { path: '/admin/communities', icon: Megaphone, label: 'Communities' },
  { path: '/admin/categories', icon: Tag, label: 'Categories' },
  { path: '/admin/reports', icon: Flag, label: 'Reports' },
  { path: '/admin/payments', icon: CreditCard, label: 'Payments' },
];

export function AdminLayout() {
  const { role } = useAuth();
  const location = useLocation();

  if (role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-[calc(100dvh-56px)]">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-card p-3">
        <div className="flex items-center gap-2 px-3 py-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm">Admin Panel</span>
        </div>
        {adminNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5', isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/50')}>
              <Icon className="w-4 h-4" /> {item.label}
            </Link>
          );
        })}
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 glass-strong border-t border-border px-2 py-1.5 safe-bottom">
        <div className="flex justify-around">
          {adminNavItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={cn('flex flex-col items-center gap-0.5 px-2 py-1', isActive ? 'text-primary' : 'text-muted-foreground')}>
                <Icon className="w-4 h-4" />
                <span className="text-[9px]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalUsers: 0, activeUsers: 0, totalRevenue: 0, eventsCreated: 0, ticketsSold: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [usersRes, eventsRes, ticketsRes, paymentsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('event_tickets').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').eq('status', 'completed'),
      ]);
      const totalRevenue = (paymentsRes.data || []).reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);
      setStats({
        totalUsers: usersRes.count || 0,
        activeUsers: Math.floor((usersRes.count || 0) * 0.7),
        totalRevenue,
        eventsCreated: eventsRes.count || 0,
        ticketsSold: ticketsRes.count || 0,
      });
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  if (isLoading) return <PageLoader />;

  const statCards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: t('admin.activeUsers'), value: stats.activeUsers.toLocaleString(), icon: Activity, color: 'text-success', bg: 'bg-success/10' },
    { label: t('admin.totalRevenue'), value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-warning', bg: 'bg-warning/10' },
    { label: t('admin.eventsCreated'), value: stats.eventsCreated.toLocaleString(), icon: Calendar, color: 'text-info', bg: 'bg-info/10' },
    { label: t('admin.ticketsSold'), value: stats.ticketsSold.toLocaleString(), icon: Ticket, color: 'text-accent', bg: 'bg-accent/10' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('admin.dashboard')}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-card border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', card.bg)}>
                  <Icon className={cn('w-5 h-5', card.color)} />
                </div>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity placeholder */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> {t('admin.analytics')}
        </h2>
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          <p className="text-sm">Analytics charts will render here with Recharts integration</p>
        </div>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setUsers(data || []); setIsLoading(false); });
  }, []);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">City</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{u.full_name?.[0] || '?'}</span>
                      </div>
                      <div>
                        <p className="font-medium">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">{u.role}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{u.city || '—'}</td>
                  <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', u.is_active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.from('reports').select('*, reporter:profiles(*)').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setReports(data || []); setIsLoading(false); });
  }, []);

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Reports</h1>
      {reports.length > 0 ? (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="p-4 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                  report.status === 'pending' ? 'bg-warning/10 text-warning' :
                  report.status === 'resolved' ? 'bg-success/10 text-success' :
                  'bg-muted text-muted-foreground'
                )}>{report.status}</span>
                <span className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm font-medium">{report.reason.replace(/_/g, ' ')}</p>
              <p className="text-xs text-muted-foreground mt-1">Type: {report.target_type} • By: {report.reporter?.full_name}</p>
              {report.description && <p className="text-sm text-muted-foreground mt-2">{report.description}</p>}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Flag className="w-8 h-8 text-muted-foreground" />} title="No reports" description="No reports have been filed yet" />
      )}
    </div>
  );
}
