import { create } from 'zustand'

// What's open over the editor (Phase 16): the right-click menu on a
// selection, a note's popover, the notes list, and a selection's
// translation. Positions are the page coordinates the overlay hangs from.

export interface Anchor {
  left: number
  top: number
  bottom: number
}

interface OverlayState {
  menu: { documentId: string; from: number; to: number; x: number; y: number } | null
  note: { documentId: string; id: string; anchor: Anchor; editing: boolean } | null
  notesList: boolean
  translate: { documentId: string; from: number; to: number; text: string; anchor: Anchor } | null
  // The highlight colour the menu's row applies: the last one used.
  lastColor: 1 | 2 | 3
  set(patch: Partial<Omit<OverlayState, 'set'>>): void
}

export const useOverlays = create<OverlayState>()((set) => ({
  menu: null,
  note: null,
  notesList: false,
  translate: null,
  lastColor: 1,
  set: (patch) => set(patch),
}))
