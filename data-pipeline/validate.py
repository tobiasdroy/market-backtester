#!/usr/bin/env python3
"""Validates public/data/*.json: continuity (no gaps, monotonic dates) and
plausibility against known published long-run benchmarks. Warnings are
printed, not hard failures, but a large deviation usually means a
splice/rebasing bug.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

PUBLIC_DATA_DIR = Path(__file__).parent.parent / "public" / "data"

# (name, level_field, expected_nominal_cagr_range)
RETURN_SERIES = [
    ("stocks", "totalReturnIndex", (0.06, 0.13)),
    ("bonds", "totalReturnIndex", (0.02, 0.08)),
    ("cash", "totalReturnIndex", (0.02, 0.07)),
]

INFLATION_CAGR_RANGE = (0.02, 0.05)

warnings: list[str] = []
errors: list[str] = []


def _load(name: str) -> pd.DataFrame:
    path = PUBLIC_DATA_DIR / f"{name}.json"
    records = json.loads(path.read_text())
    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date").reset_index(drop=True)


def _check_continuity(name: str, df: pd.DataFrame) -> None:
    full_range = pd.date_range(df["date"].min(), df["date"].max(), freq="MS")
    missing = full_range.difference(df["date"])
    if len(missing) > 0:
        errors.append(f"{name}: {len(missing)} missing months, e.g. {list(missing[:5])}")
    if not df["date"].is_monotonic_increasing:
        errors.append(f"{name}: dates not monotonic increasing")
    dupes = df["date"].duplicated().sum()
    if dupes:
        errors.append(f"{name}: {dupes} duplicate dates")


def _cagr(df: pd.DataFrame, field: str) -> float:
    n_years = (df["date"].iloc[-1] - df["date"].iloc[0]).days / 365.25
    return (df[field].iloc[-1] / df[field].iloc[0]) ** (1 / n_years) - 1


def main() -> None:
    for name, field, (lo, hi) in RETURN_SERIES:
        df = _load(name)
        _check_continuity(name, df)
        cagr = _cagr(df, field)
        print(f"{name}: {df['date'].min().date()} to {df['date'].max().date()}, "
              f"{len(df)} rows, nominal CAGR {cagr:.2%}")
        if not (lo <= cagr <= hi):
            warnings.append(
                f"{name}: nominal CAGR {cagr:.2%} outside expected range "
                f"[{lo:.0%}, {hi:.0%}] - check for a splice/rebasing bug"
            )

    inflation = _load("inflation")
    _check_continuity("inflation", inflation)
    infl_cagr = _cagr(inflation, "cpiIndex")
    print(f"inflation: {inflation['date'].min().date()} to {inflation['date'].max().date()}, "
          f"{len(inflation)} rows, avg inflation {infl_cagr:.2%}")
    lo, hi = INFLATION_CAGR_RANGE
    if not (lo <= infl_cagr <= hi):
        warnings.append(
            f"inflation: avg inflation {infl_cagr:.2%} outside expected range "
            f"[{lo:.0%}, {hi:.0%}] - check for a splice/rebasing bug"
        )

    metadata_path = PUBLIC_DATA_DIR / "metadata.json"
    if not metadata_path.exists():
        errors.append("metadata.json missing")

    print()
    if warnings:
        print(f"{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  WARN: {w}")
    if errors:
        print(f"{len(errors)} error(s):")
        for e in errors:
            print(f"  ERROR: {e}")
        raise SystemExit(1)

    print("validation passed" + (" with warnings" if warnings else ""))


if __name__ == "__main__":
    main()
