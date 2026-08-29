// The living backdrop: colour blobs, a dot grid, and a PHASE-REACTIVE particle field.
// Idle: slow drift. Investigating: particles stream into an orbit around the evidence
// column. Deciding: the orbit tightens and turns green, breathing. Witnessing: the
// field bursts outward and settles. The console's state is visible in the air.
import { useEffect, useRef } from 'react'

type Phase = 'IDLE' | 'INVESTIGATING' | 'DECIDING' | 'WITNESSING'
const PHASE_EVENT = 'cs:phase'
export function announcePhase(phase: Phase) { window.dispatchEvent(new CustomEvent(PHASE_EVENT, { detail: phase })) }

export function Backdrop() {
  useEffect(() => {
    // Cursor spotlight for cards (Linear / Aceternity pattern): expose the pointer as CSS vars.
    const onMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`)
      document.documentElement.style.setProperty('--my', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])
  return (
    <div className="cs-backdrop" aria-hidden>
      <div className="cs-aurora" />
      <div className="cs-grid" />
      <Particles />
      <div className="cs-vignette" />
    </div>
  )
}

const PALETTE: Record<Phase, [number, number, number]> = {
  IDLE: [124, 92, 255],
  INVESTIGATING: [59, 130, 246],
  DECIDING: [34, 197, 94],
  WITNESSING: [20, 184, 166],
}

function Particles({ count = 160 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let phase: Phase = 'IDLE'
    let burst = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rgb = { r: 124, g: 92, b: 255 }
    const pts = Array.from({ length: count }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0003, vy: (Math.random() - 0.5) * 0.0003,
      r: 0.8 + Math.random() * 1.6, a: 0.25 + Math.random() * 0.5, seed: Math.random() * Math.PI * 2,
    }))
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr); canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = window.innerWidth + 'px'; canvas.style.height = window.innerHeight + 'px'
    }
    const onPhase = (e: Event) => {
      const next = (e as CustomEvent<Phase>).detail
      if (next === 'WITNESSING' && phase !== 'WITNESSING') burst = 1
      phase = next
    }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener(PHASE_EVENT, onPhase)
    let t = 0
    const tick = () => {
      t += 0.016
      const W = canvas.width, H = canvas.height
      const target = PALETTE[phase]
      rgb.r += (target[0] - rgb.r) * 0.03; rgb.g += (target[1] - rgb.g) * 0.03; rgb.b += (target[2] - rgb.b) * 0.03
      ctx.clearRect(0, 0, W, H)
      // The evidence column lives on the right; the orbit centre sits there.
      const cx = 0.71, cy = 0.5
      for (const p of pts) {
        if (phase === 'IDLE') {
          p.vx += (Math.random() - 0.5) * 0.00002; p.vy += (Math.random() - 0.5) * 0.00002
        } else {
          const dx = cx - p.x, dy = cy - p.y
          const d = Math.hypot(dx, dy) || 0.001
          const ring = phase === 'DECIDING' ? 0.22 + 0.02 * Math.sin(t * 2 + p.seed) : 0.3
          const pull = (d - ring) * (phase === 'DECIDING' ? 0.0016 : 0.0009)
          p.vx += (dx / d) * pull + (-dy / d) * 0.00035 // tangential swirl
          p.vy += (dy / d) * pull + (dx / d) * 0.00035
        }
        if (burst > 0) { const dx = p.x - cx, dy = p.y - cy; const d = Math.hypot(dx, dy) || 0.001; p.vx += (dx / d) * 0.004 * burst; p.vy += (dy / d) * 0.004 * burst }
        p.x += p.vx; p.y += p.vy
        p.vx *= 0.985; p.vy *= 0.985
        if (p.x < 0 || p.x > 1) { p.vx *= -1; p.x = Math.min(1, Math.max(0, p.x)) }
        if (p.y < 0 || p.y > 1) { p.vy *= -1; p.y = Math.min(1, Math.max(0, p.y)) }
        const tw = 0.6 + 0.4 * Math.sin(t * 1.7 + p.seed)
        ctx.beginPath()
        ctx.arc(p.x * W, p.y * H, p.r * dpr * (phase === 'DECIDING' ? 1.4 : 1), 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${rgb.r | 0}, ${rgb.g | 0}, ${rgb.b | 0}, ${p.a * tw * 0.8})`
        ctx.fill()
      }
      burst *= 0.94
      ctx.strokeStyle = `rgba(${rgb.r | 0}, ${rgb.g | 0}, ${rgb.b | 0}, 0.10)`
      ctx.lineWidth = 1 * dpr
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j]
        const dx = (a.x - b.x) * W, dy = (a.y - b.y) * H
        if (dx * dx + dy * dy < (80 * dpr) ** 2) { ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke() }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener(PHASE_EVENT, onPhase) }
  }, [count])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0 }} />
}
