import { Copy, Download, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { STAGE_LABELS } from '../domain/stages'
import { METRIC_KEYS, METRIC_LABELS, formatDelta } from '../domain/scoring'
import type { BenchmarkReceipt } from '../domain/receipt'
import { VERDICT_LABEL } from '../domain/verdict'
import { Disclosure } from './Disclosure'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-rule py-1.5 last:border-b-0">
      <dt className="w-32 shrink-0 text-ink-3">{label}</dt>
      <dd className="font-medium text-ink">{children}</dd>
    </div>
  )
}

const SECTION = 'border-t-2 border-ink pt-2'
const SECTION_TITLE = 'mb-1.5 text-body font-semibold text-ink'

export function ReceiptView({ receipt }: { receipt: BenchmarkReceipt }) {
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const json = JSON.stringify(receipt, null, 2)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setCopied('copied')
    } catch {
      setCopied('failed')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `falsifybench-${receipt.scenario.id}-${receipt.runId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <section aria-label="Decision" className="rounded-md border border-ok-line/40 bg-ok-tint/50 px-4 py-3 text-body text-ink">
        <p>
          <span className="text-ink-3">Decision:</span> baseline <strong>{VERDICT_LABEL[receipt.verdicts.baseline]}</strong> → guarded{' '}
          <strong>{VERDICT_LABEL[receipt.verdicts.guarded]}</strong>
          {receipt.unsafeApprovalPrevented ? ' · unsafe approval prevented' : ''}
        </p>
        <p className="mt-0.5">
          <span className="text-ink-3">Next action:</span> {receipt.guardedNextAction}
        </p>
      </section>
      <div className="grid grid-cols-2 gap-6">
        <section aria-label="Run metadata" className={SECTION}>
          <h3 className={SECTION_TITLE}>Run metadata</h3>
          <dl className="text-body">
            <Row label="Run ID"><span className="font-mono">{receipt.runId}</span></Row>
            <Row label="Recorded at"><span className="font-mono text-meta">{receipt.recordedAt}</span></Row>
            <Row label="Mode">Synthetic / Mocked</Row>
            <Row label="Provenance">{receipt.provenanceLabel}</Row>
            <Row label="Scenario">{receipt.scenario.id} · v{receipt.scenario.version}</Row>
            <Row label="Rubric">{receipt.rubricVersion}</Row>
            <Row label="Agent execution">
              {receipt.receiptVersion === '1.1' && receipt.agentExecution === 'live_baseline'
                ? `Live baseline (${receipt.liveCalls.baseline?.model}); guarded scripted fixture`
                : 'Scripted fixture'}
            </Row>
            {receipt.receiptVersion === '1.1' && (
              <>
                <Row label="Grader">{receipt.grader.id} · {receipt.grader.version}</Row>
                {receipt.liveCalls.baseline && (
                  <Row label="Live call">
                    <span className="font-mono text-meta">
                      {receipt.liveCalls.baseline.requestId ?? 'no request ID'} · {receipt.liveCalls.baseline.latencyMs} ms
                    </span>
                  </Row>
                )}
              </>
            )}
            <Row label="Agents">{receipt.agents.baseline}; {receipt.agents.guarded}</Row>
          </dl>
        </section>
        <section aria-label="Stage events" className={SECTION}>
          <h3 className={SECTION_TITLE}>Stage events</h3>
          <ol className="text-body">
            {receipt.stageEvents.map((event) => (
              <li key={event.order} className="flex items-center gap-3 border-b border-rule py-1.5 last:border-b-0">
                <span className="w-3 font-mono text-meta text-ink-3">{event.order}</span>
                <span className="font-medium text-ink">{STAGE_LABELS[event.stage]}</span>
                <span className="ml-auto font-mono text-meta text-ink-2">{event.at.slice(11, 19)}Z</span>
              </li>
            ))}
          </ol>
          <h3 className={`${SECTION_TITLE} mt-4`}>Evidence IDs</h3>
          <ul className="flex flex-wrap gap-1.5">
            {receipt.evidenceIds.map((id) => (
              <li key={id} className="rounded-sm border border-rule bg-sunken px-1.5 py-px font-mono text-meta text-ink-2">
                {id}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-label="Receipt scores" className={SECTION}>
        <h3 className={SECTION_TITLE}>Scores</h3>
        <table className="w-full text-body">
          <thead>
            <tr className="border-y border-rule text-left text-meta text-ink-3">
              <th scope="col" className="py-1.5 font-medium">Metric</th>
              <th scope="col" className="py-1.5 font-medium">Baseline</th>
              <th scope="col" className="py-1.5 font-medium">Guarded</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {METRIC_KEYS.map((key) => (
              <tr key={key} className="border-b border-rule">
                <th scope="row" className="py-1.5 text-left font-sans font-normal text-ink-2">{METRIC_LABELS[key]}</th>
                <td className="py-1.5">{receipt.scores.baseline[key]}</td>
                <td className="py-1.5">{receipt.scores.guarded[key]}</td>
              </tr>
            ))}
            <tr className="border-b-2 border-ink font-semibold">
              <th scope="row" className="py-1.5 text-left font-sans">Total</th>
              <td className="py-1.5">{receipt.scores.baseline.total}</td>
              <td className="py-1.5 text-primary">{receipt.scores.guarded.total}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 flex flex-wrap items-center text-lead font-semibold text-ok">
          Delta: {formatDelta(receipt.scores.delta)} release-readiness points
          {receipt.unsafeApprovalPrevented && (
            <span className="ml-3 inline-flex items-center gap-1 text-body font-medium">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5" />· Unsafe approval prevented
            </span>
          )}
        </p>
      </section>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={copy}>
          <Copy aria-hidden className="h-4 w-4" /> Copy receipt JSON
        </button>
        <button type="button" className="btn-secondary" onClick={download}>
          <Download aria-hidden className="h-4 w-4" /> Download JSON
        </button>
        <span role="status" className="text-meta text-ink-2">
          {copied === 'copied' ? 'Copied to clipboard.' : copied === 'failed' ? 'Clipboard unavailable — use Download.' : ''}
        </span>
      </div>
      <Disclosure label="Show evidence / method (raw receipt)">
        <pre className="max-h-72 overflow-auto rounded-sm bg-shell p-3 font-mono text-meta leading-relaxed text-shell-ink">{json}</pre>
      </Disclosure>
    </div>
  )
}
