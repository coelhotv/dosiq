# AP-W23 — Destructuring Wrong Property Name from Hook (Wave 7 Treatments — 2026-03-25)

**Category:** Ui
**Status:** active
**Related Rule:** R-134
**Applies To:** all

## Problem



## Prevention




**Anti-Pattern:** Destructuring `const { isComplex } = useComplexityMode()` when the hook returns `mode` (not `isComplex`).

**Why it fails:**
- `isComplex` will always be `undefined`
- Ternary checks like `isComplex ? <Complex /> : <Simple />` always evaluate to false
- UI renders wrong variant (Simple instead of Complex for 7+ medicines)
- No runtime error — silent failure, discovered only in dev testing

**Real case (Wave 7 — 2026-03-25):**
```javascript
// ❌ WRONG
const { isComplex } = useComplexityMode()  // undefined!
const showComplex = isComplex ? <TreatmentsComplex /> : <TreatmentsSimple />
// Always renders Simple, even for 10 medicines (should be Complex)
```

**Corrected:**
```javascript
// ✅ CORRECT
const { mode } = useComplexityMode()
const isComplex = mode === 'complex'
const showComplex = isComplex ? <TreatmentsComplex /> : <TreatmentsSimple />
```

**Hook return values (for reference):**
```javascript
useComplexityMode() returns {
  mode,                    // 'simple' | 'moderate' | 'complex'
  medicineCount,           // number
  overrideMode,            // string | null
  setOverride,             // function
  ringGaugeSize,           // derived: 'large' | 'medium' | 'compact'
  defaultViewMode,         // derived: 'plan' | 'time'
  // NOTE: does NOT return isComplex
}
```

**Prevention:**
- Always read the hook's return type comment or JSDoc before destructuring
- Don't guess property names — inspect the actual hook file
- If destructuring `x` from a hook, verify `x` exists in the return statement
- Test the feature with the expected condition (7+ medicines) — visual inspection catches this immediately

**Related:** This bug only manifested in TreatmentsRedesign (Wave 7). DashboardRedesign correctly uses `const { mode: complexityMode }` — no issues there. Inconsistency in usage patterns across the codebase suggests this is an easy mistake for new agents to make.

---
