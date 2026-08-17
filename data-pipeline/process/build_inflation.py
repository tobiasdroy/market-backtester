"""UK inflation (CPI), monthly index level.

Splice: BoE Millennium annual CPI (1871-1914, flat-compounded to monthly,
marked isInterpolated) -> BoE Millennium monthly spliced CPI (1914-07 to
1987-12) -> ONS CPI D7BT (1988-present).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import Segment, annual_index_to_monthly, splice_segments  # noqa: E402
from fetch.fetch_boe_millennium import (  # noqa: E402
    fetch_boe_a47_annual_cpi,
    fetch_boe_m1_cpi,
)
from fetch.fetch_ons import fetch_ons_cpi_monthly  # noqa: E402

ANNUAL_SEGMENT_START = pd.Timestamp("1871-01-01")
ANNUAL_SEGMENT_END = pd.Timestamp("1914-06-01")
MONTHLY_BOE_START = pd.Timestamp("1914-07-01")
# BoE's monthly CPI covers 1988-01 too (dataset runs to 2017), and that's
# ONS's first month - include it in both segments for a real overlap month
# at the join, rather than an artificial zero-return seam. The 1871/1914
# join has no such option: the annual-interpolated segment has no data
# point at 1914-07 to overlap with (see PLAN.md / metadata.json).
MONTHLY_BOE_END = pd.Timestamp("1988-01-01")
ONS_START = pd.Timestamp("1988-01-01")


def build_inflation() -> pd.DataFrame:
    annual_cpi = fetch_boe_a47_annual_cpi()
    # Include 1870 as the anchor year so 1871's growth rate is computable.
    annual_cpi = annual_cpi[(annual_cpi.index >= 1870) & (annual_cpi.index <= 1915)]
    annual_monthly = annual_index_to_monthly(annual_cpi)
    annual_monthly = annual_monthly[
        (annual_monthly.index >= ANNUAL_SEGMENT_START)
        & (annual_monthly.index <= ANNUAL_SEGMENT_END)
    ]

    boe_monthly_cpi = fetch_boe_m1_cpi()
    boe_monthly_cpi = boe_monthly_cpi[
        (boe_monthly_cpi.index >= MONTHLY_BOE_START)
        & (boe_monthly_cpi.index <= MONTHLY_BOE_END)
    ]

    ons_cpi = fetch_ons_cpi_monthly()
    ons_cpi = ons_cpi[ons_cpi.index >= ONS_START]

    segments = [
        Segment(annual_monthly, source="BOE_MILLENNIUM_ANNUAL_CPI", is_interpolated=True),
        Segment(boe_monthly_cpi, source="BOE_MILLENNIUM_MONTHLY_CPI", is_interpolated=False),
        Segment(ons_cpi, source="ONS_CPI_D7BT", is_interpolated=False),
    ]
    return splice_segments(segments)
