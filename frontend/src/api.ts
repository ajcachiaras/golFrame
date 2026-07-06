export const KEYFRAME_NAMES = ['address', 'shaft_back', 'top', 'shaft_down', 'impact', 'finish'] as const
export type KeyframeName = (typeof KEYFRAME_NAMES)[number]

export const KEYFRAME_LABELS: Record<KeyframeName, string> = {
  address: 'Address',
  shaft_back: 'Shaft (back)',
  top: 'Top',
  shaft_down: 'Shaft (down)',
  impact: 'Impact',
  finish: 'Finish',
}

export const METRICS: { key: string; label: string; unit: string; cameraSensitive: boolean }[] = [
  { key: 'shoulder_turn_deg', label: 'Shoulder turn', unit: '°', cameraSensitive: true },
  { key: 'hip_turn_deg', label: 'Hip turn', unit: '°', cameraSensitive: true },
  { key: 'x_factor_deg', label: 'X-factor (shoulder - hip)', unit: '°', cameraSensitive: true },
  { key: 'spine_tilt_address_deg', label: 'Spine tilt at address', unit: '°', cameraSensitive: false },
  { key: 'spine_tilt_impact_deg', label: 'Spine tilt at impact', unit: '°', cameraSensitive: false },
  { key: 'spine_tilt_delta_deg', label: 'Spine tilt change', unit: '°', cameraSensitive: false },
  { key: 'tempo_ratio', label: 'Tempo ratio (backswing:downswing)', unit: ':1', cameraSensitive: false },
  { key: 'head_sway_pct', label: 'Head sway', unit: '% of torso height', cameraSensitive: true },
  { key: 'swing_plane_deg', label: 'Swing plane angle', unit: '°', cameraSensitive: true },
]

export type Metrics = Record<string, number>

export interface SwingSummary {
  id: string
  filename: string
  uploaded_at: string
  status: 'processing' | 'done' | 'error'
  is_reference: boolean
  error_message: string | null
  thumbnail_url: string | null
  metrics: Metrics | null
}

export interface SwingDetail extends SwingSummary {
  fps: number | null
  frame_count: number | null
  width: number | null
  height: number | null
  keyframes: Partial<Record<KeyframeName, number>> | null
  keyframe_times: Partial<Record<KeyframeName, number>> | null
  video_url: string | null
  annotated_video_url: string | null
}

export interface CompareResponse {
  a: SwingDetail
  b: SwingDetail
  deltas: Metrics
}

export interface TrendPoint {
  swing_id: string
  uploaded_at: string
  value: number | null
}

export interface TrendResponse {
  metric: string
  points: TrendPoint[]
}

export interface KinematicSequence {
  time: number[]
  legs: number[]
  torso: number[]
  arms: number[]
  hands: number[]
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export function listSwings(): Promise<SwingSummary[]> {
  return request('/swings')
}

export function getSwing(id: string): Promise<SwingDetail> {
  return request(`/swings/${id}`)
}

export async function uploadSwing(file: File): Promise<SwingSummary> {
  const form = new FormData()
  form.append('file', file)
  return request('/swings', { method: 'POST', body: form })
}

export function setReference(id: string, isReference: boolean): Promise<SwingDetail> {
  return request(`/swings/${id}/reference`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_reference: isReference }),
  })
}

export function patchKeyframe(id: string, name: KeyframeName, frame: number): Promise<SwingDetail> {
  return request(`/swings/${id}/keyframe`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, frame }),
  })
}

export function deleteSwing(id: string): Promise<{ deleted: string }> {
  return request(`/swings/${id}`, { method: 'DELETE' })
}

export function compareSwings(a: string, b: string): Promise<CompareResponse> {
  return request(`/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`)
}

export function getTrend(metric: string): Promise<TrendResponse> {
  return request(`/metrics/trend?metric=${encodeURIComponent(metric)}`)
}

export function getKinematicSequence(id: string): Promise<KinematicSequence> {
  return request(`/swings/${id}/kinematic-sequence`)
}
