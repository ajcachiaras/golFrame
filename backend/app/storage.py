import json
import os
import shutil
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine, text

from . import blob

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
VIDEOS_DIR = DATA_DIR / "videos"
ANNOTATED_DIR = DATA_DIR / "annotated"
THUMBNAILS_DIR = DATA_DIR / "thumbnails"
KEYPOINTS_DIR = DATA_DIR / "keypoints"
DB_PATH = DATA_DIR / "swings.db"

for d in (VIDEOS_DIR, ANNOTATED_DIR, THUMBNAILS_DIR, KEYPOINTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# No DATABASE_URL -> local SQLite (today's behavior, zero setup). Set
# DATABASE_URL (e.g. to an RDS Postgres connection string) to switch backends
# — every query below is plain ANSI SQL with named parameters, which
# SQLAlchemy Core runs identically against either engine.
DATABASE_URL = os.environ.get("DATABASE_URL") or f"sqlite:///{DB_PATH}"
_engine = create_engine(DATABASE_URL, future=True)


def video_path(swing_id: str, ext: str) -> Path:
    return VIDEOS_DIR / f"{swing_id}{ext}"


def annotated_path(swing_id: str) -> Path:
    return ANNOTATED_DIR / f"{swing_id}.mp4"


def thumbnail_path(swing_id: str) -> Path:
    return THUMBNAILS_DIR / f"{swing_id}.jpg"


def keypoints_path(swing_id: str) -> Path:
    return KEYPOINTS_DIR / f"{swing_id}.npz"


@contextmanager
def local_source_video(swing_id: str, ext: str):
    """Yields a local Path to the raw uploaded video. Downloads from S3 into
    a temp file first if cloud storage is configured (cv2/ffmpeg need a real
    file on disk); otherwise yields the local path directly, unchanged from
    today's behavior."""
    if blob.is_configured():
        fd, tmp_name = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        tmp_path = Path(tmp_name)
        blob.download(blob.video_key(swing_id, ext), tmp_path)
        try:
            yield tmp_path
        finally:
            tmp_path.unlink(missing_ok=True)
    else:
        yield video_path(swing_id, ext)


@contextmanager
def local_keypoints_for_read(swing_id: str):
    """Yields a local Path to the existing cached keypoints (.npz),
    downloading it first if cloud storage is configured. Used when
    re-rendering after a manual keyframe correction, where the pose data
    already exists from the original processing run."""
    if blob.is_configured():
        fd, tmp_name = tempfile.mkstemp(suffix=".npz")
        os.close(fd)
        tmp_path = Path(tmp_name)
        blob.download(blob.keypoints_key(swing_id), tmp_path)
        try:
            yield tmp_path
        finally:
            tmp_path.unlink(missing_ok=True)
    else:
        yield keypoints_path(swing_id)


@contextmanager
def local_output_paths(swing_id: str):
    """Yields local (annotated_path, thumbnail_path, keypoints_path) to write
    processing outputs to. On exit, uploads whichever of the three were
    actually written to S3 if cloud storage is configured (a keyframe-edit
    reprocess only writes two of the three); otherwise they're already at
    their final local location and no upload step is needed."""
    if blob.is_configured():
        tmp_dir = Path(tempfile.mkdtemp())
        annotated = tmp_dir / "annotated.mp4"
        thumbnail = tmp_dir / "thumbnail.jpg"
        keypoints = tmp_dir / "keypoints.npz"
        try:
            yield annotated, thumbnail, keypoints
            if annotated.exists():
                blob.upload(annotated, blob.annotated_key(swing_id))
            if thumbnail.exists():
                blob.upload(thumbnail, blob.thumbnail_key(swing_id))
            if keypoints.exists():
                blob.upload(keypoints, blob.keypoints_key(swing_id))
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
    else:
        yield annotated_path(swing_id), thumbnail_path(swing_id), keypoints_path(swing_id)


def init_db() -> None:
    with _engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS swings (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    video_ext TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'processing',
                    error_message TEXT,
                    is_reference INTEGER NOT NULL DEFAULT 0,
                    fps REAL,
                    frame_count INTEGER,
                    width INTEGER,
                    height INTEGER,
                    keyframes TEXT,
                    metrics TEXT
                )
                """
            )
        )


def create_swing(filename: str, video_ext: str) -> str:
    swing_id = uuid.uuid4().hex
    uploaded_at = datetime.now(timezone.utc).isoformat()
    with _engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO swings (id, filename, video_ext, uploaded_at, status) "
                "VALUES (:id, :filename, :video_ext, :uploaded_at, 'processing')"
            ),
            {"id": swing_id, "filename": filename, "video_ext": video_ext, "uploaded_at": uploaded_at},
        )
    return swing_id


def update_video_meta(swing_id: str, fps: float, frame_count: int, width: int, height: int) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE swings SET fps=:fps, frame_count=:frame_count, width=:width, height=:height "
                "WHERE id=:id"
            ),
            {"fps": fps, "frame_count": frame_count, "width": width, "height": height, "id": swing_id},
        )


def mark_done(swing_id: str, keyframes: dict, metrics: dict) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE swings SET status='done', keyframes=:keyframes, metrics=:metrics, "
                "error_message=NULL WHERE id=:id"
            ),
            {"keyframes": json.dumps(keyframes), "metrics": json.dumps(metrics), "id": swing_id},
        )


def mark_error(swing_id: str, message: str) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text("UPDATE swings SET status='error', error_message=:message WHERE id=:id"),
            {"message": message, "id": swing_id},
        )


def set_reference(swing_id: str, is_reference: bool) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text("UPDATE swings SET is_reference=:is_reference WHERE id=:id"),
            {"is_reference": 1 if is_reference else 0, "id": swing_id},
        )


def update_keyframes(swing_id: str, keyframes: dict) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text("UPDATE swings SET keyframes=:keyframes WHERE id=:id"),
            {"keyframes": json.dumps(keyframes), "id": swing_id},
        )


def update_metrics(swing_id: str, metrics: dict) -> None:
    with _engine.begin() as conn:
        conn.execute(
            text("UPDATE swings SET metrics=:metrics WHERE id=:id"),
            {"metrics": json.dumps(metrics), "id": swing_id},
        )


def _row_to_dict(row) -> dict:
    d = dict(row._mapping)
    d["is_reference"] = bool(d["is_reference"])
    d["keyframes"] = json.loads(d["keyframes"]) if d["keyframes"] else None
    d["metrics"] = json.loads(d["metrics"]) if d["metrics"] else None
    return d


def get_swing(swing_id: str) -> dict | None:
    with _engine.begin() as conn:
        row = conn.execute(text("SELECT * FROM swings WHERE id=:id"), {"id": swing_id}).fetchone()
        return _row_to_dict(row) if row else None


def list_swings() -> list[dict]:
    with _engine.begin() as conn:
        rows = conn.execute(text("SELECT * FROM swings ORDER BY uploaded_at DESC")).fetchall()
        return [_row_to_dict(r) for r in rows]


def delete_swing(swing_id: str) -> None:
    with _engine.begin() as conn:
        conn.execute(text("DELETE FROM swings WHERE id=:id"), {"id": swing_id})
    if blob.is_configured():
        blob.delete_swing_objects(swing_id)
    else:
        for candidate in DATA_DIR.rglob(f"{swing_id}.*"):
            candidate.unlink(missing_ok=True)
