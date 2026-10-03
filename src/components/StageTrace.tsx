import { ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, Pause, Play, RotateCcw, TriangleAlert } from 'lucide-react'
import { STAGES, STAGE_LABELS } from '../domain/stages'
import { stageVisualState, type ControlAvailability, type StageVisualState, type WalkthroughState } from '../domain/walkthrough'

const VISUAL: Record<StageVisualState, { text: string; row: string; icon: string; status: string; Icon: typeof Circle }> = {
  pending: { text: 'Pending', row: 'text-ink-3', icon: 'text-rule-strong', status: 'text-ink-3', Icon: Circle },
  active: { text: 'Current', row: 'bg-primary-tint font-semibold text-ink', icon: 'text-primary', status: 'text-primary', Icon: CircleDot },
  completed: { text: 'Completed', row: 'text-ink hover:bg-sunken', icon: 'text-ok', status: 'text-ok', Icon: CircleCheck },
  warning: { text: 'Flagged by audit', row: 'text-ink hover:bg-warn-tint/60', icon: 'text-warn', status: 'font-medium text-warn', Icon: TriangleAlert },
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
    <section aria-labelledby="trace-title" className="sheet">
      <div className="flex items-baseline justify-between border-b border-rule px-5 py-2.5">
        <h2 id="trace-title" className="text-body font-semibold text-ink">
          Run trace
        </h2>
        <span className="font-mono text-meta text-ink-2" aria-live="polite">
          {state.status === 'idle'
            ? 'Not started'
            : `Stage ${state.cursor + 1} of ${STAGES.length}${state.autoplay ? ' · auto-playing' : ''}${state.status === 'complete' ? ' · run complete' : ''}`}
        </span>
      </div>
      <div className="px-5 pb-4 pt-3">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Walkthrough controls">
          <button type="button" className="btn-secondary" onClick={onBack} disabled={!controls.canBack}>
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Back
          </button>
          <button type="button" className="btn-primary" onClick={onNext} disabled={!controls.canNext}>
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
        <p className="mt-2 text-meta text-ink-3">Auto-play advances every 3 s using the same steps as Next step. Any manual control pauses it.</p>
        <ol className="mt-3">
          {STAGES.map((stage, index) => {
            const visual = stageVisualState(state, index)
            const meta = VISUAL[visual]
            const selectable = index <= state.reached && state.status !== 'idle'
            const last = index === STAGES.length - 1
            return (
              <li key={stage} className="relative">
                {!last && (
                  <span
                    aria-hidden
                    className={`absolute bottom-[-9px] left-[19.5px] top-[27px] w-px ${index < state.reached ? 'bg-ok-line' : 'bg-rule'}`}
                  />
                )}
                <button
                  type="button"
                  disabled={!selectable}
                  aria-current={visual === 'active' ? 'step' : undefined}
                  onClick={() => onSelect(index)}
                  className={`relative flex w-full items-center gap-3 rounded-sm px-3 py-1.5 text-left text-body transition-colors duration-fast disabled:cursor-default ${meta.row}`}
                >
                  <meta.Icon aria-hidden className={`h-4 w-4 shrink-0 ${meta.icon}`} />
                  <span className="w-3 font-mono text-meta text-ink-3">{index + 1}</span>
                  <span>{STAGE_LABELS[stage]}</span>
                  <span className={`ml-auto text-meta ${meta.status}`}>{meta.text}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
