# AP-P11 — `useCallback` with state in deps of a ref callback

**Category:** Performance
**Status:** active
**Related Rule:** R-120
**Applies To:** all

## Problem

Ref callbacks recreated on state change. React calls `old(null)` without cleanup → `new(element)` with new observer. 16ms window with two observers. Leads to duplicate event fires or race conditions

## Prevention

Ref callbacks ALWAYS deps `[]`. Use `useRef` for stateful flags that would need closure. Return value of ref callback is ignored (only useEffect cleanup runs)
