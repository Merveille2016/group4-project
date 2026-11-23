import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPasswordRequest } from '../api'
import { KeyIcon } from '../components/Icons'
import './Login.css'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await forgotPasswordRequest(email.trim())
      setSent(data.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="forgot-title">
        <span className="auth-icon"><KeyIcon /></span>
        <h1 id="forgot-title">Forgot your password?</h1>
        <p className="form-intro">Enter your email and we will send you a link to choose a new one.</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        {sent ? (
          <>
            <p className="form-notice" role="status">{sent}</p>
            <p className="form-hint">The link works once and expires in 30 minutes. Check your spam folder if you don’t see it.</p>
            <button type="button" className="link-button" onClick={() => setSent('')}>Send it to a different email</button>
          </>
        ) : (
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
                autoFocus
                required
              />
            </div>

            <button className="submit-button" type="submit" disabled={loading} aria-busy={loading}>
              {loading ? <><span className="spinner" aria-hidden="true" /> Sending...</> : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="form-footer">
          Remembered it? <Link to="/login">Back to login</Link>
        </p>
      </section>
    </main>
  )
}

export default ForgotPassword
