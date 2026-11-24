import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPasswordRequest } from '../api'
import { KeyIcon } from '../components/Icons'
import PasswordInput from '../components/PasswordInput'
import './Login.css'

const MIN_LENGTH = 8

function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(token ? '' : 'This reset link is incomplete. Please request a new one.')

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = confirm.length > 0 && confirm !== password

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    if (tooShort || password !== confirm) return

    setError('')
    setLoading(true)
    try {
      await resetPasswordRequest(token, password)
      navigate('/login', { replace: true, state: { reason: 'reset' } })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const badLink = !token || /invalid or has expired/i.test(error)

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="reset-title">
        <span className="auth-icon"><KeyIcon /></span>
        <h1 id="reset-title">Choose a new password</h1>
        <p className="form-intro">Use at least {MIN_LENGTH} characters. You will be signed out everywhere else.</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        {badLink ? (
          <Link to="/forgot-password" className="submit-button">Request a new link</Link>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={tooShort}
                disabled={loading}
                autoFocus
                required
              />
              {tooShort && <span className="field-error">Password must be at least {MIN_LENGTH} characters</span>}
            </div>

            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                aria-invalid={mismatch}
                disabled={loading}
                required
              />
              {mismatch && <span className="field-error">Passwords do not match</span>}
            </div>

            <button className="submit-button" type="submit" disabled={loading || tooShort || mismatch} aria-busy={loading}>
              {loading ? <><span className="spinner" aria-hidden="true" /> Saving...</> : 'Reset password'}
            </button>
          </form>
        )}

        <p className="form-footer">
          <Link to="/login">Back to login</Link>
        </p>
      </section>
    </main>
  )
}

export default ResetPassword
