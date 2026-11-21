import { create } from 'zustand'

// Where the cursor is in the focused editor, for the status bar. Its own
// small store (memory report, finding 4): it changes on every keystroke,
// and in the workspace store that ran every subscriber's selector — two
// hundred sidebar rows' among them — each time.

export interface CursorStatus {
  documentId: string
  line: number
  col: number
}

export const useCursor = create<{ cursor: CursorStatus | null; set(c: CursorStatus | null): void }>()((set) => ({
  cursor: null,
  set: (cursor) => set({ cursor }),
}))
