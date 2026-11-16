import { useState } from 'react'
import './App.css'

function App() {
  const [isSignup, setIsSignup] = useState(true)
  const [confirmationError, setConfirmationError] = useState('')
  const [notice, setNotice] = useState('')

  function changeMode(signup) {
    setIsSignup(signup)
    setConfirmationError('')
    setNotice('')
  }

  function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    if (isSignup && form.get('password') !== form.get('confirmation')) {
      setConfirmationError('Passwords do not match.')
      setNotice('')
      return
    }

    setConfirmationError('')
    setNotice('Your details look good. Authentication is not connected yet.')
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="form-title">
        <a className="brand" href="/" aria-label="Forma home">UniGuide</a>
        <h1 id="form-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="form-intro">{isSignup ? 'Sign up to get started.' : 'Sign in to your account.'}</p>

        <div className="mode-switch" role="tablist" aria-label="Account access">
          <button
            className={isSignup ? 'mode-tab active' : 'mode-tab'}
            type="button"
            role="tab"
            aria-selected={isSignup}
            aria-controls="auth-form"
            onClick={() => changeMode(true)}
          >
            Sign up
          </button>
          <button
            className={isSignup ? 'mode-tab' : 'mode-tab active'}
            type="button"
            role="tab"
            aria-selected={!isSignup}
            aria-controls="auth-form"
            onClick={() => changeMode(false)}
          >
            Log in
          </button>
        </div>

        <form
          className="auth-form"
          id="auth-form"
          onSubmit={handleSubmit}
          onChange={() => {
            setConfirmationError('')
            setNotice('')
          }}
        >
          {isSignup && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" name="name" type="text" placeholder="enter your name" required />
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="enter your email" autoComplete="email" required />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </div>

          {isSignup && (
            <div className="field">
              <label htmlFor="confirmation">Confirm password</label>
              <input
                id="confirmation"
                name="confirmation"
                type="password"
                placeholder="Enter your password again"
                autoComplete="new-password"
                aria-invalid={Boolean(confirmationError)}
                aria-describedby={confirmationError ? 'confirmation-error' : undefined}
                required
              />
              {confirmationError && (
                <span className="field-error" id="confirmation-error">{confirmationError}</span>
              )}
            </div>
          )}

          <button className="submit-button" type="submit">
            {isSignup ? 'Create account' : 'Log in'}
          </button>
          {notice && <p className="form-notice" role="status">{notice}</p>}
        </form>

        <p className="form-footer">
          {isSignup ? 'Already have an account?' : 'Don’t have an account?'}{' '}
          <button className="text-button" type="button" onClick={() => changeMode(!isSignup)}>
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </section>
    </main>
  )
}

export default App
