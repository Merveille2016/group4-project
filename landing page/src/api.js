const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export class AuthError extends Error {}

let refreshing = null

// Several requests can hit a 401 at once, so they all wait on the same refresh
function refreshSession() {
  refreshing ??= fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => { refreshing = null })
  return refreshing
}

// credentials: 'include' sends the session cookie to the backend on every call
async function request(path, { method = 'GET', body, fallbackError, refresh = true } = {}) {
  const send = () => fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  let res
  try {
    res = await send()
    // The session times out quickly, the refresh cookie keeps the login going
    if (res.status === 401 && refresh && await refreshSession()) res = await send()
  } catch {
    throw new Error('Could not reach the server. Make sure the backend is running.')
  }

  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AuthError(data.message || 'Your session has expired.')
  if (!res.ok) throw new Error(data.message || fallbackError)
  return data
}

export function meRequest({ refresh = true } = {}) {
  return request('/api/auth/me', { refresh })
}

export function dashboardRequest() {
  return request('/api/admin/secret-dashboard', { fallbackError: 'Could not load the dashboard.' })
}

export function loginRequest(email, password) {
  return request('/api/auth/login', { method: 'POST', body: { email, password }, fallbackError: 'Login failed. Please try again.', refresh: false })
}

export function verifyCodeRequest(code) {
  return request('/api/auth/2fa/verify', { method: 'POST', body: { code }, fallbackError: 'Could not check the code.', refresh: false })
}

export function recoverRequest(code) {
  return request('/api/auth/2fa/recover', { method: 'POST', body: { code }, fallbackError: 'Could not check the backup code.', refresh: false })
}

export function forgotPasswordRequest(email) {
  return request('/api/auth/forgot-password', { method: 'POST', body: { email }, fallbackError: 'Could not send the reset link.', refresh: false })
}

export function resetPasswordRequest(token, password) {
  return request('/api/auth/reset-password', { method: 'POST', body: { token, password }, fallbackError: 'Could not reset the password.', refresh: false })
}

export function twoFactorStatusRequest() {
  return request('/api/auth/2fa/status', { fallbackError: 'Could not load the two factor settings.' })
}

export function setupTwoFactorRequest() {
  return request('/api/auth/2fa/setup', { method: 'POST', fallbackError: 'Could not start the setup.' })
}

export function enableTwoFactorRequest(code) {
  return request('/api/auth/2fa/enable', { method: 'POST', body: { code }, fallbackError: 'Could not turn on two factor authentication.' })
}

export function newBackupCodesRequest(code) {
  return request('/api/auth/2fa/backup-codes', { method: 'POST', body: { code }, fallbackError: 'Could not create new backup codes.' })
}

export function disableTwoFactorRequest(password, code) {
  return request('/api/auth/2fa/disable', { method: 'POST', body: { password, code }, fallbackError: 'Could not turn off two factor authentication.' })
}

export async function deleteAccountRequest(password) {
  try {
    return await request('/api/auth/me', { method: 'DELETE', body: { password }, fallbackError: 'Could not delete the account.' })
  } catch (err) {
    // A wrong password comes back as 400, but a 401 here would mean the session itself ended
    if (err instanceof AuthError) throw new Error('Your session has ended. Please log in again.', { cause: err })
    throw err
  }
}

export function logoutRequest() {
  return request('/api/auth/logout', { method: 'POST', refresh: false })
}

// The backend only has the admin register route for now, so student
// accounts go through it too (they're saved with role "admin").
export async function registerRequest(name, email, password) {
  try {
    return await request('/api/auth/register', { method: 'POST', body: { name, email, password }, fallbackError: 'Sign up failed. Please try again.', refresh: false })
  } catch (err) {
    // Backend says "Admin with this email already exists", reword it for students
    if (/already exists/i.test(err.message)) throw new Error('An account with this email already exists. Try logging in instead.', { cause: err })
    throw err
  }
}
