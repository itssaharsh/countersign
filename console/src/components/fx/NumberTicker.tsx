// Counts up to a value with spring easing — numbers should feel measured, not pasted.
import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useSpring } from 'framer-motion'

export function NumberTicker({ value, prefix = '', className = '', decimals = 0 }: { value: number; prefix?: string; className?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { damping: 34, stiffness: 260 })
  const inView = useInView(ref, { once: true })
  useEffect(() => { if (inView) mv.set(value) }, [inView, value, mv])
  useEffect(() => spring.on('change', (v) => {
    if (ref.current) ref.current.textContent = prefix + Number(v.toFixed(decimals)).toLocaleString()
  }), [spring, prefix, decimals])
  return <span ref={ref} className={className}>{prefix}0</span>
}
