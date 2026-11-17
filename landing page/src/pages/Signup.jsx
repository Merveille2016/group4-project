import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { GraduationCap } from '../components/Icons'
import './Login.css'

function Signup() {
  const { user, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from || '/'
  const mismatch = confirm.length > 0 && confirm !== password

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  if (user && !loading) return <Navigate to={from} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    if (password !== confirm) return

    setError('')
    setLoading(true)
    try {
      await signup(name.trim(), email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-title">
        <span className="auth-icon"><GraduationCap /></span>
        <h1 id="signup-title">Create your account</h1>
        <p className="form-intro">Sign up to start exploring universities.</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              placeholder="Your name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

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
            <input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              placeholder="Type your password again"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? 'confirm-error' : undefined}
              required
            />
            {mismatch && <span className="field-error" id="confirm-error">Passwords do not match.</span>}
          </div>

          <button className="submit-button" type="submit" disabled={loading || mismatch} aria-busy={loading}>
            {loading ? <><span className="spinner" aria-hidden="true" /> Creating account...</> : 'Create account'}
          </button>
        </form>

        <p className="form-footer">
          Already have an account? <Link to="/login" state={location.state}>Log in</Link>
        </p>
      </section>
    </main>
  )
}

export default Signup
