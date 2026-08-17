"""Unified USD-per-GBP monthly FX series: BoE Millennium (1791-2017-01)
directly continued by FRED DEXUSUK (2017-02+, resampled to monthly).
Rates are concatenated as-is (not rescaled) since both report the same
real-world market rate, just from different data providers.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from fetch.fetch_boe_millennium import fetch_boe_m1_fx_usd_per_gbp  # noqa: E402
from fetch.fetch_fred import fetch_fred_gbpusd_daily  # noqa: E402


def build_fx_usd_per_gbp_monthly() -> pd.Series:
    boe_fx = fetch_boe_m1_fx_usd_per_gbp()

    fred_daily = fetch_fred_gbpusd_daily()
    fred_monthly = fred_daily.resample("ME").last()
    fred_monthly.index = fred_monthly.index.to_period("M").to_timestamp()

    boe_end = boe_fx.index.max()
    fred_tail = fred_monthly[fred_monthly.index > boe_end]

    return pd.concat([boe_fx, fred_tail]).sort_index()
