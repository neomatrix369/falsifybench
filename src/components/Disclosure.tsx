import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

export function Disclosure({ label = 'Show evidence / method', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="rounded-md border border-rule">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-body font-medium text-ink-2 transition-colors duration-fast hover:bg-sunken hover:text-ink"
      >
        {open ? label.replace(/^Show/, 'Hide') : label}
        <ChevronDown aria-hidden className={`h-4 w-4 transition-transform duration-base ease-out ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="border-t border-rule bg-sunken px-3 py-3 text-body text-ink-2">
          {children}
        </div>
      )}
    </div>
  )
}
