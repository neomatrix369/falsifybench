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
    | 'protocol'
    | 'operator'
    | 'telemetry'
    | 'log'
    | 'deck'
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

/** How a turn moved the task: forward, nowhere, back on track after an error, or into harm. */
export type TurnKind = 'productive' | 'wasted' | 'rectification' | 'unsafe'

export interface AgentTurn {
  by: 'agent' | 'guard'
  action: string
  kind: TurnKind
}

/** Plain-words answer to "what is being tested here?", safe to show before Audit. */
export interface ScenarioBrief {
  agent: string
  task: string
  input: string
  checks: string
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
    /** Why the untrusted sources are excluded, shown as `Excluded · <reason>`. Defaults to `instruction`. */
    untrustedReason?: string
    summary: string
  }
  narrative: EvaluationNarrative
  findings: AuditFinding[]
  expectedSafeVerdict: Verdict
  sufficientNextAction: string
  /** Public evidence IDs the guarded decision relies on. The answer key itself is used only for grading. */
  guardedBasis: string[]
  /** Turn-level trace: tags for each public baseline turn, and the guarded run (guard stops, advises, agent resumes). */
  turns?: { baseline: TurnKind[]; guarded: AgentTurn[] }
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
  brief: ScenarioBrief
  baseline: AgentResponse
  /** What the baseline agent did, turn by turn. Untagged until Audit. */
  baselineTurns?: string[]
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

export type AgentPath = 'baseline' | 'guarded'

/** Produces one agent's answer for a scenario from its public evidence. Today: `scriptedAgentRunner` replays fixed answers. */
export interface AgentRunner {
  run(agent: 'baseline' | 'guarded', scenario: Scenario): Promise<AgentResponse>
}

/** Scores one agent's answer against the sealed grading truth. Today: `fixtureGrader` looks up hand-entered scores. */
export interface Grader {
  rubricVersion(scenario: Scenario): string
  grade(scenario: Scenario, evaluation: ScenarioEvaluation, agent: 'baseline' | 'guarded', response: AgentResponse): MetricScores
}

/** Rubric scores for both agents on one scenario. Totals are computed, never stored. */
export interface RubricScores {
  rubricVersion: string
  baseline: MetricScores
  guarded: MetricScores
}

/** What both agents answered on one run, and how the grader scored those answers. */
export interface GradedRun {
  responses: Record<AgentPath, AgentResponse>
  scores: RubricScores
}

export interface PartnerScenarioValidator {
  validate(input: unknown): PartnerValidationResult
}
