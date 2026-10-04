import { ChevronDown, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { RunLogEntry } from '../domain/runLog'
import { LAST_STAGE_INDEX, STAGES, STAGE_LABELS } from '../domain/stages'
import type { WalkthroughState } from '../domain/walkthrough'
import { AUTOPLAY_INTERVAL_MS } from '../hooks/useWalkthrough'
import type { RunRecovery } from '../domain/recovery'

type ExpandMode = 'latest' | 'all' | 'none'

function clockTime(iso: string | null): string {
  return iso ? iso.slice(11, 23) : '…'
}

function elapsed(iso: string | null, startedAt: string | null): string | null {
  if (!iso || !startedAt) return null
  const ms = Date.parse(iso) - Date.parse(startedAt)
  return Number.isFinite(ms) ? `+${(ms / 1000).toFixed(3)} s` : null
}

function useAutoplayCountdown(active: boolean, cursor: number): number | null {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!active) {
      setLeft(null)
      return
    }
    const due = Date.now() + AUTOPLAY_INTERVAL_MS
    const tick = () => setLeft(Math.max(0, Math.ceil((due - Date.now()) / 1000)))
    tick()
    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [active, cursor])
  return left
}

interface Props {
  entries: RunLogEntry[]
  state: WalkthroughState
  unsealing: boolean
  failure: RunRecovery | null
  /** Next step is held for the live baseline model, not the sealed evaluation. */
  awaitingLive?: boolean
}

function nowLine({ state, unsealing, failure, awaitingLive }: Omit<Props, 'entries'>, countdown: number | null): string | null {
  if (state.status === 'idle') return null
  if (failure === 'retry-live') return 'Stopped: the live baseline call failed and no answer was used. Retry asks the model again; Reset starts a new run.'
  if (failure === 'fix-data') return 'Stopped: the sealed evaluation failed its data checks and was not used. Reload and Reset load the same data.'
  if (failure === 'retry') return 'Stopped: the sealed evaluation timed out. Reset retries it; reload the page if it keeps timing out.'
  if (failure) return 'Stopped: the sealed evaluation failed to load. Reload the page to retry; Reset alone repeats the cached failure.'
  if (unsealing && awaitingLive) return 'Waiting for the live baseline model… Next step is held until it answers.'
  if (unsealing) return 'Unsealing the sealed evaluation… Next step is held until it arrives.'
  if (state.cursor === LAST_STAGE_INDEX) return 'Run complete. The receipt is recorded and nothing else runs.'
  const next = `${state.cursor + 2} ${STAGE_LABELS[STAGES[state.cursor + 1]]}`
  if (state.autoplay) return `Auto-play: stage ${next} runs in ${countdown ?? 3} s.`
  if (state.cursor < state.reached) return `Reviewing stage ${state.cursor + 1}. Next step replays recorded output; nothing re-runs.`
  return `Waiting for you: Next step runs stage ${next}.`
}

export function RunLog({ entries, state, unsealing, failure, awaitingLive = false }: Props) {
  const [open, setOpen] = useState(true)
  const [mode, setMode] = useState<ExpandMode>('latest')
  const [overrides, setOverrides] = useState<Record<number, boolean>>({})
  const countdown = useAutoplayCountdown(state.autoplay && !unsealing && failure === null, state.cursor)
  const viewing = state.status === 'idle' ? null : STAGES[state.cursor]
  const now = nowLine({ state, unsealing, failure, awaitingLive }, countdown)

  useEffect(() => {
    setMode('latest')
    setOverrides({})
  }, [state.runId])

  const latest = entries.reduce((last, e, i) => (e.facts?.length ? i : last), -1)
  const isOpen = (i: number) => overrides[i] ?? (mode === 'all' || (mode === 'latest' && i === latest))

  return (
    <section aria-labelledby="run-log-title" className="sheet">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-2">
        <h2 id="run-log-title" className="label">
          Run log · UTC
        </h2>
        <span className="flex items-center gap-4">
          {open && entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'all' ? 'none' : 'all')
                setOverrides({})
              }}
              className="text-meta font-medium text-ink-2 hover:text-ink"
            >
              {mode === 'all' ? 'Collapse all steps' : 'Expand all steps'}
            </button>
          )}
          <button
            type="button"
            aria-expanded={open}
            aria-controls="run-log-body"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-meta font-medium text-ink-2 hover:text-ink"
          >
            {open ? 'Hide' : 'Show'} details
            <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform duration-fast ${open ? 'rotate-180' : ''}`} />
          </button>
        </span>
      </div>
      {open && (
        <div id="run-log-body" className="px-5 py-3">
          {now && (
            <p className="mb-3 flex items-start gap-2 border-b border-rule pb-2.5 text-body text-ink">
              <span className="shrink-0 font-semibold">Now</span>
              <span className={failure ? 'text-risk' : 'text-ink-2'}>{now}</span>
            </p>
          )}
          {entries.length === 0 ? (
            <p className="text-body text-ink-3">
              Every step of the next run is listed here as it happens: what loaded, what triggered it, what was computed and how.
            </p>
          ) : (
            <ol role="log" aria-label="Run log entries" className="space-y-1">
              {entries.map((e, i) => {
                const factsId = `run-log-facts-${i}`
                const expanded = isOpen(i)
                const current = viewing !== null && e.stage === viewing
                const offset = elapsed(e.at, state.startedAt)
                return (
                  <li
                    key={i}
                    aria-current={current ? 'step' : undefined}
                    className={`-mx-2 rounded-sm px-2 py-1.5 text-body ${current ? 'bg-primary-tint' : ''}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                        {e.pending && <LoaderCircle aria-hidden className="h-3.5 w-3.5 animate-spin text-ink-3" />}
                        {e.label}
                      </span>
                      <span className="shrink-0 text-right font-mono text-meta tabular-nums text-ink-3">
                        {clockTime(e.at)}
                        {offset && <span className="block text-ink-3/80">{offset}</span>}
                      </span>
                    </span>
                    {e.detail && <span className="block font-mono text-meta text-ink-2">{e.detail}</span>}
                    {e.facts && e.facts.length > 0 && (
                      <>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={factsId}
                          aria-label={`${expanded ? 'Hide' : 'Show'} steps for ${e.label}`}
                          onClick={() => setOverrides((o) => ({ ...o, [i]: !expanded }))}
                          className="mt-1 inline-flex items-center gap-1 text-meta font-medium text-primary hover:text-primary-hover"
                        >
                          {expanded ? 'Hide' : 'Show'} steps
                          <span className="font-mono text-ink-3">({e.facts.length})</span>
                          <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`} />
                        </button>
                        {expanded && (
                          <dl
                            id={factsId}
                            className="mt-1.5 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-sm border border-rule bg-sunken px-3 py-2 text-meta"
                          >
                            {e.facts.map((f, j) => (
                              <div key={j} className="contents">
                                <dt className="font-mono text-ink-3 [overflow-wrap:anywhere]">{f.key}</dt>
                                <dd className="text-ink-2 [overflow-wrap:anywhere]">{f.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
