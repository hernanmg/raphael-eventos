import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import LandingPage from './routes/landing/LandingPage';
import LoginPage from './routes/LoginPage';
import RegisterPage from './routes/RegisterPage';
import HelpPage from './routes/HelpPage';
import PortalEventsPage from './routes/portal/PortalEventsPage';
import EventDetailPage from './routes/portal/EventDetailPage';
import ChangePasswordPage from './routes/ChangePasswordPage';
import CheckInEventsPage from './routes/checkin/CheckInEventsPage';
import { RequireAuth } from './routes/RequireAuth';

// Carga diferida de las pantallas que usan librerías de QR (qrcode,
// qr-scanner): el invitado que abre el micrositio no descarga el panel, y el
// bundle principal no carga con el escáner.
// Panel admin con carga diferida: un visitante de la landing o un cliente del
// portal no descarga sus pantallas (además mantiene el bundle principal bajo
// los 500 kB del aviso de Vite).
const AdminDashboardPage = lazy(() => import('./routes/admin/AdminDashboardPage'));
const CreateEventPage = lazy(() => import('./routes/admin/CreateEventPage'));
const AdminEventDetailPage = lazy(() => import('./routes/admin/AdminEventDetailPage'));
const IpcStatusPage = lazy(() => import('./routes/admin/IpcStatusPage'));
const CostConfigPage = lazy(() => import('./routes/admin/costing/CostConfigPage'));
const ExpensesPage = lazy(() => import('./routes/admin/costing/ExpensesPage'));
const EmployeesPage = lazy(() => import('./routes/admin/staff/EmployeesPage'));
const PayrollPage = lazy(() => import('./routes/admin/staff/PayrollPage'));
const LeadsPage = lazy(() => import('./routes/admin/crm/LeadsPage'));
const AvailabilityCalendarPage = lazy(
  () => import('./routes/admin/calendar/AvailabilityCalendarPage'),
);
const RemindersPage = lazy(() => import('./routes/admin/reminders/RemindersPage'));
const BeneficiaryReportPage = lazy(() => import('./routes/admin/payments/BeneficiaryReportPage'));
const ClientsPage = lazy(() => import('./routes/admin/clients/ClientsPage'));
const ClientDetailPage = lazy(() => import('./routes/admin/clients/ClientDetailPage'));
const AuditLogPage = lazy(() => import('./routes/admin/audit/AuditLogPage'));
const ProvidersPage = lazy(() => import('./routes/admin/providers/ProvidersPage'));
const ReportsPage = lazy(() => import('./routes/admin/reports/ReportsPage'));

const InvitePage = lazy(() => import('./routes/guests/InvitePage'));
const GuestPassPage = lazy(() => import('./routes/guests/GuestPassPage'));
const CheckInScanPage = lazy(() => import('./routes/checkin/CheckInScanPage'));

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-center text-sm text-muted">Cargando…</p>}>
      {children}
    </Suspense>
  );
}
import { RequireAdmin } from './routes/admin/RequireAdmin';

export default function App() {
  return (
    <Routes>
      {/* La landing tiene su propio header/footer (ver routes/landing/) — no
          usa el Layout/SiteHeader de la app, igual que en cualquier producto
          real (marketing site vs. la app autenticada). */}
      <Route path="/" element={<LandingPage />} />

      {/* Micrositio de invitados (Fase 3): público, sin cuenta, sin el
          Layout/SiteHeader de la app — el acceso es por el token del link. */}
      <Route
        path="/i/:inviteToken"
        element={
          <Lazy>
            <InvitePage />
          </Lazy>
        }
      />
      <Route
        path="/q/:qrToken"
        element={
          <Lazy>
            <GuestPassPage />
          </Lazy>
        }
      />

      {/* Reporte imprimible: documento standalone, sin Layout/SiteHeader. */}
      <Route element={<RequireAdmin />}>
        <Route
          path="/admin/beneficiarios/:beneficiaryId/reporte"
          element={
            <Lazy>
              <BeneficiaryReportPage />
            </Lazy>
          }
        />
      </Route>

      <Route element={<Layout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/ayuda" element={<HelpPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />
        </Route>
        <Route element={<RequireAuth roles={['CLIENTE', 'ADMIN', 'VENDEDOR']} />}>
          <Route path="/portal" element={<PortalEventsPage />} />
          <Route path="/portal/eventos/:eventId" element={<EventDetailPage />} />
        </Route>
        <Route element={<RequireAuth roles={['PUERTA', 'ADMIN', 'VENDEDOR']} />}>
          <Route path="/checkin" element={<CheckInEventsPage />} />
          <Route
            path="/checkin/:eventId"
            element={
              <Lazy>
                <CheckInScanPage />
              </Lazy>
            }
          />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/eventos/nuevo" element={<CreateEventPage />} />
          <Route path="/admin/eventos/:eventId" element={<AdminEventDetailPage />} />
          <Route path="/admin/ipc" element={<IpcStatusPage />} />
          <Route path="/admin/costeo/config" element={<CostConfigPage />} />
          <Route path="/admin/gastos" element={<ExpensesPage />} />
          <Route path="/admin/personal" element={<EmployeesPage />} />
          <Route path="/admin/personal/:employeeId/liquidacion" element={<PayrollPage />} />
          <Route path="/admin/consultas" element={<LeadsPage />} />
          <Route path="/admin/calendario" element={<AvailabilityCalendarPage />} />
          <Route path="/admin/recordatorios" element={<RemindersPage />} />
          <Route path="/admin/clientes" element={<ClientsPage />} />
          <Route path="/admin/clientes/:userId" element={<ClientDetailPage />} />
          <Route path="/admin/reportes" element={<ReportsPage />} />
          <Route path="/admin/proveedores" element={<ProvidersPage />} />
          <Route path="/admin/auditoria" element={<AuditLogPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
