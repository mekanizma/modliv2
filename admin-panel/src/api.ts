import axios, { AxiosError } from 'axios';
import { AdminSession, Stats, UserProfile } from './types';

const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL,
  timeout: 20000
});

function buildHeaders(token?: string) {
  return token
    ? {
        'X-Admin-Token': token
      }
    : {};
}

function handleError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string; error?: string }>;
    const message =
      axiosError.response?.data?.detail ||
      axiosError.response?.data?.error ||
      axiosError.response?.statusText ||
      'Bilinmeyen bir hata oluştu';
    throw new Error(message);
  }
  throw error instanceof Error ? error : new Error('Bilinmeyen hata');
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  try {
    const { data } = await api.post<{ success: boolean; token?: string; error?: string }>(
      '/api/admin/login',
      { email, password }
    );

    if (!data.success || !data.token) {
      throw new Error(data.error || 'Giriş başarısız');
    }

    return { token: data.token, email };
  } catch (error) {
    handleError(error);
  }
}

export async function fetchUsers(params: {
  token: string;
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ users: UserProfile[]; total: number; page: number; pageSize: number }> {
  const { token, page = 1, pageSize = 10, search } = params;
  try {
    const { data } = await api.get<{
      users: UserProfile[];
      total?: number;
      page?: number;
      page_size?: number;
    }>('/api/admin/users', {
      headers: buildHeaders(token),
      params: {
        page,
        page_size: pageSize,
        q: search || undefined
      }
    });
    return {
      users: data.users || [],
      total: data.total ?? (data.users ? data.users.length : 0),
      page: data.page ?? page,
      pageSize: data.page_size ?? pageSize
    };
  } catch (error) {
    handleError(error);
  }
}

export async function fetchStats(token: string): Promise<Stats> {
  try {
    const { data } = await api.get<{ stats: Stats }>('/api/admin/stats', {
      headers: buildHeaders(token)
    });
    return data.stats;
  } catch (error) {
    handleError(error);
  }
}

export async function updateUserCredits(params: {
  token: string;
  userId: string;
  credits: number;
}): Promise<UserProfile> {
  const { token, userId, credits } = params;
  try {
    const { data } = await api.put<{ user: UserProfile }>(
      `/api/admin/users/${userId}`,
      { credits },
      { headers: buildHeaders(token) }
    );
    return data.user;
  } catch (error) {
    handleError(error);
  }
}

export async function sendPushNotification(params: {
  token: string;
  title: string;
  body: string;
  userId?: string | null;
  data?: Record<string, string | number>;
}): Promise<void> {
  const { token, title, body, userId, data } = params;
  try {
    await api.post(
      '/api/admin/notifications/send',
      { title, body, user_id: userId || null, data },
      { headers: buildHeaders(token) }
    );
  } catch (error) {
    handleError(error);
  }
}

