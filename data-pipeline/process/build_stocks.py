"""Global stocks, GBP, monthly total-return index.

Splice: Shiller S&P 500 (nominal, USD, dividends reinvested) 1871-2008-02
converted to GBP via the unified FX series, then the ACWI ETF (globally
diversified, dividends reinvested) 2008-03-present, also converted to GBP.

Modeled unhedged (spot FX conversion each month) - the assumption
documented in metadata.json.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import Segment, splice_segments  # noqa: E402
from fetch.fetch_shiller import fetch_shiller_nominal_sp500_tr_usd  # noqa: E402
from fetch.fetch_yfinance_etfs import fetch_acwi_monthly_usd  # noqa: E402
from process.build_fx import build_fx_usd_per_gbp_monthly  # noqa: E402

SPLICE_DATE = pd.Timestamp("2008-03-01")  # ACWI's first available month


def _usd_to_gbp(usd: pd.Series, fx_usd_per_gbp: pd.Series) -> pd.Series:
    fx = fx_usd_per_gbp.reindex(usd.index)
    return usd / fx


def build_stocks() -> pd.DataFrame:
    fx = build_fx_usd_per_gbp_monthly()

    shiller_usd = fetch_shiller_nominal_sp500_tr_usd()
    # Include the splice month itself (Shiller has data well past 2008) so
    # the two segments share one real overlap month - the true Feb->Mar
    # 2008 return comes from Shiller/S&P 500 (ACWI didn't exist yet), and
    # every return from Apr 2008 onward is ACWI's own.
    shiller_usd = shiller_usd[shiller_usd.index <= SPLICE_DATE]
    shiller_gbp = _usd_to_gbp(shiller_usd, fx)

    acwi_usd = fetch_acwi_monthly_usd()
    acwi_usd = acwi_usd[acwi_usd.index >= SPLICE_DATE]
    acwi_gbp = _usd_to_gbp(acwi_usd, fx)

    segments = [
        Segment(shiller_gbp, source="SHILLER_SP500", is_interpolated=False),
        Segment(acwi_gbp, source="ETF_ACWI", is_interpolated=False),
    ]
    return splice_segments(segments)
