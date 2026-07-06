import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { KinematicSequence } from '../api'

const SERIES = [
  { key: 'legs', label: 'Legs (pelvis)', color: '#3b82f6' },
  { key: 'torso', label: 'Torso', color: '#22c55e' },
  { key: 'arms', label: 'Arms', color: '#f59e0b' },
  { key: 'hands', label: 'Hands', color: '#ef4444' },
] as const

export default function KinematicSequenceChart({
  sequence,
  currentTime,
}: {
  sequence: KinematicSequence
  currentTime: number
}) {
  const data = sequence.time.map((t, i) => ({
    t,
    legs: sequence.legs[i],
    torso: sequence.torso[i],
    arms: sequence.arms[i],
    hands: sequence.hands[i],
  }))

  return (
    <div>
      <h3 style={{ marginBottom: 4 }}>Kinematic sequence</h3>
      <p className="metric-note" style={{ marginBottom: 8 }}>
        Rotational speed of each segment over time. In an efficient swing, peaks happen in order: legs,
        then torso, then arms, then hands.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ left: 0, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="t" type="number" domain={[0, 'dataMax']} unit="s" stroke="var(--text)" />
          <YAxis unit="°/s" stroke="var(--text)" />
          <Tooltip labelFormatter={(t) => `${t}s`} />
          <Legend />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
          <ReferenceLine x={currentTime} stroke="var(--text-h)" strokeWidth={2} ifOverflow="extendDomain" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
