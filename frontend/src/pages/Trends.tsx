import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getTrend, METRICS, type TrendPoint } from '../api'

export default function Trends() {
  const [metric, setMetric] = useState(METRICS[0].key)
  const [points, setPoints] = useState<TrendPoint[]>([])

  useEffect(() => {
    getTrend(metric).then((res) => setPoints(res.points))
  }, [metric])

  const meta = METRICS.find((m) => m.key === metric)!
  const chartData = points
    .filter((p) => p.value !== null)
    .map((p) => ({
      date: new Date(p.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: p.value,
    }))

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Progress over time</h1>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 320, marginBottom: 24 }}>
        Metric
        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {chartData.length === 0 ? (
        <p>Not enough processed swings yet to show a trend.</p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" stroke="var(--text)" />
            <YAxis stroke="var(--text)" unit={meta.unit === ':1' ? '' : meta.unit} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
