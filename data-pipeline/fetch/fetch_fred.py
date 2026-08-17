"""FRED (Federal Reserve Bank of St. Louis) free CSV series: GBP/USD spot
FX (for the modern tail beyond the BoE Millennium dataset's Feb-2017 end)
and UK 10-year government bond yield (bridges 1960 to the modern bond ETF
era, beyond the Millennium dataset's Consols yield).
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import fetch_fresh  # noqa: E402

FRED_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"


def _fetch_fred_series(series_id: str) -> pd.Series:
    # FRED appears to stall specifically on requests carrying a spoofed
    # browser User-Agent (needed for BoE, unwanted here) - use plain headers.
    raw = fetch_fresh(FRED_CSV.format(series_id=series_id), headers={})
    df = pd.read_csv(io.BytesIO(raw))
    df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"])
    df = df[df["value"] != "."]
    df["value"] = df["value"].astype(float)
    return df.set_index("date")["value"].sort_index()


def fetch_fred_gbpusd_daily() -> pd.Series:
    """USD per GBP, daily, from 1971 (FRED series DEXUSUK)."""
    return _fetch_fred_series("DEXUSUK")


def fetch_fred_uk_10y_yield_monthly() -> pd.Series:
    """UK long-term (10Y) government bond yield, % pa, monthly, from 1960
    (FRED series IRLTLT01GBM156N, OECD Main Economic Indicators)."""
    return _fetch_fred_series("IRLTLT01GBM156N")
