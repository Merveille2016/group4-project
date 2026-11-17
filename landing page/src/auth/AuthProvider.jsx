import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './AuthContext'
import { AuthError, deleteAccountRequest, loginRequest, logoutRequest, meRequest, registerRequest } from '../api'

// Keep in sync with SESSION_IDLE_MINUTES on the backend
const IDLE_MINUTES = Number(import.meta.env.VITE_IDLE_MINUTES) || 5
const IDLE_LIMIT = IDLE_MINUTES * 60 * 1000
const PING_EVERY = Math.min(60 * 1000, IDLE_LIMIT / 3)

// Shared through localStorage so every open tab sees activity and logouts
const ACTIVITY_KEY = 'lastActivity'
const LOGOUT_KEY = 'loggedOutAt'

function readStorage(key) {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // storage blocked, this tab just won't share its state
  }
}

// Left over from the old token login; nothing reads them anymore
function clearOldTokenStorage() {
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  } catch {
    // storage blocked, nothing to clear
  }
}

function AuthProvider({ children }) {
  // `checking` is true until the backend tells us whether there's a session
  const [state, setState] = useState({ user: null, checking: true, endedBy: null })
  const navigate = useNavigate()
  const lastActive = useRef(0)

  useEffect(() => {
    clearOldTokenStorage()
    let cancelled = false

    meRequest()
      .then((data) => { if (!cancelled) setState({ user: data.admin, checking: false, endedBy: null }) })
      .catch(() => { if (!cancelled) setState({ user: null, checking: false, endedBy: null }) })

    return () => { cancelled = true }
  }, [])

  async function login(email, password) {
    const data = await loginRequest(email, password)
    lastActive.current = Date.now()
    writeStorage(ACTIVITY_KEY, lastActive.current)
    setState({ user: data.admin, checking: false, endedBy: null })
  }

  async function signup(name, email, password) {
    await registerRequest(name, email, password)
    await login(email, password)
  }

  // reason: 'user' (clicked Logout), 'idle' (inactive too long) or 'expired' (server ended it)
  const logout = useCallback((reason = 'user') => {
    setState({ user: null, checking: false, endedBy: reason })
    writeStorage(LOGOUT_KEY, Date.now())
    logoutRequest().catch(() => {
      // already logged out on the server, or it's down; either way we're done here
    })
  }, [])

  // The backend ends the session itself, so there's no logout call here
  async function deleteAccount(password) {
    await deleteAccountRequest(password)
    writeStorage(LOGOUT_KEY, Date.now())
    setState({ user: null, checking: false, endedBy: 'deleted' })
  }

  const loggedIn = Boolean(state.user)

  useEffect(() => {
    if (!loggedIn) return

    let lastPing = Date.now()
    let lastWrite = 0
    lastActive.current = Date.now()

    function endForInactivity() {
      logout('idle')
      navigate('/login', { replace: true, state: { from: window.location.pathname, reason: 'idle' } })
    }

    function markActive() {
      const now = Date.now()
      lastActive.current = now

      // mousemove fires constantly, so only touch storage every few seconds
      if (now - lastWrite > 5000) {
        lastWrite = now
        writeStorage(ACTIVITY_KEY, now)
      }

      // The backend only counts requests as activity, so keep its session alive while the person is here
      if (now - lastPing > PING_EVERY) {
        lastPing = now
        meRequest().catch((err) => {
          if (err instanceof AuthError) endForInactivity()
        })
      }
    }

    function checkIdle() {
      const last = Math.max(lastActive.current, readStorage(ACTIVITY_KEY))
      if (Date.now() - last >= IDLE_LIMIT) endForInactivity()
    }

    function onStorage(event) {
      if (event.key === LOGOUT_KEY) setState({ user: null, checking: false, endedBy: 'user' })
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }))
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', checkIdle)
    const timer = setInterval(checkIdle, 10 * 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive))
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', checkIdle)
      clearInterval(timer)
    }
  }, [loggedIn, logout, navigate])

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
