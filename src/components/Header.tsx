import { ShieldCheck } from 'lucide-react'
import { BRAND } from '../config/branding'
import { SYNTHETIC_LABEL } from '../domain/provenance'
import { DataModeSelector } from './DataModeSelector'

const NAV_LINK =
  'whitespace-nowrap rounded-sm px-2 py-1 text-shell-muted underline-offset-4 transition-colors duration-fast hover:text-shell-ink hover:underline'

export function Header({ onReceiptAnchor }: { onReceiptAnchor: () => void }) {
  return (
    <header className="sticky top-0 z-20">
      <div className="bg-shell text-shell-ink">
        <div className="mx-auto flex h-12 max-w-page items-center gap-8 px-6">
          <div className="flex items-baseline gap-3">
            <p className="wordmark text-title font-semibold tracking-tight">{BRAND.name}</p>
            <p className="text-meta text-shell-muted">{BRAND.tagline}</p>
          </div>
          <nav aria-label="Page sections" className="flex items-center gap-1 text-body">
            <a href="#scenario-previews" className={NAV_LINK}>
              Scenario previews
            </a>
            <a href="#current-receipt" onClick={onReceiptAnchor} className={NAV_LINK}>
              Current receipt
            </a>
          </nav>
          <p className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-shell-line px-2 py-0.5 text-meta font-medium text-shell-ink">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-ok-line" />
            {SYNTHETIC_LABEL}
          </p>
        </div>
      </div>
      <div className="border-b border-rule bg-sunken">
        <div className="mx-auto flex max-w-page items-center px-6 py-1.5">
          <DataModeSelector />
        </div>
      </div>
    </header>
  )
}
