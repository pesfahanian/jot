import type { Provider } from '@/lib/db'
import type { ChatMessage, KeyTest } from '../request'
import * as anthropic from './anthropic'
import { walk } from './chain'
import * as google from './google'
import * as openai from './openai'
import * as openrouter from './openrouter'

// The AI providers a review can run on. The person picks one in the AI
// Provider panel; each keeps its own key and its own model chain (the
// model, then fallbacks). Everything else in the pipeline is
// provider-blind: one shared call in, one text reply out.
export interface ProviderInfo {
  label: string
  // Where keys come from, and the one host the key is ever sent to (it
  // must also be in public/_headers connect-src).
  keysUrl: string
  keysLabel: string
  host: string
  placeholder: string
  defaultChain: string[]
  testKey(key: string): Promise<KeyTest>
  // Suggestions for the model picker; empty when the list can't be read.
  listModels(key: string): Promise<string[]>
  ask(model: string, key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string>
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  openrouter: {
    label: 'OpenRouter',
    keysUrl: 'https://openrouter.ai/keys',
    keysLabel: 'openrouter.ai/keys',
    host: 'openrouter.ai',
    placeholder: 'sk-or-v1-…',
    defaultChain: openrouter.DEFAULT_CHAIN,
    testKey: openrouter.testKey,
    listModels: openrouter.listModels,
    ask: openrouter.ask,
  },
  google: {
    label: 'Google AI Studio',
    keysUrl: 'https://aistudio.google.com/apikey',
    keysLabel: 'aistudio.google.com/apikey',
    host: 'generativelanguage.googleapis.com',
    placeholder: 'AIza…',
    defaultChain: google.DEFAULT_CHAIN,
    testKey: google.testKey,
    listModels: google.listModels,
    ask: google.ask,
  },
  openai: {
    label: 'OpenAI',
    keysUrl: 'https://platform.openai.com/api-keys',
    keysLabel: 'platform.openai.com/api-keys',
    host: 'api.openai.com',
    placeholder: 'sk-…',
    defaultChain: openai.DEFAULT_CHAIN,
    testKey: openai.testKey,
    listModels: openai.listModels,
    ask: openai.ask,
  },
  anthropic: {
    label: 'Anthropic',
    keysUrl: 'https://console.anthropic.com/settings/keys',
    keysLabel: 'console.anthropic.com',
    host: 'api.anthropic.com',
    placeholder: 'sk-ant-…',
    defaultChain: anthropic.DEFAULT_CHAIN,
    testKey: anthropic.testKey,
    listModels: anthropic.listModels,
    ask: anthropic.ask,
  },
}

export const PROVIDER_ORDER: Provider[] = ['openrouter', 'google', 'openai', 'anthropic']

// The chain a provider's reviews run on: the person's, or the default.
export function modelChain(models: Partial<Record<Provider, string[]>> | undefined, provider: Provider): string[] {
  const chain = models?.[provider]
  return chain?.length ? chain : PROVIDERS[provider].defaultChain
}

// The reply, and which model in the chain gave it.
export function chat(provider: Provider, chain: string[], key: string, messages: ChatMessage[], signal?: AbortSignal) {
  return walk(chain, (model) => PROVIDERS[provider].ask(model, key, messages, signal))
}
