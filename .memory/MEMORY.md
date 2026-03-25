# Meus Remédios — Project Memory

**Last Updated:** 2026-03-25 | **Version:** v3.3.0 | **Fase:** 6 | **Wave 4:** ✅ MERGED | **Wave 5 (Motion Language):** ✅ MERGED (Commit 4e6b312)

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
| **R-133** | Inspect component prop interface before copying | HIGH (W6.5) — LogForm TypeError |
| **R-134** | Validate context hook return types | HIGH (W6.5) — RingGaugeRedesign 0% |
| **R-135** | Prefer direct actions over modal flows | HIGH (W6.5) — 1-click vs 4-click UX |
| **R-147** | Framer Motion cascade re-trigger via key remount | CRITICAL (W7) — 90% of tab switch bugs |
| **R-148** | Domain-aware case conversion (Title vs Sentence) | HIGH (W7) — semantic-aware formatting |
| **R-149** | Full object fetch for edit workflows | CRITICAL (W7) — TreatmentItem ≠ Protocol |
| **R-150** | Compute state-specific aggregations, not just primary | CRITICAL (W7) — paused/finished tabs empty |

→ Full rules at `.memory/rules.md` (R-001 to R-150, +W7 additions)

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
| **Copy component props without reading interface (AP-W18)** | **TypeError at runtime (LogForm)** | **Always read component prop signature first** |
| **Assume stats object properties (AP-W19)** | **RingGaugeRedesign shows 0% (wrong prop name)** | **Read hook JSDoc, validate prop names** |
| **Modal flow vs 1-click registration (AP-W20)** | **4 clicks instead of 1 (worse UX)** | **Study existing patterns, prefer direct actions** |
| **Destructure wrong prop from hook (AP-W23)** | **`isComplex` undefined → wrong persona rendered (W7)** | **Always verify hook return signature** |
| **Stock calc ignoring dosage_per_intake (AP-S01)** | **30-day forecast error (90 vs 30 days — 3x off)** | **Multiply expectedDoses × dosage_per_intake** |
| **Using 1px borders (AP-D01)** | **Violates design system, visual clutter** | **Use tonal separation (bg colors) not borders** |
| **Computing aggregations for primary state only (AP-D02)** | **Other tabs empty/wrong when switched (W7)** | **Compute for ALL states, not just primary** |

→ Full anti-patterns at `.memory/anti-patterns.md` (AP-001 to AP-P21 + AP-W18-W23, AP-S01, AP-D01-D02)

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

- `.memory/rules.md` — 134 project-specific rules (R-001 to R-134, +3 from Sprint 8.5 Groq optimization)
  - R-132: Logging em `api/*.js` para Visibilidade Vercel
  - R-133: Event-Driven Router Fallback
  - R-134: Mock/Adapter Interface Completeness
- `.memory/anti-patterns.md` — 63+ anti-patterns to avoid (AP-001 to AP-SL03)
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

## Sprint 8.5 ✅ ENTREGUE (2026-03-20) — Debug & Fix: Chatbot IA no Telegram
**Commits:** `f30a72f`, `db69312`, `12470bd` | **PR:** #412 (mergeado) | **Problema:** "Chatbot não responde" no Telegram
- **Root Cause #1 (Observabilidade):** Logs em `server/bot/**` invisíveis em Vercel (Node context vs serverless context)
  - **Fix:** Adicionar `createLogger` em `api/telegram.js` (entry point Vercel, onde logs SÃO capturados)
  - **Regra:** R-132 — Logging estruturado em `api/*.js`, não em níveis inferiores

- **Root Cause #2 (Lógica):** Mensagens sem sessão ativa caíam silenciosamente (router sem fallback)
  - **Fix:** Adicionar `else { handleChatbotMessage(bot, msg) }` em `conversational.js`
  - **Regra:** R-133 — Event-driven routers SEMPRE precisam de fallback explícito + logging

