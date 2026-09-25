// Console handle for the no-UI verification steps (T0.4, Phase 1).
// Imported from main.tsx in dev only.
import { createAutosave } from './autosave'
import { db } from './db'
import * as documents from './documents'
import * as settings from './settings'

;(window as unknown as { jot: object }).jot = { db, createAutosave, ...documents, ...settings }
