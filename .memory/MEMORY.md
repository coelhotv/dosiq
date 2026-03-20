# Meus Remédios — Project Memory

**Last Updated:** 2026-03-20 | **Version:** v3.3.0 | **Fase:** 6 | **Mobile Perf M0–M8 + P1–P4:** ✅ TODOS MERGED

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

| **R-128** | Promise coalescence para auth roundtrips | CRITICAL — 13 → 1 roundtrip |
| **R-129** | String comparison para datas em hot loops | HIGH — 71.3% CPU → negligível |
| **R-131** | parseLocalDate em TODAS queries Supabase de data | CRITICAL — off-by-one day em GMT-3 |

→ Full rules at `.memory/rules.md` (R-001 to R-131)

---

## 🚫 Anti-Patterns to Avoid

| Pattern | Why Bad | Prevention |
|---------|---------|-----------|
| Use `.optional()` for nullable fields | Zod rejects null values | Use `.nullable().optional()` |
| Hardcode `new Date('YYYY-MM-DD')` | UTC midnight = wrong day in GMT-3 | Use `parseLocalDate()` |
| Guard clause before hooks | React Rules violation | Place after ALL hooks |
| setTimeout in act() blocks | Timing-dependent, flaky | Use `waitFor()` or `vi.useFakeTimers()` |
| **Modify code WITHOUT creating branch FIRST** | **Code ends up on main without review (AP-A01)** | **MANDATORY: `git checkout -b ...` BEFORE any change** |
| `calculateDailyIntake()` for non-daily | Ignores frequency (semanal, dias_alternados) | Use `calculateExpectedDoses()` |
| Count logs instead of summing quantity_taken | Multi-pill doses underestimated | Sum `.reduce((sum, log) => sum + (log.quantity_taken ?? 0), 0)` |
| Filter logs with `protocol_id \|\| medicine_id` | Cross-protocol contamination | Use protocol_id ONLY |

| `getUserId()` sem cache (AP-P14) | 13 auth roundtrips (~8s em 4G) | Promise coalescence + cache em memória |
| `new Date()` em hot loop (AP-P15) | 71.3% CPU, 9.5s freeze mobile | String comparison YYYY-MM-DD |
| UTC hardcoded em queries (AP-P16) | Off-by-one day em GMT-3 | `parseLocalDate().toISOString()` |

→ Full anti-patterns at `.memory/anti-patterns.md` (AP-001 to AP-P17, 60+ entries)

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

