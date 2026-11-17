import { useCallback, useEffect, useState } from 'react'
import { AuthContext } from './AuthContext'
import { loginRequest, logoutRequest, meRequest, registerRequest } from '../api'

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
    setState({ user: data.admin, checking: false, endedBy: null })
  }

  async function signup(name, email, password) {
    await registerRequest(name, email, password)
    await login(email, password)
  }

  // `expired` tells protected pages to send the person to /login instead of home
  const logout = useCallback((reason = 'user') => {
    setState({ user: null, checking: false, endedBy: reason })
    logoutRequest().catch(() => {
      // already logged out on the server, or it's down; either way we're done here
    })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
