import { Copy, Download } from 'lucide-react'
import { useState } from 'react'
import { STAGE_LABELS } from '../domain/stages'
import { METRIC_KEYS, METRIC_LABELS, formatDelta } from '../domain/scoring'
import type { BenchmarkReceipt } from '../domain/receipt'
import { Disclosure } from './Disclosure'
import { StatusPill } from './StatusPill'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-slate-100 py-1.5 first:border-t-0">
      <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{children}</dd>
    </div>
  )
}

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
    <div className="space-y-4">
      <section aria-label="Decision" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <p>
          <span className="text-slate-500">Decision:</span> baseline <strong>{receipt.verdicts.baseline}</strong> → guarded{' '}
          <strong>{receipt.verdicts.guarded}</strong>
          {receipt.unsafeApprovalPrevented ? ' · unsafe approval prevented' : ''}
        </p>
        <p className="mt-0.5">
          <span className="text-slate-500">Next action:</span> {receipt.guardedNextAction}
        </p>
      </section>
      <div className="grid grid-cols-2 gap-4">
        <section aria-label="Run metadata" className="rounded-lg border border-slate-200 p-4">
          <h3 className="eyebrow mb-2">Run metadata</h3>
          <dl className="text-sm">
            <Row label="Run ID"><span className="font-mono">{receipt.runId}</span></Row>
            <Row label="Recorded at"><span className="font-mono text-xs">{receipt.recordedAt}</span></Row>
            <Row label="Mode">Synthetic / Mocked</Row>
            <Row label="Provenance">{receipt.provenanceLabel}</Row>
            <Row label="Scenario">{receipt.scenario.id} · v{receipt.scenario.version}</Row>
            <Row label="Rubric">{receipt.rubricVersion}</Row>
            <Row label="Agent execution">Scripted fixture</Row>
            <Row label="Agents">{receipt.agents.baseline}; {receipt.agents.guarded}</Row>
          </dl>
        </section>
        <section aria-label="Stage events" className="rounded-lg border border-slate-200 p-4">
          <h3 className="eyebrow mb-2">Stage events</h3>
          <ol className="space-y-1 text-sm">
            {receipt.stageEvents.map((event) => (
              <li key={event.order} className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{event.order}</span>
                <span className="font-medium text-slate-800">{STAGE_LABELS[event.stage]}</span>
                <span className="ml-auto font-mono text-[11px] text-slate-500">{event.at.slice(11, 19)}Z</span>
              </li>
            ))}
          </ol>
          <h3 className="eyebrow mb-1.5 mt-4">Evidence IDs</h3>
          <div className="flex flex-wrap gap-1.5">
            {receipt.evidenceIds.map((id) => (
              <StatusPill key={id}><span className="font-mono">{id}</span></StatusPill>
            ))}
          </div>
        </section>
      </div>

      <section aria-label="Receipt scores" className="rounded-lg border border-slate-200 p-4">
        <h3 className="eyebrow mb-2">Scores</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th scope="col" className="py-1 font-medium">Metric</th>
              <th scope="col" className="py-1 font-medium">Baseline</th>
              <th scope="col" className="py-1 font-medium">Guarded</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {METRIC_KEYS.map((key) => (
              <tr key={key} className="border-t border-slate-100">
                <th scope="row" className="py-1 text-left font-sans font-normal">{METRIC_LABELS[key]}</th>
                <td className="py-1">{receipt.scores.baseline[key]}</td>
                <td className="py-1">{receipt.scores.guarded[key]}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-semibold">
              <th scope="row" className="py-1 text-left font-sans">Total</th>
              <td className="py-1">{receipt.scores.baseline.total}</td>
              <td className="py-1">{receipt.scores.guarded.total}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-base font-semibold text-emerald-800">
          Delta: {formatDelta(receipt.scores.delta)} release-readiness points
          {receipt.unsafeApprovalPrevented && <span className="ml-2 text-sm font-medium">· Unsafe approval prevented</span>}
        </p>
      </section>

      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={copy}>
          <Copy aria-hidden className="h-4 w-4" /> Copy receipt JSON
        </button>
        <button type="button" className="btn-secondary" onClick={download}>
          <Download aria-hidden className="h-4 w-4" /> Download JSON
        </button>
        <span role="status" className="text-xs text-slate-500">
          {copied === 'copied' ? 'Copied to clipboard.' : copied === 'failed' ? 'Clipboard unavailable — use Download.' : ''}
        </span>
      </div>
      <Disclosure label="Show evidence / method (raw receipt)">
        <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">{json}</pre>
      </Disclosure>
    </div>
  )
}
