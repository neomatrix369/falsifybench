import { unsealRecovery, type UnsealRecovery } from './evaluationCheck'
import { LiveAgentError } from './live'

/** How a stopped run can recover: the unseal paths, or `retry-live`, which asks the model again for the same run. */
export type RunRecovery = UnsealRecovery | 'retry-live'

export function runRecovery(error: Error): RunRecovery {
  return error instanceof LiveAgentError ? 'retry-live' : unsealRecovery(error)
}
