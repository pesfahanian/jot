import { db, type KeyStatus, type Provider, type Settings } from './db'

// Single settings record (PRD §5). A missing record reads as the defaults,
// so nothing has to seed the database on first run.

export type SettingsPatch = Partial<Omit<Settings, 'id'>>

export const defaultSettings: Settings = {
  id: 'settings',
  provider: 'openrouter',
  openRouterApiKey: null,
  keyStatus: 'untested',
  lastValidatedAt: null,
  googleApiKey: null,
  googleKeyStatus: 'untested',
  googleLastValidatedAt: null,
  theme: 'system',
}

// One provider's key, read and written through the same shape whichever
// provider it is.
export interface ProviderKey {
  key: string | null
  status: KeyStatus
  lastValidatedAt: number | null
}

export function providerKey(s: Settings, provider: Provider = s.provider): ProviderKey {
  return provider === 'google'
    ? { key: s.googleApiKey ?? null, status: s.googleKeyStatus ?? 'untested', lastValidatedAt: s.googleLastValidatedAt ?? null }
    : { key: s.openRouterApiKey, status: s.keyStatus, lastValidatedAt: s.lastValidatedAt }
}

export function keyPatch(provider: Provider, k: Partial<ProviderKey>): SettingsPatch {
  const patch: SettingsPatch = {}
  if (provider === 'google') {
    if ('key' in k) patch.googleApiKey = k.key
    if (k.status) patch.googleKeyStatus = k.status
    if ('lastValidatedAt' in k) patch.googleLastValidatedAt = k.lastValidatedAt
  } else {
    if ('key' in k) patch.openRouterApiKey = k.key
    if (k.status) patch.keyStatus = k.status
    if ('lastValidatedAt' in k) patch.lastValidatedAt = k.lastValidatedAt
  }
  return patch
}

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings, ...(await db.settings.get('settings')) }
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...patch, id: 'settings' as const }
    await db.settings.put(next)
    return next
  })
}
