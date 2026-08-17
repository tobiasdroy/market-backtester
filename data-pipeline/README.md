# Data pipeline

Offline pipeline that fetches, splices and validates historical market data,
then writes the static JSON files the app reads from `public/data/`. See
`../PLAN.md` §2 for the full source/splice plan.

## Setup

```bash
cd data-pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python build.py       # fetch -> splice -> validate -> write ../public/data/*.json
python validate.py    # re-run validation checks only
```

Raw downloads are cached in `raw/` (gitignored) so re-running `build.py`
doesn't re-hit external sources unless the cache is cleared.

## Status

Scaffolding only — `fetch/`, `process/`, `build.py` and `validate.py` are
implemented in Phase 1 (see `../PLAN.md`).
