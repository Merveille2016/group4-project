const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export class AuthError extends Error {}

// credentials: 'include' sends the session cookie to the backend on every call
async function request(path, { method = 'GET', body, fallbackError } = {}) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the server. Make sure the backend is running.')
  }

  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AuthError(data.message || 'Your session has expired.')
  if (!res.ok) throw new Error(data.message || fallbackError)
  return data
}

export function meRequest() {
  return request('/api/auth/me')
}

export function dashboardRequest() {
  return request('/api/admin/secret-dashboard', { fallbackError: 'Could not load the dashboard.' })
}

export function loginRequest(email, password) {
  return request('/api/auth/login', { method: 'POST', body: { email, password }, fallbackError: 'Login failed. Please try again.' })
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
  return request('/api/auth/logout', { method: 'POST' })
}

// The backend only has the admin register route for now, so student
// accounts go through it too (they're saved with role "admin").
export async function registerRequest(name, email, password) {
  try {
    return await request('/api/auth/register', { method: 'POST', body: { name, email, password }, fallbackError: 'Sign up failed. Please try again.' })
  } catch (err) {
    // Backend says "Admin with this email already exists", reword it for students
    if (/already exists/i.test(err.message)) throw new Error('An account with this email already exists. Try logging in instead.', { cause: err })
    throw err
  }
}
