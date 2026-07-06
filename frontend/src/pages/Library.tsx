import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteSwing,
  listSwings,
  setReference,
  uploadSwing,
  type SwingSummary,
} from '../api'
import './Library.css'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Library() {
  const [swings, setSwings] = useState<SwingSummary[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setSwings(await listSwings())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const hasProcessing = swings.some((s) => s.status === 'processing')
    if (!hasProcessing) return
    const timer = setInterval(refresh, 2500)
    return () => clearInterval(timer)
  }, [swings, refresh])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError(null)
    for (const file of Array.from(files)) {
      try {
        await uploadSwing(file)
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err))
      }
    }
    refresh()
  }

  async function toggleReference(s: SwingSummary, e: React.MouseEvent) {
    e.preventDefault()
    await setReference(s.id, !s.is_reference)
    refresh()
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete this swing? This cannot be undone.')) return
    await deleteSwing(id)
    refresh()
  }

  return (
    <div>
      <div className="library-header">
        <h1 style={{ margin: 0 }}>Your swings</h1>
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
        >
          Drop a swing video here, or click to choose a file
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {uploadError && <p style={{ color: 'var(--bad)' }}>{uploadError}</p>}

      {swings.length === 0 ? (
        <div className="empty-state">
          <p>No swings yet. Upload a video to get started.</p>
        </div>
      ) : (
        <div className="swing-grid">
          {swings.map((s) => (
            <Link key={s.id} to={`/swings/${s.id}`} className="swing-card">
              <button
                className={`star-btn${s.is_reference ? ' active' : ''}`}
                onClick={(e) => toggleReference(s, e)}
                title={s.is_reference ? 'Reference swing' : 'Mark as reference'}
              >
                ★
              </button>
              <button className="delete-btn" onClick={(e) => handleDelete(s.id, e)} title="Delete">
                ✕
              </button>
              <div className="thumb">
                {s.thumbnail_url ? (
                  <img src={s.thumbnail_url} alt="" />
                ) : s.status === 'error' ? (
                  'Error'
                ) : (
                  'Processing…'
                )}
              </div>
              <div className="body">
                <div className="filename">{s.filename}</div>
                <div className="date">{formatDate(s.uploaded_at)}</div>
                <div className="badge-row">
                  {s.status === 'error' && <span className="badge error">Failed</span>}
                  {s.status === 'processing' && <span className="badge">Processing</span>}
                  {s.metrics && (
                    <>
                      <span className="badge">{s.metrics.tempo_ratio}:1 tempo</span>
                      <span className="badge">{s.metrics.x_factor_deg}° X-factor</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
