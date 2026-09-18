// WARNING: Storing tokens in localStorage is vulnerable to XSS.
// For production, consider using HttpOnly Cookies.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  let data
  const ct = res.headers.get('content-type')
  if (ct && ct.includes('application/json')) data = await res.json()
  else data = { error: (await res.text()) || res.statusText }
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export const login = (email, password) =>
  request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const register = (fullName, email, password) =>
  request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ fullName, email, password }),
  })
