const TOKEN_KEY = 'sri_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...options, headers })
  } catch {
    throw new Error('Cannot reach the server. Check the connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && token && path !== '/auth/login') {
      setToken(null)
      window.dispatchEvent(new Event('sri:logged-out'))
    }
    throw new Error(errorText(data, res.status))
  }
  return data as T
}

function errorText(data: { error?: unknown; message?: string }, status: number) {
  const err = data.error
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const { formErrors, fieldErrors } = err as {
      formErrors?: string[]
      fieldErrors?: Record<string, string[] | undefined>
    }
    const first =
      formErrors?.[0] ||
      Object.entries(fieldErrors || {})
        .map(([k, v]) => (v?.[0] ? `${k}: ${v[0]}` : ''))
        .find(Boolean)
    if (first) return first
  }
  if (data.message) return data.message
  if (status >= 500) return 'Server error — please try again'
  return `Request failed (${status})`
}
