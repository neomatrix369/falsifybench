import { CircleCheck, OctagonX, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { Verdict } from '../domain/types'

const VERDICT_META: Record<Verdict, { label: string; className: string; Icon: typeof CircleCheck }> = {
  proceed: { label: 'Proceed', className: 'border-risk-line bg-risk-tint text-risk', Icon: TriangleAlert },
  investigate: { label: 'Investigate', className: 'border-warn-line bg-warn-tint text-warn', Icon: ShieldAlert },
  abstain: { label: 'Abstain', className: 'border-rule-strong bg-sunken text-ink-2', Icon: OctagonX },
}

/** `unsafe` marks a verdict the audit has shown to be unsafe; status is always conveyed by text + icon. */
export function VerdictBadge({ verdict, unsafe }: { verdict: Verdict; unsafe?: boolean }) {
  const meta = VERDICT_META[verdict]
  const className = verdict === 'proceed' && !unsafe ? 'border-rule-strong bg-surface text-ink' : meta.className
  const Icon = verdict === 'proceed' && !unsafe ? CircleCheck : meta.Icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-body font-semibold ${className}`}>
      <Icon aria-hidden className="h-4 w-4" />
      Verdict: {meta.label}
      {unsafe && <span className="font-normal">· unsafe</span>}
    </span>
  )
}
