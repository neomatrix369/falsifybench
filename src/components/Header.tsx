import { FlaskConical, ShieldCheck } from 'lucide-react'
import { BRAND } from '../config/branding'
import { SYNTHETIC_LABEL } from '../domain/provenance'
import { DataModeSelector } from './DataModeSelector'
import { StatusPill } from './StatusPill'

export function Header({ onReceiptAnchor }: { onReceiptAnchor: () => void }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] items-center gap-6 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <FlaskConical aria-hidden className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold text-slate-900">{BRAND.name}</p>
            <p className="text-[11px] text-slate-500">{BRAND.tagline}</p>
          </div>
        </div>
        <nav aria-label="Page sections" className="flex items-center gap-1 text-sm">
          <a href="#scenario-previews" className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Scenario previews
          </a>
          <a
            href="#current-receipt"
            onClick={onReceiptAnchor}
            className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Current receipt
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <DataModeSelector />
          <StatusPill tone="green" icon={<ShieldCheck aria-hidden className="h-3 w-3" />}>
            {SYNTHETIC_LABEL}
          </StatusPill>
        </div>
      </div>
    </header>
  )
}
