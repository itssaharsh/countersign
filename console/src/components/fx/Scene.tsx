// The generative world: a point cloud that IS the database. Idle it is a quiet sphere
// of rows. While the agent investigates it streams into the doomed cascade (users,
// orders, payments). When the gate arms, the doomed set compresses and breathes inside
// a ring. On commit it bursts and thins; on undo it re-forms. Cursor parallax moves
// the camera. Rendered with three.js via react-three-fiber, behind the glass UI.
import { Canvas, extend, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

type Phase = 'IDLE' | 'INVESTIGATING' | 'DECIDING' | 'WITNESSING'
extend(THREE as unknown as Parameters<typeof extend>[0])

const N = 12000
const PHASE_EVENT = 'cs:phase'
const mouse = { x: 0, y: 0 }

/** A soft round sprite so points read as glowing dots, not squares. */
function makeSprite(): THREE.Texture {
  const size = 64
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true
  return tex
}

const CORAL = new THREE.Color('#ff5a5f'), VIOLET = new THREE.Color('#7c5cff'), TEAL = new THREE.Color('#14b8a6'), GREEN = new THREE.Color('#22c55e'), AMBER = new THREE.Color('#ffb020')

function fib(i: number, n: number, r: number, out: THREE.Vector3) {
  const k = i + 0.5
  const phi = Math.acos(1 - (2 * k) / n)
  const theta = Math.PI * (1 + Math.sqrt(5)) * k
  out.set(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi))
}

