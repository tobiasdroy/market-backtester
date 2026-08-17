"""Bank of England Interactive Statistical Database — modern Official
Bank Rate (series IUMABEDR), free, monthly, overlaps and extends past the
Millennium dataset's Jan-2017 end. Used as the modern-era cash proxy.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import download_cached  # noqa: E402

BANK_RATE_URL = (
    "https://www.bankofengland.co.uk/boeapps/database/_iadb-fromshowcolumns.asp"
    "?csv.x=1&Datefrom=01/Jan/2015&Dateto=now&SeriesCodes=IUMABEDR"
    "&CSVF=TN&UsingCodes=Y&VPD=Y&VFD=N"
)


def fetch_boe_bank_rate_modern() -> pd.Series:
    path = download_cached(BANK_RATE_URL, "boe_bank_rate_modern.csv")
    df = pd.read_csv(path)
    df.columns = ["date", "value"]
    df["date"] = pd.to_datetime(df["date"], format="%d %b %Y")
    df["month"] = df["date"].values.astype("datetime64[M]")
    monthly = df.groupby("month")["value"].last()
    monthly.index = pd.to_datetime(monthly.index)
    return monthly.sort_index()
