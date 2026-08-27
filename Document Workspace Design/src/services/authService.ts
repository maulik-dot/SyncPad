import { apiFetch, setAuthToken, getRefreshToken, getAuthToken } from './api'
import type { AuthResponse } from '../types/api'

export const authService = {
  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const data = await apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    if (data.token) {
      setAuthToken(data.token, data.refreshToken)
    }
    return data
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (data.token) {
      setAuthToken(data.token, data.refreshToken)
    }
    return data
  },

  async googleLogin(idToken: string): Promise<AuthResponse> {
    const data = await apiFetch<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
    if (data.token) {
      setAuthToken(data.token, data.refreshToken)
    }
    return data
  },

  async logout() {
    const refreshToken = getRefreshToken()
    const token = getAuthToken()
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // Best-effort logout
    } finally {
      setAuthToken(null)
    }
  }
}