#### **Sprint M0 — Mobile Performance: Emergency Fixes (HealthHistory Freezes)** ✅ DELIVERED
- **Status:** MERGED (commit `6f4be85`, PR #339)
- **Quality:** 539/539 tests ✅ | 0 lint errors ✅ | Gemini #340, #341 applied + closed
- **Freeze Diagnosis:** 4 cascading freezes (parse/compile, eager IntersectionObserver, Sparkline paint, sync O(n))
- **Solutions:** `lazy()` + `<Suspense>`, `startTransition()`, `useMemo` for inline calcs, sentinel repositioning
- **New Anti-Patterns:** AP-P01 to AP-P03 (Mobile performance patterns)
- **New Rules:** R-115 to R-117 (lazy imports, IntersectionObserver positioning, startTransition)
- **Gemini Suggestions:** #340 (formatLocalDate), #341 (logging in catch)
- **Timeline:** 110 min (setup + 7 corrections + Gemini fixes + validation + merge)
- **Journal:** 2026-W11-m0-sprint.md (detailed impact analysis + metrics)

#### **Sprint M1 — Timeline Virtualization (react-virtuoso)** ✅ DELIVERED
- **Status:** MERGED (commit `f7153cb`, PR #342)
- **Quality:** 539/539 tests ✅ | 0 lint errors ✅ | 1 squash commit + docs update
- **Goal:** Replace `.map()` timeline with Virtuoso for mobile FPS optimization
- **Changes:**
  - Virtuoso + useWindowScroll, overscan=300, endReached pagination
  - LogEntry wrapped with React.memo + custom comparison (id+status+quantity)
  - Handlers (handleEditClick, handleDeleteLog, showSuccess, handleLogMedicine) in useCallback
  - Dead code removed: .map() loop + "Ver mais" button
- **Performance Impact:** FPS < 50 → ≥ 55 (CPU 4x throttle), DOM nodes N → ~10
- **Dependencies:** react-virtuoso@^4.18.3
- **New Rules:** R-115 (Virtuoso for long mobile lists, handler + memo pair)
- **Timeline:** 75 min (setup + impl + validation + git + push + merge + docs)
- **Journal:** 2026-W11.md (full entry with timeline breakdown)

#### **Sprint M2 — Code Splitting & Lazy Routes** ✅ DELIVERED
- **Status:** MERGED (commit `ddd3fbe`, PR #391)
- **Quality:** 539/539 tests ✅ | 0 lint errors ✅ | Gemini suggestions applied
- **Bundle Optimization:**
  - All 12 views converted to `lazy()` (except Dashboard)
  - jsPDF + html2canvas: dynamic import on export trigger (-587KB from initial)
  - 8 manualChunks: vendor-framer, vendor-supabase, vendor-virtuoso, vendor-pdf, feature-history, feature-stock, feature-landing, feature-medicines-db (819KB)
  - **Result:** 989KB → 102.47kB gzip (89% reduction 🎉)
- **ViewSkeleton:** New component for Suspense fallback during chunk loading
- **New Rules:** R-115 (lazy views), R-116 (manualChunks patterns), R-117 (mobile lazy loading)
- **Timeline:** 90 min (setup + impl + validation + git + merge + docs)
- **Journal:** Included in 2026-W11.md

#### **Sprint M3 — Database Optimization (Views + Indexes)** ✅ DELIVERED
- **Status:** MERGED (commit `e578820`, PR #393)
- **Quality:** 473/473 tests ✅ | 0 lint errors ✅ | 7 Gemini suggestions applied
- **Bugs Fixed:** 4 critical adherence bugs (120%, 900%, hasEnoughData, 30-day cap)
- **DB Optimizations:**
  - 2 CONCURRENT indexes (timeline/protocol queries: 200ms → <10ms)
  - 2 pre-aggregated views (v_daily_adherence, v_adherence_heatmap)
  - Zod validation for parameters (getDailyAdherenceFromView)
- **Extracted Helpers:** buildHeatmapNarrative, buildAdherenceGrid (30-line limit enforced)
- **New Rules:** R-121 (Zod params), R-122 (30-line extraction), AP-121/122 (dose/protocol confusion, Cartesian products)
- **Performance:** Sparkline 3-4× faster, Heatmap 10× faster, mobile main-thread unblocked
- **Timeline:** 250 min (setup + impl + 7 code review fixes + validation + docs + merge)
- **Journal:** 2026-W11-M3.md (detailed learnings, 4 bugs explained, performance metrics)

#### **Sprint M5 — Assets, CSS, Font Sizes** ✅ DELIVERED
- **Status:** MERGED (commit `4822296`, PR #394)
- **Quality:** 539/539 tests ✅ | 0 lint errors ✅ | No Gemini issues
- **Changes:**
  - Removed `@import url('*.js')` from Animations.css (critical chain fix)
  - favicon.png 192KB → SVG <1KB (LCP improvement)
  - Font sizes: 8-9px → 10-11px in SparklineAdesao, StockAlertsWidget (mobile legibility)
  - Animations: width → transform:scaleX() (zero reflow, GPU-accelerated)
- **New Rules:** R-123 (animations, scaleX), R-124 (favicon optimization)
- **Performance:** LCP ~200ms faster, TBT improvement
- **Timeline:** 60 min (setup + impl + validation + merge + docs)
- **Journal:** 2026-W11-M5.md

#### **Sprint M6 — Mobile Touch & UX (Tap, Overscroll, Source Maps)** ✅ DOCUMENTED
- **Status:** Changes in main (commit 5e593fb), full docs + anti-pattern added
- **Quality:** 539/539 tests ✅ | 0 lint errors ✅ | CSS valid
- **Changes:**
  - M6.1: `-webkit-tap-highlight-color: transparent` (remove tap flash)
  - M6.2: `touch-action: manipulation` (remove 300ms iOS delay)
  - M6.3: `overscroll-behavior: contain` (prevent rubber-band scroll)
  - M6.4: `sourcemap: 'hidden'` (already in vite.config.js from M2)
- **New Anti-Pattern:** AP-A01 (mandatory branch creation before ANY code change)
- **Skill Improvements:** deliver-sprint SKILL.md refactored with explicit Step 1.0 (branch FIRST)
- **Documentation:** docs/standards/MOBILE_PERFORMANCE.md sections 7-8 completed
- **Timeline:** 50 min (impl + validation + docs) + 15 min (AP-A01 + skill improvements)
- **Journal:** 2026-W11-M6.md (critical learning about workflow discipline)

**M4 STATUS:** Deferred (Service Worker complexity) — refactor for future sprint if needed

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
| **API Functions** | 7/12 Vercel functions (chatbot.js adicionado sprint 8.3) | ✅ Dentro do limite |
| **Code Review** | Gemini Code Assist | ✅ Enabled |
| **Deployment** | Vercel (Hobby, free) | ✅ Live |

---

## 📚 Documentation

- `.memory/rules.md` — 131 project-specific rules (R-001 to R-131)
- `.memory/anti-patterns.md` — 60+ anti-patterns to avoid (AP-001 to AP-P17)
- `.memory/journal/` — Sprint journals (2026-W06 through 2026-W12-P4)
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

## HealthHistory HTTP/2 Freeze Fix ✅ COMPLETO (2026-03-15) — v3.3.0
**P1+P2+P3: Browser freeze mobile eliminado + performance otimizada**
- **P1** `dcfccb0` PR#398 — `cachedAdherenceService` SWR + `getAdherenceSummary` protocols 1× (era 3×)
- **P2** `af8185a` PR#399 — `loadData` faseado (requestIdleCallback), max concurrent: 12+ → 2
- **P3** `fe26176` PR#400 — slim select timeline: ~500 → ~120 bytes/log (76% redução)
- R-125 (cache adherence) + R-126 (serialize mobile queries) + R-127 (slim select) registradas
- AP-P12 (repeated sub-queries) + AP-P13 (queries after setIsLoading) registradas

## Sprint P4 ✅ DELIVERED (2026-03-20) — Slim Dashboard Logs + Auth Cache
**PR:** #403 | Branch: `fix/mobile-perf-p4-slim-dashboard-logs`
- `getByDateRangeSlim` + `getByMonthSlim` (payload 76% menor)
- Zod validation em todos 8 métodos de leitura do logService
- `parseLocalDate()` em 4 métodos de query de data (R-020/R-131)
- `getUserId()` cache + promise coalescence (13 → 1 auth roundtrip, ~8s economia)
- `calculateStreaks` string comparison (CPU 71.3% → negligível)
- Fix coluna `status` inexistente em `medicine_logs`
- Spec criada: `plans/EXEC_SPEC_DASHBOARD_FIRST_LOAD.md` (D1-D6, target ≤12 queries)
- R-128 to R-131 + AP-P14 to AP-P17 registradas
- Journal: `.memory/journal/2026-W12-P4.md`

## Sprint 8.3 ✅ ENTREGUE (2026-03-20) — F8.1 Chatbot IA
**Commit:** `5a708ad` | **PR:** #407 (mergeado) | **Próxima versão:** v4.0.0-RC1
- Groq API (llama-3.3-70b-versatile) via serverless `api/chatbot.js` (slot 7/12)
- `contextBuilder.js` — contexto compacto do paciente sem IDs/UUIDs
- `safetyGuard.js` — bloqueia dosagem/diagnóstico/parar tratamento
- `chatbotService.js` — rate limit 30msg/hora (localStorage)
- `ChatWindow.jsx` + `ChatWindow.module.css` — drawer animado, CSS Modules (separation of concerns)
- `App.module.css` — FAB styles extraídos para reutilização
- App.jsx: FAB 💬 + lazy-loaded ChatWindow via Suspense
- **Quality:** 539/539 testes ✅ | Build: ChatWindow 3.23 kB gzip ✅ | Budget: 7/12 ✅
- **Gemini Review:** 5 fixes aplicados (2 HIGH + 3 MEDIUM) → 0 novos comentários → Aprovado
- **Decisão:** ChatWindow chama `useDashboard()` diretamente (não prop drilling via App.jsx)
- Journal: `.memory/journal/2026-W12.md` (review + lições aprendidas)

## Sprint 8.3.1 ✅ ENTREGUE (2026-03-20) — Bugfix Hallucinations
**Commit:** `1e47cfb` | **PR:** #408 (mergeado) | **Problema:** "Selozok = Sertralina" (LLM alucinava)
- **Opção E (Grounding):** Incluir `active_ingredient` + `therapeutic_class` no contexto
  - Antes: `- SeloZok (50mg): diario, ...`
  - Depois: `- SeloZok [Succinato de Metoprolol, Betabloqueador] (50mg): diario, ...`
  - Garantir `null` não expõe "null" no contexto (usar `filter(Boolean)`)
- **Ajustes parametros:** `temperature: 0.7 → 0.2`, `top_p: 0.9 → 1.0` (respostas factuais)
- **Modelo:** Trocar para `groq/compound` (seleção inteligente)
- **Testes:** 33/33 passando ✅ | localStorage mock corrigido (AP-T03)
- Journal: `.memory/journal/2026-W12.md` (análise de alucinação + soluções)

## Sprint M5 ✅ DELIVERED (2026-03-13)
**Assets, CSS & Font Sizes optimization**
- Commit: `4822296` | PR: #394
- Favicon 192KB → SVG <1KB (FCP +200ms)
- Font sizes 8-9px → 10-11px (accessibility)
- Width animations → transform:scaleX() (GPU, 60 FPS)
- @import JS removed from critical chain
- Quality: 539/539 tests ✅, 0 lint ✅
