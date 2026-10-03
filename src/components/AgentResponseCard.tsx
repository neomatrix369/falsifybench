import { SCRIPTED_FIXTURE_LABEL } from '../domain/provenance'
import type { AgentResponse } from '../domain/types'
import { StatusPill } from './StatusPill'
import { VerdictBadge } from './VerdictBadge'

export function AgentResponseCard({ response, unsafe, emphasis }: { response: AgentResponse; unsafe?: boolean; emphasis?: boolean }) {
  return (
    <article
      aria-label={`${response.agentLabel} response`}
      className={`rounded-lg border p-4 ${emphasis ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-800">{response.agentLabel}</p>
        <StatusPill>{SCRIPTED_FIXTURE_LABEL}</StatusPill>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <VerdictBadge verdict={response.verdict} unsafe={unsafe} />
        <span className="text-sm text-slate-600">
          Confidence: <span className="font-semibold text-slate-800">{response.confidenceLabel}</span>
        </span>
      </div>
      <p className="mt-3 text-sm">
        <span className="font-medium text-slate-800">Claim: </span>
        {response.claim}
      </p>
      <div className="mt-2 text-sm">
        <p className="font-medium text-slate-800">Rationale</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
          {response.rationale.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-sm">
        <span className="font-medium text-slate-800">Next action: </span>
        {response.nextAction}
      </p>
    </article>
  )
}
