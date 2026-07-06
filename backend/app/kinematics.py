import numpy as np
from scipy.signal import medfilt

from . import constants as c

SMOOTH_WINDOW = 5
MEDIAN_WINDOW = 7


def _angle_diff_deg(a1: float, a2: float) -> float:
    """Smallest signed difference a2 - a1, wrapped to [-180, 180]."""
    return (a2 - a1 + 180.0) % 360.0 - 180.0


def _moving_average(x: np.ndarray, window: int = SMOOTH_WINDOW) -> np.ndarray:
    if window <= 1 or len(x) < window:
        return x
    kernel = np.ones(window) / window
    pad = window // 2
    xp = np.pad(x, (pad, pad), mode="edge")
    return np.convolve(xp, kernel, mode="valid")[: len(x)]


def _despike_and_smooth(x: np.ndarray) -> np.ndarray:
    """A body segment briefly foreshortening toward edge-on to the camera
    (common right around impact) makes its 2D angle numerically unstable —
    ordinary pixel-level noise in otherwise-smoothed keypoints can translate
    into a spurious 1-3 frame spike of thousands of deg/s, dwarfing every
    genuine value elsewhere in the clip. A median filter rejects that kind of
    brief-minority outlier without flattening real (multi-frame) peaks, then
    a light moving average smooths what's left for a cleaner curve."""
    if len(x) >= MEDIAN_WINDOW:
        x = medfilt(x, kernel_size=MEDIAN_WINDOW)
    return _moving_average(x)


def _angular_speed_series(points_a: np.ndarray, points_b: np.ndarray, fps: float) -> np.ndarray:
    """Absolute angular speed (deg/s) of the vector points_b - points_a across
    every frame, via central differencing. The first/last frame can't be
    central-differenced, and a single-frame forward/backward difference there
    is noticeably noisier (no averaging baseline) — since address/finish
    aren't where anyone's looking for a kinematic-sequence peak anyway, they
    just copy their nearest interior neighbor rather than compute a separate,
    less reliable estimate."""
    n = len(points_a)
    vecs = points_b - points_a
    angles = np.degrees(np.arctan2(vecs[:, 1], vecs[:, 0]))
    speed = np.zeros(n)
    dt = 1.0 / fps

    for i in range(1, n - 1):
        speed[i] = abs(_angle_diff_deg(angles[i - 1], angles[i + 1])) / (2 * dt)

    if n > 1:
        speed[0] = speed[1]
        speed[-1] = speed[-2]

    return speed


def compute_kinematic_sequence(xy: np.ndarray, conf: np.ndarray, fps: float) -> dict:
    """Per-frame angular speed (deg/s) of four proximal-to-distal segments,
    the classic "kinematic sequence" view of a golf swing: in an efficient
    swing, peak speed occurs in order from legs -> torso -> arms -> hands,
    each handing off to the next. Speeds are derived purely from body
    keypoints (no club data needed):
      - legs:  hip line (left hip -> right hip) — pelvis rotation
      - torso: shoulder line (left shoulder -> right shoulder)
      - arms:  shoulder-mid -> wrist-mid
      - hands: elbow-mid -> wrist-mid (most distal segment available)
    """
    n = len(xy)
    hip_l, hip_r = xy[:, c.LEFT_HIP], xy[:, c.RIGHT_HIP]
    sh_l, sh_r = xy[:, c.LEFT_SHOULDER], xy[:, c.RIGHT_SHOULDER]
    sh_mid = (sh_l + sh_r) / 2.0
    elbow_mid = (xy[:, c.LEFT_ELBOW] + xy[:, c.RIGHT_ELBOW]) / 2.0
    wrist_mid = (xy[:, c.LEFT_WRIST] + xy[:, c.RIGHT_WRIST]) / 2.0

    legs = _despike_and_smooth(_angular_speed_series(hip_l, hip_r, fps))
    torso = _despike_and_smooth(_angular_speed_series(sh_l, sh_r, fps))
    arms = _despike_and_smooth(_angular_speed_series(sh_mid, wrist_mid, fps))
    hands = _despike_and_smooth(_angular_speed_series(elbow_mid, wrist_mid, fps))

    return {
        "time": [round(i / fps, 3) for i in range(n)],
        "legs": [round(float(v), 1) for v in legs],
        "torso": [round(float(v), 1) for v in torso],
        "arms": [round(float(v), 1) for v in arms],
        "hands": [round(float(v), 1) for v in hands],
    }
