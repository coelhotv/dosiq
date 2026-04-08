# AP-W03 — Use `screen.getByText('X%')` when the same text appears in multiple elements

**Category:** Ui
**Status:** active
**Related Rule:** R-094
**Applies To:** all

## Problem

`"Found multiple elements with text…"` test failure

## Prevention

Use `container.querySelector('.specific-class').textContent` for non-unique text
