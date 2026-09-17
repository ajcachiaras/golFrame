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

const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1, 1.5, 2]
const FRAME_STEP_FRACTION = 0.05

export default function Compare() {
  const [swings, setSwings] = useState<SwingSummary[]>([])
  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [result, setResult] = useState<CompareResponse | null>(null)
  const [syncPoint, setSyncPoint] = useState<KeyframeName>('impact')
  const [playbackRate, setPlaybackRate] = useState(1)
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

  function pauseBoth() {
    videoA.current?.pause()
    videoB.current?.pause()
  }

  function changeSpeed(rate: number) {
    setPlaybackRate(rate)
    if (videoA.current) videoA.current.playbackRate = rate
    if (videoB.current) videoB.current.playbackRate = rate
  }

  function stepVideoByFrames(
    video: HTMLVideoElement | null,
    fps: number | null | undefined,
    frames: number,
    direction: 1 | -1
  ) {
    if (!video || !fps) return
    video.pause()
    const stepSeconds = frames / fps
    const max = video.duration || Infinity
    video.currentTime = Math.min(Math.max(0, video.currentTime + direction * stepSeconds), max)
  }

  function stepBothByFrames(frames: number, direction: 1 | -1) {
    stepVideoByFrames(videoA.current, result?.a.fps, frames, direction)
    stepVideoByFrames(videoB.current, result?.b.fps, frames, direction)
  }

  function stepBothPercent(direction: 1 | -1) {
    // Each side steps by its own frame_count * FRAME_STEP_FRACTION, since A/B
    // can have different lengths/fps -- mirrors the single-swing detail view.
    const framesA = Math.max(1, Math.round((result?.a.frame_count ?? 1) * FRAME_STEP_FRACTION))
    const framesB = Math.max(1, Math.round((result?.b.frame_count ?? 1) * FRAME_STEP_FRACTION))
    stepVideoByFrames(videoA.current, result?.a.fps, framesA, direction)
    stepVideoByFrames(videoB.current, result?.b.fps, framesB, direction)
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
            <button onClick={pauseBoth}>⏸ Pause both</button>
          </div>

          <div className="playback-controls">
            <div className="speed-control">
              <span>Speed:</span>
              {PLAYBACK_RATES.map((rate) => (
                <button key={rate} className={playbackRate === rate ? 'active' : ''} onClick={() => changeSpeed(rate)}>
                  {rate}x
                </button>
              ))}
            </div>
            <div className="step-control">
              <button onClick={() => stepBothByFrames(1, -1)}>◀ -1 frame</button>
              <button onClick={() => stepBothByFrames(1, 1)}>+1 frame ▶</button>
            </div>
            <div className="step-control">
              <button onClick={() => stepBothPercent(-1)}>◀◀ -5%</button>
              <button onClick={() => stepBothPercent(1)}>+5% ▶▶</button>
            </div>
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
