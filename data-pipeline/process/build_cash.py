"""GBP cash, monthly total-return index, from the Bank of England Official
Bank Rate (a standard proxy for cash/money-market returns).

Splice: BoE Millennium Bank Rate (1871-2017-01, monthly average) -> modern
BoE Bank Rate (IUMABEDR, 2017-02-present).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import Segment, splice_segments  # noqa: E402
from fetch.fetch_boe_bankrate import fetch_boe_bank_rate_modern  # noqa: E402
from fetch.fetch_boe_millennium import fetch_boe_m1_bank_rate_pct  # noqa: E402

START = pd.Timestamp("1871-01-01")


def _bank_rate_to_total_return_index(rate_pct: pd.Series) -> pd.Series:
    monthly_rate = (1.0 + rate_pct / 100.0) ** (1.0 / 12.0) - 1.0
    level = (1.0 + monthly_rate).cumprod() * 100.0
    return level


def build_cash() -> pd.DataFrame:
    boe_rate = fetch_boe_m1_bank_rate_pct()
    boe_rate = boe_rate[boe_rate.index >= START]
    boe_end = boe_rate.index.max()
    boe_level = _bank_rate_to_total_return_index(boe_rate)

    modern_rate = fetch_boe_bank_rate_modern()
    # Include boe_end itself: both sources cover it, giving a real overlap
    # month at the join instead of an artificial zero-return seam.
    modern_rate = modern_rate[modern_rate.index >= boe_end]
    modern_level = _bank_rate_to_total_return_index(modern_rate)

    segments = [
        Segment(boe_level, source="BOE_MILLENNIUM_BANK_RATE", is_interpolated=False),
        Segment(modern_level, source="BOE_MODERN_BANK_RATE", is_interpolated=False),
    ]
    return splice_segments(segments)
