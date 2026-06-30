import './FallingBalloons.css'

const COLORS = ['#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6','#f87171','#34d399','#fb923c']

// Balloons start at various heights WITHIN the viewport so they're fully visible from the start
const BALLOONS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  color: COLORS[i % COLORS.length],
  left: `${4 + (i * 94 / 17) % 92}%`,
  top:  `${10 + (i * 17) % 60}vh`,     // spread between 10vh–70vh, never near top edge
  size: 48 + (i * 7) % 30,             // 48–78px
  delay: `${(i * 0.28) % 2.4}s`,
  duration: `${5 + (i * 0.45) % 3}s`,
  swayDur: `${1.8 + (i * 0.3) % 1.2}s`,
  swayDir: i % 2 === 0 ? 'balloon-sway-l' : 'balloon-sway-r',
}))

function Balloon({ color, size, left, top, delay, duration, swayDur, swayDir }) {
  const stringH = size * 1.4
  return (
    <div
      className="balloon-wrap"
      style={{ left, top, animationDelay: delay, animationDuration: duration }}
    >
      <svg
        width={size}
        height={size + stringH}
        viewBox={`0 0 ${size} ${size + stringH}`}
        className={`balloon-svg ${swayDir}`}
        style={{ animationDuration: swayDur, animationDelay: delay }}
      >
        <ellipse cx={size / 2} cy={size / 2} rx={size / 2 - 1} ry={size * 0.55} fill={color} />
        <ellipse cx={size * 0.35} cy={size * 0.3} rx={size * 0.1} ry={size * 0.14} fill="rgba(255,255,255,0.35)" />
        <ellipse cx={size / 2} cy={size - 2} rx={4} ry={3} fill={color} />
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
