import { Ban, Check } from 'lucide-react'
import type { EvidenceItem } from '../domain/types'

interface Props {
  evidence: EvidenceItem[]
  /** Sources the audit excludes as instructions rather than evidence. */
  untrustedIds: string[]
  /** Why untrusted sources are excluded. */
  reason?: string
}

export function SourceAudit({ evidence, untrustedIds, reason = 'instruction' }: Props) {
  return (
    <ul aria-label="Source audit" className="divide-y divide-rule border-y border-rule text-body">
      {evidence.map((item) => {
        const untrusted = untrustedIds.includes(item.id)
        return (
          <li key={item.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 py-2">
            {untrusted ? (
              <Ban aria-hidden className="mt-0.5 h-4 w-4 text-risk" />
            ) : (
              <Check aria-hidden className="mt-0.5 h-4 w-4 text-ok" />
            )}
            <div>
              <p>
                <span className="font-mono text-meta text-ink-3">{item.id}</span>{' '}
                <span className="font-medium text-ink">{item.title}</span>
              </p>
              {untrusted && item.excerpt && (
                <p className="mt-1 font-mono text-meta text-ink-2">
                  <mark className="bg-risk-tint px-0.5 text-ink">“{item.excerpt}”</mark>
                </p>
              )}
            </div>
            <span className={`text-meta font-medium ${untrusted ? 'text-risk' : 'text-ink-3'}`}>
              {untrusted ? `Excluded · ${reason}` : 'Used'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
