import type { ReactNode } from 'react'
import type { ChatMessage } from '@/lib/db'

// Full translation (round 4, frame 15) — built in the next step.
export function TranslateDocument({ children }: { documentId: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <>{children}</>
}

export function TranslationCard({ message }: { message: Extract<ChatMessage, { role: 'action' }> }) {
  return <span className="font-mono text-[11px] text-muted-foreground">{message.text}</span>
}
