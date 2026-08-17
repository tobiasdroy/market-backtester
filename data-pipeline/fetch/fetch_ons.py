"""ONS UK CPI (All Items Index, D7BT/MM23), monthly, free, from 1988.
Used as the modern-era UK inflation source.
"""

from __future__ import annotations

import csv
import sys
from io import StringIO
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from common import fetch_fresh, month_start  # noqa: E402

ONS_CPI_URL = (
    "https://www.ons.gov.uk/generator?format=csv"
    "&uri=/economy/inflationandpriceindices/timeseries/d7bt/mm23"
)

MONTH_NUM = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}


def fetch_ons_cpi_monthly() -> pd.Series:
    text = fetch_fresh(ONS_CPI_URL).decode("utf-8")
    out: dict[pd.Timestamp, float] = {}
    for row in csv.reader(StringIO(text)):
        if len(row) != 2:
            continue
        label, value = row
        parts = label.split()
        if len(parts) != 2 or parts[1] not in MONTH_NUM:
            continue
        year = int(parts[0])
        month = MONTH_NUM[parts[1]]
        try:
            out[month_start(year, month)] = float(value)
        except ValueError:
            continue
    return pd.Series(out).sort_index()
