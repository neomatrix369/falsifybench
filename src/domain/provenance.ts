import type { PartnerScenarioValidator, PartnerValidationResult, Provenance, ProvenanceStatus } from './types'

const PROVENANCE_STATUSES: ProvenanceStatus[] = [
  'synthetic_hand_audited',
  'partner_pending_validation',
  'partner_validated',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Pure stub for the future partner-data adapter. It never contacts a network and
 * never upgrades a record to `partner_validated` on its own: that status must be
 * asserted by the source and is still only runnable once a real validator exists.
 */
export const partnerScenarioValidator: PartnerScenarioValidator = {
  validate(input: unknown): PartnerValidationResult {
    const errors: string[] = []
    if (!isRecord(input)) {
      return { ok: false, status: null, runnable: false, errors: ['Input must be an object.'] }
    }

    const source = input.source
    if (!isRecord(source) || !nonEmptyString(source.name) || !nonEmptyString(source.retrievedAt)) {
      errors.push('Missing source metadata (source.name and source.retrievedAt are required).')
    }

    const provenance = input.provenance
    let status: ProvenanceStatus | null = null
    if (!isRecord(provenance)) {
      errors.push('Missing provenance.')
    } else {
      if (PROVENANCE_STATUSES.includes(provenance.status as ProvenanceStatus)) {
        status = provenance.status as ProvenanceStatus
      } else {
        errors.push('Provenance status is not recognised.')
      }
      if (!nonEmptyString(provenance.attestedBy)) {
        errors.push('Provenance must name who attested the data.')
      }
    }

    if (status === 'synthetic_hand_audited') {
      errors.push('Partner records cannot claim synthetic provenance.')
    }

    const ok = errors.length === 0
    // Runnable partner benchmarks are intentionally disabled in this PoC.
    return { ok, status: ok ? status : null, runnable: false, errors }
  },
}

export function isRunnableProvenance(provenance: Provenance): boolean {
  return provenance.status === 'synthetic_hand_audited'
}

export const SYNTHETIC_LABEL = 'Synthetic · hand-audited'
export const SCRIPTED_FIXTURE_LABEL = 'Scripted benchmark fixture — not a live model run'
export const PARTNER_UNAVAILABLE_REASON = 'Awaiting validated partner source.'
export const LIVE_AGENT_UNAVAILABLE_REASON =
  'Runs only on a local machine through the local server, which `npm run dev` starts. No server answered here, so no model is called.'

/** Shown on a live baseline answer instead of `SCRIPTED_FIXTURE_LABEL`. */
export const liveModelLabel = (model: string) => `Live model run — ${model} via the local server`

/** Plain statement of what a live run is: the baseline is live, the guarded agent is not. */
export const LIVE_SCOPE_NOTE = 'Only the baseline is live; the guarded agent stays a scripted fixture until Step 4.'
