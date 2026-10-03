import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

export function Disclosure({ label = 'Show evidence / method', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {open ? label.replace(/^Show/, 'Hide') : label}
        <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="border-t border-slate-200 px-3 py-3 text-sm text-slate-600">
          {children}
        </div>
      )}
    </div>
  )
}
