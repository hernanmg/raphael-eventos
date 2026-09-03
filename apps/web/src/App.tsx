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
import { RequireAuth } from './routes/RequireAuth';
import { RequireAdmin } from './routes/admin/RequireAdmin';

export default function App() {
  return (
    <Routes>
      {/* La landing tiene su propio header/footer (ver routes/landing/) — no
          usa el Layout/SiteHeader de la app, igual que en cualquier producto
          real (marketing site vs. la app autenticada). */}
      <Route path="/" element={<LandingPage />} />

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
        </Route>
      </Route>
    </Routes>
  );
}
