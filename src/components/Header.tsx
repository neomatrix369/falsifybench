import { ShieldCheck } from 'lucide-react'
import { BRAND } from '../config/branding'
import { SYNTHETIC_LABEL } from '../domain/provenance'
import { DataModeSelector, type AgentSelection } from './DataModeSelector'

export type View = 'about' | 'benchmark'

const NAV_LINK =
  'whitespace-nowrap rounded-sm px-2 py-1 text-shell-muted underline-offset-4 transition-colors duration-fast hover:text-shell-ink hover:underline'

const VIEWS: { view: View; label: string }[] = [
  { view: 'about', label: 'About' },
  { view: 'benchmark', label: 'Benchmark' },
]

function ViewSwitch({ view, onSwitchView }: { view: View; onSwitchView: (view: View) => void }) {
  return (
    <div role="group" aria-label="View" className="flex items-center rounded-sm border border-shell-line p-0.5">
      {VIEWS.map((v) => {
        const current = v.view === view
        return (
          <button
            key={v.view}
            type="button"
            aria-pressed={current}
            data-view-switch={v.view}
            onClick={() => !current && onSwitchView(v.view)}
            className={`rounded-sm px-2.5 py-0.5 text-body transition-colors duration-fast ${
              current ? 'bg-shell-ink font-medium text-shell' : 'text-shell-muted hover:text-shell-ink'
            }`}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

interface Props {
  agent?: AgentSelection
  view?: View
  onSwitchView?: (view: View) => void
  onReceiptAnchor?: () => void
  /** Scenario previews live in the Detailed tab; switch there before jumping. */
  onPreviewsAnchor?: () => void
}

export function Header({ view = 'benchmark', onSwitchView, onReceiptAnchor, onPreviewsAnchor, agent }: Props) {
  return (
    <header className="sticky top-0 z-20">
      <div className="bg-shell text-shell-ink">
        <div className="mx-auto flex h-12 max-w-page items-center gap-6 px-6">
          <div className="flex items-baseline gap-3">
            <p className="wordmark whitespace-nowrap text-title font-semibold tracking-tight">{BRAND.name}</p>
            <p className="hidden whitespace-nowrap text-meta text-shell-muted 2xl:block">{BRAND.tagline}</p>
          </div>
          {onSwitchView && <ViewSwitch view={view} onSwitchView={onSwitchView} />}
          <nav aria-label="Page sections" className="flex items-center gap-1 text-body">
            {view === 'benchmark' && (
              <>
                <a href="#scenario-previews" onClick={onPreviewsAnchor} className={NAV_LINK}>
                  Scenario previews
                </a>
                <a href="#current-receipt" onClick={onReceiptAnchor} className={NAV_LINK}>
                  Current receipt
                </a>
              </>
            )}
            <a href="score/index.html" className={NAV_LINK}>
              Benchmark score
            </a>
          </nav>
          <p className="ml-auto inline-flex shrink-0 items-center whitespace-nowrap gap-1.5 rounded-sm border border-shell-line px-2 py-0.5 text-meta font-medium text-shell-ink">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-ok-line" />
            {SYNTHETIC_LABEL}
          </p>
        </div>
      </div>
      {view === 'benchmark' && (
        <div className="border-b border-rule bg-sunken">
          <div className="mx-auto flex max-w-page items-center px-6 py-1.5">
            <DataModeSelector agent={agent} />
          </div>
        </div>
      )}
    </header>
  )
}
