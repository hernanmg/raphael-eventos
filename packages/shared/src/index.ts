// Re-exports explícitos (no "export *"): TypeScript compila "export *" a un
// helper CJS (__exportStar) que Rollup no puede analizar estáticamente, y
// vite build (apps/web) fallaba en producción con "X is not exported by
// .../shared/dist/index.js" aunque el símbolo existía en runtime. Con
// bindings nombrados, tsc emite exports directos que sí son detectables.

export {
  PlanSchema,
  RoleSchema,
  EventTypeSchema,
  EventStatusSchema,
  CardTypeSchema,
  AccountRoleSchema,
  TokenPurposeSchema,
  EmployeeContractTypeSchema,
  EmployeeVariableTypeSchema,
  LeadStatusSchema,
  SupplyUnitSchema,
} from './enums';
export type {
  Plan,
  Role,
  EventType,
  EventStatus,
  CardType,
  AccountRole,
  TokenPurpose,
  EmployeeContractType,
  EmployeeVariableType,
  LeadStatus,
  SupplyUnit,
} from './enums';

export { RegisterSchema, LoginSchema, ChangePasswordSchema, PublicUserSchema } from './auth';
export type { RegisterInput, LoginInput, ChangePasswordInput, PublicUser } from './auth';

export type {
  CardSummary,
  PaymentSummary,
  PaymentAllocationSummary,
  EventAccessScope,
  EventSummary,
  EventDetail,
} from './portal';

export {
  EventCardInputSchema,
  AlumnoInputSchema,
  CreateEventSchema,
  UpdateEventSchema,
  CardAdjustmentSchema,
  CreateIpcEntrySchema,
  RecordPaymentSchema,
} from './admin';
export type {
  EventCardInput,
  AlumnoInput,
  CreateEventInput,
  UpdateEventInput,
  CardAdjustmentInput,
  CreateIpcEntryInput,
  AdminEventListItem,
  DashboardSummary,
  AdminBeneficiaryDetail,
  AdminEventDetail,
  BeneficiaryReport,
  ClientDetail,
  ClientEventSummary,
  ClientListItem,
  EventContractSummary,
  ImportedAlumnoRow,
  IpcHistoryEntry,
  IpcStalenessStatus,
  RecordPaymentInput,
  RecordPaymentResult,
} from './admin';

export {
  TenantCostConfigInputSchema,
  SupplyCategoryInputSchema,
  ServiceCostCategoryInputSchema,
  FixedCostCategoryInputSchema,
  EventSupplyLineInputSchema,
  EventServiceCostInputSchema,
} from './costing';
export type {
  TenantCostConfigInput,
  SupplyCategoryInput,
  ServiceCostCategoryInput,
  FixedCostCategoryInput,
  EventSupplyLineInput,
  EventServiceCostInput,
  TenantCostConfigSummary,
  SupplyCategorySummary,
  ServiceCostCategorySummary,
  FixedCostCategorySummary,
  EventSupplyLineSummary,
  EventServiceCostSummary,
  EventCostingSummary,
} from './costing';

export { LeadIntakeSchema, UpdateLeadSchema } from './crm';
export type { LeadIntakeInput, UpdateLeadInput, LeadSummary, CalendarEntry } from './crm';

export { ReminderConfigInputSchema } from './reminders';
export type {
  ReminderConfigInput,
  ReminderConfigSummary,
  ReminderLogSummary,
  ReminderSweepResult,
} from './reminders';

export {
  EmployeeInputSchema,
  EventStaffAssignmentInputSchema,
  EmployeeTimeEntryInputSchema,
  PayrollPeriodInputSchema,
  CommissionAdvanceInputSchema,
} from './staff';
export type {
  EmployeeInput,
  EventStaffAssignmentInput,
  EmployeeTimeEntryInput,
  PayrollPeriodInput,
  CommissionAdvanceInput,
  EmployeeSummary,
  EventStaffAssignmentSummary,
  EmployeeTimeEntrySummary,
  PayrollEntrySummary,
  CommissionAdvanceSummary,
  DoorAccessResult,
} from './staff';

export {
  GuestRsvpSchema,
  GuestInputSchema,
  AdminGuestInputSchema,
  EventPublicInfoSchema,
  CheckInLookupSchema,
  CheckInAdmitSchema,
  CheckInRejectSchema,
} from './guests';
export type {
  GuestRsvpInput,
  GuestInput,
  AdminGuestInput,
  EventPublicInfoInput,
  GuestSource,
  GuestSummary,
  GuestAttendance,
  PortalGuestsView,
  AdminGuestsView,
  GuestStatus,
  PublicEventInfo,
  InviteView,
  GuestPassView,
  CheckInEventSummary,
  CheckInLookupInput,
  CheckInAdmitInput,
  CheckInRejectInput,
  CheckInGuestView,
  CheckInEventView,
} from './guests';

export type { SalonProfile } from './salon';

export { ProviderInputSchema, SponsorInputSchema } from './providers';
export type {
  ProviderInput,
  SponsorInput,
  PublicProvider,
  AdminProvider,
  PublicSponsor,
  AdminSponsor,
} from './providers';

export { AUDIT_AREAS } from './audit';
export type { AuditActionType, AuditLogEntry, AuditLogPage } from './audit';

export type { MonthReport, YearReport } from './reports';
