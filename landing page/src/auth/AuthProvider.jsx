import { useCallback, useState } from 'react'
import { AuthContext } from './AuthContext'
import { loginRequest, registerRequest } from '../api'

// Same keys the admin frontend uses, so the stored shape stays consistent
const TOKEN_KEY = 'token'
const USER_KEY = 'user'

// The backend issues 24h tokens; read the expiry from the payload so an old
// token doesn't leave the navbar saying "Logout"
function tokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

function clearStorage() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    // storage blocked, nothing to clear
  }
}

function readStoredSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = JSON.parse(localStorage.getItem(USER_KEY))
    if (token && user && !tokenExpired(token)) return { user, token }
  } catch {
    // corrupted value, fall through and treat as logged out
  }
  clearStorage()
  return { user: null, token: null }
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession)

  async function login(email, password) {
    const data = await loginRequest(email, password)
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.admin))
    setSession({ user: data.admin, token: data.token })
  }

  // Register doesn't return a token, so log straight in afterwards
  async function signup(email, password) {
    await registerRequest(email, password)
    await login(email, password)
  }

  // `expired` tells protected pages to send the person to /login instead of home
  const logout = useCallback((reason = 'user') => {
    clearStorage()
    setSession({ user: null, token: null, endedBy: reason })
  }, [])

  return (
    <AuthContext.Provider value={{ ...session, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
