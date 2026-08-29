// The stage. A galaxy of rows rendered with three.js; the camera, the light and the
// geometry follow the harness phase. Idle: drag to explore. Investigating: the doomed
// rows ignite and light beams draw the cascade. Deciding: the doomed set is held in a
// ring of light whose arc is the freshness countdown. Witnessing: the rows vortex away.
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Phase, Simulation } from '../state'

extend(THREE as unknown as Parameters<typeof extend>[0])

const N = 14000
const CORAL = new THREE.Color('#ff5a5f'), VIOLET = new THREE.Color('#8b7dff'), TEAL = new THREE.Color('#2dd4bf'), GREEN = new THREE.Color('#4ade80'), AMBER = new THREE.Color('#ffb454'), DIM = new THREE.Color('#3b3560')

const CLUSTER = {
  users: new THREE.Vector3(-2.4, 0.2, 0),
  orders: new THREE.Vector3(0.6, 1.3, -0.4),
  payments: new THREE.Vector3(2.6, -0.9, 0.2),
}

function fib(i: number, n: number, r: number, out: THREE.Vector3) {
  const k = i + 0.5
  const phi = Math.acos(1 - (2 * k) / n)
  const theta = Math.PI * (1 + Math.sqrt(5)) * k
  out.set(r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi))
}

function sprite(): THREE.Texture {
  const s = 64, c = document.createElement('canvas'); c.width = s; c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}

type Props = { phase: Phase; sim?: Simulation; freshness: number }

function Galaxy({ phase, sim }: Props) {
  const ref = useRef<THREE.Points>(null)
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase
  const burst = useRef(0)
  const prev = useRef<Phase>(phase)
  useEffect(() => { if (phase === 'WITNESSING' && prev.current !== 'WITNESSING') burst.current = 1; prev.current = phase }, [phase])
  // share of doomed rows shapes how many points ignite
  const doomShare = sim?.fingerprint ? Math.min(0.8, Math.max(0.25, sim.fingerprint.count / 18000)) : 0.33
  const lane = useMemo(() => Float32Array.from({ length: N }, (_, i) => (i % 10 < 4 ? 0 : i % 10 < 7 ? 1 : 2)), [])
  const seed = useMemo(() => Float32Array.from({ length: N }, () => Math.random() * Math.PI * 2), [])
  const positions = useMemo(() => { const a = new Float32Array(N * 3); const v = new THREE.Vector3(); for (let i = 0; i < N; i++) { fib(i, N, 3.2, v); a.set([v.x, v.y, v.z], i * 3) } return a }, [])
  const colors = useMemo(() => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const c = VIOLET.clone().lerp(TEAL, (i % 97) / 97); a.set([c.r, c.g, c.b], i * 3) } return a }, [])
  const tex = useMemo(() => sprite(), [])
  const v = useMemo(() => new THREE.Vector3(), []); const c = useMemo(() => new THREE.Color(), [])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const p = phaseRef.current
    const geom = ref.current!.geometry
    const pos = geom.attributes.position.array as Float32Array
    const col = geom.attributes.color.array as Float32Array
    const ease = 1 - Math.pow(0.02, dt)
    const breathe = 1 + 0.05 * Math.sin(t * 2.4)
    for (let i = 0; i < N; i++) {
      const s = seed[i]; const l = lane[i]; const doomed = (i % 100) / 100 < doomShare
      if (p === 'IDLE') {
        fib(i, N, 3.2 + 0.15 * Math.sin(s + t * 0.3), v); c.copy(VIOLET).lerp(TEAL, (i % 97) / 97)
      } else if (p === 'INVESTIGATING') {
        if (!doomed) { fib(i, N, 3.6, v); c.copy(DIM) }
        else if (l === 0) { const a = s + t * 0.3; v.set(CLUSTER.users.x + Math.cos(a) * 1.0, CLUSTER.users.y + Math.sin(a) * 1.0, Math.sin(s * 3) * 0.35); c.copy(CORAL) }
        else if (l === 1) { fib(i, N, 0.75, v); v.add(CLUSTER.orders); c.copy(VIOLET) }
        else { fib(i, N, 0.68, v); v.add(CLUSTER.payments); c.copy(TEAL) }
        if (i % 29 === 0 && doomed) { const u = (t * 0.3 + s) % 1; const a = u < 0.5 ? new THREE.Vector3().lerpVectors(CLUSTER.users, CLUSTER.orders, u * 2) : new THREE.Vector3().lerpVectors(CLUSTER.orders, CLUSTER.payments, (u - 0.5) * 2); v.copy(a); c.copy(AMBER) }
      } else if (p === 'DECIDING') {
        if (!doomed) { fib(i, N, 3.8, v); c.copy(DIM) }
        else { fib(i, N, 1.15 * breathe, v); c.copy(CORAL).lerp(GREEN, 0.4 + 0.4 * Math.sin(t * 2.4)) }
      } else {
        if (!doomed) { fib(i, N, 3.6, v); c.copy(VIOLET).lerp(TEAL, (i % 97) / 97) }
        else { const a = s * 6 + t * 0.6; const r = 0.05 + burst.current * 2.6; v.set(Math.cos(a) * r, (Math.sin(s * 9)) * 0.08 * burst.current, Math.sin(a) * r); c.copy(GREEN).lerp(DIM, 1 - burst.current) }
      }
      pos[i * 3] += (v.x - pos[i * 3]) * ease; pos[i * 3 + 1] += (v.y - pos[i * 3 + 1]) * ease; pos[i * 3 + 2] += (v.z - pos[i * 3 + 2]) * ease
      col[i * 3] += (c.r - col[i * 3]) * 0.08; col[i * 3 + 1] += (c.g - col[i * 3 + 1]) * 0.08; col[i * 3 + 2] += (c.b - col[i * 3 + 2]) * 0.08
    }
    burst.current *= 0.985
    geom.attributes.position.needsUpdate = true; geom.attributes.color.needsUpdate = true
    ref.current!.rotation.y += dt * (p === 'IDLE' ? 0.03 : 0.006)
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} sizeAttenuation vertexColors transparent opacity={0.95} depthWrite={false} map={tex} alphaTest={0.02} blending={THREE.AdditiveBlending} />
    </points>
  )
}

