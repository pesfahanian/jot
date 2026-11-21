import { create } from 'zustand'
import { installPack, installedPacks, removePack } from '@/lib/packs'
import { dropLanguage } from '@/lib/speller'

// Which language packs are installed (lib/packs.ts), and which one is
// downloading — for settings, the status bar's language cell and the
// editor's spell-check.

interface PacksState {
  installed: Set<string>
  busy: string | null
  error: string | null
  refresh(): Promise<void>
  add(code: string): Promise<void>
  remove(code: string): Promise<void>
}

export const usePacks = create<PacksState>()((set, get) => ({
  installed: new Set(),
  busy: null,
  error: null,
  async refresh() {
    const installed = await installedPacks().catch(() => new Set<string>())
    set({ installed })
  },
  async add(code) {
    if (get().busy) return
    set({ busy: code, error: null })
    try {
      await installPack(code)
    } catch {
      await removePack(code).catch(() => {})
      set({ error: code })
    }
    set({ busy: null })
    await get().refresh()
  },
  async remove(code) {
    if (get().busy) return
    set({ busy: code, error: null })
    await removePack(code).catch(() => {})
    await dropLanguage(code)
    set({ busy: null })
    await get().refresh()
  },
}))

void usePacks.getState().refresh()
