# AP-D02 — Cartesian product in LEFT JOIN logs ⨝ expected_doses without pre-aggregation

**Category:** Design
**Status:** active
**Related Rule:** R-122
**Applies To:** all

## Problem

12 logs × 10 protocols = 120 rows in intermediate result. `SUM(expected_count)` then sums duplicates (10×12=120 instead of 12).

## Prevention

Pre-aggregate expected_doses BEFORE joining logs. Create intermediate CTE that groups expected_doses by date; then LEFT JOIN logs to that CTE


**Problem:** When aggregating data by multiple states (active/paused/finished), developers compute groups/filters only for the primary state. When users switch to other states, data is missing or wrong.

**Impact:**
- Tab switching shows empty lists or stale data
- Grouped views show wrong grouping for non-primary states
- Feature works for 90% of users, fails silently for the 10% who use other tabs
- Bug discovered late in testing, not during development

**Real case (Wave 7 useTreatmentList — 2026-03-25):**
```javascript
// ❌ WRONG — groups computed only for activeItems
const activeItems = useMemo(() => items.filter(i => i.tabStatus === 'ativo'), [items])
const groups = useMemo(() => computeGroups(activeItems), [activeItems])
// When user switches to "pausados" tab: uses groups computed from activeItems! ❌

// ✅ CORRECT — groups computed per state
const activeItems = useMemo(() => items.filter(i => i.tabStatus === 'ativo'), [items])
const pausedItems = useMemo(() => items.filter(i => i.tabStatus === 'pausado'), [items])
const finishedItems = useMemo(() => items.filter(i => i.tabStatus === 'finalizado'), [items])

const activeGroups = useMemo(() => computeGroups(activeItems), [activeItems])
const pausedGroups = useMemo(() => computeGroups(pausedItems), [pausedItems])
const finishedGroups = useMemo(() => computeGroups(finishedItems), [finishedItems])

// Each tab gets its own groups
const currentGroups = { ativo: activeGroups, pausado: pausedGroups, finalizado: finishedGroups }[activeTab]
```

**Prevention:**
- Identify ALL states upfront (active/paused/finished, draft/published, etc.)
- Compute aggregations for EVERY state, even if some are rarely used
- Test all state tabs during development — don't just test the primary path
- Add comments showing the mapping: `{ ativo: activeGroups, pausado: pausedGroups, ...}`

**Related:** R-150 (Compute State-Specific Aggregations)

---

---
