import numpy as np

from . import constants as c

UP_VECTOR = np.array([0.0, -1.0])  # "up" in image coordinates (y grows downward)


def _angle_deg(v: np.ndarray) -> float:
    return float(np.degrees(np.arctan2(v[1], v[0])))


def _angle_diff_deg(a1: float, a2: float) -> float:
    """Smallest signed difference a2 - a1, wrapped to [-180, 180]."""
    return (a2 - a1 + 180.0) % 360.0 - 180.0


def _vertical_angle_deg(v: np.ndarray) -> float:
    norm = np.linalg.norm(v)
    if norm < 1e-9:
        return 0.0
    unit = v / norm
    cos_a = np.clip(np.dot(unit, UP_VECTOR), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_a)))


def _midpoint(xy: np.ndarray, frame_idx: int, a: int, b: int) -> np.ndarray:
    return (xy[frame_idx, a] + xy[frame_idx, b]) / 2.0


def _head_point(xy: np.ndarray, conf: np.ndarray, frame_idx: int) -> np.ndarray:
    if conf[frame_idx, c.NOSE] > 0.3:
        return xy[frame_idx, c.NOSE]
    if conf[frame_idx, c.LEFT_EYE] > 0.3 and conf[frame_idx, c.RIGHT_EYE] > 0.3:
        return _midpoint(xy, frame_idx, c.LEFT_EYE, c.RIGHT_EYE)
    if conf[frame_idx, c.LEFT_EAR] > 0.3 and conf[frame_idx, c.RIGHT_EAR] > 0.3:
        return _midpoint(xy, frame_idx, c.LEFT_EAR, c.RIGHT_EAR)
    return _midpoint(xy, frame_idx, c.LEFT_SHOULDER, c.RIGHT_SHOULDER)


def _rotation_deg(xy: np.ndarray, frame_a: int, frame_b: int, left_idx: int, right_idx: int) -> float:
    vec_a = xy[frame_a, right_idx] - xy[frame_a, left_idx]
    vec_b = xy[frame_b, right_idx] - xy[frame_b, left_idx]
    return abs(_angle_diff_deg(_angle_deg(vec_a), _angle_deg(vec_b)))


def _swing_plane_deg(club_xy: np.ndarray, keyframes: dict) -> float | None:
    top, impact = keyframes["top"], keyframes["impact"]
    if impact <= top:
        return None
    segment = club_xy[top : impact + 1]
    valid = ~np.isnan(segment[:, 0])
    pts = segment[valid]
    if len(pts) < 3:
        return None

    xs, ys = pts[:, 0], pts[:, 1]
    if np.ptp(xs) < 1e-6:
        return 90.0
    slope, _intercept = np.polyfit(xs, ys, 1)
    return round(abs(float(np.degrees(np.arctan(slope)))), 1)


def compute_metrics(
    xy: np.ndarray,
    conf: np.ndarray,
    keyframes: dict,
    fps: float,
    club_xy: np.ndarray | None = None,
) -> dict:
    address, top, impact = keyframes["address"], keyframes["top"], keyframes["impact"]

    shoulder_turn = _rotation_deg(xy, address, top, c.LEFT_SHOULDER, c.RIGHT_SHOULDER)
    hip_turn = _rotation_deg(xy, address, top, c.LEFT_HIP, c.RIGHT_HIP)
    x_factor = shoulder_turn - hip_turn

    neck_address = _midpoint(xy, address, c.LEFT_SHOULDER, c.RIGHT_SHOULDER)
    pelvis_address = _midpoint(xy, address, c.LEFT_HIP, c.RIGHT_HIP)
    neck_impact = _midpoint(xy, impact, c.LEFT_SHOULDER, c.RIGHT_SHOULDER)
    pelvis_impact = _midpoint(xy, impact, c.LEFT_HIP, c.RIGHT_HIP)

    spine_tilt_address = _vertical_angle_deg(neck_address - pelvis_address)
    spine_tilt_impact = _vertical_angle_deg(neck_impact - pelvis_impact)
    spine_tilt_delta = spine_tilt_impact - spine_tilt_address

    backswing_frames = max(top - address, 1)
    downswing_frames = max(impact - top, 1)
    tempo_ratio = backswing_frames / downswing_frames

    head_address = _head_point(xy, conf, address)
    head_impact = _head_point(xy, conf, impact)
    # Normalized by torso height (shoulder-mid to hip-mid), not shoulder width —
    # shoulder width collapses toward zero in a down-the-line shot (the
    # shoulder line is nearly edge-on to the camera), which would blow this
    # percentage up into meaninglessness. Torso height stays stable across
    # camera angles the same way it does for the normalization scale in
    # normalize.py.
    torso_height_address = np.linalg.norm(neck_address - pelvis_address)
    if torso_height_address > 1e-6:
        head_sway_pct = abs(head_impact[0] - head_address[0]) / torso_height_address * 100.0
    else:
        head_sway_pct = 0.0

    result = {
        "shoulder_turn_deg": round(shoulder_turn, 1),
        "hip_turn_deg": round(hip_turn, 1),
        "x_factor_deg": round(x_factor, 1),
        "spine_tilt_address_deg": round(spine_tilt_address, 1),
        "spine_tilt_impact_deg": round(spine_tilt_impact, 1),
        "spine_tilt_delta_deg": round(spine_tilt_delta, 1),
        "tempo_ratio": round(tempo_ratio, 2),
        "head_sway_pct": round(float(head_sway_pct), 1),
    }

    if club_xy is not None:
        swing_plane = _swing_plane_deg(club_xy, keyframes)
        if swing_plane is not None:
            result["swing_plane_deg"] = swing_plane

    return result