- **Root Cause #3 (API Compatibility):** `bot.sendChatAction is not a function` (mock incompleto)
  - **Fix:** Implementar method no bot adapter mock
  - **Regra:** R-134 — Mock/adapter interfaces DEVEM ter TODOS os métodos que handlers chamam

- **Quality:** 539/539 testes ✅ | 0 lint ✅ | Resposta chatbot correcta: "SeloZok = Metoprolol Succinato, betabloqueador"
- **Anti-Patterns:** AP-SL01 (logging em contexto errado), AP-SL02 (mock incompleto), AP-SL03 (router sem fallback)
- **Documentation:** Updated `docs/architecture/CHATBOT_AI.md` (Telegram integration + debugging journey), `.memory/rules.md` (R-132 to R-134)
- Journal: `.memory/journal/2026-W12.md` (análise 3-layer bug, lições de integração)

## Sprint M5 ✅ DELIVERED (2026-03-13)
**Assets, CSS & Font Sizes optimization**
- Commit: `4822296` | PR: #394
- Favicon 192KB → SVG <1KB (FCP +200ms)
- Font sizes 8-9px → 10-11px (accessibility)
- Width animations → transform:scaleX() (GPU, 60 FPS)
- @import JS removed from critical chain
- Quality: 539/539 tests ✅, 0 lint ✅

## Form Feature ✅ DELIVERED (2026-03-21)
**Add therapeutic_class field to medicine forms with ANVISA Title Case normalization**
- **Commit:** `6f138b6` | **PR:** #415
- **Scope:** MedicineForm.jsx + TreatmentWizard.jsx (+ OnboardingWizard via inheritance)
- **Changes:**
  - Add read/write `therapeutic_class` field to MedicineForm (appears always, editável)
  - Add read/write `therapeutic_class` field to TreatmentWizard step 1 (appears when populated)
  - Implement `toTitleCase()` helper (primeira letra maiúscula, resto minúscula)
  - Normalize autocomplete data: `activeIngredient` + `therapeuticClass` via `toTitleCase()`
    - activeIngredient: "toxina botulínica a" → "Toxina botulínica a"
    - therapeuticClass: "AGENTE PARALISANTE NEUROMUSCULAR" → "Agente paralisante neuromuscular"
  - Show "Fonte: ANVISA" badge when preenchido via autocomplete em criação
  - Field optional, maxLength 100 (aligns with Zod schema)
- **Quality:** 539/539 testes ✅ | 0 lint ✅ | No Gemini issues expected
- **Schema:** No changes needed (already `.string().max(100).optional().nullable()`)
- **Data Flow:** JSON ANVISA → autocomplete → toTitleCase → form state → Supabase
- **Test Plan:**
  1. New medicine: field appears, autocomplete populates with Title Case ✅
  2. Edit medicine: field shows current value ✅
  3. Treatment wizard: field appears after autocomplete selection ✅
  4. Onboarding: field appears via FirstMedicineStep ✅
- **Notes:** Service layer already saves therapeutic_class, no backend changes needed

## Wave 0 — Design Tokens ✅ DELIVERED (2026-03-24)
**Santuário Terapêutico redesign infrastructure completion**
- **Commit:** `e5a9036` | **PR:** #417 (mergeado)
- **Scope:** `src/shared/styles/tokens.redesign.css` — 13 CSS variables added across 3 sprints
- **Infrastructure:** Scoped `[data-redesign="true"]` feature flag (localStorage + URL params `?redesign=1`)
  - App renders 100% identically to neon/cyberpunk design when flag OFF
  - Zero impact on current users; gradual rollout via `mr_redesign_preview` localStorage key
- **Added Variables (Sprints 0.1-0.4):**
  - **Sprint 0.1 (Toggle & Theme):** `--color-toggle-track`, `--color-toggle-track-dark`, `--color-moon` (3/4, 75%)
  - **Sprint 0.2 (Focus Ring):** `--focus-ring-width: 2px`, `--focus-ring-offset: 2px` (2/2, 100%)
  - **Sprint 0.3 (Opacity):** 6 opacity vars with standardized 2-decimal format (6/8, 75%)
    - `--opacity-disabled: 0.50`, `--opacity-hover: 0.80`, `--opacity-focus: 1.00`, `--opacity-overlay: 0.90`, `--opacity-backdrop: 0.75`, `--opacity-muted-text: 0.40`
