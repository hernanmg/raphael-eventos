import type {
  AdminEventDetail,
  CreateEventInput,
  CreateIpcEntryInput,
  DashboardSummary,
  EventDetail,
  EventSummary,
  IpcHistoryEntry,
  LoginInput,
  PublicUser,
  RegisterInput,
} from '@raphael-eventos/shared';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  const body = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      body?.error?.message ?? 'No pudimos conectar con el servidor',
      res.status,
      body?.error?.issues,
    );
  }

  return body as T;
}

export interface SessionResponse {
  user: PublicUser;
}

export const api = {
  register: (input: RegisterInput) =>
    request<SessionResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  login: (input: LoginInput) =>
    request<SessionResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  logout: () => request<null>('/api/v1/auth/logout', { method: 'POST' }),

  // 401 significa "no hay sesión", no es un error de la app — se traduce a
  // null en vez de dejar que useSession lo trate como isError.
  me: async (): Promise<SessionResponse | null> => {
    try {
      return await request<SessionResponse>('/api/v1/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  listEvents: () => request<{ events: EventSummary[] }>('/api/v1/portal/events'),

  getEventDetail: (eventId: string) =>
    request<{ event: EventDetail }>(`/api/v1/portal/events/${eventId}`),

  getDashboard: () => request<{ dashboard: DashboardSummary }>('/api/v1/admin/dashboard'),

  getAdminEventDetail: (eventId: string) =>
    request<{ event: AdminEventDetail }>(`/api/v1/admin/events/${eventId}`),

  createEvent: (input: CreateEventInput) =>
    request<{ event: { id: string; name: string } }>('/api/v1/admin/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listIpcHistory: () => request<{ history: IpcHistoryEntry[] }>('/api/v1/admin/ipc'),

  addIpcEntry: (input: CreateIpcEntryInput) =>
    request<{ entry: IpcHistoryEntry }>('/api/v1/admin/ipc', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
