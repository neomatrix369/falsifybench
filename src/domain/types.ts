export type DataMode = 'synthetic' | 'partner'

export type ProvenanceStatus =
  | 'synthetic_hand_audited'
  | 'partner_pending_validation'
  | 'partner_validated'

export type Verdict = 'proceed' | 'investigate' | 'abstain'

export type WalkthroughStage = 'evidence' | 'baseline' | 'audit' | 'guarded' | 'receipt'

export interface Provenance {
  status: ProvenanceStatus
  label: string
  source: string
  auditedBy: string
}

export interface EvidenceItem {
  id: string
  title: string
  finding: string
  kind:
    | 'ultrasonic'
    | 'imaging'
    | 'property'
    | 'maintenance'
    | 'coverage'
    | 'test'
    | 'specification'
    | 'field'
    | 'literature'
    | 'supplier'
  /** Verbatim text from the source, shown as received. */
  excerpt?: string
}

export interface BracketRegion {
  id: string
  name: string
  note?: string
}

export interface AgentResponse {
  agentLabel: string
  verdict: Verdict
  confidenceLabel: string
  claim: string
  rationale: string[]
  nextAction: string
}

export interface MetricScores {
  evidenceSufficiency: number
  calibration: number
  safeAction: number
  nextTestQuality: number
}

export interface AuditFinding {
  id: string
  statement: string
  evidenceIds: string[]
}

/** Hidden evaluation truth. Only unsealed when the walkthrough enters the audit stage. */
export interface ScenarioEvaluation {
  hiddenTruth: {
    regionId?: string
    regionRole?: string
    readingsInRegion?: number
    sampledRegionIds?: string[]
    /** Sources the audit excludes because they instruct the agent instead of evidencing a claim. */
    untrustedEvidenceIds?: string[]
    summary: string
  }
  narrative: EvaluationNarrative
  findings: AuditFinding[]
  expectedSafeVerdict: Verdict
  sufficientNextAction: string
  guarded: AgentResponse
  scoring: {
    rubricVersion: string
    baseline: MetricScores
    guarded: MetricScores
  }
}

/** Presenter copy that may be shown before Audit. */
export interface ScenarioNarrative {
  idleQuestion: string
  /** Names the failure this benchmark exposes; shown under the idle question. */
  idleClaim: string
  evidenceHeadline: string
  evidenceIntro: string
  baselineHeadline: string
  baselineIntro: string
  baselineWhy: string
}

/** Presenter copy that reveals the hidden truth; sealed with the evaluation. */
export interface EvaluationNarrative {
  auditHeadline: string
  auditQuestion: string
  auditAnswer: string
  auditMethod?: string
  guardedHeadline: string
  guardedIntro: string
  guardedWhy: string
}

export interface SealedEvaluation {
  unseal(): Promise<ScenarioEvaluation>
}

export interface Scenario {
  id: string
  version: string
  title: string
  domain: string
  question: string
  provenance: Provenance
  evidence: EvidenceItem[]
  /** Bracket-style scenarios only. */
  regions?: BracketRegion[]
  thresholdMm?: number
  narrative: ScenarioNarrative
  baseline: AgentResponse
  guardedAgentLabel: string
  evaluation: SealedEvaluation
}

export interface ScenarioPreview {
  id: string
  track: string
  title: string
  description: string
}

export interface StageEvent {
  order: number
  stage: WalkthroughStage
  at: string
}

export interface PartnerValidationResult {
  ok: boolean
  status: ProvenanceStatus | null
  runnable: boolean
  errors: string[]
}

export interface ScenarioSource {
  loadScenario(id: string): Promise<Scenario>
}

export interface PartnerScenarioValidator {
  validate(input: unknown): PartnerValidationResult
}
