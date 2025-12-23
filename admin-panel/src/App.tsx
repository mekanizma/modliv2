import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminLogin, fetchStats, fetchUsers, sendPushNotification, updateUserCredits } from './api';
import { AdminSession, Stats, UserProfile } from './types';
import Dashboard from './components/Dashboard';
import LoginView from './components/LoginView';

const STORAGE_KEY = 'modli_admin_session_v1';

function loadSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminSession) : null;
  } catch {
    return null;
  }
}

function persistSession(session: AdminSession | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export default function App() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AdminSession | null>(() => loadSession());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const {
    data: usersResponse,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ['users', session?.token, page, search],
    queryFn: () => fetchUsers({ token: session!.token, page, pageSize: 10, search }),
    enabled: Boolean(session?.token)
  });
  const users = usersResponse?.users || [];
  const totalUsers = usersResponse?.total || 0;

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<Stats>({
    queryKey: ['stats', session?.token],
    queryFn: () => fetchStats(session!.token),
    enabled: Boolean(session?.token)
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => adminLogin(email, password),
    onSuccess: (data) => {
      setSession(data);
      persistSession(data);
    }
  });

  const creditMutation = useMutation({
    mutationFn: (payload: { userId: string; credits: number }) =>
      updateUserCredits({ token: session!.token, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', session?.token] });
      queryClient.invalidateQueries({ queryKey: ['stats', session?.token] });
    }
  });

  const notificationMutation = useMutation({
    mutationFn: (payload: { title: string; body: string; userId?: string | null }) =>
      sendPushNotification({ token: session!.token, ...payload }),
    onSuccess: () => {
      // no-op, backend is async placeholder
    }
  });

  const handleLogout = () => {
    setSession(null);
    persistSession(null);
    queryClient.clear();
  };

  const handleLogin = (email: string, password: string) => loginMutation.mutate({ email, password });

  const handleCreditChange = (userId: string, credits: number) =>
    creditMutation.mutate({ userId, credits });

  const handleSendNotification = (title: string, body: string, userId?: string | null) =>
    notificationMutation.mutate({ title, body, userId });

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  useEffect(() => {
    if (!session) return;
    persistSession(session);
  }, [session]);

  if (!session) {
    return (
      <div className="app-shell">
        <LoginView onSubmit={handleLogin} loading={loginMutation.isPending} error={loginMutation.error} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Dashboard
        adminEmail={session.email}
        onLogout={handleLogout}
        users={users || []}
        totalUsers={totalUsers}
        page={page}
        usersLoading={usersLoading}
        usersError={usersError as Error | null}
        stats={stats}
        statsLoading={statsLoading}
        statsError={statsError as Error | null}
        onUpdateCredits={handleCreditChange}
        onSendNotification={handleSendNotification}
        onSearchChange={handleSearchChange}
        onPageChange={handlePageChange}
        creditUpdating={creditMutation.isPending}
        notificationSending={notificationMutation.isPending}
        notificationError={notificationMutation.error as Error | null}
      />
    </div>
  );
}

