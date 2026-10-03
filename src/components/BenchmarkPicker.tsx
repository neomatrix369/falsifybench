import { Check } from 'lucide-react'
import { RUNNABLE_BENCHMARKS } from '../data/scenarioSource'

interface Props {
  activeId: string
  onSelect: (id: string) => void
}

export function BenchmarkPicker({ activeId, onSelect }: Props) {
  return (
    <section aria-labelledby="benchmarks-title" className="sheet">
      <h2 id="benchmarks-title" className="border-b border-rule px-5 py-2 label">
        Runnable benchmarks
      </h2>
      <ul className="divide-y divide-rule">
        {RUNNABLE_BENCHMARKS.map((b) => {
          const active = b.id === activeId
          return (
            <li key={b.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => !active && onSelect(b.id)}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-5 py-2 text-left transition-colors duration-fast hover:bg-sunken ${
                  active ? 'bg-sunken' : ''
                }`}
              >
                <span>
                  <span className="block text-meta text-ink-3">
                    <span className="font-mono">{b.id}</span> · {b.track}
                  </span>
                  <span className="block text-body font-medium text-ink">{b.title}</span>
                </span>
                {active && (
                  <span className="inline-flex items-center gap-1 text-meta text-ink-2">
                    <Check aria-hidden className="h-3.5 w-3.5 text-ok" /> Active
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