function PointCloud() {
  const ref = useRef<THREE.Points>(null)
  const phaseRef = useRef<Phase>('IDLE')
  const burstRef = useRef(0)
  const lane = useMemo(() => Float32Array.from({ length: N }, (_, i) => (i % 10 < 4 ? 0 : i % 10 < 7 ? 1 : 2)), [])
  const positions = useMemo(() => {
    const a = new Float32Array(N * 3); const v = new THREE.Vector3()
    for (let i = 0; i < N; i++) { fib(i, N, 1.7, v); a.set([v.x, v.y, v.z], i * 3) }
    return a
  }, [])
  const colors = useMemo(() => { const a = new Float32Array(N * 3); const c = new THREE.Color(); for (let i = 0; i < N; i++) { c.copy(VIOLET).lerp(CORAL, i / N); a.set([c.r, c.g, c.b], i * 3) } return a }, [])
  const target = useMemo(() => new Float32Array(N * 3), [])
  const seed = useMemo(() => Float32Array.from({ length: N }, () => Math.random() * Math.PI * 2), [])

  useEffect(() => {
    const onPhase = (e: Event) => {
      const next = (e as CustomEvent<Phase>).detail
      if (next === 'WITNESSING' && phaseRef.current !== 'WITNESSING') burstRef.current = 1
      phaseRef.current = next
    }
    window.addEventListener(PHASE_EVENT, onPhase)
    const onMove = (e: MouseEvent) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -((e.clientY / window.innerHeight) * 2 - 1) }
    window.addEventListener('mousemove', onMove)
    return () => { window.removeEventListener(PHASE_EVENT, onPhase); window.removeEventListener('mousemove', onMove) }
  }, [])

  const v = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(() => new THREE.Color(), [])
  const sprite = useMemo(() => makeSprite(), [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const phase = phaseRef.current
    const geom = ref.current!.geometry
    const pos = geom.attributes.position.array as Float32Array
    const col = geom.attributes.color.array as Float32Array
    const breathe = 1 + 0.06 * Math.sin(t * 2.2)
    for (let i = 0; i < N; i++) {
      const l = lane[i], s = seed[i]
      // --- where should this row be? ---
      if (phase === 'IDLE') {
        fib(i, N, 1.9, v)
        const a = t * 0.12; const x = v.x * Math.cos(a) - v.z * Math.sin(a); const z = v.x * Math.sin(a) + v.z * Math.cos(a); v.set(x, v.y, z)
        c.copy(VIOLET).lerp(CORAL, (i / N))
      } else if (phase === 'INVESTIGATING') {
        // users: a wide ring on the left; orders: cluster upper right; payments: cluster lower right.
        if (l === 0) { const a = s + t * 0.25; v.set(-1.9 + Math.cos(a) * 1.1, 0.2 + Math.sin(a) * 1.1, Math.sin(s * 3) * 0.3); c.copy(CORAL) }
        else if (l === 1) { fib(i, N, 0.7, v); v.x += 0.4; v.y += 1.1; c.copy(VIOLET) }
        else { fib(i, N, 0.62, v); v.x += 0.9; v.y -= 1.0; c.copy(TEAL) }
        // a stream of rows travelling users -> orders -> payments along an arc
        if ((i % 23) === 0) { const u = ((t * 0.35 + s) % 1); const from = new THREE.Vector3(-0.5, 0, 0); const mid = new THREE.Vector3(0.6, 0.9, 0.3); const to = new THREE.Vector3(1.15, -0.7, 0); v.copy(from).lerp(mid, u).lerp(to, u * u); c.copy(AMBER) }
      } else if (phase === 'DECIDING') {
        if (i % 7 === 0) { const a = s + t * 0.5; v.set(Math.cos(a) * 2.25, Math.sin(a) * 0.55, Math.sin(a) * 2.25); c.copy(GREEN) }
        else { fib(i, N, 1.0 * breathe, v); c.copy(CORAL).lerp(GREEN, 0.35 + 0.35 * Math.sin(t * 2.2)) }
      } else {
        // WITNESSING: the doomed rows are gone; what remains settles into a thin, calm disk.
        const a = s * 4 + t * 0.08; const r = 1.2 + (i % 100) / 100 * 1.6
        v.set(Math.cos(a) * r, (Math.sin(s * 9) * 0.06), Math.sin(a) * r); c.copy(TEAL).lerp(VIOLET, (i % 100) / 100)
      }
      // burst impulse on commit
      if (burstRef.current > 0.01) { const k = 1 + burstRef.current * 1.8; v.multiplyScalar(k) }
      target[i * 3] = v.x; target[i * 3 + 1] = v.y; target[i * 3 + 2] = v.z
      // --- ease toward it ---
      const e = 1 - Math.pow(0.001, dt) * 0.9 // frame-rate independent easing
      pos[i * 3] += (target[i * 3] - pos[i * 3]) * e * 0.14
      pos[i * 3 + 1] += (target[i * 3 + 1] - pos[i * 3 + 1]) * e * 0.14
      pos[i * 3 + 2] += (target[i * 3 + 2] - pos[i * 3 + 2]) * e * 0.14
      col[i * 3] += (c.r - col[i * 3]) * 0.1; col[i * 3 + 1] += (c.g - col[i * 3 + 1]) * 0.1; col[i * 3 + 2] += (c.b - col[i * 3 + 2]) * 0.1
    }
    burstRef.current *= 0.96
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
    // the whole world drifts and yields to the cursor
    ref.current!.rotation.y = Math.sin(t * 0.1) * 0.15
  })

  return (
    <points ref={ref} position={[2.3, -0.9, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.075} sizeAttenuation vertexColors transparent opacity={0.9} depthWrite={false} map={sprite} alphaTest={0.05} />
    </points>
  )
}

// Sparse, large, soft points far behind: depth and air.
function Dust() {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => Float32Array.from({ length: 900 * 3 }, () => (Math.random() - 0.5) * 16), [])
  useFrame((state) => { if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.02 })
  return (
    <points ref={ref} position={[0, 0, -4]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.14} sizeAttenuation color="#b8a8ff" transparent opacity={0.3} depthWrite={false} map={makeSprite()} alphaTest={0.05} />
    </points>
  )
}

function ParallaxCamera() {
  const { camera } = useThree()
  useFrame(() => {
    camera.position.x += (mouse.x * 0.6 - camera.position.x) * 0.04
    camera.position.y += (mouse.y * 0.4 - camera.position.y) * 0.04
    camera.lookAt(1.2, -0.4, 0)
  })
  return null
}

export function Scene() {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 48 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} style={{ position: 'absolute', inset: 0 }}>
      <ParallaxCamera />
      <PointCloud />
      <Dust />
    </Canvas>
  )
}
