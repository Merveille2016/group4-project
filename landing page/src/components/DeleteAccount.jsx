import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import PasswordInput from './PasswordInput'

function DeleteAccount() {
  const { deleteAccount } = useAuth()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function cancel() {
    setOpen(false)
    setPassword('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await deleteAccount(password)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <section className="panel danger-zone">
      <h2>Delete account</h2>
      <p>This permanently removes your account. You can’t undo it.</p>

      {!open ? (
        <button type="button" className="danger-button" onClick={() => setOpen(true)}>Delete my account</button>
      ) : (
        <form className="delete-form" onSubmit={handleSubmit}>
          <label htmlFor="delete-password">Enter your password to confirm</label>
          <PasswordInput
            id="delete-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
            required
          />
          {error && <p className="delete-error" role="alert">{error}</p>}
          <div className="delete-actions">
            <button type="button" className="cancel-button" onClick={cancel} disabled={loading}>Cancel</button>
            <button type="submit" className="danger-button" disabled={loading || !password}>
              {loading ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default DeleteAccount
