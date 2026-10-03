import type { WalkthroughStage } from './types'

export const STAGES: readonly WalkthroughStage[] = ['evidence', 'baseline', 'audit', 'guarded', 'receipt']

export const STAGE_LABELS: Record<WalkthroughStage, string> = {
  evidence: 'Evidence loaded',
  baseline: 'Baseline decided',
  audit: 'Evidence audit',
  guarded: 'Guarded verdict',
  receipt: 'Receipt recorded',
}

export const LAST_STAGE_INDEX = STAGES.length - 1
export const AUDIT_STAGE_INDEX = STAGES.indexOf('audit')
