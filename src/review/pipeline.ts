import type { ReviewSession } from '@/lib/db'
import { assembleFlags } from './assemble'
import { REVIEW_MODEL } from './openrouter'
import { runPassA } from './passA'
import { resolveSections, runPassB } from './passB'
import { RULESET_VERSION } from './ruleset'
import { runSharedCall } from './sharedCall'

// The full flag-production pipeline (checks.md "Execution model"):
//   Pass A (client) → one shared OpenRouter call → Pass B (client) → assemble
export async function produceReview(documentId: string, text: string, key: string, signal?: AbortSignal): Promise<ReviewSession> {
  const a = runPassA(text)
  const { response } = await runSharedCall(key, text, a, signal)
  const sections = resolveSections(text, a, response.sections)
  const b = runPassB(text, a, response, sections)
  const flags = assembleFlags(text, a, response, b)
  return { documentId, rulesetVersion: RULESET_VERSION, model: REVIEW_MODEL, source: text, createdAt: Date.now(), flags }
}
