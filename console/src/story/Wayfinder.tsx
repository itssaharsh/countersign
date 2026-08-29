// Wayfinding for the story: a thin rail on the right edge that names every section,
// marks the one in view, and jumps on click. Appears once the stage has scrolled away.
import { useEffect, useState } from 'react'
import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion'

type Item = { id: string; label: string }

export function Wayfinder({ scroll }: { scroll: MotionValue<number> }) {
  const [items, setItems] = useState<Item[]>([])
  const [active, setActive] = useState('')
  useEffect(() => {
    const secs = Array.from(document.querySelectorAll<HTMLElement>('section[data-shot]'))
    setItems(secs.map((s) => ({ id: s.dataset.shot ?? '', label: s.dataset.label ?? s.dataset.shot ?? '' })))
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.shot ?? '')
    }, { rootMargin: '-45% 0px -45% 0px' })
    secs.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])
  const opacity = useTransform(scroll, [0.6, 1], [0, 1])
  const pointerEvents = useTransform(scroll, (v) => (v > 0.7 ? 'auto' : 'none'))
  // While the rail is transparent it must also be out of the tab order (inert), or a
  // keyboard user can focus and activate controls they cannot see.
  const [visible, setVisible] = useState(false)
  useMotionValueEvent(scroll, 'change', (v) => setVisible(v > 0.7))
  const go = (id: string | null) => {
    const y = id ? (document.querySelector<HTMLElement>(`section[data-shot="${id}"]`)?.getBoundingClientRect().top ?? 0) + window.scrollY : 0
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: number) => void } }).__lenis
    if (lenis) lenis.scrollTo(y); else window.scrollTo({ top: y, behavior: 'smooth' })
  }
  return (
    <motion.nav className="wayfinder" style={{ opacity, pointerEvents }} aria-label="Sections" inert={!visible} aria-hidden={!visible}>
      <button type="button" className="wf" onClick={() => go(null)}><span className="dot" /><span className="lbl">Stage</span></button>
      {items.map((it) => (
        <button type="button" key={it.id} className={`wf ${active === it.id ? 'on' : ''}`} onClick={() => go(it.id)} aria-current={active === it.id ? 'true' : undefined}>
          <span className="dot" /><span className="lbl">{it.label}</span>
        </button>
      ))}
    </motion.nav>
  )
}
