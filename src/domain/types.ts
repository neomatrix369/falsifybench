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
  kind: 'ultrasonic' | 'imaging' | 'property' | 'maintenance' | 'coverage'
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
    regionId: string
    regionRole: string
    readingsInRegion: number
    sampledRegionIds: string[]
    summary: string
  }
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
  regions: BracketRegion[]
  thresholdMm: number
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
