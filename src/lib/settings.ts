import { db, type Provider, type ProviderKey, type Settings } from './db'

export type { ProviderKey }

// Single settings record (PRD §5). A missing record reads as the defaults,
// so nothing has to seed the database on first run.

export type SettingsPatch = Partial<Omit<Settings, 'id'>>

export const defaultSettings: Settings = {
  id: 'settings',
  provider: 'openrouter',
  keys: {},
  models: {},
  theme: 'system',
  minimap: true,
  welcomedAt: null,
  welcomeDocId: null,
  storageWarningDismissedAt: null,
}

const NO_KEY: ProviderKey = { key: null, status: 'untested', lastValidatedAt: null }

export function providerKey(s: Settings, provider: Provider = s.provider): ProviderKey {
  return s.keys?.[provider] ?? NO_KEY
}

// Changes one provider's key record, leaving the others as they are.
export function setProviderKey(provider: Provider, k: Partial<ProviderKey>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const s = await getSettings()
    return updateSettings({ keys: { ...s.keys, [provider]: { ...providerKey(s, provider), ...k } } })
  })
}

// Sets one provider's model chain; null goes back to the default.
export function setProviderModels(provider: Provider, chain: string[] | null): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const { [provider]: _old, ...rest } = (await getSettings()).models ?? {}
    void _old
    return updateSettings({ models: chain ? { ...rest, [provider]: chain } : rest })
  })
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
