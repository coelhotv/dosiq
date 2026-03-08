# Meus Remédios — Project Memory

**Last Updated:** 2026-03-08 | **Version:** v3.2.0+ | **Fase:** 6 (Portabilidade, Performance, Monetização)

---

## 🎯 Quick Reference

### Diretórios Canônicos
- **Componentes:** `src/shared/components/` (canônico) vs `src/components/` (legado)
- **Hooks:** `src/shared/hooks/` (canônico) vs `src/hooks/` (legado)
- **Schemas:** `src/schemas/` (canônico, ÚNICO local para schemas Zod)
- **Services API:** `src/services/api/` (compartilhados) + `src/features/*/services/` (feature-local)
- **Memoria:** `.memory/rules.md`, `.memory/anti-patterns.md`, `.memory/journal/YYYY-WWW.md`

### Path Aliases (vite.config.js)
`@` → src/ | `@features` → src/features/ | `@shared` → src/shared/ | `@services` → src/services/ | `@schemas` → src/schemas/ | `@utils` → src/utils/ | `@dashboard`, `@medications`, `@protocols`, `@stock`, `@adherence`

### Test Commands
```bash
npm run test:fast           # 1 thread, 6.5 min
npm run test:critical       # services/schemas/utils/hooks
npm run test:changed        # só alterados desde main
npm run validate:quick      # lint + test:changed
npm run validate:agent      # OBRIGATÓRIO antes de push (10 min kill-switch)
```

---

## 📋 Critical Rules Summary

| Rule | Description | Impact |
|------|-------------|--------|
| **R-001** | Duplicate file check before editing | CRITICAL — wrong file modified = prod bug |
| **R-010** | Hook order: States → Memos → Effects → Handlers | CRITICAL — ReferenceError TDZ |
| **R-020** | Always use `parseLocalDate()` for dates | CRITICAL — UTC midnight = wrong day |
| **R-062** | Quality > Speed (R-062) | HIGH — one good PR > 3 rushed |
| **R-065** | Read memory before coding | CRITICAL — prevents repeating known mistakes |
| **R-111** | Use `calculateExpectedDoses()` not `calculateDailyIntake()` | CRITICAL (S6.1) — respects frequency |
| **R-112** | Adherence = sum(quantity_taken), not count(logs) | CRITICAL (S6.1) — else multi-pill doses fail |
| **R-113** | Filter logs by protocol_id ONLY, never || medicine_id | CRITICAL (S6.1) — prevents cross-protocol contamination |
| **R-114** | .setHours(0,0,0,0) on date boundaries | HIGH (S6.1) — timezone-agnostic comparison |

→ Full rules at `.memory/rules.md` (R-001 to R-114)

---

## 🚫 Anti-Patterns to Avoid

| Pattern | Why Bad | Prevention |
|---------|---------|-----------|
| Use `.optional()` for nullable fields | Zod rejects null values | Use `.nullable().optional()` |
| Hardcode `new Date('YYYY-MM-DD')` | UTC midnight = wrong day in GMT-3 | Use `parseLocalDate()` |
| Guard clause before hooks | React Rules violation | Place after ALL hooks |
| setTimeout in act() blocks | Timing-dependent, flaky | Use `waitFor()` or `vi.useFakeTimers()` |
| `calculateDailyIntake()` for non-daily | Ignores frequency (semanal, dias_alternados) | Use `calculateExpectedDoses()` |
| Count logs instead of summing quantity_taken | Multi-pill doses underestimated | Sum `.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0)` |
| Filter logs with `protocol_id \|\| medicine_id` | Cross-protocol contamination | Use protocol_id ONLY |

→ Full anti-patterns at `.memory/anti-patterns.md` (AP-001 to AP-A04)

---

## 📦 Recent Sprints Summary

### ✅ Fase 5 — Complete (v3.2.0 RELEASED)

| Sprint | Feature | Status | Tests | Notes |
|--------|---------|--------|-------|-------|
| 5.A | Cost Analysis (F5.10) | ✅ MERGED | 425 | O(M*P) → O(M+P), 6.7x faster |
| 5.B | ANVISA Base + Autocomplete (F5.6) | ✅ MERGED | 473 | 10K+ medicines, encoding issue deferred |
| 5.C | Onboarding Renovation (F5.C) | ✅ MERGED | 473 | WelcomeStep redesign + StockStep new |
| 5.D | Landing Page Redesign (F5.D) | ✅ MERGED | 473 | Hero + Features + Parallax + Footer 2026 |

### 🚀 Fase 6 — In Progress

#### **Sprint 6.1 — Refill Prediction & Protocol Risk** ✅ DELIVERED
- **Status:** COMPLETE (9 commits, all Gemini issues fixed)
- **Quality:** 491/491 tests ✅ | 0 lint errors ✅ | 9/9 issues FIXED
- **Services:** refillPredictionService.js + protocolRiskService.js (pure, no Supabase)
- **Tests:** 8 refill tests + 11 risk tests (100% coverage)
- **UI Integration:** StockBars (predictedStockoutDate) + TreatmentAccordion (risk badge)
- **Gemini Issues Fixed:** 1 CRITICAL + 5 HIGH + 3 MEDIUM
  - CRITICAL: calculateDailyIntake → calculateExpectedDoses (frequency handling)
  - HIGH: Timezone fixes, adherence by quantity_taken, log filter by protocol_id only
  - MEDIUM: O(N×M) → O(M+S+P), vi.useFakeTimers, test setup fixes
