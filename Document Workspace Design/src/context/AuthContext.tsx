import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User, AuthResponse } from '../types/api'
import { authService } from '../services/authService'
import { getAuthToken } from '../services/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<AuthResponse>
  register: (name: string, email: string, pass: string) => Promise<AuthResponse>
  googleLogin: (idToken: string) => Promise<AuthResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('syncpad_user')
    return saved ? JSON.parse(saved) : null
  })
  const [token, setToken] = useState<string | null>(() => getAuthToken())

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null)
      setToken(null)
    }
    window.addEventListener('syncpad:auth-expired', handleAuthExpired)
    return () => window.removeEventListener('syncpad:auth-expired', handleAuthExpired)
  }, [])

  const handleAuthSuccess = (res: AuthResponse) => {
    const userInfo: User = {
      id: res.userId,
      email: res.email,
      name: res.name,
      profilePictureUrl: res.profilePictureUrl,
    }
    setUser(userInfo)
    setToken(res.token)
    localStorage.setItem('syncpad_user', JSON.stringify(userInfo))
    return res
  }

  const login = async (email: string, pass: string) => {
    const res = await authService.login(email, pass)
    return handleAuthSuccess(res)
  }

  const register = async (name: string, email: string, pass: string) => {
    const res = await authService.register(name, email, pass)
    return handleAuthSuccess(res)
  }

  const googleLogin = async (idToken: string) => {
    const res = await authService.googleLogin(idToken)
    return handleAuthSuccess(res)
  }

  const logout = () => {
    authService.logout()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        register,
        googleLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
