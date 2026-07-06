import cv2
import numpy as np

from . import constants as c

TARGET_HEIGHT = 1280
# Zoom/anchor chosen so a full standing body (feet to head) plus headroom for
# a club raised overhead at the top of the backswing/finish both fit within
# the canvas — 0.22/0.55 was too tight and cropped the feet, since torso
# height is only ~28% of standing height, so scaling it to 22% of the canvas
# put ankles almost exactly on the bottom edge with zero margin for error.
TORSO_HEIGHT_TARGET_FRACTION = 0.16  # fraction of TARGET_HEIGHT
MIN_TORSO_HEIGHT_FRACTION_OF_RAW = 0.05  # sanity floor vs. raw_height
TORSO_CENTER_Y_FRACTION = 0.48  # where to place the torso vertically in the output canvas
MIN_LEG_CONF = 0.3


def compute_transform(
    xy_address: np.ndarray, conf_address: np.ndarray, raw_width: int, raw_height: int
) -> tuple[np.ndarray, int, int]:
    """Compute an affine transform (2x3 matrix) from the address-frame body
    pose that:
      - rotates so the ankle-mid -> hip-mid ("leg") line is perfectly
        vertical, correcting genuine camera roll (a tilted phone). The leg
        line is used instead of the shoulder line because it stays roughly
        vertical from *any* horizontal camera angle (face-on or
        down-the-line) — the shoulder line, by contrast, is nearly edge-on
        (and so unstable/near-degenerate) in a down-the-line shot. It's also
        deliberately NOT the shoulder-hip/spine vector, since that would
        force spine_tilt_address to zero and destroy that metric's signal.
        If ankles aren't confidently detected, rotation is skipped (identity)
        rather than guessing from a less reliable reference.
      - scales so torso height (shoulder-mid to hip-mid) maps to a fixed
        fraction of the output canvas height (consistent "zoom" regardless
        of camera distance). Torso height is used instead of shoulder width
        because shoulder width collapses toward zero whenever the golfer
        isn't perfectly face-on at the address frame (foreshortening), which
        would otherwise blow the zoom factor up to nonsensical levels.
      - translates so the torso is centered in the output canvas
    Returns (M, out_width, out_height). out_width preserves the source's
    aspect ratio at a fixed target height.
    """
    l_sh = xy_address[c.LEFT_SHOULDER]
    r_sh = xy_address[c.RIGHT_SHOULDER]
    l_hip = xy_address[c.LEFT_HIP]
    r_hip = xy_address[c.RIGHT_HIP]

    shoulder_mid = (l_sh + r_sh) / 2.0
    hip_mid = (l_hip + r_hip) / 2.0
    torso_center = (shoulder_mid + hip_mid) / 2.0

    rotation_deg = 0.0
    if conf_address[c.LEFT_ANKLE] > MIN_LEG_CONF and conf_address[c.RIGHT_ANKLE] > MIN_LEG_CONF:
        ankle_mid = (xy_address[c.LEFT_ANKLE] + xy_address[c.RIGHT_ANKLE]) / 2.0
        # Rotation that maps the hip->ankle ("leg") vector onto straight-down
        # (0, +y). Same derivation as the spine-vertical case: zeroes out the
        # vector's x-component after rotation.
        leg_vec = ankle_mid - hip_mid
        rotation_deg = float(np.degrees(np.arctan2(-leg_vec[0], leg_vec[1])))

    torso_height = float(np.linalg.norm(hip_mid - shoulder_mid))
    min_torso_height = raw_height * MIN_TORSO_HEIGHT_FRACTION_OF_RAW
    if torso_height < min_torso_height:
        torso_height = raw_height * 0.28  # fallback: typical torso-height proportion of frame

    out_height = TARGET_HEIGHT
    out_width = int(round(TARGET_HEIGHT * (raw_width / raw_height)))

    target_torso_height = TORSO_HEIGHT_TARGET_FRACTION * out_height
    scale = target_torso_height / torso_height

    center = (float(torso_center[0]), float(torso_center[1]))
    M = cv2.getRotationMatrix2D(center, rotation_deg, scale)

    target_x = out_width / 2.0
    target_y = out_height * TORSO_CENTER_Y_FRACTION
    M[0, 2] += target_x - torso_center[0]
    M[1, 2] += target_y - torso_center[1]

    return M, out_width, out_height


def transform_points(points: np.ndarray, M: np.ndarray) -> np.ndarray:
    """Apply a 2x3 affine matrix to an array of 2D points, any leading shape
    (..., 2). NaNs pass through unchanged (arithmetic on NaN stays NaN)."""
    shape = points.shape
    flat = points.reshape(-1, 2)
    ones = np.ones((flat.shape[0], 1))
    homogeneous = np.hstack([flat, ones])
    transformed = homogeneous @ M.T
    return transformed.reshape(shape)
