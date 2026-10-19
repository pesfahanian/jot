import { create } from 'zustand'

// App-level overlays (round 4): the settings modal and the command palette,
// plus a request for the focused pane to open its PDF options card (from
// the palette or ⇧⌘E — the card belongs to the pane's export button).

export type SettingsSection = 'ai' | 'editor' | 'appearance' | 'shortcuts' | 'storage'

interface UiState {
  settings: { open: boolean; section: SettingsSection }
  paletteOpen: boolean
  pdfRequest: { paneId: string; nonce: number } | null
  // While the shortcut editor records a key, app shortcuts stand aside.
  recordingKey: boolean
  openSettings(section?: SettingsSection): void
  closeSettings(): void
  setSettingsSection(section: SettingsSection): void
  setPalette(open: boolean): void
  requestPdf(paneId: string): void
  setRecordingKey(on: boolean): void
}

export const useUi = create<UiState>()((set, get) => ({
  settings: { open: false, section: 'ai' },
  paletteOpen: false,
  pdfRequest: null,
  recordingKey: false,
  openSettings: (section) => set({ settings: { open: true, section: section ?? get().settings.section }, paletteOpen: false }),
  closeSettings: () => set({ settings: { ...get().settings, open: false } }),
  setSettingsSection: (section) => set({ settings: { ...get().settings, section } }),
  setPalette: (open) => set({ paletteOpen: open }),
  requestPdf: (paneId) => set({ pdfRequest: { paneId, nonce: Date.now() } }),
  setRecordingKey: (on) => set({ recordingKey: on }),
}))
