/**
 * ErrorBoundary
 *
 * Catches unhandled React render errors anywhere in the component tree and
 * shows a recoverable error UI instead of a blank screen.
 *
 * Usage:
 *   Wrap the entire app (or a subtree) with <ErrorBoundary>.
 *   The user can click "Reload page" to recover without losing their session.
 *
 * React error boundaries must be class components — hooks cannot catch
 * render errors. This is the only class component in the codebase.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  children: ReactNode
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error:    Error | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console in development; in production this would go to Sentry/Datadog
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback } = this.props

    if (!hasError || !error) return children

    // Use custom fallback if provided
    if (fallback) return fallback(error, this.reset)

    // ── Default fallback UI ───────────────────────────────────────────────────
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'var(--color-void, #07080f)' }}
      >
        <div
          className="glass-card rounded-sm p-10 w-full max-w-md text-center"
          style={{ border: '1px solid rgba(248,113,113,0.25)' }}
        >
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(248,113,113,0.1)',
                border:     '1px solid rgba(248,113,113,0.3)',
              }}
            >
              <AlertTriangle size={28} style={{ color: '#f87171' }} />
            </div>
          </div>

          {/* Heading */}
          <h1 className="font-display font-black text-2xl text-frost mb-2">
            Something went wrong
          </h1>
          <p className="font-body text-sm text-ice/40 mb-2">
            An unexpected error occurred. Your session is still active.
          </p>

          {/* Error detail — only shown in development */}
          {import.meta.env.DEV && (
            <pre
              className="text-left text-xs text-red-400/70 bg-red-900/10 rounded-sm p-3 mb-6 overflow-auto max-h-32"
              style={{ border: '1px solid rgba(248,113,113,0.15)' }}
            >
              {error.message}
            </pre>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => window.location.reload()}
              className="btn-gold flex items-center gap-2 px-6 py-3 rounded-sm text-sm"
            >
              <RefreshCw size={14} />
              RELOAD PAGE
            </button>
            <button
              onClick={this.reset}
              className="btn-outline px-6 py-3 rounded-sm text-sm"
              style={{ color: 'rgba(201,168,76,0.6)', borderColor: 'rgba(201,168,76,0.2)' }}
            >
              TRY AGAIN
            </button>
          </div>
        </div>
      </div>
    )
  }
}
