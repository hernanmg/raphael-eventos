import type {
  AdminEventDetail,
  AdminProvider,
  AdminSponsor,
  AuditLogPage,
  CardAdjustmentInput,
  EventType,
  ProviderInput,
  PublicProvider,
  PublicSponsor,
  UpdateEventInput,
  YearReport,
  ChangePasswordInput,
  SalonProfile,
  GuestPassView,
  AdminGuestInput,
  AdminGuestsView,
  EventPublicInfoInput,
  GuestInput,
  GuestSummary,
  PortalGuestsView,
  GuestRsvpInput,
  InviteView,
  CheckInEventSummary,
  CheckInAdmitInput,
  CheckInEventView,
  CheckInGuestView,
  CheckInLookupInput,
  CheckInRejectInput,
  DoorAccessResult,
  BeneficiaryReport,
  CalendarEntry,
  ClientDetail,
  ClientListItem,
  CommissionAdvanceInput,
  CommissionAdvanceSummary,
  CreateEventInput,
  CreateIpcEntryInput,
  DashboardSummary,
  EventContractSummary,
  ImportedAlumnoRow,
  IpcStalenessStatus,
  LeadIntakeInput,
  LeadSummary,
  RecordPaymentInput,
  RecordPaymentResult,
  UpdateLeadInput,
  EmployeeInput,
  EmployeeSummary,
  EmployeeTimeEntryInput,
  EmployeeTimeEntrySummary,
  CostCategoryInput,
  CostCategorySummary,
  EventCostingSummary,
  ExpenseInput,
  ExpenseList,
  ExpenseSummary,
  PayrollConfirmInput,
  PayrollPreview,
  EventDetail,
  EventStaffAssignmentInput,
  EventStaffAssignmentSummary,
  EventSummary,
  IpcHistoryEntry,
  LoginInput,
  PayrollEntrySummary,
  ReminderConfigInput,
  ReminderConfigSummary,
  ReminderLogSummary,
  ReminderSweepResult,
  Plan,
  PublicUser,
  RegisterInput,
  TenantCostConfigInput,
  TenantCostConfigSummary,
} from '@raphael-eventos/shared';

