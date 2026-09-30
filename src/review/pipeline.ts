import type { Provider, ReviewSession } from '@/lib/db'
import { assembleFlags } from './assemble'
import { runPassA } from './passA'
import { resolveSections, runPassB } from './passB'
import { RULESET_VERSION } from './ruleset'
import { runSharedCall } from './sharedCall'

// The full flag-production pipeline (checks.md "Execution model"):
//   Pass A (client) → one shared provider call → Pass B (client) → assemble
// Or, when the model declines the document (suitability.ts), its reason.
// `force` ("review anyway") doesn't let it decline.
export async function produceReview(
  documentId: string,
  text: string,
  provider: Provider,
  chain: string[],
  key: string,
  signal?: AbortSignal,
  force = false,
): Promise<ReviewSession | { skipped: string }> {
  const a = runPassA(text)
  const { response, model } = await runSharedCall(provider, chain, key, text, a, signal, !force)
  if (response.skip) return { skipped: response.skip }
  const sections = resolveSections(text, a, response.sections)
  const b = runPassB(text, a, response, sections)
  const flags = assembleFlags(text, a, response, b)
  return { documentId, rulesetVersion: RULESET_VERSION, model: `${provider}:${model}`, source: text, createdAt: Date.now(), flags }
}
