import './FallingBalloons.css'

const COLORS = ['#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6','#f87171','#34d399','#fb923c']

const BALLOONS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  color: COLORS[i % COLORS.length],
  left: `${5 + (i * 97 / 15) % 90}%`,
  size: 48 + (i * 7) % 28,          // 48–76px
  delay: `${(i * 0.31) % 2.8}s`,
  duration: `${4.5 + (i * 0.4) % 2.5}s`,
  sway: i % 2 === 0 ? 'balloon-sway-l' : 'balloon-sway-r',
}))

function Balloon({ color, size, left, delay, duration, sway }) {
  const stringH = size * 1.4
  return (
    <div className="balloon-wrap" style={{ left, animationDelay: delay, animationDuration: duration }}>
      <svg width={size} height={size + stringH} viewBox={`0 0 ${size} ${size + stringH}`} className={`balloon-svg ${sway}`} style={{ animationDelay: delay }}>
        {/* Balloon body */}
        <ellipse cx={size / 2} cy={size / 2} rx={size / 2 - 1} ry={size * 0.55} fill={color} />
        {/* Shine */}
        <ellipse cx={size * 0.35} cy={size * 0.3} rx={size * 0.1} ry={size * 0.14} fill="rgba(255,255,255,0.35)" />
        {/* Knot */}
        <ellipse cx={size / 2} cy={size - 2} rx={4} ry={3} fill={color} />
        {/* String */}
        <path
          d={`M${size / 2} ${size + 1} Q${size / 2 + 10} ${size + stringH * 0.5} ${size / 2} ${size + stringH}`}
          stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" fill="none"
        />
      </svg>
    </div>
  )
}

export default function FallingBalloons() {
  return (
    <div className="balloons-container" aria-hidden="true">
      {BALLOONS.map(b => <Balloon key={b.id} {...b} />)}
    </div>
  )
}
