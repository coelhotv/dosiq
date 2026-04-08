# AP-P01 — IntersectionObserver sentinel positioned before fold + rootMargin high

**Category:** Performance
**Status:** active
**Related Rule:** R-115
**Applies To:** all

## Problem

`rootMargin: '200px'` + sentinel mid-JSX = observer fires immediately on view open → lazy load becomes eager load

## Prevention

Position sentinel AFTER all visible content (end of JSX); reduce `rootMargin` to `<= 50px`