- **New Rules:** R-111 to R-114 (calculateExpectedDoses, quantity_taken, protocol_id filtering, timezone boundaries)
- **New Anti-Patterns:** AP-A01 to AP-A04 (corresponding preventions)
- **Timeline:** 190 min (setup + analysis + implementation + validation + docs)
- **Journal:** 2026-W10.md (comprehensive sprint analysis, errors learned, challenges resolved)

---

## 🧠 Knowledge Base

### API & Services
- **adherenceLogic.js** — Canonical source for dose calculations
  - `calculateExpectedDoses(protocols, days)` — respects frequency (ALWAYS use this)
  - `getDailyDoseRate()` — consults DOSE_RATE_MAP (semanal=1/7, dias_alternados=1/2)
  - `calculateDailyIntake()` — simple version (ignores frequency, DON'T use for predictions)
- **adherenceService.js** — Adherence scoring, streak tracking, daily aggregations
- **analyticsService.js** — Privacy-first, localStorage only (no PII, 30-day retention)
- **costAnalysisService.js** — Monthly medication cost analysis (Sprint 5.A)

### Common Pitfalls (Wave 3)
- **useCachedQuery:** Assinatura POSICIONAL `(key, fetcher, options)` — NOT `{key, fetcher}`
- **Calendar:** markedDates acceita YYYY-MM-DD (não ISO timestamps); sempre usar `formatLocalDate()`
- **DoseZoneList:** 'upcoming' abre por padrão (zona primária manhã cedo)
- **StockBars:** showOnlyCritical filtra crítico/baixo (pode ficar vazio)

### Schemas (Zod)
- Enums SEMPRE em PORTUGUÊS: `['diário', 'semanal', 'quando_necessário']`
- Nullable fields: `.nullable().optional()` (never just `.optional()`)
- Dosage em comprimidos (não mg, max 100 Zod)
- `quantity_taken` SEMPRE em pills

---

## 🛠️ Development Workflow

### Before Coding
1. **Read memory:** `.memory/rules.md` + `.memory/anti-patterns.md`
2. **Check duplicates:** `find src -name "*FileName*" -type f`
3. **Trace imports:** `grep -r "from.*FileName" src/ | head -20`

### Code Quality Checks
1. **Lint:** `npm run lint` (0 errors required)
2. **Tests:** `npm run validate:quick` (before commit), `npm run validate:agent` (before push)
3. **Build:** `npm run build` (must succeed)

### Git Workflow
```bash
git checkout -b feature/fase-N/descriptive-name
# Make changes, validate locally
npm run validate:agent
git add <specific-files>
git commit -m "feat(scope): description"
git push -u origin feature/fase-N/descriptive-name
# Create PR, await Gemini Code Assist review, address issues, merge
```

**RULES:**
- Code agents NEVER self-merge (R-060)
- Always wait for Gemini Code Assist review (R-062)
- Semantic commits in Portuguese (feat/fix/docs/refactor)
- No `--no-verify` or force-push to main

---

## 📊 Project Status

| Metric | Value | Status |
|--------|-------|--------|
| **Version** | v3.2.0 | ✅ Released |
| **Fase** | 6 (Portabilidade, Performance, Monetização) | 🚀 In Progress |
| **Tests** | 491+ (core) | ✅ All passing |
| **Lint** | 0 errors | ✅ Clean |
| **API Functions** | 12 Vercel functions (max) | ⚠️ At limit (R-090) |
| **Code Review** | Gemini Code Assist | ✅ Enabled |
| **Deployment** | Vercel (Hobby, free) | ✅ Live |

---

## 📚 Documentation

- `.memory/rules.md` — 114 project-specific rules (R-001 to R-114)
- `.memory/anti-patterns.md` — 48 anti-patterns to avoid (AP-001 to AP-A04)
- `.memory/journal/` — Sprint journals (2026-W06 through 2026-W10)
- `.memory/knowledge.md` — Domain-specific facts and APIs
- `docs/INDEX.md` — Public documentation index
- `CLAUDE.md` — Project instructions (override defaults)

---

## 🔄 Memory Consolidation

**This file is the single source of truth for project memory.**

- **Removed dependency on:** `/Users/accoelho/.claude/projects/...` (auto memory)
- **All knowledge now in:** `/.memory/` (project git-tracked)
- **Journal entries:** `/.memory/journal/YYYY-WWW.md`
- **Rules & anti-patterns:** `.memory/rules.md` + `.memory/anti-patterns.md`
- **Quick reference:** This file (updated 2026-03-08)

Agents should read this file + rules + anti-patterns before coding.
