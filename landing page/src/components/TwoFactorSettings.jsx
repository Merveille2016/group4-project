import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  AuthError, disableTwoFactorRequest, enableTwoFactorRequest, newBackupCodesRequest, setupTwoFactorRequest, twoFactorStatusRequest,
} from '../api'
import PasswordInput from './PasswordInput'

function BackupCodes({ codes, onDone }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function download() {
    const blob = new Blob([`UniGuide backup codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'uniguide-backup-codes.txt'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="backup-box">
      <p className="security-text">
        Save these backup codes somewhere safe. Each one works once if you lose your phone. They won’t be shown again.
      </p>
      <ul className="backup-codes" aria-label="Backup codes">
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <div className="security-actions">
        <button type="button" className="cancel-button" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" className="cancel-button" onClick={download}>Download</button>
        <button type="button" className="primary-button" onClick={onDone}>I’ve saved them</button>
      </div>
    </div>
  )
}

function CodeField({ id, label, value, onChange, disabled }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        maxLength={11}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
      />
    </>
  )
}

function TwoFactorSettings() {
  const { updateUser, logout } = useAuth()
  const [status, setStatus] = useState(null)
  // null, 'setup', 'codes', 'regenerate' or 'disable'
  const [mode, setMode] = useState(null)
  const [setup, setSetup] = useState(null)
  const [codes, setCodes] = useState([])
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    twoFactorStatusRequest()
      .then((data) => { if (!cancelled) setStatus(data) })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof AuthError) logout('expired')
        else setError(err.message)
      })
    return () => { cancelled = true }
  }, [logout])

  function reset(nextMode = null) {
    setMode(nextMode)
    setCode('')
    setPassword('')
    setError('')
  }

  async function run(action) {
    setError('')
    setLoading(true)
    try {
      await action()
    } catch (err) {
      if (err instanceof AuthError) logout('expired')
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const startSetup = () => run(async () => {
    setSetup(await setupTwoFactorRequest())
    reset('setup')
  })

  const confirmSetup = (event) => {
    event.preventDefault()
    run(async () => {
      const data = await enableTwoFactorRequest(code)
      updateUser(data.admin)
      setCodes(data.backupCodes)
      setSetup(null)
      setStatus({ enabled: true, backupCodesLeft: data.backupCodes.length })
      reset('codes')
    })
  }

  const regenerate = (event) => {
    event.preventDefault()
    run(async () => {
      const data = await newBackupCodesRequest(code)
      setCodes(data.backupCodes)
      setStatus({ enabled: true, backupCodesLeft: data.backupCodes.length })
      reset('codes')
    })
  }

  const disable = (event) => {
    event.preventDefault()
    run(async () => {
      const data = await disableTwoFactorRequest(password, code)
      updateUser(data.admin)
      setStatus({ enabled: false, backupCodesLeft: 0 })
      reset()
    })
  }

  if (!status) {
    return (
      <section className="panel">
        <h2>Two factor authentication</h2>
        {error ? <p className="delete-error" role="alert">{error}</p> : <p className="security-text">Loading...</p>}
      </section>
    )
  }

  return (
    <section className="panel" aria-labelledby="security-title">
      <div className="panel-heading">
        <h2 id="security-title">Two factor authentication</h2>
        <span className={`status ${status.enabled ? 'ok' : 'pending'}`}>
          <span className="dot" /> {status.enabled ? 'On' : 'Off'}
        </span>
      </div>

      {mode === 'codes' && <BackupCodes codes={codes} onDone={() => { setCodes([]); reset() }} />}

      {mode === 'setup' && setup && (
        <form className="security-form" onSubmit={confirmSetup}>
          <p className="security-text">
            Scan this QR code with an authenticator app such as Google Authenticator, Authy or Microsoft Authenticator.
          </p>
          <div className="qr-row">
            <img className="qr-image" src={setup.qr} alt="QR code for your authenticator app" width="180" height="180" />
            <div>
              <p className="security-text">Can’t scan it? Enter this key in the app instead:</p>
              <code className="secret-key">{setup.secret.match(/.{1,4}/g).join(' ')}</code>
            </div>
          </div>
          <CodeField id="setup-code" label="Enter the 6 digit code the app shows" value={code} onChange={setCode} disabled={loading} />
          {error && <p className="delete-error" role="alert">{error}</p>}
          <div className="security-actions">
            <button type="button" className="cancel-button" onClick={() => { setSetup(null); reset() }} disabled={loading}>Cancel</button>
            <button type="submit" className="primary-button" disabled={loading || !code}>{loading ? 'Checking...' : 'Turn on'}</button>
          </div>
        </form>
      )}

      {mode === 'regenerate' && (
        <form className="security-form" onSubmit={regenerate}>
          <p className="security-text">Your current backup codes will stop working.</p>
          <CodeField id="regen-code" label="Code from your authenticator app" value={code} onChange={setCode} disabled={loading} />
          {error && <p className="delete-error" role="alert">{error}</p>}
          <div className="security-actions">
            <button type="button" className="cancel-button" onClick={() => reset()} disabled={loading}>Cancel</button>
            <button type="submit" className="primary-button" disabled={loading || !code}>{loading ? 'Creating...' : 'Create new codes'}</button>
          </div>
        </form>
      )}

      {mode === 'disable' && (
        <form className="security-form" onSubmit={disable}>
          <label htmlFor="disable-password">Password</label>
          <PasswordInput
            id="disable-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          <CodeField id="disable-code" label="Code from your app, or a backup code" value={code} onChange={setCode} disabled={loading} />
          {error && <p className="delete-error" role="alert">{error}</p>}
          <div className="security-actions">
            <button type="button" className="cancel-button" onClick={() => reset()} disabled={loading}>Cancel</button>
            <button type="submit" className="danger-button" disabled={loading || !code || !password}>{loading ? 'Turning off...' : 'Turn off'}</button>
          </div>
        </form>
      )}

      {!mode && (
        <>
          <p className="security-text">
            {status.enabled
              ? `Signing in needs your password and a code from your phone. ${status.backupCodesLeft} backup code${status.backupCodesLeft === 1 ? '' : 's'} left.`
              : 'Add a second step to signing in: a code from an app on your phone, so a stolen password isn’t enough.'}
          </p>
          {error && <p className="delete-error" role="alert">{error}</p>}
          <div className="security-actions">
            {status.enabled ? (
              <>
                <button type="button" className="cancel-button" onClick={() => reset('regenerate')}>New backup codes</button>
                <button type="button" className="danger-button" onClick={() => reset('disable')}>Turn off</button>
              </>
            ) : (
              <button type="button" className="primary-button" onClick={startSetup} disabled={loading}>
                {loading ? 'Starting...' : 'Set up two factor authentication'}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export default TwoFactorSettings
