import numpy as np

from . import constants as c

MIN_POINT_CONF = 0.3
MIN_AVG_WRIST_CONF = 0.15


def _hand_centers(xy: np.ndarray, conf: np.ndarray) -> np.ndarray:
    n = xy.shape[0]
    centers = np.zeros((n, 2))
    last = None
    for i in range(n):
        pts = [
            xy[i, idx]
            for idx in (c.LEFT_WRIST, c.RIGHT_WRIST)
            if conf[i, idx] > MIN_POINT_CONF
        ]
        center = np.mean(pts, axis=0) if pts else last
        if center is None:
            center = np.array([0.0, 0.0])
        centers[i] = center
        last = center
    return centers


def _moving_average(x: np.ndarray, window: int = 5) -> np.ndarray:
    if window <= 1 or len(x) < window:
        return x
    kernel = np.ones(window) / window
    pad = window // 2
    xp = np.pad(x, (pad, pad), mode="edge")
    return np.convolve(xp, kernel, mode="valid")[: len(x)]


def detect_keyframes(xy: np.ndarray, conf: np.ndarray) -> dict:
    """Heuristically detect address / top-of-backswing / impact / finish frame
    indices from the hand-speed time series. This is an approximation based on
    a single 2D view — see the app's UI note about manual correction."""
    n = xy.shape[0]
    if n < 5:
        raise ValueError("Video too short to analyze (need at least 5 frames)")

    avg_wrist_conf = conf[:, [c.LEFT_WRIST, c.RIGHT_WRIST]].mean()
    if avg_wrist_conf < MIN_AVG_WRIST_CONF:
        raise ValueError("Could not reliably detect the golfer's hands in this video")

    centers = _hand_centers(xy, conf)
    speed = np.zeros(n)
    speed[1:] = np.linalg.norm(np.diff(centers, axis=0), axis=1)
    speed = _moving_average(speed, window=5)

    max_speed = float(speed.max())
    if max_speed < 1e-6:
        raise ValueError("No swing motion detected in this video")

    # Swing start: first frame where hand speed ramps up meaningfully.
    rising = np.where(speed > 0.15 * max_speed)[0]
    swing_start = int(rising[0]) if len(rising) else n // 2

    # Address: the stillest frame before the swing starts.
    address = int(np.argmin(speed[: swing_start + 1])) if swing_start > 0 else 0

    # Impact: the fastest frame at/after address (downswing speed dominates).
    impact = address + int(np.argmax(speed[address:]))
    if impact <= address:
        impact = min(address + 1, n - 1)

    # Top of backswing: hands decelerate through the second half of the
    # backswing and pause before the downswing, so the calmest point in the
    # *late* portion of address->impact (50%-90% of the way through) is a much
    # better signal than the overall minimum — an early practice waggle or a
    # slow takeaway can otherwise register as a lower speed than the real
    # pause at the top.
    span = impact - address
    lo = address + max(1, int(span * 0.5))
    hi = address + int(span * 0.9)
    if hi <= lo:
        top = address + span // 2
    else:
        top = lo + int(np.argmin(speed[lo:hi]))

    # Finish: first frame after impact where the hands settle back down,
    # falling back to the last frame of the clip.
    settle_thresh = max(speed[address], 0.1 * max_speed)
    after_impact = speed[impact:]
    settled = np.where(after_impact < settle_thresh)[0]
    finish = int(impact + settled[0]) if len(settled) > 0 else n - 1
    finish = max(finish, min(impact + 1, n - 1))

    return {
        "address": int(np.clip(address, 0, n - 1)),
        "top": int(np.clip(top, 0, n - 1)),
        "impact": int(np.clip(impact, 0, n - 1)),
        "finish": int(np.clip(finish, 0, n - 1)),
    }


def refine_with_club_data(
    keyframes: dict,
    xy: np.ndarray,
    conf: np.ndarray,
    club_xy: np.ndarray,
    club_conf: np.ndarray,
) -> dict:
    """Refine `impact` using clubhead speed (more accurate than the hand-speed
    proxy, which runs late into the release) and locate `shaft_back` /
    `shaft_down` — the moments during the backswing and downswing where the
    shaft is foreshortened toward the camera (clubhead closest to the grip in
    2D). All indices are in the same frame space as `xy`/`club_xy`. Keys are
    only added/changed where club data is dense enough to trust; otherwise
    the original hand-speed-based keyframes are left untouched.

    `club_xy` is the gap-*filled* (linearly interpolated) path — good enough
    for a visual trail, but interpolated stretches produce a spuriously
    constant speed across the whole gap that can fool a naive argmax/argmin
    into picking the first frame of a long interpolated run instead of the
    genuine peak. So all frame-picking here is restricted to `club_conf > 0`
    (real detections only); `club_xy`'s interpolated values are never used to
    pick a keyframe, only to measure between two real detections.
    """
    result = dict(keyframes)
    n = len(club_xy)
    address, top, finish = keyframes["address"], keyframes["top"], keyframes["finish"]

    grip = _hand_centers(xy, conf)
    real = club_conf > 0

    search_hi = min(finish, n - 1)
    real_idx = [i for i in range(top, search_hi + 1) if real[i]]
    if len(real_idx) >= 2:
        best_speed, best_frame = -1.0, None
        for a, b in zip(real_idx, real_idx[1:]):
            speed = np.linalg.norm(club_xy[b] - club_xy[a]) / (b - a)
            if speed > best_speed:
                best_speed, best_frame = speed, b
        if best_frame is not None:
            result["impact"] = best_frame

    impact = result["impact"]

    shaft_back = _shaft_toward_camera_frame(club_xy, real, grip, address, top)
    if shaft_back is not None:
        result["shaft_back"] = shaft_back

    shaft_down = _shaft_toward_camera_frame(club_xy, real, grip, top, impact)
    if shaft_down is not None:
        result["shaft_down"] = shaft_down

    return result


def _shaft_toward_camera_frame(
    club_xy: np.ndarray, has_data: np.ndarray, grip: np.ndarray, lo: int, hi: int
) -> int | None:
    if hi <= lo or has_data[lo : hi + 1].sum() < 3:
        return None
    dist = np.linalg.norm(club_xy[lo : hi + 1] - grip[lo : hi + 1], axis=1)
    dist = np.where(has_data[lo : hi + 1], dist, np.inf)
    if np.all(np.isinf(dist)):
        return None
    return int(lo + np.argmin(dist))
