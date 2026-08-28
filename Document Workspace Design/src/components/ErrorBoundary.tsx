import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React tree:', error, errorInfo)
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('syncpad_user')
      localStorage.removeItem('syncpad_token')
      localStorage.removeItem('syncpad_refresh_token')
    } catch {}
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#111] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              !
            </div>
            <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
            <p className="text-xs text-[#888] mb-4">
              An unexpected error occurred while loading the workspace.
            </p>
            <div className="bg-[#111] border border-[#222] rounded-lg p-3 text-left font-mono text-[11px] text-red-400/90 overflow-x-auto max-h-32 mb-5">
              {this.state.error?.message || 'Unknown render error'}
            </div>
            <button
              onClick={this.handleReset}
              className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer"
            >
              Reset Session & Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
