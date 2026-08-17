"""MSCI World Index, Gross Total Return, USD - free via MSCI's
(undocumented, no-auth) index data service. Genuinely globally
diversified developed-market equities.

`index_variant=GRTR` matters: `STRD` is MSCI's price-only variant (no
dividends) and `NETR` deducts withholding tax - `GRTR` (dividends
reinvested gross) is the standard total-return index and the one
comparable to Shiller's dividend-reinvested S&P 500 series at the splice.

The free endpoint's *documented* floor is 1997-01 (`start_date` earlier
than that is rejected), but empirically the data it actually serves is
further capped to a shorter trailing window from today (observed: ~26
years, i.e. currently starting around 2000-2001, despite requesting
1997-01) - and that window shifts forward as time passes. Treat
whatever this returns as the discovered start of MSCI coverage rather
than assuming 1997-01; build_stocks.py splices Shiller up through
whatever month this actually starts at.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import pandas as pd
import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import BROWSER_HEADERS, month_start  # noqa: E402

MSCI_WORLD_INDEX_CODE = "990100"
MSCI_URL = (
    "https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph"
    "?index_variant=GRTR&start_date=19970101&end_date={end_date}"
    "&data_frequency=END_OF_MONTH&index_codes={index_code}&currency_symbol=USD"
)


def fetch_msci_world_grtr_usd() -> pd.Series:
    end_date = date.today().strftime("%Y%m%d")
    url = MSCI_URL.format(end_date=end_date, index_code=MSCI_WORLD_INDEX_CODE)
    resp = requests.get(url, headers=BROWSER_HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if "indexes" not in data:
        raise RuntimeError(f"unexpected MSCI response: {data}")

    out: dict[pd.Timestamp, float] = {}
    for row in data["indexes"]["INDEX_LEVELS"]:
        calc_date = str(row["calc_date"])
        year, month = int(calc_date[:4]), int(calc_date[4:6])
        out[month_start(year, month)] = float(row["level_eod"])
    return pd.Series(out).sort_index()
