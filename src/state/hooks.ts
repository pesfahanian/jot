import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type JotDocument } from '@/lib/db'

// Every document, kept live from IndexedDB. undefined until the first read.
export function useDocuments(): JotDocument[] | undefined {
  return useLiveQuery(() => db.documents.toArray(), [])
}

// A clock for relative timestamps; ticks every 30s.
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
