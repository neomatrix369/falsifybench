import { ChevronDown, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { RunLogEntry } from '../domain/runLog'

function clockTime(iso: string | null): string {
  return iso ? iso.slice(11, 23) : '…'
}

export function RunLog({ entries }: { entries: RunLogEntry[] }) {
  const [open, setOpen] = useState(true)
  return (
    <section aria-labelledby="run-log-title" className="sheet">
      <div className="flex items-center justify-between border-b border-rule px-5 py-2">
        <h2 id="run-log-title" className="label">
          Run log
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="run-log-body"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-meta font-medium text-ink-2 hover:text-ink"
        >
          {open ? 'Hide' : 'Show'} details
          <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && (
        <div id="run-log-body" className="px-5 py-3">
          {entries.length === 0 ? (
            <p className="text-body text-ink-3">Every step of the next run is listed here as it happens: what loaded, what was computed and how.</p>
          ) : (
            <ol role="log" aria-label="Run log entries" className="space-y-1.5">
              {entries.map((e, i) => (
                <li key={i} className="grid grid-cols-[7.5rem_1fr] gap-x-3 text-body">
                  <span className="font-mono text-meta tabular-nums text-ink-3">{clockTime(e.at)} UTC</span>
                  <span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                      {e.pending && <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin text-ink-3" />}
                      {e.label}
                    </span>
                    {e.detail && <span className="block font-mono text-meta text-ink-2">{e.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
