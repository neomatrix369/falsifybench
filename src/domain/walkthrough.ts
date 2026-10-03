import { LAST_STAGE_INDEX, STAGES } from './stages'
import type { StageEvent } from './types'

export type WalkthroughStatus = 'idle' | 'active' | 'complete'

export interface WalkthroughState {
  status: WalkthroughStatus
  runId: string | null
  startedAt: string | null
  /** Furthest stage reached in this run (-1 before a run starts). */
  reached: number
  /** Stage currently shown in the result surface. */
  cursor: number
  autoplay: boolean
  events: StageEvent[]
}

export type WalkthroughAction =
  | { type: 'START'; runId: string; at: string; autoplay?: boolean }
  | { type: 'NEXT'; at: string; source: 'manual' | 'auto' }
  | { type: 'BACK' }
  | { type: 'SELECT'; index: number }
  | { type: 'AUTOPLAY_ON'; runId: string; at: string }
  | { type: 'AUTOPLAY_OFF' }
  | { type: 'RESET' }

export const initialWalkthroughState: WalkthroughState = {
  status: 'idle',
  runId: null,
  startedAt: null,
  reached: -1,
  cursor: -1,
  autoplay: false,
  events: [],
}

function eventFor(index: number, at: string): StageEvent {
  return { order: index + 1, stage: STAGES[index], at }
}

function start(runId: string, at: string, autoplay: boolean): WalkthroughState {
  return {
    status: 'active',
    runId,
    startedAt: at,
    reached: 0,
    cursor: 0,
    autoplay,
    events: [eventFor(0, at)],
  }
}

/** Shared forward transition used by both manual Next step and auto-play ticks. */
function advance(state: WalkthroughState, at: string): WalkthroughState {
  if (state.status === 'idle' || state.cursor >= LAST_STAGE_INDEX) return state
  if (state.cursor < state.reached) {
    return { ...state, cursor: state.cursor + 1 }
  }
  const reached = state.reached + 1
  return {
    ...state,
    reached,
    cursor: reached,
    status: reached === LAST_STAGE_INDEX ? 'complete' : 'active',
    events: [...state.events, eventFor(reached, at)],
  }
}

export function walkthroughReducer(state: WalkthroughState, action: WalkthroughAction): WalkthroughState {
  switch (action.type) {
    case 'START':
      if (state.status === 'active') return state
      return start(action.runId, action.at, action.autoplay ?? false)
    case 'NEXT': {
      const next = advance(state, action.at)
      const autoplay = action.source === 'manual' ? false : next.autoplay && next.cursor < LAST_STAGE_INDEX
      return next === state && autoplay === state.autoplay ? state : { ...next, autoplay }
    }
    case 'BACK':
      if (state.status === 'idle' || state.cursor <= 0) return { ...state, autoplay: false }
      return { ...state, cursor: state.cursor - 1, autoplay: false }
    case 'SELECT':
      if (state.status === 'idle' || action.index < 0 || action.index > state.reached) return state
      return { ...state, cursor: action.index, autoplay: false }
    case 'AUTOPLAY_ON':
      if (state.status === 'idle' || (state.status === 'complete' && state.cursor >= LAST_STAGE_INDEX))
        return start(action.runId, action.at, true)
      if (state.cursor >= LAST_STAGE_INDEX) return state
      return { ...state, autoplay: true }
    case 'AUTOPLAY_OFF':
      return state.autoplay ? { ...state, autoplay: false } : state
    case 'RESET':
      return initialWalkthroughState
    default:
      return state
  }
}

export interface ControlAvailability {
  canRun: boolean
  canBack: boolean
  canNext: boolean
  canAutoplay: boolean
  canReset: boolean
}

export function controlAvailability(state: WalkthroughState): ControlAvailability {
  return {
    canRun: state.status !== 'active',
    canBack: state.status !== 'idle' && state.cursor > 0,
    canNext: state.status !== 'idle' && state.cursor < LAST_STAGE_INDEX,
    canAutoplay: state.cursor < LAST_STAGE_INDEX || state.status === 'complete',
    canReset: state.status !== 'idle',
  }
}

export type StageVisualState = 'pending' | 'active' | 'completed' | 'warning'

export function stageVisualState(state: WalkthroughState, index: number): StageVisualState {
  if (index > state.reached) return 'pending'
  if (index === state.cursor) return 'active'
  if (STAGES[index] === 'baseline' && state.reached >= STAGES.indexOf('audit')) return 'warning'
  return 'completed'
}
