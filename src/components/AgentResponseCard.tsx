import { SCRIPTED_FIXTURE_LABEL, liveModelLabel } from '../domain/provenance'
import type { AgentResponse } from '../domain/types'
import { VerdictBadge } from './VerdictBadge'

export function AgentResponseCard({ response, unsafe, emphasis }: { response: AgentResponse; unsafe?: boolean; emphasis?: boolean }) {
  const rule = unsafe ? 'border-risk-line' : emphasis ? 'border-primary' : 'border-ink'
  return (
    <article aria-label={`${response.agentLabel} response`} className={`border-t-2 pt-3 ${rule}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-body font-semibold text-ink">{response.agentLabel}</p>
        <p className="label">{response.live ? liveModelLabel(response.live.model) : SCRIPTED_FIXTURE_LABEL}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <VerdictBadge verdict={response.verdict} unsafe={unsafe} />
        <span className="text-body text-ink-2">
          Confidence: <span className="font-semibold text-ink">{response.confidenceLabel}</span>
        </span>
      </div>
      <p className="mt-3 text-body text-ink">
        <span className="font-semibold">Claim: </span>
        {response.claim}
      </p>
      <div className="mt-2 text-body">
        <p className="font-semibold text-ink">Rationale</p>
        <ul className="mt-1 space-y-0.5 text-ink-2">
          {response.rationale.map((line) => (
            <li key={line} className="relative pl-4 before:absolute before:left-0.5 before:top-[0.6rem] before:h-px before:w-2 before:bg-rule-strong">
              {line}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-2 text-body text-ink">
        <span className="font-semibold">Next action: </span>
        {response.nextAction}
      </p>
      {response.guard?.overrides.length ? (
        <div className="mt-3 border-t border-rule pt-2 text-body text-ink-2">
          <p className="font-semibold text-ink">Guard rules applied</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {response.guard.overrides.map((override) => (
              <li key={override}>{override}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}
