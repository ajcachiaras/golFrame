import os
from pathlib import Path

import boto3

BUCKET_ENV = "S3_BUCKET_NAME"
REGION_ENV = "AWS_REGION"

_client = None


def is_configured() -> bool:
    return bool(os.environ.get(BUCKET_ENV))


def _bucket_name() -> str:
    bucket = os.environ.get(BUCKET_ENV)
    if not bucket:
        raise RuntimeError(f"{BUCKET_ENV} is not set — cloud storage is not configured")
    return bucket


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client("s3", region_name=os.environ.get(REGION_ENV))
    return _client


def video_key(swing_id: str, ext: str) -> str:
    return f"videos/{swing_id}{ext}"


def annotated_key(swing_id: str) -> str:
    return f"annotated/{swing_id}.mp4"


def thumbnail_key(swing_id: str) -> str:
    return f"thumbnails/{swing_id}.jpg"


def keypoints_key(swing_id: str) -> str:
    return f"keypoints/{swing_id}.npz"


def upload(local_path: Path, key: str) -> None:
    _get_client().upload_file(str(local_path), _bucket_name(), key)


def download(key: str, local_path: Path) -> None:
    _get_client().download_file(_bucket_name(), key, str(local_path))


def exists(key: str) -> bool:
    client = _get_client()
    try:
        client.head_object(Bucket=_bucket_name(), Key=key)
        return True
    except client.exceptions.ClientError:
        return False


def presigned_url(key: str, expires: int = 3600) -> str:
    return _get_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": _bucket_name(), "Key": key},
        ExpiresIn=expires,
    )


def delete_swing_objects(swing_id: str) -> None:
    """Delete every object belonging to a swing across all four key
    prefixes (video extension varies, so this is a prefix match rather
    than a single known key)."""
    client = _get_client()
    bucket = _bucket_name()
    for prefix in (
        f"videos/{swing_id}",
        f"annotated/{swing_id}",
        f"thumbnails/{swing_id}",
        f"keypoints/{swing_id}",
    ):
        resp = client.list_objects_v2(Bucket=bucket, Prefix=prefix)
        for obj in resp.get("Contents", []):
            client.delete_object(Bucket=bucket, Key=obj["Key"])
