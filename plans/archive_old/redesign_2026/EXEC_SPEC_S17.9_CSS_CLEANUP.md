# EXEC SPEC — Sprint 17.9 CSS Cleanup (Revised)

> **DEVFLOW Planning Output**
> Mode: Planning
> Sprint: S17.9 — Token & CSS Cleanup (Scope Revised)
> Date: 2026-04-09
> Supersedes: Section "Sprint 17.9" in WAVE_17_ROLLOUT_LEGACY_CLEANUP.md
>
> **Why revised?** Audit revealed original spec underestimated neon token scope.
> 250 references to `--neon-*` spread across 39 active CSS files — far beyond
> "remove a block from tokens.css". Splitting into S17.9 (file cleanup) + S17.9.5 (neon migration).

---

## Audit Summary (2026-04-09)

### `.redesign.css` files status

| File | Active Imports | Action |
|------|---------------|--------|
| `src/shared/styles/tokens.redesign.css` | **0** (not imported) | Delete |
| `src/shared/styles/layout.redesign.css` | `src/shared/styles/index.css:44` | Rename → `layout.css` |
| `src/shared/styles/components.redesign.css` | `src/shared/styles/index.css:45` | Rename → `components.css` |

### Neon token scope

- **250 references** to `--neon-*` / `--accent-primary` / `--accent-error` / `--accent-secondary`
- **39 CSS files** affected (active component files, not just tokens.css)
- This is NOT a 1-hour cleanup — it's a full migration sprint on its own → **S17.9.5**

### Orphaned CSS in `src/views/` (no corresponding `.jsx`)

| File | Orphan? | Action |
|------|---------|--------|
| `src/views/Emergency.css` | ✅ `Emergency.jsx` is in `src/views/redesign/` | Delete |
| `src/views/Calendar.module.css` | ✅ No `Calendar.jsx` in views/ | Delete |
| `src/views/LandingPrototype.css` | ✅ No `LandingPrototype.jsx` | Delete |
| `src/views/Settings.module.css` | ✅ `Settings.jsx` exists but not importing module | Delete (verify) |

### `src/shared/styles/index.css` state

- Lines 44–45: still importing `.redesign.css` files (will be fixed in this sprint)
- Line 495: `.gradient-text` uses `var(--neon-cyan)`, `var(--neon-magenta)` — remove in S17.9.5
- Lines 469–491: `.glow-*` utility classes using `var(--glow-*)` — review in S17.9.5

---

## S17.9 Scope — File Cleanup Only

**Objective:** Remove `.redesign` suffix from CSS files, delete orphans, clean imports.
**NOT IN SCOPE:** Neon token migration in component CSS files → S17.9.5

### Deliverables

#### 1. Rename `layout.redesign.css` → `layout.css`

```bash
# Verify content is not empty/stub
wc -l src/shared/styles/layout.redesign.css

# Rename
mv src/shared/styles/layout.redesign.css src/shared/styles/layout.css
```

Update import in `src/shared/styles/index.css`:
```css
/* Line 44 — change: */
@import './layout.redesign.css';   /* REMOVE */
@import './layout.css';            /* ADD */
```

#### 2. Rename `components.redesign.css` → `components.css`

```bash
# Verify
wc -l src/shared/styles/components.redesign.css

# Rename
mv src/shared/styles/components.redesign.css src/shared/styles/components.css
```

Update import in `src/shared/styles/index.css`:
```css
/* Line 45 — change: */
@import './components.redesign.css';  /* REMOVE */
@import './components.css';           /* ADD */
```

#### 3. Delete `tokens.redesign.css` (no active imports)

```bash
# Pre-condition: confirm zero imports
grep -r "tokens.redesign" src/ --include="*.{js,jsx,css}"
# Expected: no output

rm src/shared/styles/tokens.redesign.css
```

#### 4. Delete orphaned CSS files in `src/views/`

Pre-condition: confirm no JSX imports them:
```bash
grep -r "Emergency.css\|Calendar.module.css\|LandingPrototype.css\|Settings.module.css" src/ --include="*.{js,jsx}"
```

