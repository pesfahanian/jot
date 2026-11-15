import { create } from 'zustand'

// How many typos each document has marked (editor/spelling.ts), for the
// status bar's "typos N · fix all".

export interface Typo {
  from: number
  to: number
  word: string
  fix: string
}

interface TyposState {
  byDoc: Record<string, number>
  set(documentId: string, count: number): void
}

export const useTypos = create<TyposState>()((set, get) => ({
  byDoc: {},
  set: (documentId, count) => get().byDoc[documentId] !== count && set({ byDoc: { ...get().byDoc, [documentId]: count } }),
}))
