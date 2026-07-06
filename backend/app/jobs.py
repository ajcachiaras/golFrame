import threading
import traceback

from . import cache as cache_mod
from . import club as club_mod
from . import metrics as metrics_mod
from . import normalize as normalize_mod
from . import phases as phases_mod
from . import pose as pose_mod
from . import render as render_mod
from . import storage

PAD_SECONDS = 0.4


def process_swing(swing_id: str) -> None:
    try:
        swing = storage.get_swing(swing_id)
        if swing is None:
            return

        with storage.local_source_video(swing_id, swing["video_ext"]) as source_path, storage.local_output_paths(
            swing_id
        ) as (annotated_out, thumbnail_out, keypoints_out):
            raw = pose_mod.extract_keypoints(source_path)
            raw_xy, raw_conf = raw["xy"], raw["conf"]
            fps, raw_frame_count = raw["fps"], raw["frame_count"]
            raw_width, raw_height = raw["width"], raw["height"]

            prelim_keyframes = phases_mod.detect_keyframes(raw_xy, raw_conf)

            pad = max(1, int(round(fps * PAD_SECONDS)))
            trim_start = max(0, prelim_keyframes["address"] - pad)
            trim_end = min(raw_frame_count - 1, prelim_keyframes["finish"] + pad)
            trim_frame_count = trim_end - trim_start + 1

            keyframes = {name: idx - trim_start for name, idx in prelim_keyframes.items()}
            xy_trim = raw_xy[trim_start : trim_end + 1]
            conf_trim = raw_conf[trim_start : trim_end + 1]

            club_xy_trim = None
            club_conf_trim = None
            try:
                frame_iter = pose_mod.iter_frames(source_path, trim_start, trim_end)
                club_xy_raw, club_conf_trim = club_mod.detect_club_path(frame_iter, trim_frame_count)
                if club_mod.is_reliable(club_conf_trim):
                    club_xy_trim = club_mod.interpolate_gaps(club_xy_raw, club_conf_trim)
            except Exception:  # noqa: BLE001 - club tracking is best-effort, never fatal
                traceback.print_exc()
                club_xy_trim = None

            if club_xy_trim is not None:
                keyframes = phases_mod.refine_with_club_data(
                    keyframes, xy_trim, conf_trim, club_xy_trim, club_conf_trim
                )

            M, out_w, out_h = normalize_mod.compute_transform(
                xy_trim[keyframes["address"]], conf_trim[keyframes["address"]], raw_width, raw_height
            )
            xy_norm = normalize_mod.transform_points(xy_trim, M)
            club_xy_norm = (
                normalize_mod.transform_points(club_xy_trim, M) if club_xy_trim is not None else None
            )

            storage.update_video_meta(swing_id, fps, trim_frame_count, out_w, out_h)

            metrics = metrics_mod.compute_metrics(xy_norm, conf_trim, keyframes, fps, club_xy=club_xy_norm)

            cache_mod.save_swing_data(
                keypoints_out,
                xy=xy_norm,
                conf=conf_trim,
                fps=fps,
                M=M,
                out_width=out_w,
                out_height=out_h,
                trim_start=trim_start,
                club_xy=club_xy_norm,
            )

            render_mod.render_annotated_video(
                source_path,
                annotated_out,
                xy_norm,
                conf_trim,
                fps,
                keyframes,
                M,
                (out_w, out_h),
                trim_start,
                club_xy=club_xy_norm,
            )
            render_mod.save_thumbnail(
                source_path,
                thumbnail_out,
                xy_norm,
                conf_trim,
                keyframes["address"],
                M,
                (out_w, out_h),
                trim_start,
            )

        storage.mark_done(swing_id, keyframes, metrics)
    except Exception as exc:  # noqa: BLE001 - surface any processing failure to the UI
        traceback.print_exc()
        storage.mark_error(swing_id, str(exc))


def start_processing(swing_id: str) -> None:
    thread = threading.Thread(target=process_swing, args=(swing_id,), daemon=True)
    thread.start()


def reprocess_after_keyframe_edit(swing_id: str) -> dict:
    """Recompute metrics and re-render the annotated video/thumbnail from
    cached normalized pose/club data + the (already-updated) keyframes. Used
    after a manual keyframe correction so we don't have to re-run pose, club,
    or normalization inference."""
    swing = storage.get_swing(swing_id)
    if swing is None:
        raise ValueError("Swing not found")

    with storage.local_keypoints_for_read(swing_id) as keypoints_in:
        data = cache_mod.load_swing_data(keypoints_in)

    keyframes = swing["keyframes"]

    metrics = metrics_mod.compute_metrics(
        data["xy"], data["conf"], keyframes, data["fps"], club_xy=data["club_xy"]
    )
    storage.update_metrics(swing_id, metrics)

    with storage.local_source_video(swing_id, swing["video_ext"]) as source_path, storage.local_output_paths(
        swing_id
    ) as (annotated_out, thumbnail_out, _keypoints_out):
        out_size = (data["out_width"], data["out_height"])
        render_mod.render_annotated_video(
            source_path,
            annotated_out,
            data["xy"],
            data["conf"],
            data["fps"],
            keyframes,
            data["M"],
            out_size,
            data["trim_start"],
            club_xy=data["club_xy"],
        )
        render_mod.save_thumbnail(
            source_path,
            thumbnail_out,
            data["xy"],
            data["conf"],
            keyframes["address"],
            data["M"],
            out_size,
            data["trim_start"],
        )

    return metrics
