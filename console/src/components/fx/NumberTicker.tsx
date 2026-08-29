// Counts up to a value with spring easing — numbers should feel measured, not pasted.
// Under prefers-reduced-motion the final value is written immediately, no spring.
import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

export function NumberTicker({ value, prefix = '', className = '', decimals = 0 }: { value: number; prefix?: string; className?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { damping: 34, stiffness: 260 })
  const inView = useInView(ref, { once: true, amount: 0.2 })
  const fmt = (v: number) => prefix + Number(v.toFixed(decimals)).toLocaleString()
  useEffect(() => { if (inView) mv.set(value) }, [inView, value, mv])
  // Insurance for programmatic scrolls that can outrun the observer: if the element is on
  // screen and still at zero after a beat, start the count anyway.
  useEffect(() => {
    const t = window.setInterval(() => {
      const el = ref.current
      if (!el || mv.get() === value) return
      const r = el.getBoundingClientRect()
      if (r.bottom > 0 && r.top < window.innerHeight) mv.set(value)
    }, 700)
    return () => window.clearInterval(t)
  }, [mv, value])
  useEffect(() => {
    if (reduced) { if (ref.current) ref.current.textContent = fmt(value); return }
    return spring.on('change', (v) => { if (ref.current) ref.current.textContent = fmt(v) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spring, prefix, decimals, reduced, value])
  return <span ref={ref} className={className}>{reduced ? fmt(value) : `${prefix}0`}</span>
}
