import { create } from 'zustand'

// How many typos each document has marked (editor/spelling.ts), and how
// many of those have a sure fix, for the status bar's "typos N · fix …".

export interface Typo {
  from: number
  to: number
  word: string
  // The best guess, what a click applies; then the next likeliest.
  fix: string
  others: string[]
  // Nothing else comes close: "fix all" applies it.
  sure: boolean
}

export interface TypoCount {
  all: number
  sure: number
}

interface TyposState {
  byDoc: Record<string, TypoCount>
  set(documentId: string, list: readonly Typo[]): void
}

export const useTypos = create<TyposState>()((set, get) => ({
  byDoc: {},
  set(documentId, list) {
    const now = get().byDoc[documentId]
    const all = list.length
    const sure = list.filter((t) => t.sure).length
    if (now?.all !== all || now?.sure !== sure) set({ byDoc: { ...get().byDoc, [documentId]: { all, sure } } })
  },
}))
