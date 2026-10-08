import type {
  AdminEventDetail,
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
  EventCostingSummary,
  EventDetail,
  EventServiceCostInput,
  EventServiceCostSummary,
  EventStaffAssignmentInput,
  EventStaffAssignmentSummary,
  EventSummary,
  EventSupplyLineInput,
  EventSupplyLineSummary,
  FixedCostCategoryInput,
  FixedCostCategorySummary,
  IpcHistoryEntry,
  LoginInput,
  PayrollEntrySummary,
  ReminderConfigInput,
  ReminderConfigSummary,
  ReminderLogSummary,
  ReminderSweepResult,
  PayrollPeriodInput,
  Plan,
  PublicUser,
  RegisterInput,
  ServiceCostCategoryInput,
  ServiceCostCategorySummary,
  SupplyCategoryInput,
  SupplyCategorySummary,
  TenantCostConfigInput,
  TenantCostConfigSummary,
} from '@raphael-eventos/shared';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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

  listSupplyCategories: () =>
    request<{ categories: SupplyCategorySummary[] }>('/api/v1/admin/supply-categories'),

  createSupplyCategory: (input: SupplyCategoryInput) =>
    request<{ category: SupplyCategorySummary }>('/api/v1/admin/supply-categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteSupplyCategory: (id: string) =>
    request<null>(`/api/v1/admin/supply-categories/${id}`, { method: 'DELETE' }),

  listServiceCostCategories: () =>
    request<{ categories: ServiceCostCategorySummary[] }>('/api/v1/admin/service-cost-categories'),

  createServiceCostCategory: (input: ServiceCostCategoryInput) =>
    request<{ category: ServiceCostCategorySummary }>('/api/v1/admin/service-cost-categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  deleteServiceCostCategory: (id: string) =>
    request<null>(`/api/v1/admin/service-cost-categories/${id}`, { method: 'DELETE' }),

  listFixedCostCategories: () =>
    request<{ categories: FixedCostCategorySummary[] }>('/api/v1/admin/fixed-cost-categories'),

  createFixedCostCategory: (input: FixedCostCategoryInput) =>
    request<{ category: FixedCostCategorySummary }>('/api/v1/admin/fixed-cost-categories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateFixedCostCategory: (id: string, input: FixedCostCategoryInput) =>
    request<{ category: FixedCostCategorySummary }>(`/api/v1/admin/fixed-cost-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteFixedCostCategory: (id: string) =>
    request<null>(`/api/v1/admin/fixed-cost-categories/${id}`, { method: 'DELETE' }),

  createEventSupplyLine: (eventId: string, input: EventSupplyLineInput) =>
    request<{ line: EventSupplyLineSummary }>(`/api/v1/admin/events/${eventId}/supply-lines`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateEventSupplyLine: (id: string, input: EventSupplyLineInput) =>
    request<{ line: EventSupplyLineSummary }>(`/api/v1/admin/supply-lines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteEventSupplyLine: (id: string) =>
    request<null>(`/api/v1/admin/supply-lines/${id}`, { method: 'DELETE' }),

  createEventServiceCost: (eventId: string, input: EventServiceCostInput) =>
    request<{ cost: EventServiceCostSummary }>(`/api/v1/admin/events/${eventId}/service-costs`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateEventServiceCost: (id: string, input: EventServiceCostInput) =>
    request<{ cost: EventServiceCostSummary }>(`/api/v1/admin/service-costs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),

  deleteEventServiceCost: (id: string) =>
    request<null>(`/api/v1/admin/service-costs/${id}`, { method: 'DELETE' }),

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

  computePayroll: (employeeId: string, input: PayrollPeriodInput) =>
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
