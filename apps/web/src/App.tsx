import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import LandingPage from './routes/landing/LandingPage';
import LoginPage from './routes/LoginPage';
import RegisterPage from './routes/RegisterPage';
import HelpPage from './routes/HelpPage';
import PortalEventsPage from './routes/portal/PortalEventsPage';
import EventDetailPage from './routes/portal/EventDetailPage';
import AdminDashboardPage from './routes/admin/AdminDashboardPage';
import CreateEventPage from './routes/admin/CreateEventPage';
import AdminEventDetailPage from './routes/admin/AdminEventDetailPage';
import IpcStatusPage from './routes/admin/IpcStatusPage';
import CostConfigPage from './routes/admin/costing/CostConfigPage';
import EmployeesPage from './routes/admin/staff/EmployeesPage';
import PayrollPage from './routes/admin/staff/PayrollPage';
import LeadsPage from './routes/admin/crm/LeadsPage';
import AvailabilityCalendarPage from './routes/admin/calendar/AvailabilityCalendarPage';
import RemindersPage from './routes/admin/reminders/RemindersPage';
import BeneficiaryReportPage from './routes/admin/payments/BeneficiaryReportPage';
import ClientsPage from './routes/admin/clients/ClientsPage';
import ClientDetailPage from './routes/admin/clients/ClientDetailPage';
import { RequireAuth } from './routes/RequireAuth';
import { RequireAdmin } from './routes/admin/RequireAdmin';

export default function App() {
  return (
    <Routes>
      {/* La landing tiene su propio header/footer (ver routes/landing/) — no
          usa el Layout/SiteHeader de la app, igual que en cualquier producto
          real (marketing site vs. la app autenticada). */}
      <Route path="/" element={<LandingPage />} />

      {/* Reporte imprimible: documento standalone, sin Layout/SiteHeader. */}
      <Route element={<RequireAdmin />}>
        <Route
          path="/admin/beneficiarios/:beneficiaryId/reporte"
          element={<BeneficiaryReportPage />}
        />
      </Route>

      <Route element={<Layout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/ayuda" element={<HelpPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/portal" element={<PortalEventsPage />} />
          <Route path="/portal/eventos/:eventId" element={<EventDetailPage />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/eventos/nuevo" element={<CreateEventPage />} />
          <Route path="/admin/eventos/:eventId" element={<AdminEventDetailPage />} />
          <Route path="/admin/ipc" element={<IpcStatusPage />} />
          <Route path="/admin/costeo/config" element={<CostConfigPage />} />
          <Route path="/admin/personal" element={<EmployeesPage />} />
          <Route path="/admin/personal/:employeeId/liquidacion" element={<PayrollPage />} />
          <Route path="/admin/consultas" element={<LeadsPage />} />
          <Route path="/admin/calendario" element={<AvailabilityCalendarPage />} />
          <Route path="/admin/recordatorios" element={<RemindersPage />} />
          <Route path="/admin/clientes" element={<ClientsPage />} />
          <Route path="/admin/clientes/:userId" element={<ClientDetailPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
