import { ArrowRight, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { comingNextPreviews } from '../data/previews'

export function ComingNextCards({ onReturnToActive }: { onReturnToActive: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = comingNextPreviews.find((p) => p.id === openId)
  const titleRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (openId) titleRef.current?.focus()
  }, [openId])

  return (
    <section id="scenario-previews" aria-labelledby="previews-title" className="sheet scroll-mt-28">
      <h2 id="previews-title" className="border-b border-rule px-5 py-2.5 text-body font-semibold text-ink">
        Scenario previews
      </h2>
      <ul className="divide-y divide-rule">
        {comingNextPreviews.map((preview) => {
          const expanded = openId === preview.id
          return (
            <li key={preview.id}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="preview-description"
                onClick={() => setOpenId(expanded ? null : preview.id)}
                className={`grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-5 py-2.5 text-left transition-colors duration-fast hover:bg-sunken ${
                  expanded ? 'bg-sunken' : ''
                }`}
              >
                <span>
                  <span className="block text-meta text-ink-3">{preview.track}</span>
                  <span className="block text-body font-medium text-ink">{preview.title}</span>
                </span>
                <span className="inline-flex items-center gap-1 whitespace-nowrap text-meta text-ink-3">
                  <Lock aria-hidden className="h-3 w-3" />
                  Coming next · not runnable
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {open && (
        <div id="preview-description" role="region" aria-label={`${open.track} preview`} className="border-t border-rule bg-sunken px-5 py-4 text-body">
          <p ref={titleRef} tabIndex={-1} className="font-semibold text-ink focus:outline-none">
            {open.track}: {open.title}
          </p>
          <p className="mt-1 text-ink-2">{open.description}</p>
          <p className="mt-2 text-meta text-ink-3">Preview only. Only MAT-001 is runnable in this proof of concept.</p>
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => {
              setOpenId(null)
              onReturnToActive()
            }}
          >
            Return to MAT-001
            <ArrowRight aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  )
}
