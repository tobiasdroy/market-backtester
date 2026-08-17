"""Modern-era total-return proxy from a listed ETF, via yfinance.

IGLH.L (iShares Global Govt Bond UCITS ETF, GBP Hedged): globally
diversified government bonds, GBP, from 2018.

`auto_adjust=True` gives dividend/split-adjusted close, i.e. a genuine
total-return series.
"""

from __future__ import annotations

import pandas as pd
import yfinance as yf


def _monthly_close(ticker: str) -> pd.Series:
    """Last trading-day close of each month, relabeled to that month's
    start date for consistency with the rest of the pipeline's schema."""
    hist = yf.Ticker(ticker).history(period="max", auto_adjust=True)
    close = hist["Close"]
    close.index = close.index.tz_localize(None)
    monthly = close.resample("ME").last().dropna()
    monthly.index = monthly.index.to_period("M").to_timestamp()
    return monthly


def fetch_iglh_monthly_gbp() -> pd.Series:
    return _monthly_close("IGLH.L")
