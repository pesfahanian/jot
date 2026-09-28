import type { Provider, ReviewSession } from '@/lib/db'
import { assembleFlags } from './assemble'
import { PROVIDERS } from './providers'
import { runPassA } from './passA'
import { resolveSections, runPassB } from './passB'
import { RULESET_VERSION } from './ruleset'
import { runSharedCall } from './sharedCall'

// The full flag-production pipeline (checks.md "Execution model"):
//   Pass A (client) → one shared provider call → Pass B (client) → assemble
export async function produceReview(documentId: string, text: string, provider: Provider, key: string, signal?: AbortSignal): Promise<ReviewSession> {
  const a = runPassA(text)
  const { response } = await runSharedCall(provider, key, text, a, signal)
  const sections = resolveSections(text, a, response.sections)
  const b = runPassB(text, a, response, sections)
  const flags = assembleFlags(text, a, response, b)
  return { documentId, rulesetVersion: RULESET_VERSION, model: `${provider}:${PROVIDERS[provider].model}`, source: text, createdAt: Date.now(), flags }
}
