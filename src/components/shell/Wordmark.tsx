import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'

// The dotted-j wordmark (docs/design/logo, round 2). Ink is currentColor and
// the dot the accent token, so it follows Jot's own theme setting.
//
// Two drawings for the sidebar's 13.5px size: on high-density screens the
// outlined mark (enough real pixels to stay sharp); on 1× screens the
// pixel-hinted 24×16 drawing, whose stems land on whole pixels — the
// outlines there would blur the stems and smudge the dot.

const hiDpi = window.matchMedia('(min-resolution: 2dppx)')
const subscribe = (fn: () => void) => {
  hiDpi.addEventListener('change', fn)
  return () => hiDpi.removeEventListener('change', fn)
}

export function Wordmark({ className }: { className?: string }) {
  const sharp = useSyncExternalStore(subscribe, () => hiDpi.matches)
  // The hinted drawing only stays crisp on whole device pixels; centering
  // in the header can land it on a half pixel, so nudge it onto the grid.
  const pixel = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    const el = pixel.current
    if (!el) return
    el.style.transform = ''
    const r = el.getBoundingClientRect()
    const dx = Math.round(r.left) - r.left
    const dy = Math.round(r.top) - r.top
    if (dx || dy) el.style.transform = `translate(${dx}px, ${dy}px)`
  })
  return sharp ? (
    // Outlines cropped to the ink (the export's 6u margin removed), at the
    // sidebar's 13.5px em: 1u = 0.27px.
    <svg viewBox="6 6 81 44.5" width={21.87} height={12.02} role="img" aria-label="jot" className={className}>
      <path d="M8 16H22.5V41Q22.5 50.5 13 50.5H6V45.5H13Q17.5 45.5 17.5 41V21H8Z" fill="currentColor" />
      <rect x="17" y="6" width="6" height="6" rx="1.5" fill="var(--primary)" />
      <path
        d="M46.5 15.5C53.5 15.5 58 20.5 58 28C58 35.5 53.5 40.5 46.5 40.5C39.5 40.5 35 35.5 35 28C35 20.5 39.5 15.5 46.5 15.5ZM46.5 20.5C50.5 20.5 53 23.5 53 28C53 32.5 50.5 35.5 46.5 35.5C42.5 35.5 40 32.5 40 28C40 23.5 42.5 20.5 46.5 20.5Z"
        fillRule="evenodd"
        fill="currentColor"
      />
      <path d="M70 9H75V16H87V21H75V33Q75 35 78 35H87V40H78Q70 40 70 33V21H64V16H70Z" fill="currentColor" />
    </svg>
  ) : (
    <svg ref={pixel} viewBox="0 0 24 16" width={24} height={16} role="img" aria-label="jot" shapeRendering="crispEdges" className={className}>
      <path d="M1 5H6V14H5V15H0V14H4V6H1Z" fill="currentColor" />
      <rect x="4" y="2" width="2" height="2" fill="var(--primary)" />
      <path d="M10 5H14V6H15V11H14V12H10V11H9V6H10ZM11 6H13V11H11Z" fillRule="evenodd" fill="currentColor" />
      <path d="M18 3H20V5H23V6H20V11H23V12H19V11H18V6H16V5H18Z" fill="currentColor" />
    </svg>
  )
}
