import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Pages a "shared" user may open; everything else sends them back to /compartidos.
const SHARED_PATHS = [
  /^\/compartidos\/?$/,
  /^\/search\/?$/,
  /^\/phrases\/zen\/?$/,
  /^\/phrases\/stats\/?$/,
  /^\/phrases\/zen\/stats\/?$/,
  /^\/phrases\/\d+\/?$/,
  /^\/phrases\/\d+\/evaluation\/?$/,
]

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, sharedOnly } = useAuth()
  const { pathname } = useLocation()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (sharedOnly && !SHARED_PATHS.some((re) => re.test(pathname))) {
    return <Navigate to="/compartidos" replace />
  }
  return children
}
