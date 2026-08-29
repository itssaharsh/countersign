// Per-card cursor spotlight: keep each card's own offset in CSS vars so the
// page-level pointer position maps correctly inside the card.
export function installSpotlight() {
  const update = (e: MouseEvent) => {
    const el = (e.target as HTMLElement | null)?.closest?.('.card') as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--cx', `${r.left}px`)
    el.style.setProperty('--cy', `${r.top}px`)
  }
  window.addEventListener('mousemove', update)
}
