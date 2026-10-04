import { Pause, Play } from 'lucide-react'
import { useState } from 'react'
import type { FindingTone, TickerItem } from '../config/landing'

const TONE_INK: Record<FindingTone | 'own', string> = { risk: 'text-risk', warn: 'text-warn', own: 'text-primary' }

function TickerRun({ items, copy }: { items: TickerItem[]; copy: 'primary' | 'repeat' }) {
  return (
    <ul aria-hidden={copy === 'repeat' || undefined} className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <li key={i} className="flex items-baseline whitespace-nowrap pr-10 font-mono text-meta text-ink-2">
          <b className={`mr-2 font-semibold ${TONE_INK[item.tone]}`}>{item.figure}</b>
          {item.text}
          <span aria-hidden className="ml-10 text-rule-strong">
            //
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Looping strip of quoted figures. Pauses on hover, focus or the button, and stands still under reduced motion. */
export function Ticker({ items }: { items: TickerItem[] }) {
  const [paused, setPaused] = useState(false)
  return (
    <section aria-label="Industry readings ticker" data-paused={paused} className="ticker flex items-stretch border-b border-rule bg-sunken">
      <div className="relative min-w-0 flex-1 overflow-hidden py-2 motion-reduce:overflow-x-auto">
        <div className="animate-ticker flex w-max">
          <TickerRun items={items} copy="primary" />
          <TickerRun items={items} copy="repeat" />
        </div>
      </div>
      <button
        type="button"
        aria-pressed={paused}
        onClick={() => setPaused((p) => !p)}
        className="flex shrink-0 items-center gap-1 border-l border-rule px-3 text-meta text-ink-2 transition-colors duration-fast hover:bg-surface hover:text-ink motion-reduce:hidden"
      >
        {paused ? <Play aria-hidden className="h-3 w-3" /> : <Pause aria-hidden className="h-3 w-3" />}
        {paused ? 'Play ticker' : 'Pause ticker'}
      </button>
    </section>
  )
}

const NODES = [
  { at: 4, label: 'Evidence' },
  { at: 27, label: 'Claim + confidence' },
  { at: 50, label: 'Falsification check' },
  { at: 73, label: 'Verdict' },
  { at: 96, label: 'Score' },
] as const

/** Illustration of the walkthrough path: the baseline claim is caught at the check, the guarded path runs through. */
export function FalsificationStrip() {
  return (
    <figure className="border-t border-rule px-8 pb-4 pt-3">
      <div aria-hidden className="relative h-16">
        <div className="absolute inset-x-[4%] top-1/2 h-px bg-rule-strong" />
        {NODES.map((n) => (
          <div key={n.label} className="absolute top-1/2" style={{ left: `${n.at}%` }}>
            <span className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border bg-surface ${n.at === 50 ? 'border-ink' : 'border-rule-strong'}`} />
            <span className={`absolute left-0 top-2.5 -translate-x-1/2 whitespace-nowrap font-mono text-meta ${n.at === 50 ? 'text-ink' : 'text-ink-3'}`}>{n.label}</span>
          </div>
        ))}
        <span className="animate-travel-caught absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-risk" style={{ left: '50%' }} />
        <span className="animate-travel-through absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ok" style={{ left: '96%' }} />
        <span className="absolute left-[50%] top-0 -translate-x-1/2 whitespace-nowrap font-mono text-meta text-risk">baseline: unsupported, flagged</span>
        <span className="absolute right-[4%] top-0 whitespace-nowrap font-mono text-meta text-ok">guarded: Investigate</span>
      </div>
      <figcaption className="mt-1 text-meta text-ink-3">
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-risk" />
          Baseline agent
        </span>
        <span className="mr-3 inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-ok" />
          Guarded path
        </span>
        In both runnable scenarios the baseline claim is caught at the falsification check; the guarded path leaves with an Investigate verdict and a falsifying test.
      </figcaption>
    </figure>
  )
}
