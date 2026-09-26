import { Keycap, KeycapPanel } from '@/components/review/Keycap'

// Dev-only check for T4.2 (open /?specimen=keycap). Both themes side by side:
// the keycap panel on its required panel ground, and — for comparison only —
// the same bevel forced onto the surface ground, where light's highlight dies.
function Column({ dark }: { dark: boolean }) {
  return (
    <div className={dark ? 'dark' : undefined}>
      <div className="flex flex-col gap-4 rounded-(--radius-tray) border border-border-tray bg-background p-5 text-foreground">
        <div className="font-mono text-[11px] text-muted-foreground">{dark ? 'dark' : 'light'} · panel ground (the token)</div>
        <div className="rounded-(--radius-panel) border border-border-strong bg-card p-5">
          <KeycapPanel className="px-4 py-3.5">
            <div className="mb-2 text-[15px] font-semibold tracking-[-0.02em]">Style review</div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-ink-tertiary">
              <Keycap>A</Keycap>
              <Keycap>R</Keycap>
              <span className="ml-1.5">accept / reject</span>
            </div>
          </KeycapPanel>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">reference only · same bevel on surface ground</div>
        <div className="rounded-(--radius-panel) border border-border-strong bg-popover p-5">
          <div className="rounded-(--radius-panel) border border-border-float bg-popover px-4 py-3.5" style={{ boxShadow: 'var(--keycap)' }}>
            <div className="text-[15px] font-semibold tracking-[-0.02em]">Style review</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function KeycapSpecimen() {
  document.documentElement.classList.remove('dark')
  return (
    <div className="grid min-h-svh grid-cols-2 gap-6 bg-background p-8">
      <Column dark={false} />
      <Column dark />
    </div>
  )
}
