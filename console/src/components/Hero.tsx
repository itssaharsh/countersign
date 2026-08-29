// The idle state is a thesis, not an empty panel.
import { NumberTicker } from './fx/NumberTicker'

export function Hero() {
  return (
    <div className="card card-strong relative overflow-hidden px-9 py-10">
      <div className="cs-scanline" />
      <div className="t-label mb-5">Dossier · TF-007</div>
      <h1 className="t-display text-[46px] leading-[1.05]" style={{ color: 'var(--cs-ink)' }}>
        An approval gate that shows you the <em className="gradient-text">command</em> instead of the{' '}
        <em className="gradient-text">consequence</em> is not a control.
        <br />
        <span style={{ color: 'var(--cs-ink-dim)' }}>It's a consent form.</span>
      </h1>
      <p className="mt-6 max-w-[60ch] text-[15px] leading-7" style={{ color: 'var(--cs-ink-dim)' }}>
        Countersign shadow-executes the change, measures exactly what dies through real foreign keys,
        proves the rollback on committed state, and only then lets an Approve button exist.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-4">
        <Stat value={18000} label="rows in the estate" accent="var(--cs-coral)" />
        <Stat value={42} label="tables under watch" accent="var(--cs-violet)" />
        <Stat value={0} label="numbers estimated" accent="var(--cs-teal)" />
      </div>
      <div className="mt-8 pill" style={{ color: 'var(--cs-violet)', borderColor: 'rgba(124,92,255,0.35)', background: 'rgba(124,92,255,0.06)' }}>↙ Transmit an order to begin</div>
    </div>
  )
}

function Stat({ value, label, accent = 'var(--cs-coral)' }: { value: number; label: string; accent?: string }) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: `${accent}0f`, border: `1px solid ${accent}33` }}>
      <div className="t-hud text-[26px]" style={{ color: accent }}><NumberTicker value={value} /></div>
      <div className="t-label mt-1">{label}</div>
    </div>
  )
}
