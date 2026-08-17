"""Shared helpers for the data pipeline: month-timestamp utilities and
splicing/rebasing of index-level series from multiple sources into one
continuous, documented series."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
import requests

RAW_DIR = Path(__file__).parent / "raw"

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    )
}


def download_cached(
    url: str, filename: str, headers: dict | None = None, retries: int = 3
) -> Path:
    """Download `url` to raw/`filename` unless already cached; return the path."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = RAW_DIR / filename
    if path.exists():
        return path

    effective_headers = BROWSER_HEADERS if headers is None else headers
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=effective_headers, timeout=60)
            resp.raise_for_status()
            path.write_bytes(resp.content)
            return path
        except requests.RequestException as exc:
            last_error = exc
    raise RuntimeError(f"failed to download {url} after {retries} attempts") from last_error


def month_start(year: int, month: int) -> pd.Timestamp:
    return pd.Timestamp(year=year, month=month, day=1)


@dataclass
class Segment:
    """One source's contribution to a spliced series.

    `series` holds index *levels* (not returns), indexed by month-start
    Timestamps, in the order they should be stitched together. Consecutive
    segments are rescaled so the level is continuous at the splice boundary
    (percentage changes within each segment are preserved exactly).
    """

    series: pd.Series
    source: str
    is_interpolated: bool = False


def splice_segments(segments: list[Segment]) -> pd.DataFrame:
    """Stitch segments into one continuous index-level series, rebased to
    100 at the first observation, with per-row source/interpolation/
    splice-start metadata for the app to display.
    """
    if not segments:
        raise ValueError("no segments to splice")

    rows: list[dict] = []
    running_scale = None
    prev_level_at_join = None

    for seg_idx, seg in enumerate(segments):
        s = seg.series.sort_index()
        if s.empty:
            continue

        if running_scale is None:
            # First segment: rebase so it starts at 100.
            running_scale = 100.0 / s.iloc[0]
        else:
            # Rescale this segment so its first point matches the level the
            # previous segment ended on (continuity of pct-change at the seam).
            running_scale = prev_level_at_join / s.iloc[0]

        scaled = s * running_scale

        for i, (date, level) in enumerate(scaled.items()):
            is_splice_start = seg_idx > 0 and i == 0
            rows.append(
                {
                    "date": date,
                    "level": level,
                    "source": seg.source,
                    "isInterpolated": seg.is_interpolated,
                    "isSpliceStart": is_splice_start,
                }
            )

        prev_level_at_join = scaled.iloc[-1]

    df = pd.DataFrame(rows).drop_duplicates(subset="date", keep="last")
    df = df.sort_values("date").reset_index(drop=True)
    return df


def annual_index_to_monthly(annual: pd.Series) -> pd.Series:
    """Convert an annual index-level series (indexed by year int) to a
    monthly index-level series using a flat compounded monthly rate per
    year (not a lump/step change), per PLAN.md's interpolation policy.
    Requires at least one prior year to establish the first year's growth
    rate; the first year in the input is used only as that anchor and is
    not itself emitted.
    """
    annual = annual.sort_index()
    years = list(annual.index)
    out: dict[pd.Timestamp, float] = {}

    for i in range(1, len(years)):
        y = years[i]
        prev_y = years[i - 1]
        if y != prev_y + 1:
            raise ValueError(f"non-contiguous annual series at {prev_y}->{y}")
        level_end = annual.loc[y]
        level_start = annual.loc[prev_y]
        annual_growth = level_end / level_start - 1.0
        monthly_rate = (1.0 + annual_growth) ** (1.0 / 12.0) - 1.0

        level = level_start
        for m in range(1, 13):
            level = level * (1.0 + monthly_rate)
            out[month_start(y, m)] = level

    return pd.Series(out).sort_index()


def to_monthly_returns(level: pd.Series) -> pd.Series:
    return level.sort_index().pct_change().fillna(0.0)
