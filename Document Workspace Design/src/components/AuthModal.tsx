import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const { login, register } = useAuth()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please provide your name')
        await register(name.trim(), email.trim(), password)
      } else {
        await login(email.trim(), password)
      }
      onClose()
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md mx-4 p-7 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors text-2xl leading-none"
        >
          ×
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white text-[#111] font-black text-lg mb-2">
            S
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isRegister ? 'Create your SyncPad Account' : 'Welcome back to SyncPad'}
          </h2>
          <p className="text-xs text-[#666] mt-1">
            {isRegister ? 'Real-time collaborative document platform' : 'Enter your credentials to access workspaces'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-[11px] font-medium text-[#777] uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444] transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[#777] uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="jane@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#777] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder:text-[#444] outline-none focus:border-[#444] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-white text-[#111] font-semibold text-sm hover:bg-[#eee] disabled:opacity-40 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? 'Processing...' : isRegister ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister)
              setError(null)
            }}
            className="text-xs text-[#888] hover:text-white transition-colors"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}
