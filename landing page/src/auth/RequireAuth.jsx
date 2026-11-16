import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function RequireAuth({ children }) {
  const { user, endedBy } = useAuth()
  const location = useLocation()

  if (!user) {
    // Someone who just clicked Logout wants to leave, not log in again
    if (endedBy === 'user') return <Navigate to="/" replace />
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export default RequireAuth
