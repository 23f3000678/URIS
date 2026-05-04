import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './routes/ProtectedRoute'
import SessionGuard  from './components/SessionGuard'
import Landing       from './pages/Landing'
import Login         from './pages/Login'
import Register      from './pages/Register'
import Dashboard     from './pages/Dashboard'
import Availability  from './pages/Availability'
import Tasks         from './pages/Tasks'
import Review        from './pages/Review'
import Team          from './pages/Team'
import Alerts        from './pages/Alerts'
import AdminOverview from './pages/AdminOverview'
import AuditLogs     from './features/admin/AuditLogs'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* SessionGuard must be inside BrowserRouter so useNavigate works.
            It is a no-op when the user is not authenticated. */}
        <SessionGuard />

        <Routes>
          {/* Public routes */}
          <Route path="/"         element={<Landing />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected — any authenticated user */}
          <Route path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/availability"
            element={<ProtectedRoute><Availability /></ProtectedRoute>} />
          <Route path="/tasks"
            element={<ProtectedRoute><Tasks /></ProtectedRoute>} />

          {/* Protected — admin only */}
          <Route path="/review"
            element={<ProtectedRoute adminOnly><Review /></ProtectedRoute>} />
          <Route path="/team"
            element={<ProtectedRoute adminOnly><Team /></ProtectedRoute>} />
          <Route path="/alerts"
            element={<ProtectedRoute adminOnly><Alerts /></ProtectedRoute>} />
          <Route path="/admin"
            element={<ProtectedRoute adminOnly><AdminOverview /></ProtectedRoute>} />
          <Route path="/audit-logs"
            element={<ProtectedRoute adminOnly><AuditLogs /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
