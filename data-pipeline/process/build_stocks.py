"""Global stocks, GBP, monthly total-return index.

Splice: Shiller S&P 500 (nominal, USD, dividends reinvested) up through
whatever month MSCI World's free data actually starts at (see
fetch_msci.py - MSCI's free tier serves a shifting trailing window, not a
fixed 1997-01 start, so this is discovered per run rather than assumed),
converted to GBP via the unified FX series; then MSCI World Gross Total
Return (genuinely globally diversified, dividends reinvested, USD) from
that month to present, also converted to GBP.

Modeled unhedged (spot FX conversion each month) - the assumption
documented in metadata.json.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import Segment, splice_segments  # noqa: E402
from fetch.fetch_msci import fetch_msci_world_grtr_usd  # noqa: E402
from fetch.fetch_shiller import fetch_shiller_nominal_sp500_tr_usd  # noqa: E402
from process.build_fx import build_fx_usd_per_gbp_monthly  # noqa: E402


def _usd_to_gbp(usd: pd.Series, fx_usd_per_gbp: pd.Series) -> pd.Series:
    fx = fx_usd_per_gbp.reindex(usd.index)
    return usd / fx


def build_stocks() -> pd.DataFrame:
    fx = build_fx_usd_per_gbp_monthly()

    msci_usd = fetch_msci_world_grtr_usd()
    splice_date: pd.Timestamp = msci_usd.index.min()

    shiller_usd = fetch_shiller_nominal_sp500_tr_usd()
    # Include the splice month itself so the two segments share one real
    # overlap month - that month's true return comes from Shiller/S&P 500
    # (MSCI has no data before its discovered start), and every return
    # from the next month onward is MSCI World's own.
    shiller_usd = shiller_usd[shiller_usd.index <= splice_date]
    shiller_gbp = _usd_to_gbp(shiller_usd, fx)
    msci_gbp = _usd_to_gbp(msci_usd, fx)

    segments = [
        Segment(shiller_gbp, source="SHILLER_SP500", is_interpolated=False),
        Segment(msci_gbp, source="MSCI_WORLD_GRTR", is_interpolated=False),
    ]
    return splice_segments(segments)