- **Code Quality:** 539/539 testes ✅ | 0 lint ✅ | Gemini Code Assist: 2 MEDIUM suggestions applied
  - Color variable reuse optimization (hardcoded `#f59e0b` → `var(--color-warning)`)
  - Opacity decimal standardization consistency check
- **Validation:** Manual comparative analysis of spec vs. implementation (all 4 sprints verified against `plans/redesign/WAVE_0_DESIGN_TOKENS.md`)
- **Documentation:**
  - Journal: `.memory/journal/2026-W12.md` (detailed completion analysis)
  - Specification file: `plans/redesign/WAVE_0_DESIGN_TOKENS.md` (source spec, still canonical)
- **Lessons Learned:**
  - Partial infrastructure implementation can mask incomplete feature setup (R-135: "Always validate spec vs. implementation comprehensively")
  - CSS variable scoping with `[data-redesign="true"]` provides safe gradual rollout without affecting current users (R-136: "Feature flags via CSS selectors for low-risk design iterations")

## Wave 2 — Surface & Layout System ✅ DELIVERED (2026-03-24)
**Santuário Terapêutico — Material 3 "No-Line Rule" + responsive grid system**
- **Commit:** `1228894` | **PR:** #419 (squash merged)
- **Branch:** feature/redesign/wave-2-surface-layout → main (deleted post-merge)
- **3 Sequential Sprints completed:**
  - **2.1:** Card variants (alert-critical/warning/info/success, card-gradient, card-section), surface utilities (list-tonal, icon-container, status-dot)
  - **2.2:** Responsive grid system (1/2/3/12-col, dashboard, treatments, stock layouts), page container, main-with-sidebar, responsive helpers
  - **2.3:** Integration validation (build ✅, lint ✅, tests ✅, zero file changes outside redesign scope)
- **Code Review:** 4 inline suggestions (1 HIGH + 3 MEDIUM) all applied:
  - HIGH: Class name collision `.icon-container` → `.icon-container-redesign` (avoid BottomNav conflict)
  - MEDIUM: Group alert card common properties (CSS consolidation)
  - MEDIUM: Group grid base selectors (CSS consolidation)
  - LOW: Format .status-dot on separate lines (readability)
- **Quality:** 539/539 testes ✅ | 0 lint errors ✅ | Build success ✅
- **New Files:** layout.redesign.css (255 lines) + tokens.redesign.css extensions (90 lines)
- **Scoping:** All classes aditivas (no conflicts); existing classes scoped with `[data-redesign="true"]` when necessary
- **Rollout Infrastructure:** Gradual rollout ready via localStorage (`mr_redesign_preview`) or URL (`?redesign=1`)
- **Próxima Wave:** Wave 3 — Component Redesign (buttons, cards, inputs, navigation)

## Wave 1 — Typography & Icon System ✅ DELIVERED (2026-03-24)
**Typography (Public Sans + Lexend) + lucide-react icon library**
- **Commit:** `8dde2ca` | **PR:** #418 (squash merged)
- **Branch:** feature/redesign/wave-1-typography-icons → main (fast-forward)
- **3 Sprints completed:**
  - **1.1:** Typography tokens (type scale, font weights ≥400, backward compat aliases, heading defaults, max-line-width)
  - **1.2:** lucide-react v1.0.1 installation (icon mapping table for future waves)
  - **1.3:** Global typography rules scoped in `[data-redesign="true"]` (base text, headings, form elements, antialiasing)
