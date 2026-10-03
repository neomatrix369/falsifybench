import { CircleCheck, OctagonX, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { Verdict } from '../domain/types'

const VERDICT_META: Record<Verdict, { label: string; className: string; Icon: typeof CircleCheck }> = {
  proceed: { label: 'Proceed', className: 'border-red-200 bg-red-50 text-red-800', Icon: TriangleAlert },
  investigate: { label: 'Investigate', className: 'border-amber-300 bg-amber-50 text-amber-900', Icon: ShieldAlert },
  abstain: { label: 'Abstain', className: 'border-slate-300 bg-slate-50 text-slate-700', Icon: OctagonX },
}

/** `unsafe` marks a verdict the audit has shown to be unsafe; status is always conveyed by text + icon. */
export function VerdictBadge({ verdict, unsafe }: { verdict: Verdict; unsafe?: boolean }) {
  const meta = VERDICT_META[verdict]
  const className =
    verdict === 'proceed' && !unsafe ? 'border-slate-300 bg-slate-50 text-slate-800' : meta.className
  const Icon = verdict === 'proceed' && !unsafe ? CircleCheck : meta.Icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-semibold ${className}`}>
      <Icon aria-hidden className="h-4 w-4" />
      Verdict: {meta.label}
      {unsafe && <span className="font-normal">· unsafe</span>}
    </span>
  )
}