// VITE_API_URL:
//  - sin definir → API local de desarrollo;
//  - "same-origin" → rutas relativas (producción: vercel.json reenvía /api/* a
//    la API en Render, así web y API comparten origen y la cookie de sesión
//    SameSite=Lax viaja sin dominio propio);
//  - una URL → esa API (ej. con dominio propio, api.<dominio>).
const RAW_API_URL = import.meta.env.VITE_API_URL as string | undefined;
export const API_URL =
  RAW_API_URL === undefined || RAW_API_URL === ''
    ? 'http://localhost:3001'
    : RAW_API_URL === 'same-origin'
      ? ''
      : RAW_API_URL.replace(/\/+$/, '');

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
  tenantPlan: Plan;
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

  changePassword: (input: ChangePasswordInput) =>
    request<{ user: PublicUser }>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

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

  getSalonProfile: () => request<{ salon: SalonProfile }>('/api/v1/public/salon'),

  // -- Fase 4: edición de eventos, ajustes de tarjeta, auditoría ---------

  updateEvent: (eventId: string, input: UpdateEventInput) =>
    request<{ event: { id: string; name: string; status: string } }>(
      `/api/v1/admin/events/${eventId}`,
      { method: 'PUT', body: JSON.stringify(input) },
    ),

  adjustCard: (cardId: string, input: CardAdjustmentInput) =>
    request<{ adjustmentId: string }>(`/api/v1/admin/cards/${cardId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getAuditLog: (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams(
      Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return request<AuditLogPage>(`/api/v1/admin/audit${query ? `?${query}` : ''}`);
  },

  getEventHistory: (eventId: string, cursor?: string) =>
    request<AuditLogPage>(
      `/api/v1/admin/events/${eventId}/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),

  // -- Fase 4: directorio de proveedores + sponsors ------------------------

  resetClientPassword: (userId: string) =>
    request<DoorAccessResult>(`/api/v1/admin/clients/${userId}/reset-password`, {
      method: 'POST',
    }),

  listAdminProviders: () => request<{ providers: AdminProvider[] }>('/api/v1/admin/providers'),

  createProvider: (input: ProviderInput) =>
    request<{ provider: AdminProvider }>('/api/v1/admin/providers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateProvider: (id: string, input: ProviderInput) =>
    request<{ provider: AdminProvider }>(`/api/v1/admin/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteProvider: (id: string) =>
    request<null>(`/api/v1/admin/providers/${id}`, { method: 'DELETE' }),

  listAdminSponsors: () => request<{ sponsors: AdminSponsor[] }>('/api/v1/admin/sponsors'),

  /** Multipart (logo como archivo) — sin el Content-Type JSON de request(). */
  saveSponsor: async (id: string | null, form: FormData): Promise<{ sponsor: AdminSponsor }> => {
    const res = await fetch(`${API_URL}/api/v1/admin/sponsors${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      credentials: 'include',
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(body?.error?.message ?? 'No pudimos guardar el sponsor', res.status);
    }
    return body;
  },

  deleteSponsor: (id: string) =>
    request<null>(`/api/v1/admin/sponsors/${id}`, { method: 'DELETE' }),

  getPublicProviders: (eventType?: EventType) =>
    request<{ providers: PublicProvider[] }>(
      `/api/v1/public/providers${eventType ? `?eventType=${eventType}` : ''}`,
    ),

  getPublicSponsors: () => request<{ sponsors: PublicSponsor[] }>('/api/v1/public/sponsors'),

  getPortalProviders: () =>
    request<{ eventTypes: EventType[]; providers: PublicProvider[] }>('/api/v1/portal/providers'),

  // -- Fase 4: reportes -----------------------------------------------------

  getYearReport: (year: number, eventIds: string[] = []) =>
    request<{ report: YearReport }>(
      `/api/v1/admin/reports/year?year=${year}${
        eventIds.length ? `&eventIds=${eventIds.map(encodeURIComponent).join(',')}` : ''
      }`,
    ),

  // -- Micrositio de invitados (público, Fase 3) -----------------------

  getInvite: (inviteToken: string) =>
    request<{ invite: InviteView }>(`/api/v1/public/invite/${encodeURIComponent(inviteToken)}`),

  rsvp: (inviteToken: string, input: GuestRsvpInput) =>
    request<{ qrToken: string }>(`/api/v1/public/invite/${encodeURIComponent(inviteToken)}/rsvp`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // -- Invitados: portal del titular -------------------------------------

  getPortalGuests: (eventId: string) =>
    request<PortalGuestsView>(`/api/v1/portal/events/${eventId}/guests`),

  ensurePortalInviteLink: (eventId: string) =>
    request<{ inviteToken: string }>(`/api/v1/portal/events/${eventId}/invite-link`, {
      method: 'POST',
    }),

  addPortalGuest: (eventId: string, input: GuestInput) =>
    request<{ guest: GuestSummary }>(`/api/v1/portal/events/${eventId}/guests`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  cancelPortalGuest: (guestId: string) =>
    request<null>(`/api/v1/portal/guests/${guestId}/cancel`, { method: 'POST' }),

  // -- Invitados: panel admin ------------------------------------------

  getAdminGuests: (eventId: string) =>
    request<AdminGuestsView>(`/api/v1/admin/events/${eventId}/guests`),

  ensureAdminInviteLink: (beneficiaryId: string) =>
    request<{ inviteToken: string }>(`/api/v1/admin/beneficiaries/${beneficiaryId}/invite-link`, {
      method: 'POST',
    }),

  addAdminGuest: (eventId: string, input: AdminGuestInput) =>
    request<{ guest: GuestSummary }>(`/api/v1/admin/events/${eventId}/guests`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  cancelAdminGuest: (guestId: string) =>
    request<null>(`/api/v1/admin/guests/${guestId}/cancel`, { method: 'POST' }),

  updateEventPublicInfo: (eventId: string, input: EventPublicInfoInput) =>
    request<{ info: { startTime: string | null; photosUrl: string | null } }>(
      `/api/v1/admin/events/${eventId}/public-info`,
      { method: 'PUT', body: JSON.stringify(input) },
    ),

  getGuestPass: (qrToken: string) =>
    request<{ pass: GuestPassView }>(`/api/v1/public/guest/${encodeURIComponent(qrToken)}`),

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

  listIpcHistory: () =>
    request<{ history: IpcHistoryEntry[]; staleness: IpcStalenessStatus }>('/api/v1/admin/ipc'),

  addIpcEntry: (input: CreateIpcEntryInput) =>
    request<{ entry: IpcHistoryEntry }>('/api/v1/admin/ipc', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  recordPayment: (beneficiaryId: string, input: RecordPaymentInput) =>
    request<RecordPaymentResult>(`/api/v1/admin/beneficiaries/${beneficiaryId}/payments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deletePayment: (paymentId: string) =>
    request<null>(`/api/v1/admin/payments/${paymentId}`, { method: 'DELETE' }),

  getBeneficiaryReport: (beneficiaryId: string) =>
    request<{ report: BeneficiaryReport }>(`/api/v1/admin/beneficiaries/${beneficiaryId}/report`),

  listClients: () => request<{ clients: ClientListItem[] }>('/api/v1/admin/clients'),

  getClientDetail: (userId: string) =>
    request<{ client: ClientDetail }>(`/api/v1/admin/clients/${userId}`),

  // -- Costeo (Plan Pro) ------------------------------------------------

  getCostConfig: () => request<{ config: TenantCostConfigSummary }>('/api/v1/admin/cost-config'),

  updateCostConfig: (input: TenantCostConfigInput) =>
    request<{ config: TenantCostConfigSummary }>('/api/v1/admin/cost-config', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  listCostCategories: () =>
    request<{ categories: CostCategorySummary[] }>('/api/v1/admin/cost-categories'),

  createCostCategory: (input: CostCategoryInput) =>
    request<{ category: CostCategorySummary }>('/api/v1/admin/cost-categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateCostCategory: (id: string, input: CostCategoryInput) =>
    request<{ category: CostCategorySummary }>(`/api/v1/admin/cost-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteCostCategory: (id: string) =>
    request<null>(`/api/v1/admin/cost-categories/${id}`, { method: 'DELETE' }),

  listExpenses: (filter: { eventId?: string; month?: string }) => {
    const params = new URLSearchParams();
    if (filter.eventId) params.set('eventId', filter.eventId);
    if (filter.month) params.set('month', filter.month);
    return request<{ list: ExpenseList }>(`/api/v1/admin/expenses?${params.toString()}`);
  },

  /** Multipart: `data` (JSON del gasto) + `receipt` (foto/PDF del ticket, opcional). */
  saveExpense: async (
    id: string | null,
    input: ExpenseInput,
    receipt: File | null,
  ): Promise<{ expense: ExpenseSummary }> => {
    const form = new FormData();
    form.append('data', JSON.stringify(input));
    if (receipt) form.append('receipt', receipt);
    const res = await fetch(`${API_URL}/api/v1/admin/expenses${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      credentials: 'include',
      body: form,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(
        body?.error?.message ?? 'No pudimos guardar el gasto',
        res.status,
        body?.error?.issues,
      );
    }
    return body;
  },

  deleteExpense: (id: string) =>
    request<null>(`/api/v1/admin/expenses/${id}`, { method: 'DELETE' }),

  getEventCosting: (eventId: string, guestCount?: number) =>
    request<{ costing: EventCostingSummary }>(
      `/api/v1/admin/events/${eventId}/costing${guestCount ? `?guestCount=${guestCount}` : ''}`,
    ),

  // -- Personal (Básica: ABM/asignación · Pro: horas/liquidación) -------

  listEmployees: () => request<{ employees: EmployeeSummary[] }>('/api/v1/admin/employees'),

  createEmployee: (input: EmployeeInput) =>
    request<{ employee: EmployeeSummary }>('/api/v1/admin/employees', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateEmployee: (id: string, input: EmployeeInput) =>
    request<{ employee: EmployeeSummary }>(`/api/v1/admin/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  /** Alta de acceso de puerta o reseteo: devuelve la contraseña temporal una sola vez. */
  grantDoorAccess: (employeeId: string) =>
    request<DoorAccessResult>(`/api/v1/admin/employees/${employeeId}/door-access`, {
      method: 'POST',
    }),

  // -- Check-in de invitados (Fase 3) ----------------------------------

  listCheckInEvents: () => request<{ events: CheckInEventSummary[] }>('/api/v1/checkin/events'),

  getCheckInEvent: (eventId: string) =>
    request<{ event: CheckInEventView }>(`/api/v1/checkin/events/${eventId}`),

  checkInLookup: (eventId: string, input: CheckInLookupInput) =>
    request<{ guests: CheckInGuestView[] }>(`/api/v1/checkin/events/${eventId}/lookup`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  checkInAdmit: (eventId: string, guestId: string, input: CheckInAdmitInput) =>
    request<{ guest: CheckInGuestView }>(
      `/api/v1/checkin/events/${eventId}/guests/${guestId}/admit`,
      { method: 'POST', body: JSON.stringify(input) },
    ),

  checkInReject: (eventId: string, guestId: string, input: CheckInRejectInput) =>
    request<null>(`/api/v1/checkin/events/${eventId}/guests/${guestId}/reject`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listEventStaff: (eventId: string) =>
    request<{ assignments: EventStaffAssignmentSummary[] }>(
      `/api/v1/admin/events/${eventId}/staff`,
    ),

  assignStaff: (eventId: string, input: EventStaffAssignmentInput) =>
    request<{ assignment: EventStaffAssignmentSummary }>(`/api/v1/admin/events/${eventId}/staff`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  unassignStaff: (assignmentId: string) =>
    request<null>(`/api/v1/admin/staff-assignments/${assignmentId}`, { method: 'DELETE' }),

  listTimeEntries: (employeeId: string) =>
    request<{ entries: EmployeeTimeEntrySummary[] }>(
      `/api/v1/admin/employees/${employeeId}/time-entries`,
    ),

  recordTimeEntry: (employeeId: string, input: EmployeeTimeEntryInput) =>
    request<{ entry: EmployeeTimeEntrySummary }>(
      `/api/v1/admin/employees/${employeeId}/time-entries`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),

  listPayrollEntries: (employeeId: string) =>
    request<{ entries: PayrollEntrySummary[] }>(`/api/v1/admin/employees/${employeeId}/payroll`),

  previewPayroll: (employeeId: string, period: string) =>
    request<{ preview: PayrollPreview }>(
      `/api/v1/admin/employees/${employeeId}/payroll/preview?period=${period}`,
    ),

  confirmPayroll: (employeeId: string, input: PayrollConfirmInput) =>
    request<{ entry: PayrollEntrySummary }>(`/api/v1/admin/employees/${employeeId}/payroll`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listCommissionAdvances: (employeeId: string) =>
    request<{ advances: CommissionAdvanceSummary[] }>(
      `/api/v1/admin/employees/${employeeId}/commission-advances`,
    ),

  recordCommissionAdvance: (employeeId: string, input: CommissionAdvanceInput) =>
    request<{ advance: CommissionAdvanceSummary }>(
      `/api/v1/admin/employees/${employeeId}/commission-advances`,
      { method: 'POST', body: JSON.stringify(input) },
    ),

  // -- CRM de consultas + Calendario de disponibilidad -------------------

  submitLead: (input: LeadIntakeInput) =>
    request<{ lead: LeadSummary }>('/api/v1/leads', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listLeads: (status?: string) =>
    request<{ leads: LeadSummary[] }>(`/api/v1/admin/leads${status ? `?status=${status}` : ''}`),

  updateLead: (id: string, input: UpdateLeadInput) =>
    request<{ lead: LeadSummary }>(`/api/v1/admin/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  getCalendar: (from: string, to: string) =>
    request<{ entries: CalendarEntry[] }>(`/api/v1/admin/calendar?from=${from}&to=${to}`),

  // -- Importación de Excel de alumnos (egreso) ---------------------------

  downloadAlumnosTemplate: async (): Promise<Blob> => {
    const res = await fetch(`${API_URL}/api/v1/admin/events/import-alumnos/template`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError('No pudimos descargar la plantilla', res.status);
    return res.blob();
  },

  importAlumnos: async (file: File): Promise<{ rows: ImportedAlumnoRow[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/v1/admin/events/import-alumnos`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(body?.error?.message ?? 'No pudimos leer el archivo', res.status);
    }
    return body as { rows: ImportedAlumnoRow[] };
  },

  // -- Contratos digitales -------------------------------------------------

  getAdminContract: (eventId: string) =>
    request<{ contract: EventContractSummary | null }>(`/api/v1/admin/events/${eventId}/contract`),

  uploadContract: async (
    eventId: string,
    file: File,
  ): Promise<{ contract: EventContractSummary }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/v1/admin/events/${eventId}/contract`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(body?.error?.message ?? 'No pudimos subir el contrato', res.status);
    }
    return body as { contract: EventContractSummary };
  },

  deleteContract: (eventId: string) =>
    request<null>(`/api/v1/admin/events/${eventId}/contract`, { method: 'DELETE' }),

  getPortalContract: (eventId: string) =>
    request<{ contract: EventContractSummary | null }>(`/api/v1/portal/events/${eventId}/contract`),

  // -- Recordatorios automáticos --------------------------------------------

  getReminderConfig: () =>
    request<{ config: ReminderConfigSummary }>('/api/v1/admin/reminder-config'),

  updateReminderConfig: (input: ReminderConfigInput) =>
    request<{ config: ReminderConfigSummary }>('/api/v1/admin/reminder-config', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  listReminderLogs: () => request<{ logs: ReminderLogSummary[] }>('/api/v1/admin/reminders/log'),

  runReminders: () =>
    request<{ result: ReminderSweepResult }>('/api/v1/admin/reminders/run', { method: 'POST' }),
};

/**
 * URL absoluta de un recurso de la API para usar en un <a href>/<img src>
 * (descargas, logos): la cookie de sesión viaja igual en una navegación
 * normal, no hace falta fetch+blob — mismo criterio que los contratos.
 */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
