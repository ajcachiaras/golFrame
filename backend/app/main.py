import os
import re
import secrets
import shutil
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles

from . import blob, cache, jobs, kinematics, storage
from .schemas import (
    KEYFRAME_NAMES,
    METRIC_KEYS,
    CompareResponse,
    KeyframePatch,
    KinematicSequenceResponse,
    ReferencePatch,
    SwingDetail,
    SwingSummary,
    TrendPoint,
    TrendResponse,
)

_security = HTTPBasic(auto_error=False)


def require_auth(
    request: Request, credentials: HTTPBasicCredentials | None = Depends(_security)
) -> None:
    """No-op when BASIC_AUTH_USER/PASS aren't set (local dev); gates every
    route when they are (a public deploy for a single-user tool), except
    /api/health which the load balancer polls unauthenticated."""
    if request.url.path == "/api/health":
        return
    user = os.environ.get("BASIC_AUTH_USER")
    password = os.environ.get("BASIC_AUTH_PASS")
    if not user or not password:
        return
    valid = credentials is not None and secrets.compare_digest(
        credentials.username, user
    ) and secrets.compare_digest(credentials.password, password)
    if not valid:
        raise HTTPException(
            status_code=401, detail="Unauthorized", headers={"WWW-Authenticate": "Basic"}
        )


app = FastAPI(title="GolFrame API", dependencies=[Depends(require_auth)])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFE_EXT_RE = re.compile(r"^\.[a-zA-Z0-9]{1,5}$")


@app.on_event("startup")
def on_startup() -> None:
    storage.init_db()


def _swing_to_dict(swing: dict) -> dict:
    d = dict(swing)
    # A "done" swing always has both files — jobs.py only calls mark_done
    # after both render_annotated_video and save_thumbnail succeed, so this
    # avoids a filesystem stat / S3 HEAD request per swing on every list call.
    ready = d["status"] == "done"
    d["thumbnail_url"] = f"/api/swings/{d['id']}/thumbnail" if ready else None
    d["video_url"] = None
    d["annotated_video_url"] = f"/api/swings/{d['id']}/annotated" if ready else None

    keyframes = d.get("keyframes")
    fps = d.get("fps")
    if keyframes and fps:
        d["keyframe_times"] = {name: round(frame / fps, 3) for name, frame in keyframes.items()}
    else:
        d["keyframe_times"] = None
    return d


def _get_swing_or_404(swing_id: str) -> dict:
    swing = storage.get_swing(swing_id)
    if swing is None:
        raise HTTPException(status_code=404, detail="Swing not found")
    return swing


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/swings", response_model=SwingSummary)
def upload_swing(file: UploadFile) -> dict:
    ext = Path(file.filename or "").suffix.lower()
    if not SAFE_EXT_RE.match(ext):
        ext = ".mp4"

    swing_id = storage.create_swing(file.filename or "swing", ext)

    if blob.is_configured():
        fd, tmp_name = tempfile.mkstemp(suffix=ext)
        try:
            with os.fdopen(fd, "wb") as out:
                shutil.copyfileobj(file.file, out)
            blob.upload(Path(tmp_name), blob.video_key(swing_id, ext))
        finally:
            Path(tmp_name).unlink(missing_ok=True)
    else:
        dest = storage.video_path(swing_id, ext)
        with dest.open("wb") as out:
            shutil.copyfileobj(file.file, out)

    jobs.start_processing(swing_id)

    return _swing_to_dict(storage.get_swing(swing_id))


@app.get("/api/swings", response_model=list[SwingSummary])
def list_swings() -> list[dict]:
    return [_swing_to_dict(s) for s in storage.list_swings()]


@app.get("/api/swings/{swing_id}", response_model=SwingDetail)
def get_swing(swing_id: str) -> dict:
    swing = _get_swing_or_404(swing_id)
    return _swing_to_dict(swing)


@app.get("/api/swings/{swing_id}/kinematic-sequence", response_model=KinematicSequenceResponse)
def get_kinematic_sequence(swing_id: str) -> dict:
    swing = _get_swing_or_404(swing_id)
    if swing["status"] != "done":
        raise HTTPException(status_code=409, detail="Swing is not ready yet")
    with storage.local_keypoints_for_read(swing_id) as keypoints_path:
        data = cache.load_swing_data(keypoints_path)
    return kinematics.compute_kinematic_sequence(data["xy"], data["conf"], data["fps"])


