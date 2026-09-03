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
} from './enums';
export type {
  Plan,
  Role,
  EventType,
  EventStatus,
  CardType,
  AccountRole,
  TokenPurpose,
} from './enums';

export { RegisterSchema, LoginSchema, PublicUserSchema } from './auth';
export type { RegisterInput, LoginInput, PublicUser } from './auth';

export type {
  CardSummary,
  PaymentSummary,
  EventAccessScope,
  EventSummary,
  EventDetail,
} from './portal';

export {
  EventCardInputSchema,
  AlumnoInputSchema,
  CreateEventSchema,
  CreateIpcEntrySchema,
} from './admin';
export type {
  EventCardInput,
  AlumnoInput,
  CreateEventInput,
  CreateIpcEntryInput,
  AdminEventListItem,
  DashboardSummary,
  AdminBeneficiaryDetail,
  AdminEventDetail,
  IpcHistoryEntry,
} from './admin';
