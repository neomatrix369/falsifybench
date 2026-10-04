import { RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'
import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from 'react'
import type { UnsealRecovery } from '../domain/evaluationCheck'

const EXPLANATION: Record<'reset' | UnsealRecovery, string> = {
  reset: 'No receipt was recorded and this run is not marked complete. Reset to start a fresh, deterministic run.',
  reload:
    'No receipt was recorded and this run is not marked complete. The browser caches a failed module import for this page, so reload the page to retry; Reset alone repeats the failure.',
  retry:
    'No receipt was recorded and this run is not marked complete. The sealed evaluation was too slow to load, but it may still arrive: Reset retries it. Reload the page if it keeps timing out.',
  'fix-data':
    'No receipt was recorded and this run is not marked complete. The sealed evaluation failed its data checks, so it was not used. Reload and Reset load the same data; fix the scenario data (npm run score lists every failed gate).',
}

export function ErrorCard({
  message,
  onReset,
  recovery = 'reset',
}: {
  message: string
  onReset: () => void
  recovery?: 'reset' | UnsealRecovery
}) {
  // The control that had focus (e.g. a held Next step) may now be disabled; move focus to the card.
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus(), [])
  return (
    <div role="alert" className="sheet border-t-4 border-t-risk-line p-6">
      <div className="flex items-center gap-2 text-risk">
        <TriangleAlert aria-hidden className="h-5 w-5" />
        <h2 ref={heading} tabIndex={-1} className="text-title font-semibold focus:outline-none">
          The walkthrough hit an unexpected error
        </h2>
      </div>
      <p className="mt-2 text-body text-ink-2">{EXPLANATION[recovery]}</p>
      <p className="mt-2 font-mono text-meta text-ink-3">{message}</p>
      {recovery === 'reload' || recovery === 'retry' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden className="h-4 w-4" /> Reload page
          </button>
          <button type="button" className="btn-secondary" onClick={onReset}>
            <RotateCcw aria-hidden className="h-4 w-4" /> Reset walkthrough
          </button>
        </div>
      ) : (
        <button type="button" className="btn-primary mt-4" onClick={onReset}>
          <RotateCcw aria-hidden className="h-4 w-4" /> Reset walkthrough
        </button>
      )}
    </div>
  )
}

interface BoundaryProps {
  onReset: () => void
  resetKey: unknown
  children: ReactNode
}

export class WalkthroughErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FalsifyBench walkthrough error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorCard
          message={this.state.error.message}
          onReset={() => {
            this.setState({ error: null })
            this.props.onReset()
          }}
        />
      )
    }
    return this.props.children
  }
}
