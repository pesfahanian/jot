import type { Provider } from '@/lib/db'
import type { ChatMessage, KeyTest } from '../request'
import * as google from './google'
import * as openrouter from './openrouter'

// The AI providers a review can run on. The person picks one in the AI
// Provider panel; each keeps its own key. Everything else in the pipeline
// is provider-blind: one shared call in, one text reply out.
export interface ProviderInfo {
  label: string
  model: string
  // Where keys come from, and the one host the key is ever sent to.
  keysUrl: string
  keysLabel: string
  host: string
  placeholder: string
  testKey(key: string): Promise<KeyTest>
  // The reply, and which model gave it (Google fails over down a chain).
  chat(key: string, messages: ChatMessage[], signal?: AbortSignal): Promise<{ content: string; model: string }>
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  openrouter: {
    label: 'OpenRouter',
    model: openrouter.MODEL,
    keysUrl: 'https://openrouter.ai/keys',
    keysLabel: 'openrouter.ai/keys',
    host: 'openrouter.ai',
    placeholder: 'sk-or-v1-…',
    testKey: openrouter.testKey,
    chat: openrouter.chat,
  },
  google: {
    label: 'Google AI Studio',
    model: google.MODEL,
    keysUrl: 'https://aistudio.google.com/apikey',
    keysLabel: 'aistudio.google.com/apikey',
    host: 'generativelanguage.googleapis.com',
    placeholder: 'AIza…',
    testKey: google.testKey,
    chat: google.chat,
  },
}

export const PROVIDER_ORDER: Provider[] = ['openrouter', 'google']
