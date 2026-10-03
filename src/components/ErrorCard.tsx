import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

export function ErrorCard({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div role="alert" className="card border-red-200 p-6">
      <div className="flex items-center gap-2 text-red-800">
        <TriangleAlert aria-hidden className="h-5 w-5" />
        <h2 className="text-base font-semibold">The walkthrough hit an unexpected error</h2>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        No receipt was recorded and this run is not marked complete. Reset to start a fresh, deterministic run.
      </p>
      <p className="mt-2 font-mono text-xs text-slate-500">{message}</p>
      <button type="button" className="btn-primary mt-4" onClick={onReset}>
        <RotateCcw aria-hidden className="h-4 w-4" /> Reset walkthrough
      </button>
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
