const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''

export function getAuthToken(): string | null {
  return localStorage.getItem('syncpad_token')
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('syncpad_refresh_token')
}

export function setAuthToken(token: string | null, refreshToken?: string | null) {
  if (token) {
    localStorage.setItem('syncpad_token', token)
    if (refreshToken) {
      localStorage.setItem('syncpad_refresh_token', refreshToken)
    }
  } else {
    localStorage.removeItem('syncpad_token')
    localStorage.removeItem('syncpad_refresh_token')
    localStorage.removeItem('syncpad_user')
  }
}

export async function apiFetch<T>(endpoint: string, options: RequestInit & { _retry?: boolean } = {}): Promise<T> {
  const token = getAuthToken()
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (res.status === 401 && !options._retry) {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setAuthToken(data.token, data.refreshToken)
          headers.set('Authorization', `Bearer ${data.token}`)
          const retryRes = await fetch(url, {
            ...options,
            _retry: true,
            headers,
          })
          if (retryRes.ok) {
            if (retryRes.status === 204) return {} as T
            return retryRes.json()
          }
        }
      } catch {
        // Fall through to clearing token
      }
    }
    setAuthToken(null)
    window.dispatchEvent(new Event('syncpad:auth-expired'))
  }

  if (!res.ok) {
    let errorMessage = `HTTP Error ${res.status}: ${res.statusText}`
    try {
      const errorJson = await res.json()
      if (errorJson.message) {
        errorMessage = errorJson.message
      }
    } catch {
      // Ignore JSON parse errors
    }
    throw new Error(errorMessage)
  }

  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}

export default apiFetch
