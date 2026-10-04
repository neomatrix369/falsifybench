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
  guard?: GuardReport
  /** Present only when a live model produced this answer; scripted fixtures never carry it. */
  live?: LiveCall
}

export interface GuardReport {
  untrustedSourceIds: string[]
  openGaps: string[]
  overrides: string[]
}

/** What actually happened on one live model call, as reported by the local server and measured by the browser. */
export interface LiveCall {
  provider: 'anthropic'
  /** Model ID the provider reported for this call. */
  model: string
  /** Provider request ID (`request-id` header), or null if none was returned. */
  requestId: string | null
  /** Time the local server waited for the provider. */
  latencyMs: number
  /** Browser round trip to the local server, including `latencyMs`. */
  roundTripMs: number
  endpoint: string
  /** Fields of the model's structured output that passed validation before use. */
  validatedFields: string[]
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

/**
 * Produces one agent's answer for a scenario from its public evidence. `scriptedAgentRunner` replays fixed answers;
 * `liveAgentRunner` asks a model for both answers through the local server (local runs only).
 */
export interface AgentRunner {
  /** `live` runners call a model: the walkthrough asks for the baseline and guarded answers at their stages. Default `scripted`. */
  readonly execution?: 'scripted' | 'live'
  /** `signal` aborts an abandoned call (reset, scenario switch, timeout); scripted runners can ignore it. */
  run(agent: 'baseline' | 'guarded', scenario: Scenario, options?: { baseline?: AgentResponse; signal?: AbortSignal }): Promise<AgentResponse>
}

export type GraderId = 'fixture-grader' | 'rule-grader' | 'custom'

/** Which grader scored a run, as shown in the UI, Run log and receipt. */
export interface GraderIdentity {
  id: GraderId
  label: string
}

/** Scores one agent's answer against the sealed grading truth. `fixtureGrader` looks up hand-entered scores; `ruleGraderSeam` applies the rule grader. */
export interface Grader {
  readonly id?: GraderId
  readonly label?: string
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
  grader: GraderIdentity
}

export interface PartnerScenarioValidator {
  validate(input: unknown): PartnerValidationResult
}
