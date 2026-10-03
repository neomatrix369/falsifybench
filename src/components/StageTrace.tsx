import { ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, Pause, Play, RotateCcw, TriangleAlert } from 'lucide-react'
import { STAGES, STAGE_LABELS } from '../domain/stages'
import { stageVisualState, type ControlAvailability, type StageVisualState, type WalkthroughState } from '../domain/walkthrough'

const VISUAL: Record<StageVisualState, { text: string; className: string; Icon: typeof Circle }> = {
  pending: { text: 'Pending', className: 'border-slate-200 bg-white text-slate-400', Icon: Circle },
  active: { text: 'Current', className: 'border-indigo-300 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-300', Icon: CircleDot },
  completed: { text: 'Completed', className: 'border-emerald-200 bg-white text-slate-800 hover:bg-emerald-50/50', Icon: CircleCheck },
  warning: { text: 'Flagged by audit', className: 'border-amber-300 bg-amber-50/60 text-slate-800 hover:bg-amber-50', Icon: TriangleAlert },
}

const ICON_COLOR: Record<StageVisualState, string> = {
  pending: 'text-slate-300',
  active: 'text-indigo-600',
  completed: 'text-emerald-600',
  warning: 'text-amber-600',
}

interface Props {
  state: WalkthroughState
  controls: ControlAvailability
  onSelect: (index: number) => void
  onBack: () => void
  onNext: () => void
  onToggleAutoplay: () => void
  onReset: () => void
}

export function StageTrace({ state, controls, onSelect, onBack, onNext, onToggleAutoplay, onReset }: Props) {
  return (
    <section aria-labelledby="trace-title" className="card p-5">
      <div className="flex items-center justify-between">
        <h2 id="trace-title" className="eyebrow">
          Run trace
        </h2>
        <span className="text-xs text-slate-500" aria-live="polite">
          {state.status === 'idle'
            ? 'Not started'
            : `Stage ${state.cursor + 1} of ${STAGES.length}${state.autoplay ? ' · auto-playing' : ''}${state.status === 'complete' ? ' · run complete' : ''}`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Walkthrough controls">
        <button type="button" className="btn-secondary" onClick={onBack} disabled={!controls.canBack}>
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Back
        </button>
        <button type="button" className="btn-secondary" onClick={onNext} disabled={!controls.canNext}>
          Next step
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onToggleAutoplay}
          disabled={!controls.canAutoplay}
          aria-pressed={state.autoplay}
        >
          {state.autoplay ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
          {state.autoplay ? 'Pause auto-play' : 'Auto-play'}
        </button>
        <button type="button" className="btn-secondary" onClick={onReset} disabled={!controls.canReset}>
          <RotateCcw aria-hidden className="h-4 w-4" />
          Reset
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Auto-play advances every 3 s using the same steps as Next step. Any manual control pauses it.</p>
      <ol className="mt-3 space-y-1.5">
        {STAGES.map((stage, index) => {
          const visual = stageVisualState(state, index)
          const meta = VISUAL[visual]
          const selectable = index <= state.reached && state.status !== 'idle'
          return (
            <li key={stage}>
              <button
                type="button"
                disabled={!selectable}
                aria-current={visual === 'active' ? 'step' : undefined}
                onClick={() => onSelect(index)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default ${meta.className}`}
              >
                <meta.Icon aria-hidden className={`h-4 w-4 shrink-0 ${ICON_COLOR[visual]}`} />
                <span className="font-mono text-xs text-slate-400">{index + 1}</span>
                <span className="font-medium">{STAGE_LABELS[stage]}</span>
                <span className="ml-auto text-[11px] text-slate-500">{meta.text}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
