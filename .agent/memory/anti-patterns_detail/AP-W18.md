# AP-W18 — Copy component usage from existing code without inspecting the actual prop interface (e.g., LogForm usage from Dashboard.jsx)

**Category:** Ui
**Status:** active
**Related Rule:** R-133
**Applies To:** all

## Problem

TypeError at runtime: "Cannot read properties of undefined" when component tries to access props with wrong names. E.g., LogForm expects `protocols`, `treatmentPlans`, `initialValues`, `onSave`, `onCancel` but receives `prefillData`, `onSuccess`.

## Prevention

Always read the component's destructuring signature in the source code BEFORE copy-pasting usage. Verify all expected props are provided and named correctly. Match prop names exactly.
