// A thin light that travels the perimeter of a panel: the "something is armed" signal
// (Aceternity moving-border pattern, drawn with CSS offset-path).
import { motion } from 'framer-motion'

export function BorderBeam({ color = 'var(--cs-teal)', duration = 5 }: { color?: string; duration?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden" aria-hidden>
      <motion.div
        className="absolute"
        style={{ width: 180, height: 3, borderRadius: 999, offsetPath: 'rect(0 auto auto 0 round 24px)', offsetRotate: 'auto', background: `linear-gradient(90deg, transparent, ${color}, #fff, ${color}, transparent)`, boxShadow: `0 0 18px ${color}`, opacity: 0.95 }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  )
}
