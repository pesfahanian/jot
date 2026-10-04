import { useLiveQuery } from 'dexie-react-hooks'
import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { getSettings, updateSettings } from '@/lib/settings'
import { currentStorageRisk, warningDue, type StorageRisk } from '@/lib/storageRisk'
import { exportWorkspace } from '@/state/actions'

// The storage warning (data safety): a full-width amber band above the
// panels in browsers that delete Jot's storage on their own (lib/
// storageRisk.ts). Its one action is the backup. Dismissible; it returns 7
// days later — and after Safari has wiped storage, since the dismissal is
// stored there too, which is exactly when it matters.

const COPY: Record<Exclude<StorageRisk, null>, { lead: string; rest: string }> = {
  mac: {
    lead: "Safari deletes jot's documents after 7 days of using Safari without typing or clicking in jot.",
    rest: 'Everything jot saves lives only in this browser. For writing you want to keep, use Chrome, Firefox or Edge — and export a backup now and then.',
  },
  ipad: {
    lead: "On iPad, every browser deletes jot's documents after 7 days of use without typing or clicking in jot.",
    rest: 'Add jot to your Home Screen to keep them there. It starts empty, so export your workspace here first and import it in the app.',
  },
}

// A dev-only override to see either version in any browser:
// ?storage-warning=mac or ?storage-warning=ipad.
function risk(): StorageRisk {
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(location.search).get('storage-warning')
    if (forced === 'mac' || forced === 'ipad') return forced
  }
  return currentStorageRisk()
}

const button =
  'flex h-6 flex-none items-center rounded-md border px-[11px] font-mono text-[11.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function StorageWarning() {
  const [kind] = useState(risk)
  const settings = useLiveQuery(() => getSettings(), [])
  if (!kind || !settings || !warningDue(settings.storageWarningDismissedAt)) return null
  const { lead, rest } = COPY[kind]
  return (
    <div role="alert" className="flex flex-none items-center gap-3 rounded-(--radius-panel) border border-warn bg-warn-bg py-2.5 pr-2.5 pl-3.5 text-[13px] leading-[1.5] text-foreground">
      <TriangleAlert size={15} strokeWidth={1.75} className="flex-none text-warn" aria-hidden />
      <p className="min-w-0 flex-auto">
        <span className="font-semibold">{lead}</span> {rest}
      </p>
      <button type="button" onClick={() => void exportWorkspace()} className={`${button} border-ink-tertiary bg-background text-foreground hover:border-foreground`}>
        export workspace
      </button>
      <button
        type="button"
        aria-label="dismiss for a week"
        title="dismiss — it comes back in a week"
        onClick={() => void updateSettings({ storageWarningDismissedAt: Date.now() })}
        className="flex-none px-1.5 font-mono text-[13px] text-secondary-foreground hover:text-foreground"
      >
        ×
      </button>
    </div>
  )
}