function Beams({ phase }: { phase: Phase }) {
  const dash = useRef(0)
  const refs = useRef<Array<{ material: { dashOffset: number } } | null>>([])
  const curves = useMemo(() => [
    new THREE.QuadraticBezierCurve3(CLUSTER.users, new THREE.Vector3(-1, 1.6, 0.3), CLUSTER.orders).getPoints(48),
    new THREE.QuadraticBezierCurve3(CLUSTER.orders, new THREE.Vector3(1.9, 0.6, -0.3), CLUSTER.payments).getPoints(48),
  ], [])
  useFrame((_, dt) => { dash.current -= dt * 0.9; for (const r of refs.current) if (r) r.material.dashOffset = dash.current })
  if (phase !== 'INVESTIGATING') return null
  return (
    <group>
      {curves.map((pts, i) => (
        <Line key={i} ref={(el) => { refs.current[i] = el }} points={pts} color={i === 0 ? '#ffb454' : '#2dd4bf'} lineWidth={2.2} dashed dashSize={0.18} gapSize={0.12} transparent opacity={0.9} />
      ))}
    </group>
  )
}

function Labels({ phase, sim }: Props) {
  if (phase !== 'INVESTIGATING' && phase !== 'DECIDING') return null
  const n = (name: string) => sim?.tables.find((t) => t.name === name)?.delta ?? 0
  const items: Array<[THREE.Vector3, string, number, string]> = phase === 'INVESTIGATING'
    ? [[CLUSTER.users, 'users', n('users'), '#ff5a5f'], [CLUSTER.orders, 'orders', n('orders'), '#8b7dff'], [CLUSTER.payments, 'payments', n('payments'), '#2dd4bf']]
    : [[new THREE.Vector3(0, 1.75, 0), 'doomed set', sim?.fingerprint?.count ?? 0, '#4ade80']]
  return (
    <>
      {items.map(([p, label, count, color]) => (
        <Html key={label} position={[p.x, p.y + 1.0, p.z]} center style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div className="rise" style={{ textAlign: 'center' }}>
            <div className="t-giant" style={{ fontSize: 34, color }}>{count ? `−${count.toLocaleString()}` : '…'}</div>
            <div className="t-tag" style={{ color: 'var(--ink-dim)' }}>{label}</div>
          </div>
        </Html>
      ))}
    </>
  )
}

function GateRing({ phase, freshness }: Props) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame((state) => { if (ring.current) ring.current.rotation.z = state.clock.elapsedTime * 0.25 })
  if (phase !== 'DECIDING') return null
  const arc = Math.max(0.02, freshness) * Math.PI * 2
  return (
    <group rotation={[Math.PI / 2.6, 0, 0]}>
      <mesh><torusGeometry args={[2.3, 0.012, 8, 160]} /><meshBasicMaterial color="#2a2750" transparent opacity={0.9} /></mesh>
      <mesh ref={ring}><torusGeometry args={[2.3, 0.035, 8, 160, arc]} /><meshBasicMaterial color="#4ade80" toneMapped={false} /></mesh>
      <mesh><torusGeometry args={[2.9, 0.006, 8, 200]} /><meshBasicMaterial color="#8b7dff" transparent opacity={0.5} /></mesh>
    </group>
  )
}

function Rig({ phase }: { phase: Phase }) {
  const { camera } = useThree()
  const controls = useRef<OrbitControlsImpl | null>(null)
  const target = useMemo(() => new THREE.Vector3(), [])
  const goal = useMemo(() => ({
    IDLE: { pos: new THREE.Vector3(0, 0.6, 9.5), look: new THREE.Vector3(0, 0, 0) },
    INVESTIGATING: { pos: new THREE.Vector3(0.6, 1.6, 7.6), look: new THREE.Vector3(0.2, 0.2, 0) },
    DECIDING: { pos: new THREE.Vector3(0, 2.2, 6.4), look: new THREE.Vector3(0, 0, 0) },
    WITNESSING: { pos: new THREE.Vector3(-0.8, 1.2, 8.2), look: new THREE.Vector3(0, 0, 0) },
  }), [])
  useFrame((_, dt) => {
    const g = goal[phase]
    const k = 1 - Math.pow(0.05, dt)
    if (phase !== 'IDLE') {
      camera.position.lerp(g.pos, k)
      target.lerp(g.look, k)
      if (controls.current) { controls.current.target.copy(target); controls.current.update() }
    }
  })
  return <OrbitControls ref={controls} enabled={phase === 'IDLE'} enableZoom={false} enablePan={false} autoRotate={phase === 'IDLE'} autoRotateSpeed={0.35} enableDamping dampingFactor={0.06} minPolarAngle={0.9} maxPolarAngle={2.2} />
}

export function Experience(props: Props) {
  return (
    <div className="stage-canvas">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.6, 9.5], fov: 45 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#07060f']} />
        <fog attach="fog" args={['#07060f', 9, 18]} />
        <Rig phase={props.phase} />
        <Galaxy {...props} />
        <Beams phase={props.phase} />
        <Labels {...props} />
        <GateRing {...props} />
        <EffectComposer>
          <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.4} intensity={1.15} mipmapBlur />
          <Vignette eskil={false} offset={0.2} darkness={0.85} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
