import { ArrowRight, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { comingNextPreviews } from '../data/previews'
import { StatusPill } from './StatusPill'

export function ComingNextCards({ onReturnToActive }: { onReturnToActive: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = comingNextPreviews.find((p) => p.id === openId)
  const titleRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (openId) titleRef.current?.focus()
  }, [openId])

  return (
    <section id="scenario-previews" aria-labelledby="previews-title" className="scroll-mt-20">
      <h2 id="previews-title" className="eyebrow mb-2 px-1">
        Scenario previews
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {comingNextPreviews.map((preview) => (
          <button
            key={preview.id}
            type="button"
            aria-expanded={openId === preview.id}
            aria-controls="preview-description"
            onClick={() => setOpenId(openId === preview.id ? null : preview.id)}
            className={`card p-3 text-left transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              openId === preview.id ? 'border-indigo-300' : ''
            }`}
          >
            <StatusPill icon={<Lock aria-hidden className="h-3 w-3" />}>Coming next · not runnable</StatusPill>
            <p className="mt-2 text-xs font-medium text-slate-500">{preview.track}</p>
            <p className="text-sm font-semibold text-slate-800">{preview.title}</p>
          </button>
        ))}
      </div>
      {open && (
        <div id="preview-description" role="region" aria-label={`${open.track} preview`} className="card mt-3 p-4 text-sm">
          <p ref={titleRef} tabIndex={-1} className="font-semibold text-slate-800 focus:outline-none">
            {open.track}: {open.title}
          </p>
          <p className="mt-1 text-slate-600">{open.description}</p>
          <p className="mt-2 text-xs text-slate-500">Preview only. Only MAT-001 is runnable in this proof of concept.</p>
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
