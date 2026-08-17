"""Global bonds, GBP-hedged, monthly total-return index.

No free long-run "global government bond index" exists, so pre-2018 is
approximated from UK gilt/consol yields (a defensible single-market proxy
for developed-market government bonds, deliberately GBP so no FX step is
needed) via the standard yield -> total-return approximation:

  monthly total return ~= income accrual (prior month's yield / 12)
                           + price return from the yield change

For the Consols segment (irredeemable perpetuities) the price return has
an exact closed form (price is proportional to 1/yield); for the 10-year
gilt-yield segment we use an assumed modified duration of 7 years.

Splice: BoE Millennium Consols yield (1871-1959) -> FRED UK 10Y yield
(1960-2018-02) -> IGLH.L (iShares Global Govt Bond UCITS ETF, GBP Hedged)
2018-03-present, which is already GBP and needs no yield approximation.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import Segment, splice_segments  # noqa: E402
from fetch.fetch_boe_millennium import fetch_boe_m1_consols_yield_pct  # noqa: E402
from fetch.fetch_fred import fetch_fred_uk_10y_yield_monthly  # noqa: E402
from fetch.fetch_yfinance_etfs import fetch_iglh_monthly_gbp  # noqa: E402

CONSOLS_START = pd.Timestamp("1871-01-01")
# Each *_END is one month later than the next segment's *_START so the two
# share a real overlap month at the join (see build_stocks.py for why).
CONSOLS_END = pd.Timestamp("1960-01-01")
GILT10Y_START = pd.Timestamp("1960-01-01")
GILT10Y_END = pd.Timestamp("2018-03-01")
IGLH_START = pd.Timestamp("2018-03-01")

ASSUMED_10Y_DURATION = 7.0


def _perpetuity_total_return_index(yield_pct: pd.Series) -> pd.Series:
    """Exact for an irredeemable perpetuity: price is proportional to 1/yield."""
    y = yield_pct.sort_index()
    level = 100.0
    out = {y.index[0]: level}
    prev_yield = y.iloc[0]
    for date, cur_yield in y.iloc[1:].items():
        price_return = prev_yield / cur_yield - 1.0
        income = prev_yield / 100.0 / 12.0
        level *= 1.0 + price_return + income
        out[date] = level
        prev_yield = cur_yield
    return pd.Series(out).sort_index()


def _duration_approx_total_return_index(
    yield_pct: pd.Series, duration_years: float
) -> pd.Series:
    y = yield_pct.sort_index()
    level = 100.0
    out = {y.index[0]: level}
    prev_yield = y.iloc[0]
    for date, cur_yield in y.iloc[1:].items():
        delta_yield = (cur_yield - prev_yield) / 100.0
        price_return = -duration_years * delta_yield
        income = prev_yield / 100.0 / 12.0
        level *= 1.0 + price_return + income
        out[date] = level
        prev_yield = cur_yield
    return pd.Series(out).sort_index()


def build_bonds() -> pd.DataFrame:
    consols_yield = fetch_boe_m1_consols_yield_pct()
    # Lead in from before 1871 so the first in-range month already has a
    # prior-month yield to compute a real return from, then clip to range.
    consols_level = _perpetuity_total_return_index(consols_yield)
    consols_level = consols_level[
        (consols_level.index >= CONSOLS_START) & (consols_level.index <= CONSOLS_END)
    ]

    gilt10y_yield = fetch_fred_uk_10y_yield_monthly()
    gilt10y_yield = gilt10y_yield[
        (gilt10y_yield.index >= GILT10Y_START) & (gilt10y_yield.index <= GILT10Y_END)
    ]
    gilt10y_level = _duration_approx_total_return_index(
        gilt10y_yield, ASSUMED_10Y_DURATION
    )

    iglh = fetch_iglh_monthly_gbp()
    iglh = iglh[iglh.index >= IGLH_START]

    segments = [
        Segment(consols_level, source="BOE_CONSOLS_YIELD_APPROX", is_interpolated=False),
        Segment(gilt10y_level, source="FRED_UK10Y_YIELD_APPROX", is_interpolated=False),
        Segment(iglh, source="ETF_IGLH_GBP_HEDGED", is_interpolated=False),
    ]
    return splice_segments(segments)
