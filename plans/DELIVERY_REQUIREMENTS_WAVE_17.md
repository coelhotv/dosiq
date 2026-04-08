# Wave 17 — Delivery Requirements (DEVFLOW Planning)

> **DEVFLOW Planning Output**
> Mode: Planning
> Goal: Document delivery process requirements for Wave 17 — Rollout Promotion & Legacy Cleanup
> Spec Reference: `plans/backlog-redesign/WAVE_17_ROLLOUT_LEGACY_CLEANUP.md` (11 sprints, final wave of redesign)
> Date: 2026-04-08

---

## P1 — Scope Analysis

### Project Context
- **Phase:** v3.3.0 + Redesign (Waves 0–16 complete, W17 is the final rollout wave)
- **Goal:** Convert redesign from opt-in feature flag to single unified UI, remove all legacy views/components, consolidate CSS
- **Blast Radius:** VERY HIGH — touches nearly every file in src/
- **Deployment Strategy:** 11 sequential sprints, each leaving app in deployable state

### Scope Boundaries
| What's In Scope | Why |
|---|---|
| Remove `RedesignContext`, `useRedesign` hook | Feature flag infrastructure becomes obsolete |
| Delete legacy views (`Dashboard.jsx`, `Stock.jsx`, `Treatment.jsx`, etc.) | Redesign views fully replace them |
| Consolidate CSS tokens → `sanctuary.css` | New tokens become global default |
| Rename redesign views (remove suffix) | Single unified view set, no "redesign" directory needed long-term |
| Update `App.jsx` — remove all `isRedesignEnabled` branches | Code must reflect single UI reality |
| Verify `vite.config.js` chunk boundaries | Ensure chunks don't break after rename/delete |

| What's Out of Scope | Why |
|---|---|
| Rewrite view logic or UX flows | Redesign views already complete from W0-W15 |
| Change component APIs or data contracts | Wave 15 accessibility already finalized |
| Create new views or alter dashboard layout | Pure cleanup/consolidation phase |

