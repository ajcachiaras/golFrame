import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  KEYFRAME_LABELS,
  KEYFRAME_NAMES,
  deleteSwing,
  getKinematicSequence,
  getSwing,
  patchKeyframe,
  setReference,
  type KeyframeName,
  type KinematicSequence,
  type SwingDetail as SwingDetailT,
} from '../api'
import CameraCaveat from '../components/CameraCaveat'
import KinematicSequenceChart from '../components/KinematicSequenceChart'
import MetricsTable from '../components/MetricsTable'
import './SwingDetail.css'

const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1, 1.5, 2]
const FRAME_STEP_FRACTION = 0.05

export default function SwingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [swing, setSwing] = useState<SwingDetailT | null>(null)
  const [editing, setEditing] = useState<KeyframeName | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [sequence, setSequence] = useState<KinematicSequence | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const videoRef = useRef<HTMLVideoElement>(null)

  const refresh = useCallback(async () => {
    if (!id) return
    setSwing(await getSwing(id))
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (swing?.status !== 'processing') return
    const timer = setInterval(refresh, 2000)
    return () => clearInterval(timer)
  }, [swing, refresh])

  useEffect(() => {
    if (!id || swing?.status !== 'done') return
    getKinematicSequence(id).then(setSequence).catch(() => setSequence(null))
  }, [id, swing?.status])

  if (!swing) return <p>Loading…</p>

  function seekTo(name: KeyframeName) {
    const t = swing!.keyframe_times?.[name]
    if (t !== undefined && videoRef.current) {
      videoRef.current.currentTime = t
    }
  }

  function changeSpeed(rate: number) {
    setPlaybackRate(rate)
    if (videoRef.current) videoRef.current.playbackRate = rate
  }

  function stepByFrames(frames: number, direction: 1 | -1) {
    const v = videoRef.current
    const fps = swing?.fps
    if (!v || !fps) return
    v.pause()
    const stepSeconds = frames / fps
    const max = v.duration || Infinity
    v.currentTime = Math.min(Math.max(0, v.currentTime + direction * stepSeconds), max)
  }

  function stepFrames(direction: 1 | -1) {
    const frameCount = swing?.frame_count
    if (!frameCount) return
    stepByFrames(Math.max(1, Math.round(frameCount * FRAME_STEP_FRACTION)), direction)
  }

  function startEdit(name: KeyframeName) {
    setEditing(name)
    const existing = swing!.keyframes?.[name]
    setEditValue(String(existing ?? swing!.keyframes?.address ?? 0))
  }

  async function saveEdit(name: KeyframeName) {
    const frame = parseInt(editValue, 10)
    if (Number.isNaN(frame)) return
    setSaving(true)
    try {
      const updated = await patchKeyframe(swing!.id, name, frame)
      setSwing(updated)
      setEditing(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleReference() {
    const updated = await setReference(swing.id, !swing.is_reference)
    setSwing(updated)
  }

  async function handleDelete() {
    if (!confirm('Delete this swing? This cannot be undone.')) return
    await deleteSwing(swing.id)
    navigate('/')
  }

  return (
    <div>
      <div className="top-actions">
        <button onClick={() => navigate('/')}>← Library</button>
        <button onClick={toggleReference}>{swing.is_reference ? '★ Unmark reference' : '☆ Mark as reference'}</button>
        <button onClick={handleDelete}>Delete</button>
      </div>

      <h1 style={{ marginTop: 0 }}>{swing.filename}</h1>

      {swing.status === 'processing' && <p>Processing… this can take a little while on CPU.</p>}
      {swing.status === 'error' && <p style={{ color: 'var(--bad)' }}>Failed: {swing.error_message}</p>}

      {swing.status === 'done' && (
        <div className="detail-layout">
          <div className="detail-video">
            <video
              ref={videoRef}
              src={swing.annotated_video_url ?? undefined}
              controls
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
            <div className="playback-controls">
              <div className="speed-control">
                <span>Speed:</span>
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    className={playbackRate === rate ? 'active' : ''}
                    onClick={() => changeSpeed(rate)}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
              <div className="step-control">
                <button onClick={() => stepByFrames(1, -1)}>◀ -1 frame</button>
                <button onClick={() => stepByFrames(1, 1)}>+1 frame ▶</button>
              </div>
              <div className="step-control">
                <button onClick={() => stepFrames(-1)}>
                  ◀◀ -{Math.max(1, Math.round((swing.frame_count ?? 1) * FRAME_STEP_FRACTION))} frames
                </button>
                <button onClick={() => stepFrames(1)}>
                  +{Math.max(1, Math.round((swing.frame_count ?? 1) * FRAME_STEP_FRACTION))} frames ▶▶
                </button>
              </div>
            </div>
            <div className="keyframe-row">
              {KEYFRAME_NAMES.map((name) => {
                const frame = swing.keyframes?.[name]
                const detected = frame !== undefined
                return (
                  <div className={`keyframe-chip${detected ? '' : ' not-detected'}`} key={name}>
                    <span className="name">{KEYFRAME_LABELS[name]}</span>
                    {editing === name ? (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={(swing.frame_count ?? 1) - 1}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                        />
                        <span style={{ display: 'flex', gap: 4 }}>
                          <button disabled={saving} onClick={() => saveEdit(name)}>
                            Save
                          </button>
                          <button onClick={() => setEditing(null)}>Cancel</button>
                        </span>
                      </>
                    ) : detected ? (
                      <>
                        <span onClick={() => seekTo(name)} style={{ cursor: 'pointer' }}>
                          frame {frame}
                        </span>
                        <button onClick={() => startEdit(name)}>Correct</button>
                      </>
                    ) : (
                      <>
                        <span>not detected</span>
                        <button onClick={() => startEdit(name)}>Add</button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <CameraCaveat />
            {swing.metrics && <MetricsTable metrics={swing.metrics} />}
          </div>

          {sequence && (
            <div className="kinematic-section">
              <KinematicSequenceChart sequence={sequence} currentTime={currentTime} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
