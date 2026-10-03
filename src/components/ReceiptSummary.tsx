import { Receipt } from 'lucide-react'
import { formatDelta } from '../domain/scoring'
import type { BenchmarkReceipt } from '../domain/receipt'
import { StatusPill } from './StatusPill'

export function ReceiptSummary({ receipt, onOpen }: { receipt: BenchmarkReceipt | null; onOpen: () => void }) {
  return (
    <section id="current-receipt" aria-labelledby="current-receipt-title" className="card scroll-mt-20 p-4">
      <div className="flex items-center gap-3">
        <Receipt aria-hidden className="h-4 w-4 text-slate-500" />
        <h2 id="current-receipt-title" className="text-sm font-semibold text-slate-800">
          Current receipt
        </h2>
        {receipt ? (
          <>
            <span className="font-mono text-xs text-slate-600">{receipt.runId}</span>
            <StatusPill tone="green">{receipt.provenanceLabel}</StatusPill>
            <span className="text-sm text-slate-700">
              Baseline {receipt.scores.baseline.total} → Guarded {receipt.scores.guarded.total}{' '}
              <span className="font-semibold text-emerald-800">({formatDelta(receipt.scores.delta)})</span>
            </span>
            <button type="button" className="btn-secondary ml-auto py-1 text-xs" onClick={onOpen}>
              Open receipt
            </button>
          </>
        ) : (
          <span className="text-sm text-slate-500">No receipt recorded yet — complete all five stages to record one.</span>
        )}
      </div>
    </section>
  )
}
