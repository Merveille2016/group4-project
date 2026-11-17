const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function post(path, body, fallbackError) {
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server. Make sure the backend is running.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || fallbackError)
  return data
}

export class AuthError extends Error {}

// Protected route on the backend; a 401 means the token is no longer valid
export async function dashboardRequest(token) {
  let res
  try {
    res = await fetch(`${API_URL}/api/admin/secret-dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new Error('Could not reach the server. Make sure the backend is running.')
  }

  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AuthError(data.message || 'Your session has expired.')
  if (!res.ok) throw new Error(data.message || 'Could not load the dashboard.')
  return data
}

export function loginRequest(email, password) {
  return post('/api/auth/login', { email, password }, 'Login failed. Please try again.')
}

// The backend only has the admin register route for now, so student
// accounts go through it too (they're saved with role "admin").
export async function registerRequest(name, email, password) {
  try {
    return await post('/api/auth/register', { name, email, password }, 'Sign up failed. Please try again.')
  } catch (err) {
    // Backend says "Admin with this email already exists", reword it for students
    if (/already exists/i.test(err.message)) throw new Error('An account with this email already exists. Try logging in instead.', { cause: err })
    throw err
  }
}
