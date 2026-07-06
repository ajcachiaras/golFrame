from pathlib import Path

import cv2
import imageio.v2 as imageio
import numpy as np

from .constants import CONF_THRESHOLD, NUM_KEYPOINTS, SKELETON_EDGES

WIREFRAME_COLOR = (0, 255, 0)
LABEL_COLOR = (0, 215, 255)
CLUB_PATH_COLOR = (0, 165, 255)  # BGR orange


def _draw_skeleton(frame: np.ndarray, xy_frame: np.ndarray, conf_frame: np.ndarray) -> np.ndarray:
    for a, b in SKELETON_EDGES:
        if conf_frame[a] > CONF_THRESHOLD and conf_frame[b] > CONF_THRESHOLD:
            pt1 = tuple(xy_frame[a].astype(int))
            pt2 = tuple(xy_frame[b].astype(int))
            cv2.line(frame, pt1, pt2, WIREFRAME_COLOR, 2, cv2.LINE_AA)

    for idx in range(NUM_KEYPOINTS):
        if conf_frame[idx] > CONF_THRESHOLD:
            pt = tuple(xy_frame[idx].astype(int))
            cv2.circle(frame, pt, 3, WIREFRAME_COLOR, -1, cv2.LINE_AA)

    return frame


def _draw_club_path(frame: np.ndarray, club_xy: np.ndarray, frame_idx: int) -> np.ndarray:
    """Persistent trace of the clubhead's path from the start of the clip up
    through `frame_idx` — stays on screen for the rest of the video rather
    than fading, so the full swing arc is visible by the end. Gaps (NaN,
    undetected) simply break the line rather than drawing a straight-line
    guess across them."""
    pts = club_xy[: frame_idx + 1]
    valid_pts = [tuple(p.astype(int)) for p in pts if not np.isnan(p[0])]
    if len(valid_pts) < 2:
        return frame

    for i in range(1, len(valid_pts)):
        cv2.line(frame, valid_pts[i - 1], valid_pts[i], CLUB_PATH_COLOR, 3, cv2.LINE_AA)
    return frame


def render_annotated_video(
    source_path: Path,
    target_path: Path,
    xy: np.ndarray,
    conf: np.ndarray,
    fps: float,
    keyframes: dict,
    M: np.ndarray,
    out_size: tuple[int, int],
    trim_start: int,
    club_xy: np.ndarray | None = None,
) -> None:
    """Read raw frames starting at `trim_start`, warp each with `M` into
    `out_size`, and draw the skeleton/club path/keyframe labels using the
    already-transformed, trim-relative `xy`/`club_xy` arrays. H.264/yuv420p
    via imageio's bundled ffmpeg so the result plays back in a browser
    <video> tag — OpenCV's own VideoWriter codecs (e.g. mp4v) are not
    decodable by Chrome/Firefox.
    """
    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {source_path}")

    out_width, out_height = out_size
    writer = imageio.get_writer(str(target_path), fps=fps, codec="libx264", pixelformat="yuv420p")

    label_by_frame = {idx: name.upper().replace("_", " ") for name, idx in keyframes.items()}
    trim_length = len(xy)

    try:
        raw_idx = 0
        out_idx = 0
        while out_idx < trim_length:
            ok, frame = cap.read()
            if not ok:
                break
            if raw_idx < trim_start:
                raw_idx += 1
                continue

            warped = cv2.warpAffine(frame, M, (out_width, out_height))
            warped = _draw_skeleton(warped, xy[out_idx], conf[out_idx])
            if club_xy is not None:
                warped = _draw_club_path(warped, club_xy, out_idx)

            label = label_by_frame.get(out_idx)
            if label:
                cv2.putText(
                    warped, label, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, LABEL_COLOR, 2, cv2.LINE_AA
                )

            writer.append_data(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))
            raw_idx += 1
            out_idx += 1
    finally:
        cap.release()
        writer.close()


def save_thumbnail(
    source_path: Path,
    thumb_path: Path,
    xy: np.ndarray,
    conf: np.ndarray,
    frame_idx: int,
    M: np.ndarray,
    out_size: tuple[int, int],
    trim_start: int,
) -> None:
    """`frame_idx` is trim-relative (matching `xy`); the raw source is seeked
    to `trim_start + frame_idx`."""
    cap = cv2.VideoCapture(str(source_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {source_path}")

    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, trim_start + frame_idx)
        ok, frame = cap.read()
        if not ok:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = cap.read()
        if ok:
            out_width, out_height = out_size
            warped = cv2.warpAffine(frame, M, (out_width, out_height))
            warped = _draw_skeleton(warped, xy[frame_idx], conf[frame_idx])
            cv2.imwrite(str(thumb_path), warped)
    finally:
        cap.release()
