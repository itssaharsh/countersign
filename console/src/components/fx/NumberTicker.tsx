// Counts up to a value with spring easing — numbers should feel measured, not pasted.
import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'framer-motion'

export function NumberTicker({ value, prefix = '', className = '', decimals = 0 }: { value: number; prefix?: string; className?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { damping: 34, stiffness: 260 })
  const inView = useInView(ref, { once: true, amount: 0.2 })
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
  useEffect(() => spring.on('change', (v) => {
    if (ref.current) ref.current.textContent = prefix + Number(v.toFixed(decimals)).toLocaleString()
  }), [spring, prefix, decimals])
  return <span ref={ref} className={className}>{prefix}0</span>
}
