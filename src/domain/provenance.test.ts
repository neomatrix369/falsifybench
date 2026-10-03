import { describe, expect, it } from 'vitest'
import { mat001 } from '../data/mat001'
import { isRunnableProvenance, partnerScenarioValidator } from './provenance'

const validSource = { name: 'Partner lab', retrievedAt: '2026-01-01T00:00:00Z' }

describe('partnerScenarioValidator', () => {
  it('rejects input without source metadata', () => {
    const result = partnerScenarioValidator.validate({ provenance: { status: 'partner_pending_validation', attestedBy: 'x' } })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/source metadata/i)
  })

  it('rejects input without provenance', () => {
    const result = partnerScenarioValidator.validate({ source: validSource })
    expect(result.ok).toBe(false)
    expect(result.errors.join(' ')).toMatch(/provenance/i)
  })

  it('rejects non-objects and synthetic claims', () => {
    expect(partnerScenarioValidator.validate(null).ok).toBe(false)
    expect(
      partnerScenarioValidator.validate({ source: validSource, provenance: { status: 'synthetic_hand_audited', attestedBy: 'x' } }).ok,
    ).toBe(false)
  })

  it('keeps pending partner data non-runnable', () => {
    const result = partnerScenarioValidator.validate({
      source: validSource,
      provenance: { status: 'partner_pending_validation', attestedBy: 'Partner QA' },
    })
    expect(result).toMatchObject({ ok: true, status: 'partner_pending_validation', runnable: false })
  })

  it('never enables a runnable partner benchmark in this PoC', () => {
    const result = partnerScenarioValidator.validate({
      source: validSource,
      provenance: { status: 'partner_validated', attestedBy: 'Partner QA' },
    })
    expect(result.runnable).toBe(false)
  })

  it('treats MAT-001 as runnable synthetic data', () => {
    expect(isRunnableProvenance(mat001.provenance)).toBe(true)
  })
})
