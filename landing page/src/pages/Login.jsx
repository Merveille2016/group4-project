import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthError } from '../api'
import { GraduationCap, ShieldIcon } from '../components/Icons'
import './Login.css'
import PasswordInput from '../components/PasswordInput'

function Login() {
  const { user, login, verifyCode, recover } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  // 'password', then 'code' or 'backup' for accounts with 2FA
  const [step, setStep] = useState('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Browsers do not autofill read only fields, so they unlock when clicked
  const [locked, setLocked] = useState(true)

  // Send people back to the page they came from
  const from = location.state?.from || '/'
  const notices = {
    registered: 'Your account has been created. Please log in.',
    expired: 'Your session has ended. Please log in again.',
    reset: 'Your password has been reset. Please log in with your new password.',
  }
  const notice = !error && step === 'password' && notices[location.state?.reason]

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  if (user && !loading) return <Navigate to={from} replace />

  function backToPassword(message = '') {
    setStep('password')
    setPassword('')
    setCode('')
    setError(message)
  }

  function switchStep(next) {
    setStep(next)
    setCode('')
    setError('')
  }

  async function handlePassword(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result.twoFactorRequired) {
        setStep('code')
        setLoading(false)
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleCode(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      // Six digits is an app code, anything else is treated as a backup code
      const appCode = /^\d{6}$/.test(code.replace(/\s/g, ''))
      if (step === 'backup' || !appCode) {
        await recover(code)
      } else {
        await verifyCode(code)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setLoading(false)
      // The pre-auth timed out or ran out of attempts, so the password is needed again
      if (err instanceof AuthError) backToPassword(err.message)
      else setError(err.message)
    }
  }

  if (step !== 'password') {
    const backup = step === 'backup'
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="code-title">
          <span className="auth-icon"><ShieldIcon /></span>
          <h1 id="code-title">{backup ? 'Use a backup code' : 'Two factor check'}</h1>
          <p className="form-intro">
            {backup
              ? 'Enter one of the backup codes you saved when you turned on two factor authentication.'
              : 'Enter the 6 digit code from your authenticator app, or one of your backup codes.'}
          </p>

          {error && <p className="form-error" role="alert">{error}</p>}

          <form className="auth-form" onSubmit={handleCode}>
            <div className="field">
              <label htmlFor="code">{backup ? 'Backup code' : 'Code'}</label>
              <input
                id="code"
                className={backup ? undefined : 'code-input'}
                type="text"
                autoComplete="one-time-code"
                placeholder={backup ? 'xxxxx-xxxxx' : '123456 or xxxxx-xxxxx'}
                maxLength={11}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <button className="submit-button" type="submit" disabled={loading || !code.trim()} aria-busy={loading}>
              {loading ? <><span className="spinner" aria-hidden="true" /> Checking...</> : 'Verify'}
            </button>
          </form>

          <div className="form-links">
            {backup
              ? <button type="button" className="link-button" onClick={() => switchStep('code')}>Use my authenticator app</button>
              : <button type="button" className="link-button" onClick={() => switchStep('backup')}>Lost your phone? Use a backup code</button>}
            <button type="button" className="link-button" onClick={() => backToPassword()}>Back to sign in</button>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <span className="auth-icon"><GraduationCap /></span>
        <h1 id="login-title">Welcome back</h1>
        <p className="form-intro">Sign in to your UniGuide account.</p>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}

        <form className="auth-form" onSubmit={handlePassword}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="off"
              readOnly={locked}
              onFocus={() => setLocked(false)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="field">
            <div className="field-row">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="field-link">Forgot password?</Link>
            </div>
            <PasswordInput
              id="password"
              placeholder="Your password"
              autoComplete="off"
              readOnly={locked}
              onFocus={() => setLocked(false)}
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
