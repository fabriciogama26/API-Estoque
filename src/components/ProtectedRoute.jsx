import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usePermissions } from '../context/PermissionsContext.jsx'
import { getRecoveryRedirect } from '../utils/recoveryRedirect.js'

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const { canAccessPath, loading } = usePermissions()
  const location = useLocation()

  const recoveryRedirect = getRecoveryRedirect(location)
  if (recoveryRedirect && location.pathname !== '/reset-password') {
    return <Navigate to={recoveryRedirect} replace />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (loading) {
    return (
      <div className="page-loading" role="status" aria-live="polite">
        Validando credencial...
      </div>
    )
  }

  if (!canAccessPath(location.pathname)) {
    return <Navigate to="/sem-acesso" replace state={{ from: location }} />
  }

  return <Outlet />
}
