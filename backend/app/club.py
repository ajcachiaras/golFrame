import os
from typing import Iterable

import numpy as np
from inference_sdk import InferenceHTTPClient

API_KEY_ENV = "ROBOFLOW_API_KEY"
MODEL_ID_ENV = "ROBOFLOW_CLUB_MODEL_ID"
CLUBHEAD_CLASS_ENV = "ROBOFLOW_CLUBHEAD_CLASS"
# Forked/trained copy of club-head-tracking/golf-club-tracking in the user's
# own workspace — the original public project wasn't reachable with a
# non-owner API key on either the hosted or local-download inference paths.
DEFAULT_MODEL_ID = "andrew-cachiaras/golf-club-tracking-ja5fq-1-rfdetr-small-t1"
API_URL = "https://serverless.roboflow.com"

# The model's 3 classes come through as bare numeric labels ("0", "1", "3")
# with no semantic names preserved by the fork. Empirically traced across a
# full swing (address -> top -> impact -> finish), class "1" has by far the
# smallest bounding box and the widest, most physically-coherent pendulum arc
# (reaching furthest from the body at the top of the backswing and through
# the follow-through) — consistent with being the clubhead specifically,
# vs. class "0" (larger, likely the whole club) or "3" (smaller range,
# likely the grip/hands).
DEFAULT_CLUBHEAD_CLASS = "1"

CONF_THRESHOLD = 0.3
MAX_JUMP_PX = 250
MIN_DETECTION_FRACTION = 0.3

_client = None


def _get_client() -> InferenceHTTPClient:
    global _client
    if _client is None:
        api_key = os.environ.get(API_KEY_ENV)
        if not api_key:
            raise RuntimeError(f"{API_KEY_ENV} is not set — club tracking requires a Roboflow API key")
        _client = InferenceHTTPClient(api_url=API_URL, api_key=api_key)
    return _client


def _model_id() -> str:
    return os.environ.get(MODEL_ID_ENV, DEFAULT_MODEL_ID)


def _clubhead_class() -> str:
    return os.environ.get(CLUBHEAD_CLASS_ENV, DEFAULT_CLUBHEAD_CLASS)


def detect_club_path(frames: Iterable[np.ndarray], n: int) -> tuple[np.ndarray, np.ndarray]:
    """Run clubhead detection over an iterable of `n` raw BGR frames (already
    restricted to the trim range by the caller — streamed rather than
    materialized as a list, since a few hundred full-res frames would be a
    lot of memory to hold at once). Returns (xy (N,2) with NaN for
    undetected frames, conf (N,) with 0 for undetected frames)."""
    client = _get_client()
    model_id = _model_id()
    clubhead_class = _clubhead_class()
    xy = np.full((n, 2), np.nan)
    conf = np.zeros(n)
    # Updated on every raw detection, whether or not it passes the jump gate
    # below. Gating against only the *accepted* history breaks down as soon
    # as one legitimately fast (but real) frame-to-frame jump gets rejected:
    # the reference point would freeze there forever, and every subsequent
    # — even correct — detection would keep failing the same stale check.
    last_seen = None

    for i, frame in enumerate(frames):
        try:
            result = client.infer(frame, model_id=model_id)
            preds = result.get("predictions", []) if isinstance(result, dict) else []
        except Exception:
            preds = []

        best = None
        for p in preds:
            if str(p.get("class")) != clubhead_class:
                continue
            if p.get("confidence", 0) < CONF_THRESHOLD:
                continue
            if best is None or p["confidence"] > best["confidence"]:
                best = p

        if best is not None:
            pt = np.array([best["x"], best["y"]])
            if last_seen is None or np.linalg.norm(pt - last_seen) <= MAX_JUMP_PX:
                xy[i] = pt
                conf[i] = best["confidence"]
            last_seen = pt

    return xy, conf


def is_reliable(conf: np.ndarray) -> bool:
    if len(conf) == 0:
        return False
    return float((conf > 0).mean()) >= MIN_DETECTION_FRACTION


def interpolate_gaps(xy: np.ndarray, conf: np.ndarray) -> np.ndarray:
    """Linearly interpolate missing frames between the first and last
    confident detection. Frames outside that span are left as NaN."""
    valid = conf > 0
    if valid.sum() < 2:
        return xy
    idx = np.where(valid)[0]
    span = np.arange(idx[0], idx[-1] + 1)
    out = xy.copy()
    for dim in range(2):
        out[idx[0] : idx[-1] + 1, dim] = np.interp(span, idx, xy[idx, dim])
    return out