- **Accessibility:** WCAG 2.1 AA compliant (font weight ≥400 for elderly patients, no light/thin fonts)
- **Code Quality:** 539/539 testes ✅ | 0 lint ✅ | 0 Gemini issues ✅
- **Tokens Added:**
  - Font families: `--font-display` (Public Sans), `--font-body` (Lexend)
  - Type scale: display (3.5/2.75/2.25rem), headline (2/1.75/1.5rem), title, label, body
  - Font weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
  - Backward compat: `--text-xs` through `--text-5xl`, `--font-size-*` aliases
  - Heading defaults: h1-h6 with specific weights per level
  - Line heights: tight (1.1), snug (1.25), normal (1.5), relaxed (1.75)
  - Tracking: tight (-0.02em), normal, wide, wider, widest
- **Dependencies:** lucide-react ^1.0.1 (icons always paired with text labels, sizes: 28px nav / 24px base / 20px dense / 16px inline)
- **Documentation:**
  - Journal: `.memory/journal/2026-W13.md` (complete sprint analysis)
  - New rules: R-137 to R-140 (typography accessibility, icon labeling, @import scoping, heading hierarchy)
- **Lessons Learned:**
  - Token systems need both semantic (display/headline/title) AND numeric (text-4xl/3xl/2xl) aliases for compatibility
  - Form element inheritance works via CSS cascading; explicit selectors improve maintainability
  - Complete heading hierarchy upfront (size × weight × line-height × tracking) prevents UX inconsistency

## Wave 3 — Component Library Primitives ✅ DELIVERED (2026-03-24)
**Santuário Terapêutico — Material Design 3 components (Button, Card, Badge, Input, Progress, ListItem)**
- **Commit:** `b7293a6` | **PR:** #420 (squash merged)
- **Branch:** feature/redesign/wave-3-component-primitives → main (deleted post-merge)
- **6 Sprints completed:**
  - **3.1:** Button redesign (6 variants: primary/secondary/outline/ghost/danger/danger-ghost, touch-first sizing)
  - **3.2:** Card redesign (3 variants: default/gradient/alert with ambient shadows, no borders)
  - **3.3:** Inputs & forms (complete form styling, search wrapper, accessible focus/disabled states)
  - **3.4:** Badge component (NEW: `Badge.jsx`, 5 semantic variants: critical/warning/success/info/neutral)
  - **3.5:** Progress bars (semantic colors, labeled progress, full-width container)
  - **3.6:** List items (no dividers, icon circles, title/subtitle structure, hover/active states)
- **Code Review & Fixes:** 9 inline suggestions (6 HIGH + 2 MEDIUM + 1 HIGH via ChatGPT Codex) ALL APPLIED:
  - HIGH (Colors): Line 150 `#ffffff` → CSS var; Line 156 `#a51515` → color-mix; Lines 340/350/360/370 badge rgba → color-mix
  - HIGH (API): Line 80 removed `min-height: 56px` from primary variant (was overriding size classes)
  - MEDIUM: Consolidated `.btn-secondary` + `.btn-outline` shared rules (36 → 16 lines)
  - MEDIUM: Consolidated `.list-item-icon` + `.list-item-icon-sm` base styles
- **Single Commit:** `f0d33c8` "fix(redesign): replace hardcoded colors with CSS variables..." (all 9 fixes atomic)
- **Quality:** 539/539 testes ✅ | 0 lint errors ✅ | Gemini + ChatGPT approval ✅
- **New Components:** Badge.jsx (20 lines, simple semantic component, CSS-only styling)
- **New Rules:** R-118 (CSS color system), R-119 (button size class preservation), R-120 (CSS consolidation)
- **New Anti-Patterns:** AP-024 (hardcoded colors bypass design system), AP-W02 (size override), AP-C02 (duplication)
- **Critical Learning:** Skipping `.memory/rules.md` consult BEFORE coding = 80% of review issues
  - AP-023 reinforced (memory file reading is non-negotiable R-065)
  - Implementation order: Read memory → Check pattern → Then code
- **Documentation:**
  - Journal: `.memory/journal/2026-W13.md` (comprehensive Wave 1-3 analysis)
  - Rules: R-118 to R-120 + 3 new anti-patterns registered
  - MEMORY.md updated (this section)
