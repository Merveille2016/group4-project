import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GraduationCap } from '../components/Icons'
import './Login.css'
import PasswordInput from '../components/PasswordInput'
import { idleLabel } from '../auth/idle'

function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Send people back to the page they came from
  const from = location.state?.from || '/'
  const notices = {
    idle: `You were logged out after ${idleLabel()} of inactivity. Please log in again.`,
    expired: 'Your session has ended. Please log in again.',
  }
  const notice = !error && notices[location.state?.reason]

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  if (user && !loading) return <Navigate to={from} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <span className="auth-icon"><GraduationCap /></span>
        <h1 id="login-title">Welcome back</h1>
        <p className="form-intro">Sign in to your UniGuide account.</p>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              placeholder="Your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button className="submit-button" type="submit" disabled={loading} aria-busy={loading}>
            {loading ? <><span className="spinner" aria-hidden="true" /> Signing in...</> : 'Log in'}
          </button>
        </form>

        <p className="form-footer">
          Don’t have an account? <Link to="/signup" state={location.state}>Sign up</Link>
        </p>
      </section>
    </main>
  )
}

export default Login
