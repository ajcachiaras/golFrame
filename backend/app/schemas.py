from typing import Optional
from pydantic import BaseModel

KEYFRAME_NAMES = ("address", "shaft_back", "top", "shaft_down", "impact", "finish")

METRIC_KEYS = (
    "shoulder_turn_deg",
    "hip_turn_deg",
    "x_factor_deg",
    "spine_tilt_address_deg",
    "spine_tilt_impact_deg",
    "spine_tilt_delta_deg",
    "tempo_ratio",
    "head_sway_pct",
    "swing_plane_deg",
)


class SwingSummary(BaseModel):
    id: str
    filename: str
    uploaded_at: str
    status: str
    is_reference: bool
    error_message: Optional[str] = None
    thumbnail_url: Optional[str] = None
    metrics: Optional[dict] = None


class SwingDetail(SwingSummary):
    fps: Optional[float] = None
    frame_count: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    keyframes: Optional[dict] = None
    keyframe_times: Optional[dict] = None
    video_url: Optional[str] = None
    annotated_video_url: Optional[str] = None


class ReferencePatch(BaseModel):
    is_reference: bool


class KeyframePatch(BaseModel):
    name: str
    frame: int


class CompareResponse(BaseModel):
    a: SwingDetail
    b: SwingDetail
    deltas: dict


class TrendPoint(BaseModel):
    swing_id: str
    uploaded_at: str
    value: Optional[float]


class TrendResponse(BaseModel):
    metric: str
    points: list[TrendPoint]


class KinematicSequenceResponse(BaseModel):
    time: list[float]
    legs: list[float]
    torso: list[float]
    arms: list[float]
    hands: list[float]
