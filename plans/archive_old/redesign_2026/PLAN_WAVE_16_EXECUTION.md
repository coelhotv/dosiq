# PLAN: Wave 16 Accessibility & Polish — Execution Order

**Gerado:** 2026-04-08 via DEVFLOW Planning  
**Spec Referência:** `plans/archive_old/redesign_2026/WAVE_16_ACCESSIBILITY_POLISH.md` (1094 linhas)  
**Status:** ✅ COMPLETE (PHASE 1+2 delivered, PR #448 merged)

---

## Executive Summary

Wave 16 é a wave de **compliance de acessibilidade** para Santuário Terapêutico (Waves 0-15 completas).  
**Goal:** Lighthouse Accessibility ≥ 95 + navegação completa via teclado/screen reader.

**Resultado final:** PR #448 mergeado em `main` em 2026-04-08.

**Escopo:**
- 1 arquivo criado (`useFocusTrap.js` hook)
- 12 arquivos editados (App, Modal, Forms, 3x Gauge/Sparkline/Swipe, Calendar, CSS)
- 9 sprints independentes/paralelos

**Artifacts modificados:** 13 (1 create + 12 edits)  
**Contracts tocados:** nenhum (aditivo apenas, sem breaking changes)  
**ADRs necessários:** ADR-001 (já accepted, feature flags)

---

## Execution Path (9 Independent Sprints)

### **PHASE 1: Critical Path (Serial)**

Estas sprints têm dependências e devem rodar em ordem:

#### 1.1 — **S15.1**: App-level Semantics
- ✏️ `src/App.jsx` — skip link JSX + `id="main-content"` + `useReducedMotion` hook
- ✏️ `src/shared/styles/index.css` — skip link CSS (`.skip-to-content`, `.sr-only`)
- **Time estimate:** 15 min  
- **Artifacts:** 2  
- **Verify:** Skip link visible on first Tab; main has id

#### 1.2 — **S15.2.1**: Create useFocusTrap Hook
- ✨ `src/shared/hooks/useFocusTrap.js` — extract from DailyDoseModal (lines 61-107)
- **Time estimate:** 10 min  
- **Artifacts:** 1  
- **Verify:** Hook exists, exported, no syntax errors

#### 1.3 — **S15.2.2-15.2.3**: Update Modal + DailyDoseModal
- ✏️ `src/features/dashboard/components/DailyDoseModal.jsx` — use shared hook
- ✏️ `src/shared/components/ui/Modal.jsx` — add ARIA (role, aria-modal, aria-labelledby, focus trap, Escape key)
- **Time estimate:** 20 min  
- **Artifacts:** 2  
- **Verify:** Modal has role="dialog", aria-modal="true", focus trap works, Escape closes

### **PHASE 2: Parallel Sprints (can run in parallel with PHASE 1)**

#### 2.1 — **S15.3**: Refactor window.matchMedia → useReducedMotion Hook
- ✏️ `src/features/dashboard/components/RingGaugeRedesign.jsx` — replace window.matchMedia
- ✏️ `src/features/dashboard/components/SparklineAdesao.jsx` — replace window.matchMedia
- ✏️ `src/features/dashboard/components/SwipeRegisterItem.jsx` — replace window.matchMedia
- **Time estimate:** 15 min  
- **Artifacts:** 3  
- **Verify:** grep for `window.matchMedia` returns 0 in these files

#### 2.2 — **S15.4**: Calendar ARIA Grid Pattern
- ✏️ `src/shared/components/ui/Calendar.jsx` — add role="grid", role="gridcell", aria-label per day
- **Time estimate:** 20 min  
- **Artifacts:** 1  
- **Verify:** DevTools shows grid roles; days have aria-label

#### 2.3 — **S15.5**: Forms aria-describedby
- ✏️ `src/features/medications/components/MedicineForm.jsx` — add aria-describedby to inputs
- ✏️ `src/features/protocols/components/ProtocolForm.jsx` — add aria-describedby to inputs
- ✏️ `src/features/stock/components/StockForm.jsx` — add aria-describedby to inputs
- **Time estimate:** 20 min  
- **Artifacts:** 3  
- **Verify:** Form errors announced by screen reader

#### 2.4 — **S15.6**: Touch Targets (min-height 44px)
- ✏️ `src/shared/styles/components.redesign.css` — ensure `.btn-sm` has min-height: 44px
- **Time estimate:** 5 min  
- **Artifacts:** 1  
- **Verify:** `grep -n "min-height: 44px" src/shared/styles/components.redesign.css`

#### 2.5 — **S15.7**: Color Contrast
- ✏️ `src/shared/styles/components.redesign.css` — verify placeholders, badge text, gradients ≥ 4.5:1 ratio
- **Time estimate:** 10 min (audit only, likely no changes needed)  
- **Artifacts:** 1 (possibly)  
- **Verify:** axe DevTools or Lighthouse Accessibility tab

#### 2.6 — **S15.8**: Focus Ring Audit
- 🔍 Verify all focusable elements have visible focus-visible styling
- 🔍 Verify tabIndex and role on interactive divs/cards
- **Time estimate:** 20 min (audit + spot fixes)  
- **Artifacts:** ~2-3 CSS tweaks  
- **Verify:** Manual keyboard navigation test

#### 2.7 — **S15.9**: Heading Hierarchy Audit
- 🔍 Verify each redesigned view has exactly 1 `<h1>` (page title) and no level-skips
- **Time estimate:** 15 min (audit only, minimal changes)  
- **Artifacts:** ~1-2 heading level fixes  
- **Verify:** `grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/*.jsx`

---

## Execution Order Summary

```
┌─ S15.1 (App, CSS)
├─ S15.2.1 (Hook create)
│  ├─ S15.2.2-3 (Modal use hook, add ARIA)
│
├─ [PARALLEL] S15.3 (window.matchMedia fixes)
├─ [PARALLEL] S15.4 (Calendar ARIA)
├─ [PARALLEL] S15.5 (Forms aria-describedby)
├─ [PARALLEL] S15.6 (Touch targets)
├─ [PARALLEL] S15.7 (Color contrast)
├─ [PARALLEL] S15.8 (Focus ring audit)
├─ [PARALLEL] S15.9 (Heading hierarchy)
│
└─ [VALIDATION] Lighthouse + keyboard/screen reader testing
```

---

## Pre-Execution Checklist

- [ ] S15.1 depends on `useReducedMotion` available in framer-motion ✓ (available)
- [ ] `useFocusTrap` logic matches DailyDoseModal implementation line-for-line
- [ ] All 13 target files exist and are on correct paths
- [ ] Redesign flag infrastructure (ADR-001) working (`?redesign=1` toggles design)
- [ ] No unmerged changes in target files

---

## Validation Gates

### Build & Lint
```bash
npm run validate:agent    # MUST pass (10-min timeout)
npm run build             # MUST complete without errors
```

### Quality Metrics (automatic)
- Lighthouse Accessibility score ≥ 95 with `?redesign=1`
- Performance score regression ≤ 5 points
- Zero console errors with `?redesign=1`

### Manual Testing (optional but recommended)
- **Keyboard:** Tab through entire page, verify skip link, modal focus trap, escape key
- **Screen reader (VoiceOver/NVDA):** Navigate page, verify headings, ARIA labels, form errors
- **Reduced motion:** Enable `prefers-reduced-motion: reduce` in System Preferences, verify animations disabled

---

## Artifacts Summary

| Type | Count | Files |
|------|-------|-------|
| Create | 1 | `useFocusTrap.js` |
| Edit (App-level) | 2 | `App.jsx`, `index.css` |
| Edit (Components) | 7 | `Modal.jsx`, `DailyDoseModal.jsx`, `RingGaugeRedesign.jsx`, `SparklineAdesao.jsx`, `SwipeRegisterItem.jsx`, `Calendar.jsx`, `components.redesign.css` |
| Edit (Forms) | 3 | `MedicineForm.jsx`, `ProtocolForm.jsx`, `StockForm.jsx` |
| **Total** | **13** | — |

---

## Next Session: Arquivo Histórico

Wave 16 já foi entregue. Use este plano como referência do caminho executado; o próximo trabalho de redesign agora pertence a W17 ou a novas waves.

---

## Known Constraints

- **Mobile Performance:** No regression expected (acessibilidade é semântica, não afeta bundle)
- **Contracts:** Nenhum contrato quebrado (nenhum método de API muda, apenas ARIA é aditiva)
- **Browser Support:** All ARIA features are standard; `useReducedMotion` from framer-motion is stable
- **Feature Flag:** Wave 16 rodou com `?redesign=1` (ADR-001 in effect); o status atual é histórico após merge

---

## Reference

- **Spec Completa:** `plans/backlog-redesign/WAVE_16_ACCESSIBILITY_POLISH.md`
- **WCAG 2.1 AA:** https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices Guide:** https://www.w3.org/WAI/ARIA/apg/
- **ADR-001:** Gradual Redesign Rollout (feature flags)
