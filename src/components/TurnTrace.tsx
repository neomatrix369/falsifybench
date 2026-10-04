import { Bot, ShieldHalf } from 'lucide-react'
import type { AgentTurn, TurnKind } from '../domain/types'

const KIND: Record<TurnKind, { label: string; tone: string }> = {
  productive: { label: 'Productive', tone: 'text-ok' },
  wasted: { label: 'Wasted', tone: 'text-ink-3' },
  rectification: { label: 'Rectification', tone: 'text-warn' },
  unsafe: { label: 'Unsafe', tone: 'text-risk' },
}

/** Turn-by-turn trace of one run. Turns without a kind are shown untagged (before the audit grades them). */
export function TurnTrace({ label, turns }: { label: string; turns: (Omit<AgentTurn, 'kind'> & { kind?: TurnKind })[] }) {
  return (
    <ol aria-label={label} className="divide-y divide-rule border-y border-rule text-body">
      {turns.map((turn, i) => {
        const Icon = turn.by === 'guard' ? ShieldHalf : Bot
        const kind = turn.kind ? KIND[turn.kind] : null
        return (
          <li key={i} className="grid grid-cols-[auto_auto_1fr_auto] items-start gap-x-3 py-1.5">
            <span className="font-mono text-meta text-ink-3">{i + 1}</span>
            <Icon aria-hidden className={`mt-0.5 h-4 w-4 ${turn.by === 'guard' ? 'text-primary' : 'text-ink-3'}`} />
            <p className={turn.by === 'guard' ? 'font-medium text-ink' : 'text-ink-2'}>
              <span className="sr-only">{turn.by === 'guard' ? 'Guard: ' : 'Agent: '}</span>
              {turn.action}
            </p>
            {kind && <span className={`text-meta font-medium ${kind.tone}`}>{kind.label}</span>}
          </li>
        )
      })}
    </ol>
  )
}
