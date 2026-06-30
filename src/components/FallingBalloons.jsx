import './FallingBalloons.css'

// Hue rotations spread across the color wheel for variety
const HUES = [0, 35, 75, 130, 175, 210, 260, 300, 330]

const BALLOONS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left:     `${3 + (i * 93 / 19) % 94}%`,
  size:     `${3.2 + (i * 0.25) % 1.6}rem`,
  delay:    `${(i * 0.28) % 3.2}s`,
  duration: `${5 + (i * 0.45) % 4}s`,
  rotate:   `${-20 + (i * 11) % 40}deg`,
  hue:      HUES[i % HUES.length],
}))

export default function FallingBalloons() {
  return (
    <div className="balloons-container" aria-hidden="true">
      {BALLOONS.map(({ id, left, size, delay, duration, rotate }) => (
        <div
          key={id}
          className="balloon-wrap"
          style={{ left, fontSize: size, animationDelay: delay, animationDuration: duration, '--rot': rotate, filter: `hue-rotate(${hue}deg) saturate(1.3)` }}
        >
          🎈
        </div>
      ))}
    </div>
  )
}
