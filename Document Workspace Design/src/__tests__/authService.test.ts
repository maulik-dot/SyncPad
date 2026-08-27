import { describe, it, expect, beforeEach, vi } from 'vitest'
import { authService } from '../services/authService'
import { getAuthToken, getRefreshToken, setAuthToken } from '../services/api'

describe('AuthService and API Token Handling', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('should store access token and refresh token upon setAuthToken', () => {
    setAuthToken('access-token-123', 'refresh-token-456')
    expect(getAuthToken()).toBe('access-token-123')
    expect(getRefreshToken()).toBe('refresh-token-456')
  })

  it('should clear all tokens upon logout', () => {
    setAuthToken('access-token-123', 'refresh-token-456')
    authService.logout()
    expect(getAuthToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('should dispatch syncpad:auth-expired when 401 is encountered and refresh token fails', async () => {
    const expiredListener = vi.fn()
    window.addEventListener('syncpad:auth-expired', expiredListener)

    setAuthToken('expired-token')

    // Mock fetch to return 401
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Token expired' }),
    } as Response)

    try {
      await authService.login('test@example.com', 'wrong')
    } catch {
      // Expected rejection
    }

    expect(getAuthToken()).toBeNull()
    expect(expiredListener).toHaveBeenCalled()
  })
})
