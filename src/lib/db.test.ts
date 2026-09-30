import { describe, expect, it } from 'vitest'
import { migrateKeys } from './db'

// Phase 12's settings migration: stored keys must survive the move to the
// per-provider map — a lost key means a person re-pasting it.

describe('migrateKeys', () => {
  it('moves both providers’ keys, with their status, into the map', () => {
    const s: Record<string, unknown> = {
      id: 'settings',
      provider: 'google',
      openRouterApiKey: 'sk-or-v1-test',
      keyStatus: 'valid',
      lastValidatedAt: 1,
      googleApiKey: 'AIza-test',
      googleKeyStatus: 'invalid',
      googleLastValidatedAt: 2,
      theme: 'dark',
    }
    migrateKeys(s)
    expect(s).toEqual({
      id: 'settings',
      provider: 'google',
      theme: 'dark',
      models: {},
      keys: {
        openrouter: { key: 'sk-or-v1-test', status: 'valid', lastValidatedAt: 1 },
        google: { key: 'AIza-test', status: 'invalid', lastValidatedAt: 2 },
      },
    })
  })

  it('leaves providers without a key out, and fills missing status', () => {
    const s: Record<string, unknown> = { id: 'settings', openRouterApiKey: null, keyStatus: 'untested', lastValidatedAt: null, googleApiKey: 'AIza-test' }
    migrateKeys(s)
    expect(s.keys).toEqual({ google: { key: 'AIza-test', status: 'untested', lastValidatedAt: null } })
  })
})