If output is empty → delete:
```bash
rm src/views/Emergency.css
rm src/views/Calendar.module.css
rm src/views/LandingPrototype.css
```

`Settings.module.css` — verify separately:
```bash
grep -r "Settings.module" src/ --include="*.{js,jsx}"
# If no import → delete too
```

#### 5. Update `src/shared/styles/index.css` section header

After renaming, update the section comment (lines ~40–46):
```css
/* ============================================
   REDESIGN — Santuário Terapêutico
   Wave 17: Global tokens (W17.2), layout consolidation (W17.3), components (W17.4)
   ============================================ */
@import './tokens/sanctuary.css';
@import './layout.css';         /* renamed from layout.redesign.css in S17.9 */
@import './components.css';     /* renamed from components.redesign.css in S17.9 */
```

---

## Acceptance Criteria

- [ ] `tokens.redesign.css` deleted (was unused)
- [ ] `layout.redesign.css` renamed to `layout.css`, import in index.css updated
- [ ] `components.redesign.css` renamed to `components.css`, import in index.css updated
- [ ] `src/views/Emergency.css` deleted (orphaned)
- [ ] `src/views/Calendar.module.css` deleted (orphaned)
- [ ] `src/views/LandingPrototype.css` deleted (orphaned)
- [ ] `Settings.module.css` evaluated and deleted if no imports found
- [ ] `npm run build` passes (zero errors, zero warnings)
- [ ] `npm run validate:agent` passes (543+ tests)
- [ ] `grep -r "redesign.css" src/` returns zero results

---

## Quality Gates (C4)

```bash
# Mandatory after every deletion/rename
npm run build

# After all changes
npm run validate:agent

# Verification grep — must return zero
grep -r "layout.redesign\|components.redesign\|tokens.redesign" src/
grep -r "Emergency.css\|LandingPrototype.css" src/ --include="*.{js,jsx}"
```

---

## Risk Flags

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| `components.redesign.css` has styles not covered elsewhere | LOW | Build passes even now (already global scope since S17.4) |
| Orphaned CSS has no imports but is used via class names | VERY LOW | Grep confirms no jsx imports |
| Settings.module.css is imported somewhere not found by grep | LOW | Check before delete |

---

## Deferred: S17.9.5 — Neon Token Migration

**Reason:** Original spec said "remove neon block from tokens.css". Actual scope is 250
references across 39 active CSS files requiring per-token mapping.

### Token mapping strategy (for S17.9.5 spec)

| Neon token | Sanctuary replacement |
|------------|----------------------|
| `--neon-cyan` | `--color-primary` (#006a5e) |
| `--neon-blue` | `--color-secondary` (#005db6) |
| `--neon-pink` | `--color-error` |
| `--neon-green` | `--color-success` |
| `--neon-magenta` | `--color-accent` |
| `--neon-purple` | `--color-secondary` |
| `--neon-yellow` | `--color-warning` |
| `--accent-primary` | `--color-primary` |
| `--accent-secondary` | `--color-secondary` |
| `--accent-error` | `--color-error` |
| `--accent-success` | `--color-success` |

### Files with highest neon density (S17.9.5 priority order)

1. `src/shared/styles/index.css` — `.gradient-text`, `.glow-*` classes
2. `src/shared/styles/tokens.css` — source of `--neon-*` definitions
3. `src/features/dashboard/components/SmartAlerts.css` — 4 references
4. `src/features/dashboard/components/InsightCard.css` — 3 references
5. `src/features/dashboard/components/SwipeRegisterItem.css` — 3 references
6. `src/features/adherence/components/AdherenceWidget.css` — 5 references
7. `src/features/medications/components/MedicineForm.css` — 5 references
8. All remaining 32 files

**Estimated S17.9.5 effort:** Medium sprint (1–2 hours). Not blocking S17.10.

---

## Implementation Notes

- **Order:** Always rename before deleting (R-001)
- **Build after each step:** Don't batch all deletions (R-003)
- No contracts touched (CSS-only changes)
- No ADRs required (cleanup within ADR-001 / ADR-008 scope)
