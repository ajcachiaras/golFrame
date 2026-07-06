from pathlib import Path

import numpy as np

_EMPTY = np.zeros((0, 2))


def save_swing_data(
    path: Path,
    xy: np.ndarray,
    conf: np.ndarray,
    fps: float,
    M: np.ndarray,
    out_width: int,
    out_height: int,
    trim_start: int,
    club_xy: np.ndarray | None = None,
) -> None:
    """Cache the final normalized, trim-relative pose/club data plus enough
    of the normalization transform to re-render (or recompute metrics) after
    a manual keyframe correction without re-running pose or club inference."""
    np.savez(
        path,
        xy=xy,
        conf=conf,
        fps=fps,
        M=M,
        out_width=out_width,
        out_height=out_height,
        trim_start=trim_start,
        club_xy=club_xy if club_xy is not None else _EMPTY,
        has_club=club_xy is not None,
    )


def load_swing_data(path: Path) -> dict:
    with np.load(path) as data:
        has_club = bool(data["has_club"])
        return {
            "xy": data["xy"],
            "conf": data["conf"],
            "fps": float(data["fps"]),
            "M": data["M"],
            "out_width": int(data["out_width"]),
            "out_height": int(data["out_height"]),
            "trim_start": int(data["trim_start"]),
            "club_xy": data["club_xy"] if has_club else None,
        }