@app.get("/api/swings/{swing_id}/thumbnail")
def get_thumbnail(swing_id: str):
    if blob.is_configured():
        key = blob.thumbnail_key(swing_id)
        if not blob.exists(key):
            raise HTTPException(status_code=404, detail="Thumbnail not available")
        return RedirectResponse(blob.presigned_url(key))
    path = storage.thumbnail_path(swing_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(path, media_type="image/jpeg")


@app.get("/api/swings/{swing_id}/annotated")
def get_annotated_video(swing_id: str):
    if blob.is_configured():
        key = blob.annotated_key(swing_id)
        if not blob.exists(key):
            raise HTTPException(status_code=404, detail="Annotated video not available")
        return RedirectResponse(blob.presigned_url(key))
    path = storage.annotated_path(swing_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Annotated video not available")
    return FileResponse(path, media_type="video/mp4")


@app.patch("/api/swings/{swing_id}/reference", response_model=SwingDetail)
def set_reference(swing_id: str, patch: ReferencePatch) -> dict:
    _get_swing_or_404(swing_id)
    storage.set_reference(swing_id, patch.is_reference)
    return _swing_to_dict(storage.get_swing(swing_id))


@app.patch("/api/swings/{swing_id}/keyframe", response_model=SwingDetail)
def patch_keyframe(swing_id: str, patch: KeyframePatch) -> dict:
    swing = _get_swing_or_404(swing_id)
    if swing["status"] != "done" or not swing["keyframes"]:
        raise HTTPException(status_code=409, detail="Swing is not ready for keyframe edits yet")

    if patch.name not in KEYFRAME_NAMES:
        raise HTTPException(status_code=400, detail=f"name must be one of {KEYFRAME_NAMES}")

    frame_count = swing["frame_count"] or 0
    if not (0 <= patch.frame < frame_count):
        raise HTTPException(status_code=400, detail=f"frame must be between 0 and {frame_count - 1}")

    keyframes = dict(swing["keyframes"])
    keyframes[patch.name] = patch.frame
    storage.update_keyframes(swing_id, keyframes)

    try:
        jobs.reprocess_after_keyframe_edit(swing_id)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return _swing_to_dict(storage.get_swing(swing_id))


@app.delete("/api/swings/{swing_id}")
def delete_swing(swing_id: str) -> dict:
    _get_swing_or_404(swing_id)
    storage.delete_swing(swing_id)
    return {"deleted": swing_id}


@app.get("/api/compare", response_model=CompareResponse)
def compare_swings(a: str, b: str) -> dict:
    swing_a = _get_swing_or_404(a)
    swing_b = _get_swing_or_404(b)

    if swing_a["status"] != "done" or swing_b["status"] != "done":
        raise HTTPException(status_code=409, detail="Both swings must finish processing before comparing")

    metrics_a = swing_a["metrics"] or {}
    metrics_b = swing_b["metrics"] or {}
    deltas = {
        key: round(metrics_b.get(key, 0) - metrics_a.get(key, 0), 2)
        for key in METRIC_KEYS
        if key in metrics_a and key in metrics_b
    }

    return {
        "a": _swing_to_dict(swing_a),
        "b": _swing_to_dict(swing_b),
        "deltas": deltas,
    }


@app.get("/api/metrics/trend", response_model=TrendResponse)
def metrics_trend(metric: str) -> dict:
    if metric not in METRIC_KEYS:
        raise HTTPException(status_code=400, detail=f"metric must be one of {METRIC_KEYS}")

    swings = [s for s in storage.list_swings() if s["status"] == "done"]
    swings.sort(key=lambda s: s["uploaded_at"])

    points = [
        TrendPoint(
            swing_id=s["id"],
            uploaded_at=s["uploaded_at"],
            value=(s["metrics"] or {}).get(metric),
        )
        for s in swings
    ]

    return {"metric": metric, "points": points}


# Production build of the frontend, served by this same app so there's one
# deploy artifact and no CORS to manage. Absent during local `npm run dev`
# (the Vite dev server handles the frontend then), so this is a no-op there.
_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        candidate = _FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