### Verification Checklist (Pre-Delivery)
- [ ] W15 (Accessibility & Polish) merged to main ✅ (PR #448 on 2026-04-08)
- [ ] Lighthouse scores on main: Accessibility ≥95, Performance ≥90
- [ ] `npm run validate:agent` passes on current main
- [ ] No PRs pending merge that conflict with redesign removal
- [ ] Backup/archive plan for legacy views (in git history, accessible by commit)

---

## P2 — ADR Check & Coverage

### Existing ADRs Covering This Wave

| ADR | Title | Status | Coverage |
|-----|-------|--------|----------|
| **ADR-001** | Gradual Redesign Rollout via Feature Flags | accepted | Defines `RedesignContext`, flag storage, `data-redesign` attribute scoping. **Wave 17 reverses this decision — promotes redesign to default, then removes infrastructure.** No breaking decision needed; ADR-001 covered the rollout journey, W17 closes it. |
| **ADR-007** | Wave-Based Redesign Incremental Delivery | accepted | Defines 15-wave rollout strategy. Wave 17 is the final consolidation wave. All 15 design waves (W0-W15) approved before W17 starts. |
| **ADR-008** | Design System Hierarchy: Tokens → Typography → Components → Layouts | accepted | Foundation for `sanctuary.css` token consolidation in Sprint 16.2 |
| **ADR-012** | No Sharp Borders: Minimum 0.75rem Border Radius | accepted | Governs CSS in `sanctuary.css` and component overrides |
| **ADR-023** | No Font Weights Below 400 (Elderly Accessibility) | accepted | Preserved in `sanctuary.css` mapping |

### New ADR Needed?

**Question:** Should we draft ADR-026 for "Single Unified UI Post-Redesign Rollout"?

**Answer:** **No explicit ADR draft needed.** ADR-001 is the authoritative decision covering feature-flagged rollout. Wave 17 is the *execution* of the planned consolidation end-state (§5 of ADR-001 mentions promotion to default + cleanup). Reverting the flag is operationally already decided; no new architectural options.

**However:** Document in journal (`memory/journal/2026-W15.jsonl`) that W17 represents the final stage of ADR-001's lifecycle: from provisional (W0) → validated (W1-W15) → production default (W16.1) → cleanup (W17).

---

## P3 — Execution Requirements (NOT a Rewrite of Spec)

The spec (`WAVE_17_ROLLOUT_LEGACY_CLEANUP.md`) is complete and detailed. This section documents the **delivery process** constraints, dependencies, and decision gates according to DEVFLOW.

### Implementation Order (Mandatory Sequence)

**Reason:** Each sprint depends on previous state. Reordering causes intermediate build failures.

```
16.0 (Audit)
    ↓
16.1 (Soft Promotion — 2-week observation) ← SEPARATE DELIVERY, 2 WEEKS PAUSE
    ↓
16.2 (Token Consolidation) ← depends on 16.1 complete + testing
    ↓
16.3 (Layout Consolidation) ← depends on 16.2
    ↓
16.4 (Component CSS Consolidation) ← depends on 16.3
    ↓
16.5 (App.jsx Simplification) ← depends on 16.4 CSS complete
    ↓
16.6 (Legacy View Deletion) ← depends on 16.5 removing all isRedesignEnabled checks
    ↓
16.7 (Rename Redesign Views) ← depends on 16.6 (legacy gone) + 16.5 (App.jsx no conditionals)
    ↓
16.8 (Feature Flag Infrastructure Removal) ← depends on 16.7 (no imports of old names)
    ↓
16.9 (Token & CSS Cleanup) ← depends on 16.8 (no uses of RedesignContext) + grep validation
    ↓
16.10 (Onboarding & Final Polish) ← depends on 16.9 (neon tokens gone)
    ↓
16.11 (Validation Final) ← smoke test, coverage, lighthouse, zero-grep
```

### Contracts Touched (CON-NNN)

No direct contract modifications. However, following contracts are affected by deletions:

| Contract | Impact | Mitigation |
|----------|--------|-----------|
| **CON-016: useRedesign()** | DELETED in Sprint 16.8. All consumers removed by 16.7. | All imports audited in 16.5 + verified grep in 16.8. |
| **CON-006: useCachedQuery()** | Not modified; still exported from same location. | No action required. |
| **CON-001–CON-015** | Not touched; services/schemas/hooks remain stable. | No action required. |

### Rules to Apply (R-NNN)

| Rule | Sprint(s) | Application |
|------|-----------|-------------|
| **R-001** (Duplicate File Check) | 16.6 (Legacy Deletion), 16.7 (Rename) | Before deleting any .jsx/.css, grep for all imports; confirm deletions won't break build. |
| **R-002** (Path Alias Verification) | 16.5 (App.jsx), 16.7 (Rename) | After rename, verify all imports use correct aliases (@shared, @views, etc.). |
| **R-003** (Import Existence Check) | 16.5 (App.jsx), 16.6 (Delete), 16.7 (Rename) | `npm run build` after each sprint validates no imports to nonexistent files. |
| **R-010** (Hook Declaration Order) | 16.5 (App.jsx simplification) | If refactoring App.jsx hooks, maintain state→memo→effect→handlers order. |

### Anti-Patterns to Watch (AP-NNN)

| AP | Risk | Mitigation |
|----|------|-----------|
| **AP-001** (Modify duplicate file) | Accidentally fix CSS in legacy `Dashboard.css` after copying to `DashboardRedesign.css` is already main. | Grep before delete; validate which file is actually imported. |
| **AP-002** (Assume import location) | Assume `MedicinesRedesign.jsx` location without checking; rename to `Medicines` breaks if original `Medicines.jsx` was never deleted. | Grep audit in 16.6; 16.7 rename happens AFTER 16.6 legacy deletion. |
| **AP-003** (Import nonexistent file) | Build crash if old import path still active. | `npm run build` mandatory after each sprint. |

### Quality Gates (C4)

Each sprint must pass:

```bash
# Lint
npm run lint

# Tests (changed files only during sprints, full before merge)
npm run test:changed
npm run test:critical     # slower, before final merge

# Build (mandatory after structure changes)
npm run build

# Agent validation (before final PR merge)
npm run validate:agent

# Lighthouse (Sprint 16.11 only, but trend throughout)
npm run preview  # then manual Lighthouse audit in devtools
```

### Risk Matrix

| Risk | Probability | Impact | Mitigation | Owned By |
|------|-------------|--------|-----------|----------|
| CSS of legacy view referenced by redesign via shared class | HIGH | MEDIUM | Grep before delete; visual test each view | 16.6 gate |
| Neon token used in shared component not migrated to sanctuary | MEDIUM | MEDIUM | Grep `--neon-` after 16.9; retest components | 16.9 gate |
| Import of legacy view forgotten in some component | LOW | HIGH | Grep required before 16.6 delete; `npm run build` validates | 16.6 gate |
| `vite.config.js` manualChunks pointing to deleted files | MEDIUM | LOW | Check build output; `npm run build --analyze` shows chunk membership | 16.7 gate |
| Regressively enable old neon tokens during testing | LOW | MEDIUM | Grep `--neon-` at end of 16.9; none should exist in src/ | 16.9+16.11 gates |

### Dependency Map

```
spec (WAVE_17_ROLLOUT_LEGACY_CLEANUP.md)
 ├── 16.0 (Audit)
 ├── 16.1 (Soft Promotion)
 │    └── requires: main updated, 2-week observation window
 ├── 16.2 (Tokens)
 │    └── requires: tokens.redesign.css fully audited
 ├── 16.3 (Layout)
 │    └── requires: sanctuary.css created (16.2)
 ├── 16.4 (Components)
 │    └── requires: layout.redesign.css scoping removed (16.3)
 ├── 16.5 (App.jsx)
 │    └── requires: all CSS inlined (16.4)
 ├── 16.6 (Delete Views)
 │    └── requires: no isRedesignEnabled in App.jsx (16.5)
 ├── 16.7 (Rename)
 │    └── requires: no legacy views (16.6)
 ├── 16.8 (Delete Context)
 │    └── requires: no imports of old component names (16.7)
 ├── 16.9 (Cleanup CSS)
 │    └── requires: no uses of RedesignContext/neon (16.8)
 ├── 16.10 (Polish)
 │    └── requires: onboarding migrated from neon (16.9)
 └── 16.11 (Validation)
      └── requires: all previous complete
```

---

## P4 — State Management & Delivery Process

### DEVFLOW C3 Implementation Order Align

Per DEVFLOW Coding Mode (C3), implementation follows:
1. **Schemas** — No schema changes (Wave 17 is CSS/structure only)
2. **Services** — No service changes
3. **Components** — CSS migration (16.2–16.4), component cleanup (16.10)
4. **Views** — Deletion (16.6), rename (16.7)
5. **Infrastructure** — Context deletion (16.8), feature flag removal
6. **Styles** — Token consolidation (16.2–16.3), cleanup (16.9)

This aligns perfectly with spec order.

### DEVFLOW C4 Quality Gates Per Sprint

Each sprint in Wave 17 has mandatory gates:

| Sprint | Lint | Test | Build | Agent | Notes |
|--------|------|------|-------|-------|-------|
| 16.0 | ✓ | ✓ | ✓ | ✓ | Baseline only, no changes |
| 16.1 | ✓ | ✓ | ✓ | ✓ | 2-week wait before 16.2 |
| 16.2 | ✓ | ✓ | ✓ | ✓ | `npm run build` validates token moves |
| 16.3 | ✓ | ✓ | ✓ | ✓ | Layout CSS removed from scoping |
| 16.4 | ✓ | ✓ | ✓ | ✓ | Component CSS consolidated |
| 16.5 | ✓ | ✓ | ✓ | ✓ | App.jsx simplified; visual regression test |
| 16.6 | ✓ | ✓ | ✓ | ✓ | **CRITICAL:** grep validation before delete |
| 16.7 | ✓ | ✓ | ✓ | ✓ | **CRITICAL:** grep for old names after rename |
| 16.8 | ✓ | ✓ | ✓ | ✓ | **CRITICAL:** grep for useRedesign/RedesignContext |
| 16.9 | ✓ | ✓ | ✓ | ✓ | **CRITICAL:** grep for --neon-* |
| 16.10 | ✓ | ✓ | ✓ | ✓ | Final polish pass |
| 16.11 | ✓ | ✓ | ✓ | ✓ | Lighthouse + smoke test |
| 16.12 | ✓ | — | — | — | Release prep (version bump, docs, tag, release notes) |

### Deliver-Sprint Integration

**Option 1: Integrated (recommended for W17 given complexity)**
```
/deliver-sprint          (handles C3 + C4 + git)
  → DEVFLOW manages pre/post gates
  → 11 sequential deliveries (each sprint is its own PR)
  → DEVFLOW C5 after each PR merge (journal entries)
```

**Option 2: Manual (if testing individually first)**
```
Branch: feature/redesign/wave-17-rollout
  → 11 commits (one per sprint)
  → Manual testing between sprints (2-week pause after 16.1)
  → Single PR at end of all 11 sprints
  → DEVFLOW C5 captures entire session
```

**Recommendation:** **Option 1** — Use `/deliver-sprint` for each sprint (11 separate PRs), so each is independently testable and rollback-safe. 2-week observation period between 16.1 and 16.2 PRs allows monitoring in production.

---

## P5 — Pre-Delivery Checklist

Before starting Sprint 16.0:

### Code Readiness
- [ ] Current `main` has W15 (Accessibility) merged
- [ ] `npm run validate:agent` passes on main (baseline)
- [ ] `npm run build` produces no warnings on main
- [ ] Lighthouse on main: Accessibility ≥95, Performance ≥90
- [ ] No other redesign-related PRs in flight

### Team Readiness
- [ ] Code reviewers aware of 11-sprint timeline
- [ ] Stakeholders briefed on 2-week pause after 16.1
- [ ] Monitoring/alerts set up for production (after 16.1 soft promotion)
- [ ] Rollback plan documented (revert `resolveInitialFlag` to `return false`)

### Documentation Readiness
- [ ] Spec (`WAVE_17_ROLLOUT_LEGACY_CLEANUP.md`) locked (no changes during delivery)
- [ ] This file (`DELIVERY_REQUIREMENTS_WAVE_17.md`) versioned
- [ ] ADRs current (ADR-001, ADR-007 referenced, no new ones needed)
- [ ] Team has access to spec + this requirements doc

### Tools & Automation
- [ ] Build/test pipeline green on main
- [ ] Vercel deploy preview working
- [ ] GitHub branch protection rules current (require tests pass)

---

## Appendix A — Grep Commands (Reference)

Used throughout sprints for validation:

```bash
# Check for feature flag usage (should be zero after 16.8)
grep -r "isRedesignEnabled\|useRedesign\|RedesignContext\|RedesignProvider" src/ --include="*.{js,jsx}"

# Check for data-redesign attribute (should be zero after 16.7)
grep -r "data-redesign" src/ --include="*.jsx"

# Check for neon tokens (should be zero after 16.9)
grep -r "\-\-neon-\|neon-cyan\|neon-magenta\|neon-purple\|neon-green\|neon-pink" src/ --include="*.css"

# Check for old file names (should be zero after 16.7)
grep -r "MedicinesRedesign\|StockRedesign\|DashboardRedesign\|TreatmentsRedesign\|ProfileRedesign\|HealthHistoryRedesign\|SettingsRedesign\|EmergencyRedesign\|ConsultationRedesign" src/ --include="*.{js,jsx}"

# Check for redesign.css imports (should be zero after 16.9)
grep -r "tokens.redesign\|layout.redesign\|components.redesign" src/ --include="*.{js,jsx,css}"
```

---

## Appendix B — Success Criteria (Post-Wave 17)

### Code Metrics
- Bundle size (main chunk): ≤ 110kB gzip
- Zero build warnings
- All 11 sprints merged without rollback

### Test Metrics
- `npm run validate:agent`: 100% pass
- No regression in test coverage
- Zero false positives from grep validation commands

### User Metrics
- Lighthouse Accessibility: ≥95 (no regression from W15)
- Lighthouse Performance: ≥90
- No spike in error logs post-16.1 (2-week observation)
- No user complaints re: design revert/switch

### Code Quality
- Zero references to `isRedesignEnabled`, `useRedesign`, `RedesignContext`, `data-redesign`
- Zero neon token variables in active source
- Zero "Redesign" suffixes in file names
- All legacy views deleted
- CSS consolidation complete

---

## Sprint 16.12 — Release v4.0.0 & Major Release Documentation

**Objetivo:** Formalizar Wave 17 como v4.0.0 major release com documentação completa

### Pré-condições
- Sprint 16.11 (Validação Final) completo e aprovado
- Todos os testes passando (0 failures)
- Lighthouse validado: Accessibility ≥95, Performance ≥90
- Smoke test visual completado em todas as views

### 16.12.1 — Atualizar versão do projeto

**Arquivo:** `package.json`
```json
{
  "name": "meus-remedios",
  "version": "4.0.0",  // ← Mudar de 3.3.0
  ...
}
```

### 16.12.2 — Criar CHANGELOG.md

**Novo arquivo:** `CHANGELOG.md` (raiz do projeto)

**Conteúdo:** Documentar todas as features de v4.0.0:

```markdown
# Changelog

## [4.0.0] — 2026-04-08 — Santuário Terapêutico Complete ✨

### 🎨 **Major: Design System Overhaul**
- Santuário Terapêutico design (Waves 0-16) agora padrão em 100% das telas
- Nova paleta: Health Green (#006a5e) + Clinical Blue (#005db6)
- Tipografia moderna: Public Sans (display) + Lexend (body)
- Border radius: mínimo 0.75rem (healthcare-appropriate aesthetics)
- Shadow system: ambient (Material Design 3) em lugar de glows

### ♿ **Major: WCAG 2.1 AA Accessibility**
- Font weights ≥400 only (elderly users, geriatric compliance)
- Todos os ícones pareados com text labels
- Motion preferences respeitadas
- Color contrast ratios verificados

### 📱 **Major: Mobile Performance**
- Bundle: 989kB → 102.47kB gzip (89% reduction)
- Lazy loading em 13+ views
- Dashboard queries: 13+ → 1 (cache coalescence)
- Mobile FCP: ~500ms mais rápido

### 🤖 **New: AI Chatbot Multi-Canal**
- Groq API com prompt caching
- Web + Telegram unified assistant
- Context-aware recomendações
- Safety guard + hallucination mitigations

### 🎛️ **New: Navigation Redesign**
- BottomNav (mobile) + Sidebar (desktop)
- Framer Motion page transitions
- 6 motion archetypes (entrada, saída, feedback)

### 📊 **Improvements: Dashboard & Insights**
- Adherence widgets redesigned
- Smart alerts (adherence, stock, protocols)
- Cost analysis view
- Health history com calendar navigation

### 🏥 **Improvements: Clinical Features**
- Consultation mode (read-only medicines)
- Clinical PDF reports
- ANVISA drug database
- Therapeutic class field

### ✅ **Improvements: Protocol Management**
- Enhanced treatment wizard
- Titration schedule support
- Protocol reminders

### 📦 **Improvements: Stock & Inventory**
- Four-tier system (CRITICAL/LOW/NORMAL/HIGH)
- FIFO inventory management
- Expiration tracking
- Cost analytics

### 🔧 **Technical: Architecture**
- Feature-based organization
- Zod validation everywhere
- Supabase RLS enforcement
- Telegram bot sem logic duplication

### 🚀 **Infrastructure**
- 6/12 serverless functions: DLQ, Gemini, health, notify, share, telegram
- GitHub Actions + Gemini Code Assist

### 📝 **Breaking Changes**
- Feature flag infrastructure removed
- Neon colors removed (`--neon-*`)
- Legacy views deleted
- BottomNav replaced (agora BottomNavRedesign)

### 🎓 **Documentation**
- Complete redesign system docs
- Mobile performance standards
- Bot architecture guide
- Chatbot AI integration guide

---
```

### 16.12.3 — Atualizar README.md

**Arquivo:** `README.md` (adicionar/atualizar seções):

```markdown
# Meus Remedios — Medication Management PWA

> **Personal medication management for elderly patients**
> 
> Version: **v4.0.0** | Lighthouse: **A11y ≥95** | Performance: **≥90**

## ✨ What's New in v4.0.0?

### Santuário Terapêutico Design
- New healthcare-focused palette (green #006a5e + blue #005db6)
- Modern typography, soft edges, ambient shadows
- 100% of screens redesigned

### WCAG 2.1 AA Accessibility ✅
- Elderly-friendly fonts (weights ≥400)
- All icons labeled
- Motion preferences honored

### Performance (89% Reduction)
- Main bundle: **102.47kB gzip** (from 989kB)
- Dashboard load: **<5s on 4G mobile**
- Lazy loading + code splitting

### New Features
- 🤖 AI Chatbot (Groq, multi-channel)
- 💊 Consultation mode
- 📊 Cost analysis
- 🏥 ANVISA database + clinical features
- 📱 Touch-optimized navigation

## Quick Start

```bash
git clone https://github.com/coelhotv/meus-remedios.git
cd meus-remedios
npm install
npm run dev  # http://localhost:5173
```

---
```

### 16.12.4 — Criar docs/v4_0_0_RELEASE.md

**Novo arquivo:** Migration guide para usuários

```markdown
# v4.0.0 Release Guide

## What's Changed

### Design
Complete visual overhaul: **Santuário Terapêutico** (healthcare-focused)
- Before (v3.x): Neon/cyberpunk
- After (v4.0.0): Clinical, accessible, soft design

### Accessibility
**WCAG 2.1 AA** compliance:
- Fonts ≥400 (no thin/light)
- Icons labeled
- Motion preferences honored

### Performance
- Bundle: 989kB → 102.47kB (89% smaller)
- Dashboard: <5s on 4G mobile
- Lazy loading on all views

### New Features
1. **Chatbot IA** — Medicine recommendations
2. **Consultation Mode** — Read-only medicines
3. **Cost Analysis** — Expense tracking
4. **Clinical Features** — ANVISA DB, PDFs
5. **Navigation** — Bottom nav (mobile) + sidebar (desktop)

## Migration from v3.x

### Data
✅ All user data **preserved automatically**:
- Medications, protocols, stock, adherence logs, settings

### UI
⚠️ Interface looks completely different, but functionality is the same

### Breaking Changes
None for users. For developers:
- Feature flag removed (`RedesignContext` deleted)
- Legacy views deleted
- CSS tokens restructured

---
```

### 16.12.5 — Atualizar docs/INDEX.md

**Arquivo:** `docs/INDEX.md` (update version header)

```bash
# At top of file:
# Meus Remedios Documentation
# Version: v4.0.0 (Santuário Terapêutico Complete)
# Last Updated: 2026-04-08

# Add to table of contents:
## Release Information
- [v4.0.0 Release Notes](../CHANGELOG.md#400--2026-04-08)
- [Migration from v3.x](v4_0_0_RELEASE.md)
```

### 16.12.6 — Criar git tag e commit

```bash
# Stage all changes
git add -A

# Commit release
git commit -m "chore(release): v4.0.0 — Santuário Terapêutico Complete

- Bump package.json to v4.0.0
- Create CHANGELOG.md with release notes
- Update README.md with new features
- Add v4_0_0_RELEASE.md migration guide
- Update docs/INDEX.md version reference

Wave 17 Complete:
  ✅ Redesign rollout (Waves 0-16)
  ✅ WCAG 2.1 AA accessibility
  ✅ 89% bundle reduction (mobile perf)
  ✅ AI Chatbot (Groq multi-channel)
  ✅ Clinical features (consultations, ANVISA, PDFs)
  ✅ Feature flag infrastructure removed
  ✅ Legacy code cleaned up

Breaking Changes:
  - RedesignContext + useRedesign deleted
  - Legacy views + neon colors removed
  - BottomNav replaced by BottomNavRedesign

No Data Migrations Needed
All user data preserved (medications, protocols, adherence logs)

Lighthouse Scores:
  - Accessibility: ≥95 (maintained from W15)
  - Performance: ≥90 (improved from perf optimization)

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"

# Create annotated tag
git tag -a v4.0.0 -m "v4.0.0 — Santuário Terapêutico Complete

Major Release Features:
✨ New Design Language (Waves 0-16)
♿ WCAG 2.1 AA Compliance (Wave 16)  
⚡ 89% Bundle Reduction (Mobile M2)
🤖 AI Chatbot (Groq, web + Telegram)
🏥 Clinical Features (ANVISA, consultations, PDFs)

Architecture:
- Feature-based org (src/features/*)
- Zod schema-first validation
- Supabase RLS enforcement
- Telegram bot service mirror

Breaking Changes:
- Feature flag removed (RedesignContext deleted)
- Neon colors removed (--neon-*)
- Legacy views deleted (replaced by redesign)

Data: All user data preserved, no migrations needed.

Performance:
- Main bundle: 102.47kB gzip
- Dashboard load: <5s on 4G
- Lazy loading + code splitting

Quality:
- Lighthouse Accessibility: ≥95
- Lighthouse Performance: ≥90
- Tests: 100% pass
- Build: zero warnings

Released: 2026-04-08
Commit: $(git rev-parse --short HEAD)
Author: Claude Code DEVFLOW"

# Push to remote
git push origin main --tags
```

### 16.12.7 — Criar GitHub Release (opcional)

```bash
# Via GitHub CLI:
gh release create v4.0.0 \
  --title "v4.0.0 — Santuário Terapêutico Complete" \
  --notes "See CHANGELOG.md for full release notes" \
  --latest=true

# Via GitHub Web UI:
# 1. Go to Releases → Create a new release
# 2. Tag: v4.0.0
# 3. Title: v4.0.0 — Santuário Terapêutico Complete
# 4. Body: Copy CHANGELOG.md v4.0.0 section
# 5. Publish
```

### 16.12.8 — Validação Pós-Release

```bash
# Verify production deployment
curl https://meus-remedios.vercel.app/package.json  # Should show v4.0.0

# Verify Lighthouse scores
npm run preview  # Then manual Lighthouse audit

# Verify git tag exists
git tag -l v4.0.0  # Should list the tag

# Verify CHANGELOG updated
grep "^## \[4.0.0\]" CHANGELOG.md  # Should find v4.0.0 section
```

### 16.12.9 — Notificar equipe

- [ ] Announcement em email/Slack to team
- [ ] Update project status in tracking tool
- [ ] Document in release notes that v4.0.0 is production (stable)
- [ ] Monitor production (Vercel, error logs) for 2-3 days post-release

---

## Critério de Conclusão Sprint 16.12

- [ ] `package.json` versão bumped para 4.0.0
- [ ] `CHANGELOG.md` criado com v4.0.0 release notes
- [ ] `README.md` atualizado com nova versão + features
- [ ] `docs/v4_0_0_RELEASE.md` criado (migration guide)
- [ ] `docs/INDEX.md` atualizado com referência v4.0.0
- [ ] Git tag `v4.0.0` criado e pusheado
- [ ] GitHub Release criado (ou release notes postadas)
- [ ] Vercel deployment validado (URL carrega com v4.0.0)
- [ ] Lighthouse scores validados em produção
- [ ] Equipe notificada de novo major release

---

## Summary

**Wave 17 Delivery Process:**
- **12 sequential sprints** (16.0–16.12):
  - Sprints 16.0–16.11: Code delivery (cleanup, consolidation, validation)
  - Sprint 16.12: Release & documentation (v4.0.0 tag, release notes, docs update)
- **Mandatory order** (dependencies documented)
- **2-week observation** after soft promotion (16.1)
- **12 quality gates** (lint/test/build/agent per sprint)
- **Zero contracts broken** (feature flag infrastructure is intentionally deprecated)
- **Spec reference:** `plans/backlog-redesign/WAVE_17_ROLLOUT_LEGACY_CLEANUP.md`
- **DEVFLOW integration:** Use `/deliver-sprint` for each sprint (Option 1 recommended)

**Next Step:** Run `/deliver-sprint` starting with Sprint 16.0 (Audit) → continuous through 16.12 (Release).
