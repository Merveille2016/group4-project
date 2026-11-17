import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function RequireAuth({ children }) {
  const { user, checking, endedBy } = useAuth()
  const location = useLocation()

  // Wait for the session check before deciding, or a refresh would bounce to /login
  if (checking) return <main className="auth-checking" aria-busy="true" />

  if (!user) {
    // Someone who just logged out or deleted their account wants to leave, not log in again
    if (endedBy === 'user' || endedBy === 'deleted') return <Navigate to="/" replace />
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: endedBy }} />
  }
  return children
}

export default RequireAuth
