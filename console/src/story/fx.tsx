// Motion primitives for the story. Patterns from MagicUI (marquee, border beam, number
// ticker) and Aceternity (spotlight card, sticky stack, text reveal) rebuilt on
// framer-motion and GSAP ScrollTrigger so they follow one scroll model (Lenis).
import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/** Fade-and-rise when the element enters the viewport. */
export function Reveal({ children, delay = 0, className, style, y = 28 }: { children: ReactNode; delay?: number; className?: string; style?: CSSProperties; y?: number }) {
  const reduced = useReducedMotion()
  return (
    <motion.div className={className} style={style}
      initial={reduced ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}

/** Words light up as you scroll through the paragraph (scrubbed, not timed). */
export function TextReveal({ text, className, style, as = 'p' }: { text: string; className?: string; style?: CSSProperties; as?: 'p' | 'h2' }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    const words = el.querySelectorAll<HTMLElement>('.w')
    const tween = gsap.to(words, { opacity: 1, stagger: 0.03, ease: 'none', scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 42%', scrub: 0.4 } })
    return () => { tween.scrollTrigger?.kill(); tween.kill() }
  }, [reduced])
  const Tag = as
  return (
    <Tag ref={ref} className={`reveal-words ${className ?? ''}`} style={style}>
      {text.split(' ').map((w, i) => <span key={i} className="w">{w}&nbsp;</span>)}
    </Tag>
  )
}

/** Sticky card stack: each card pins under the previous, and the covered one recedes. */
export function Stack({ children }: { children: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const root = ref.current
    if (!root || reduced) return
    // Phones read one tile at a time; receding only makes the current tile unreadable.
    if (window.innerWidth < 760) return
    const cards = Array.from(root.querySelectorAll<HTMLElement>('.stack-card'))
    const tweens = cards.slice(0, -1).map((card, i) => gsap.to(card, {
      scale: 0.94, filter: 'brightness(0.72)', ease: 'none',
      scrollTrigger: { trigger: cards[i + 1], start: 'top 70%', end: 'top 9vh', scrub: true },
    }))
    return () => { tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill() }) }
  }, [reduced])
  return <div ref={ref} className="stack">{children}</div>
}

/** Endless horizontal band (MagicUI marquee): content is duplicated for a seamless loop. */
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`marquee ${className ?? ''}`} aria-hidden>
      <div className="track">{children}</div>
      <div className="track">{children}</div>
    </div>
  )
}

/** A card whose highlight follows the pointer (Aceternity spotlight) with a soft lift. */
export function SpotCard({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <motion.div ref={ref} className={`card card-spot ${className ?? ''}`} style={style}
      whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      onMouseMove={(e) => { const r = ref.current!.getBoundingClientRect(); ref.current!.style.setProperty('--mx', `${e.clientX - r.left}px`); ref.current!.style.setProperty('--my', `${e.clientY - r.top}px`) }}>
      {children}
    </motion.div>
  )
}

/** The element leans toward the pointer and springs back. */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0), y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 18 }), sy = useSpring(y, { stiffness: 220, damping: 18 })
  return (
    <motion.div ref={ref} style={{ x: sx, y: sy, display: 'inline-block' }}
      onMouseMove={(e) => { const r = ref.current!.getBoundingClientRect(); x.set((e.clientX - (r.left + r.width / 2)) * strength); y.set((e.clientY - (r.top + r.height / 2)) * strength) }}
      onMouseLeave={() => { x.set(0); y.set(0) }}>
      {children}
    </motion.div>
  )
}
