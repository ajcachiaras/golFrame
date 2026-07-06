import { METRICS, type Metrics } from '../api'

export default function MetricsTable({
  metrics,
  compareTo,
}: {
  metrics: Metrics
  compareTo?: Metrics
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
          {compareTo && <th>Δ vs. other</th>}
        </tr>
      </thead>
      <tbody>
        {METRICS.map((m) => {
          const value = metrics[m.key]
          if (value === undefined) return null
          const delta = compareTo ? value - compareTo[m.key] : undefined
          return (
            <tr key={m.key}>
              <td>
                {m.label}
                {m.cameraSensitive && <sup className="metric-note"> †</sup>}
              </td>
              <td>
                {value}
                {m.unit}
              </td>
              {compareTo && delta !== undefined && (
                <td style={{ color: delta === 0 ? undefined : delta > 0 ? 'var(--good)' : 'var(--bad)' }}>
                  {delta > 0 ? '+' : ''}
                  {Math.round(delta * 100) / 100}
                  {m.unit}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
