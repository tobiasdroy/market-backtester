#!/usr/bin/env python3
"""Orchestrates the full offline data pipeline: fetch -> splice -> write
public/data/*.json (+ metadata.json documenting every splice point).
Re-run whenever you want to refresh the bundled historical data.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from common import to_monthly_returns
from process.build_bonds import build_bonds
from process.build_cash import build_cash
from process.build_inflation import build_inflation
from process.build_stocks import build_stocks

PUBLIC_DATA_DIR = Path(__file__).parent.parent / "public" / "data"

PIPELINE_VERSION = "1.0.0"

# Static documentation (url + note) per source. Deliberately does NOT
# hardcode "from"/"to" dates - several sources (MSCI's free tier, ONS/FRED/
# BoE's modern series) genuinely shift which months they cover between
# runs, so splice date ranges are computed from the actual data in
# _compute_splices() instead of asserted here.
SOURCE_DOCS = {
    "SHILLER_SP500": {
        "url": "https://shillerdata.com",
        "note": (
            "Robert Shiller's monthly S&P 500 dataset (nominal, dividends "
            "reinvested), USD, converted to GBP via monthly FX. Used as "
            "the developed-market equity proxy before genuinely global "
            "index data is available from MSCI_WORLD_GRTR. Overlaps it by "
            "one month so that month's real Shiller-implied return is "
            "preserved at the join rather than reset to zero."
        ),
    },
    "MSCI_WORLD_GRTR": {
        "url": "https://www.msci.com/end-of-day-data-search",
        "note": (
            "MSCI World Index, Gross Total Return (dividends reinvested, "
            "pre-withholding-tax), USD, converted to GBP via monthly FX. "
            "Genuinely globally diversified developed-market equities, via "
            "MSCI's free index data service - which serves a shifting "
            "trailing window from today rather than a fixed start date, so "
            "how far back this segment reaches will vary between runs."
        ),
    },
    "BOE_CONSOLS_YIELD_APPROX": {
        "url": "https://www.bankofengland.co.uk/statistics/research-datasets",
        "note": (
            "UK Consols (irredeemable government perpetuity) yield from "
            "the BoE Millennium dataset, converted to a total return via "
            "the exact perpetuity price/yield relationship plus income "
            "accrual. Single-market (UK) proxy for developed-market "
            "government bonds."
        ),
    },
    "FRED_UK10Y_YIELD_APPROX": {
        "url": "https://fred.stlouisfed.org/series/IRLTLT01GBM156N",
        "note": (
            "UK 10-year government bond yield (FRED/OECD), converted to a "
            "total return via a standard assumed-duration (7-year) "
            "approximation."
        ),
    },
    "ETF_IGLH_GBP_HEDGED": {
        "url": "https://www.ishares.com",
        "note": (
            "iShares Global Government Bond UCITS ETF, GBP Hedged "
            "(IGLH.L), dividend-adjusted close. Genuinely globally "
            "diversified government bonds, currency-hedged so no FX "
            "conversion is needed (or introduced)."
        ),
    },
    "BOE_MILLENNIUM_BANK_RATE": {
        "url": "https://www.bankofengland.co.uk/statistics/research-datasets",
        "note": "Bank of England Official Bank Rate, from the Millennium dataset.",
    },
    "BOE_MODERN_BANK_RATE": {
        "url": "https://www.bankofengland.co.uk/boeapps/database/",
        "note": "Bank of England Official Bank Rate (series IUMABEDR), modern era.",
    },
    "BOE_MILLENNIUM_ANNUAL_CPI": {
        "url": "https://www.bankofengland.co.uk/statistics/research-datasets",
        "note": (
            "BoE Millennium dataset's long-run annual UK CPI (preferred "
            "measure), interpolated to monthly via a flat compounded "
            "monthly rate (not a lump annual jump)."
        ),
    },
    "BOE_MILLENNIUM_MONTHLY_CPI": {
        "url": "https://www.bankofengland.co.uk/statistics/research-datasets",
        "note": "BoE Millennium dataset's spliced monthly UK CPI series.",
    },
    "ONS_CPI_D7BT": {
        "url": "https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7bt/mm23",
        "note": "Official ONS UK CPI (All Items Index), modern era.",
    },
}


def _compute_splices(df: pd.DataFrame) -> list[dict]:
    """Groups consecutive same-source rows into splice entries with their
    actual from/to dates, so metadata.json always reflects what the data
    really contains rather than an assumption baked in at write time."""
    df = df.sort_values("date").reset_index(drop=True)
    block_id = (df["source"] != df["source"].shift()).cumsum()
    splices = []
    for _, block in df.groupby(block_id):
        source = block["source"].iloc[0]
        docs = SOURCE_DOCS[source]
        splices.append(
            {
                "from": block["date"].min().strftime("%Y-%m"),
                "to": block["date"].max().strftime("%Y-%m"),
                "source": source,
                "url": docs["url"],
                "note": docs["note"],
            }
        )
    return splices

CURRENCY_ASSUMPTIONS = {
    "stocks": "unhedged - spot FX converted to GBP each month",
    "bonds": "GBP-hedged (pre-2018 legs are already GBP-denominated by construction)",
    "cash": "GBP",
    "inflation": "GBP (UK CPI)",
}


def _write_return_series(name: str, df: pd.DataFrame) -> None:
    df = df.sort_values("date").reset_index(drop=True)
    monthly_return = to_monthly_returns(df.set_index("date")["level"]).values
    records = []
    for i, row in df.iterrows():
        record = {
            "date": row["date"].strftime("%Y-%m-01"),
            "totalReturnIndex": round(float(row["level"]), 6),
            "monthlyReturn": round(float(monthly_return[i]), 8),
            "source": row["source"],
            "isInterpolated": bool(row["isInterpolated"]),
        }
        if row["isSpliceStart"]:
            record["isSpliceStart"] = True
        records.append(record)
    out_path = PUBLIC_DATA_DIR / f"{name}.json"
    out_path.write_text(json.dumps(records, indent=2))
    print(f"wrote {out_path} ({len(records)} rows, {df['date'].min().date()} to {df['date'].max().date()})")


def _write_inflation_series(df: pd.DataFrame) -> None:
    df = df.sort_values("date").reset_index(drop=True)
    records = []
    for _, row in df.iterrows():
        record = {
            "date": row["date"].strftime("%Y-%m-01"),
            "cpiIndex": round(float(row["level"]), 6),
            "source": row["source"],
            "isInterpolated": bool(row["isInterpolated"]),
        }
        if row["isSpliceStart"]:
            record["isSpliceStart"] = True
        records.append(record)
    out_path = PUBLIC_DATA_DIR / "inflation.json"
    out_path.write_text(json.dumps(records, indent=2))
    print(f"wrote {out_path} ({len(records)} rows, {df['date'].min().date()} to {df['date'].max().date()})")


def _write_metadata(dfs: dict[str, pd.DataFrame]) -> None:
    metadata = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pipelineVersion": PIPELINE_VERSION,
        "series": {
            name: {
                "splices": _compute_splices(df),
                "earliestAvailable": df["date"].min().strftime("%Y-%m-01"),
                "latestAvailable": df["date"].max().strftime("%Y-%m-01"),
                "currencyAssumption": CURRENCY_ASSUMPTIONS[name],
            }
            for name, df in dfs.items()
        },
    }
    out_path = PUBLIC_DATA_DIR / "metadata.json"
    out_path.write_text(json.dumps(metadata, indent=2))
    print(f"wrote {out_path}")


def main() -> None:
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("building stocks...")
    stocks = build_stocks()
    print("building bonds...")
    bonds = build_bonds()
    print("building cash...")
    cash = build_cash()
    print("building inflation...")
    inflation = build_inflation()

    _write_return_series("stocks", stocks)
    _write_return_series("bonds", bonds)
    _write_return_series("cash", cash)
    _write_inflation_series(inflation)

    _write_metadata(
        {"stocks": stocks, "bonds": bonds, "cash": cash, "inflation": inflation}
    )

    print("done.")


if __name__ == "__main__":
    main()
