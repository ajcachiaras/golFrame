from pathlib import Path

import cv2
import numpy as np
from scipy.signal import savgol_filter
from ultralytics import YOLO

from .constants import NUM_KEYPOINTS

POSE_MODEL_NAME = "yolov8s-pose.pt"

_model = None


def get_pose_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO(POSE_MODEL_NAME)
    return _model


def smooth_keypoints(xy: np.ndarray) -> np.ndarray:
    n = len(xy)
    window = min(11, n)
    if window % 2 == 0:
        window -= 1
    if window > 3:
        return savgol_filter(xy, window, 3, axis=0)
    return xy


def extract_keypoints(video_path: Path) -> dict:
    """Run pose estimation over every frame of the video and return smoothed
    body keypoints for the largest (main) detected person in each frame."""
    model = get_pose_model()
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    all_xy: list[np.ndarray] = []
    all_conf: list[np.ndarray] = []

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            results = model(frame, verbose=False)[0]
            boxes = results.boxes
            kpts = results.keypoints

            if kpts is not None and kpts.xy.shape[0] > 0 and boxes is not None and len(boxes) > 0:
                xyxy = boxes.xyxy.cpu().numpy()
                areas = (xyxy[:, 2] - xyxy[:, 0]) * (xyxy[:, 3] - xyxy[:, 1])
                main_idx = int(np.argmax(areas))
                xy = kpts.xy[main_idx].cpu().numpy()
                conf = (
                    kpts.conf[main_idx].cpu().numpy()
                    if kpts.conf is not None
                    else np.ones(NUM_KEYPOINTS)
                )
                all_xy.append(xy)
                all_conf.append(conf)
            else:
                all_xy.append(all_xy[-1].copy() if all_xy else np.zeros((NUM_KEYPOINTS, 2)))
                all_conf.append(np.zeros(NUM_KEYPOINTS))
    finally:
        cap.release()

    frame_count = len(all_xy)
    if frame_count == 0:
        raise RuntimeError("No frames could be read from video")

    xy_arr = np.asarray(all_xy, dtype=np.float64)
    conf_arr = np.asarray(all_conf, dtype=np.float64)
    xy_smoothed = smooth_keypoints(xy_arr)

    return {
        "xy": xy_smoothed,
        "conf": conf_arr,
        "fps": float(fps),
        "frame_count": frame_count,
        "width": width,
        "height": height,
    }


def iter_frames(path: Path, start: int, end: int):
    """Yield raw BGR frames for indices [start, end] inclusive, decoded
    sequentially from frame 0 for exact frame-accuracy — matches how
    `extract_keypoints` reads frames, so indices line up with the pose data."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")
    try:
        idx = 0
        while idx <= end:
            ok, frame = cap.read()
            if not ok:
                break
            if idx >= start:
                yield frame
            idx += 1
    finally:
        cap.release()
