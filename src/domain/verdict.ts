import type { Verdict } from './types'

/** Display label for a verdict; raw values stay lowercase in data and exported JSON. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  proceed: 'Proceed',
  investigate: 'Investigate',
  abstain: 'Abstain',
}
