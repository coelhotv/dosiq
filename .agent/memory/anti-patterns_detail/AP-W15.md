# AP-W15 — Initialize state with `useState(() => derivedHook())` assuming it will stay reactive

**Category:** Ui
**Status:** active
**Related Rule:** R-107
**Applies To:** all

## Problem

State is stale if derived value changes after mount (e.g., `defaultViewMode` after complexity change)

## Prevention

Add `useEffect(() => { if (!savedPref) setState(derived) }, [derived])`
