import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// Debug view for a failed review: hovering the error chip shows the
// message, then the full response exactly as OpenRouter sent it
// (provider errors carry the real reason in error.metadata). Rendered at
// page level — the status bar clips anything that overflows it — and kept
// open while the pointer is over the panel, so its text can be selected.
export function ErrorDetail({ message, detail, children }: { message: string; detail: string; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const open = () => {
    clearTimeout(closeTimer.current)
    const r = anchor.current?.getBoundingClientRect()
    if (r) setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 })
  }
  const close = () => {
    closeTimer.current = setTimeout(() => setPos(null), 200)
  }
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${message}\n\n${detail}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable — the text is still selectable */
    }
  }

  return (
    <span ref={anchor} onMouseEnter={open} onMouseLeave={close} onFocus={open} onBlur={close} className="flex">
      {children}
      {pos &&
        createPortal(
          <div
            role="tooltip"
            onMouseEnter={open}
            onMouseLeave={close}
            style={{ left: pos.left, bottom: pos.bottom }}
            className="fixed z-[60] flex max-h-[60vh] w-[520px] flex-col overflow-hidden rounded-(--radius-panel) border border-border-float bg-popover text-popover-foreground"
          >
            <div className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-[11.5px]">
              <span className="text-destructive">review failed</span>
              <span className="min-w-0 flex-auto truncate text-foreground">{message}</span>
              <button type="button" onClick={() => void copy()} className="rounded-sm border border-border-strong px-1.5 text-[11px] text-secondary-foreground hover:text-foreground">
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <pre className="min-h-0 flex-auto overflow-auto px-3 py-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-secondary-foreground select-text [overflow-wrap:anywhere]">
              {detail || '(no response body)'}
            </pre>
          </div>,
          document.body,
        )}
    </span>
  )
}
