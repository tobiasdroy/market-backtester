"""Robert Shiller's monthly S&P 500 dataset (Yale), free, monthly since
1871. Used as the long-run developed-market equity proxy before global
index/ETF data is available.

Source: https://shillerdata.com (ie_data.xls)
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
import xlrd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import download_cached, month_start  # noqa: E402

SHILLER_URL = (
    "https://img1.wsimg.com/blobby/go/e5e77e0b-59d1-44d9-ab25-4763ac982e53"
    "/downloads/ie_data.xls"
)


def fetch_shiller_nominal_sp500_tr_usd() -> pd.Series:
    """Nominal USD S&P 500 total-return index, monthly, from 1871.

    Shiller's sheet only publishes a *real* (US-CPI-deflated) total return
    column ("Real Total Return Price"). We reconstruct the nominal series
    by re-inflating it with Shiller's own US CPI column, so the whole
    reconstruction is internally consistent (same source for both legs):
    nominal(t) is proportional to real(t) * US_CPI(t).
    """
    path = download_cached(SHILLER_URL, "shiller_ie_data.xls")
    wb = xlrd.open_workbook(str(path))
    ws = wb.sheet_by_name("Data")

    dates: list[pd.Timestamp] = []
    real_tr: list[float] = []
    us_cpi: list[float] = []

    for r in range(8, ws.nrows):
        row = ws.row_values(r)
        raw_date = row[0]
        if not isinstance(raw_date, float):
            continue
        year = int(raw_date)
        month = round(raw_date * 100) % 100
        if month < 1 or month > 12:
            continue
        real_total_return_price = row[9]
        cpi = row[4]
        if not isinstance(real_total_return_price, (int, float)) or not isinstance(
            cpi, (int, float)
        ):
            continue
        dates.append(month_start(year, month))
        real_tr.append(float(real_total_return_price))
        us_cpi.append(float(cpi))

    real_tr_s = pd.Series(real_tr, index=pd.DatetimeIndex(dates))
    us_cpi_s = pd.Series(us_cpi, index=pd.DatetimeIndex(dates))
    nominal = real_tr_s * us_cpi_s
    return nominal.sort_index()
