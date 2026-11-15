import { db, type ProviderKey, type Settings } from './db'

export type { ProviderKey }

// Single settings record (PRD §5). A missing record reads as the defaults,
// so nothing has to seed the database on first run.

export type SettingsPatch = Partial<Omit<Settings, 'id'>>

export const defaultSettings: Settings = {
  id: 'settings',
  theme: 'system',
  minimap: true,
  welcomedAt: null,
  welcomeDocId: null,
  storageWarningDismissedAt: null,
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
