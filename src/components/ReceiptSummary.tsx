import { Receipt, ShieldCheck } from 'lucide-react'
import { formatDelta } from '../domain/scoring'
import type { BenchmarkReceipt } from '../domain/receipt'

export function ReceiptSummary({ receipt, onOpen }: { receipt: BenchmarkReceipt | null; onOpen: () => void }) {
  return (
    <section id="current-receipt" aria-labelledby="current-receipt-title" className="sheet scroll-mt-28 px-5 py-3">
      <div className="flex items-center gap-4">
        <Receipt aria-hidden className="h-4 w-4 text-ink-3" />
        <h2 id="current-receipt-title" className="text-body font-semibold text-ink">
          Current receipt
        </h2>
        {receipt ? (
          <>
            <span className="font-mono text-meta text-ink-2">{receipt.runId}</span>
            <span className="inline-flex items-center gap-1 text-meta text-ink-2">
              <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-ok" />
              {receipt.provenanceLabel}
            </span>
            <span className="font-mono text-body text-ink">
              Baseline {receipt.scores.baseline.total} → Guarded {receipt.scores.guarded.total}{' '}
              <span className="font-semibold text-ok">({formatDelta(receipt.scores.delta)})</span>
            </span>
            <button type="button" className="btn-secondary ml-auto py-1 text-meta" onClick={onOpen}>
              Open receipt
            </button>
          </>
        ) : (
          <span className="text-body text-ink-3">No receipt recorded yet — complete all five stages to record one.</span>
        )}
      </div>
    </section>
  )
}
