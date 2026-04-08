# AP-W01 — Edit a file referenced in spec without verifying the actual path first

**Category:** Ui
**Status:** active
**Related Rule:** R-092
**Applies To:** all

## Problem

Edit goes to wrong file; bug remains; spec can have stale paths

## Prevention

Always `find src -name "*File*" -type f` before editing any spec-referenced file
