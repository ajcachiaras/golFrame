import { useEffect, useMemo, useRef, useState } from 'react'
import {
  KEYFRAME_LABELS,
  KEYFRAME_NAMES,
  compareSwings,
  listSwings,
  type CompareResponse,
  type KeyframeName,
  type SwingSummary,
} from '../api'
import CameraCaveat from '../components/CameraCaveat'
import MetricsTable from '../components/MetricsTable'
import './Compare.css'

export default function Compare() {
  const [swings, setSwings] = useState<SwingSummary[]>([])
  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [result, setResult] = useState<CompareResponse | null>(null)
  const [syncPoint, setSyncPoint] = useState<KeyframeName>('impact')
  const [error, setError] = useState<string | null>(null)
  const videoA = useRef<HTMLVideoElement>(null)
  const videoB = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    listSwings().then((all) => {
      const done = all.filter((s) => s.status === 'done')
      setSwings(done)
      const reference = done.find((s) => s.is_reference)
      if (done.length > 0) setIdA(done[0].id)
      if (reference && reference.id !== done[0]?.id) setIdB(reference.id)
      else if (done.length > 1) setIdB(done[1].id)
    })
  }, [])

  useEffect(() => {
    if (!idA || !idB) return
    setError(null)
    compareSwings(idA, idB)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }, [idA, idB])

  const sharedKeyframes = useMemo(
    () =>
      KEYFRAME_NAMES.filter(
        (name) => result?.a.keyframe_times?.[name] !== undefined && result?.b.keyframe_times?.[name] !== undefined
      ),
    [result]
  )

  function sync(point: KeyframeName) {
    setSyncPoint(point)
    const tA = result?.a.keyframe_times?.[point]
    const tB = result?.b.keyframe_times?.[point]
    if (tA !== undefined && videoA.current) videoA.current.currentTime = tA
    if (tB !== undefined && videoB.current) videoB.current.currentTime = tB
  }

  function playBoth() {
    videoA.current?.play()
    videoB.current?.play()
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Compare swings</h1>

      <div className="compare-pickers">
        <label>
          Swing A
          <select value={idA} onChange={(e) => setIdA(e.target.value)}>
            {swings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.filename}
                {s.is_reference ? ' (reference)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Swing B
          <select value={idB} onChange={(e) => setIdB(e.target.value)}>
            {swings.map((s) => (
              <option key={s.id} value={s.id}>
                {s.filename}
                {s.is_reference ? ' (reference)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p style={{ color: 'var(--bad)' }}>{error}</p>}

      {result && (
        <>
          <div className="sync-row">
            <span>Sync at:</span>
            {sharedKeyframes.map((k) => (
              <button key={k} className={syncPoint === k ? 'active' : ''} onClick={() => sync(k)}>
                {KEYFRAME_LABELS[k]}
              </button>
            ))}
            <button onClick={playBoth}>▶ Play both</button>
          </div>

          <div className="compare-videos">
            <video ref={videoA} src={result.a.annotated_video_url ?? undefined} controls />
            <video ref={videoB} src={result.b.annotated_video_url ?? undefined} controls />
          </div>

          <div style={{ marginTop: 20 }}>
            <CameraCaveat />
            {result.a.metrics && <MetricsTable metrics={result.b.metrics!} compareTo={result.a.metrics} />}
          </div>
        </>
      )}
    </div>
  )
}
