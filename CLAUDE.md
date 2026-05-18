# CLAUDE.md — Dosiq

> **DEVFLOW** = processo oficial. Skill: `/devflow` | Def: `.agent/DEVFLOW.md` | Memória: `.agent/memory/`
>
> **Antes de qualquer tarefa:** ler `.agent/state.json` → `/devflow` (hot+warm; cold sob demanda) → `/deliver-sprint` para entregas → `/devflow distill` quando `journal_entries >= 15`.

## Projeto

**Dosiq v4.0.0** — gerenciamento de medicamentos. Monorepo npm workspaces + Turborepo.

| App | Stack | Deploy |
|-----|-------|--------|
| `apps/web` (`@dosiq/web` v4.0.0) | React 19 + Vite 7 + Supabase + Zod 4 + Framer Motion 12 + Vitest 4 (PWA Workbox) | Vercel Hobby |
| `apps/mobile` (`@dosiq/mobile` v0.3.3) | Expo 53 + RN 0.79 + React Nav 7 + Firebase Analytics + AsyncStorage | EAS (iOS/Android) |

---

## Estrutura

```
apps/
  web/src/
    features/      # adherence calendar chatbot consultation dashboard emergency
                   # export medications notifications prescriptions profile
                   # protocols reports settings stock
    schemas/       # Zod — ÚNICO local
    services/api/  # adherenceService, dlqService, geminiReviewService
    shared/        # components/ hooks/ platform/ services/ styles/ utils/
    utils/         # adherenceLogic, dateUtils, titrationUtils
    views/         # wrappers — TODAS lazy (R-117), exceto Dashboard
  mobile/          # Expo: src/ assets/ android/ ios/ __tests__/
                   # App.js, app.config.js, eas.json, metro.config.js
packages/
  core/            # @dosiq/core — lógica compartilhada web↔mobile
  config/          # configs comuns
  design-tokens/   # @design-tokens — tokens CSS/JS
  shared-data/     # dados estáticos compartilhados
  storage/         # abstração storage (web localStorage / RN AsyncStorage)
api/               # Vercel serverless (máx 12 — Hobby R-090)
                   # routers: dlq, gemini-reviews, notify, share, telegram,
                   # chatbot, register-webpush, health/notifications
server/bot/        # Telegram bot (tasks, scheduler, bot-factory)
.agent/            # DEVFLOW — rules/APs/ADRs/knowledge/journal
```

---

## Path Aliases (`apps/web/vite.config.js`)

```
@ @features @shared @services @schemas @utils
@dashboard @medications @protocols @stock @adherence
@calendar @emergency @prescriptions @settings(→views/redesign/settings)
@design-tokens(→packages/design-tokens/src)
@dosiq/core(→packages/core/src)
```

SEMPRE usar aliases. NUNCA caminhos relativos longos.

---

## Convenções

| Contexto | Idioma |
|----------|--------|
| Código (vars/funções) | Inglês |
| Comentários, JSDoc, UI, erros | Português |
| Commits | Português semântico (`feat(scope): descrição`) |
| DB tables/columns | Inglês snake_case |

**Nomes:** Componentes `PascalCase` · funções/vars `camelCase` · constantes `SCREAMING_SNAKE` · hooks `usePascal` · services `camelCase.js` · schemas `{name}Schema.js`.

**Ordem React (TDZ crítico):** States → Memos → Effects → Handlers.

**Imports:** React/libs → componentes internos → hooks/utils (`@shared`) → services/schemas → CSS (último).

---

## Regras Críticas

### Antes de modificar arquivo
1. `find apps/web/src -name "*Nome*"` (duplicatas)
2. `grep -r "from.*Nome" apps/web/src/` (importações)
3. Confirmar alias em `apps/web/vite.config.js`

### Datas/Timezone
- **SEMPRE** `parseLocalDate()` de `@utils/dateUtils`
- **NUNCA** `new Date('YYYY-MM-DD')` → UTC midnight = dia anterior em GMT-3

### Zod
- Enums em português: `['diario','semanal','quando_necessario']`
- `safeParse()` para validação não-bloqueante
- Nullable: `.nullable().optional()` (nunca só `.optional()`)
- Schemas sincronizados com CHECK constraints SQL

### Dosagem
- `quantity_taken` em comprimidos (não mg) — limite Zod 100
- `dosage_per_intake` = cp/dose · `dosage_per_pill` = mg/cp
- **Ordem dose:** Validar → Registrar → Decrementar estoque
- LogForm retorna array (plan/bulk) ou objeto (protocol/single) — checar `Array.isArray()`

### Lazy Loading mobile (R-117)
- Views (exceto Dashboard) **DEVEM** ser `React.lazy()` + `Suspense`
- Suspense fallback **DEVE** ser `ViewSkeleton`
- Vite manualChunks: vendor-{framer,supabase,virtuoso,pdf} + feature-{history,stock,landing,medicines-db}
- Bundle: **102.47 kB gzip** (de 989KB — 89% redução)

### Telegram bot
- Callback data <64 bytes (índices, não UUIDs)
- `escapeMarkdownV2()` sempre — escapar `\` **primeiro**
- `shouldSendNotification()` já loga — não chamar `logNotification()` depois
- Session: `await getSession(chatId)` para `userId` dinâmico

### Migrações Supabase

**Grants obrigatórios** a partir de 30/10/2026, novas tabelas no projeto não recebem grants automáticos.
Template obrigatório após `CREATE TABLE`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO service_role;
-- anon: apenas se a tabela tiver dados verdadeiramente públicos (raro no dosiq)
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;
```

**Funções SECURITY DEFINER** — regras obrigatórias:
- `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;` antes de qualquer `GRANT` explícito
- `REVOKE EXECUTE ON FUNCTION ... FROM anon;` sempre (usuários não autenticados não devem chamar RPCs privilegiadas)
- `SET search_path = ''` no cabeçalho da função (previne search path injection)
- Usar `public.<tabela>` (schema qualificado) no body quando `search_path = ''`

---

### Vercel Serverless (R-090)
- Hobby: **máx 12 funções**. Utilitários em `api/_prefixo/` não contam
- Verificar budget antes de criar `.js` em `api/` (ver `api/CLAUDE.md`)
- **NUNCA** `process.exit()` → `throw new Error()`
- **SEMPRE** `res.status(code).json(body)` (nunca `res.json()`)
- Env vars: fallback `process.env.X || process.env.VITE_X`

---

## Testes (Vitest 4 — `@dosiq/web`)

Rodar do root via workspace:

| Uso | Comando |
|-----|---------|
| **Agente (obrigatório)** | `rtk npm run validate:agent` (kill switch 600s) |
| Críticos | `rtk npm run test:critical` |
| Alterados desde main | `npm run test:changed` |
| CI completo | `rtk npm run validate:full` (lint+ci+build) |
| Dev rápido | `rtk npm run test:fast` |

**Regras:** `afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); })` obrigatório · `vi.mock()` antes dos imports · `waitFor()` em vez de `setTimeout` em `act()` · arquivo de teste ≤300 linhas.

**Mobile:** Jest + jest-expo (`npm test --workspace @dosiq/mobile`).

---

## DEVFLOW C5 (antes do commit)

- Bug não-trivial → `AP-NNN` em `.agent/memory/anti-patterns.json` + `_detail/`
- Padrão novo → `R-NNN` em `rules.json` + `rules_detail/`
- Decisão arquitetural → `ADR-NNN` em `decisions.json` + `decisions_detail/`
- Entrega significativa → `.agent/memory/journal/YYYY-WWW.jsonl` (append)
- Atualizar `.agent/state.json` (`journal_entries_since_distillation`)

`.memory/` aposentado (somente leitura W01-W11). Tudo novo → `.agent/memory/`.

## Distill Policy (dosiq — pós-Fase 2.5)

**Threshold automático**: `genes.memory_distillation_threshold = 15` (mantido).
Auto-trigger quando `journal_entries_since_distillation >= 15`.

**Trigger manual obrigatório**: ao encerrar QUALQUER fase de evolução
(Fase 0/1/2/2.5/3/4/5/6), rodar `/devflow distill` imediatamente após o PR de
RETRO + DEVFLOW C5 ser mergeado — independente do threshold.

**Por quê**: fases entregam ~3-8 journal entries cada; com threshold 15, distill
auto pode atrasar 2-3 fases. Trigger manual pós-fase mantém memória "fresh" no
ponto de transição, evitando counter drift (AP-161) e perdendo a janela em que
os aprendizados ainda estão vivos no contexto.

**Avaliar baixar threshold pra 10 após Fase 4** se distill manual virar overhead.

Distill bem-feito DEVE incluir D5 self-clean profundo (reconciliar
`state.json` contra índices markdown — fonte de verdade).

---

## Git Workflow

```
1. /devflow bootstrap
2. branch (feature/wave-X/nome)
3. C1-C4
4. rtk npm run validate:agent
5. C5 — registrar lições
6. commit semântico (PT)
7. push + PR
8. AGUARDAR Gemini review → aplicar
9. AGUARDAR aprovação → USER faz merge (R-060 — agente nunca auto-merge)
10. C5 pós-merge + distill se journal>=15
```

Tipos: `feat fix docs test refactor style chore`.

**Gitdir externo (Mac Mini):** `docs/setup/GIT_ARCHITECTURE.md`. Usar `gsync` para sync origin+bridge.

---

## Schemas — enums

- `DOSAGE_UNITS`: `mg mcg g ml ui cp gotas`
- `MEDICINE_TYPES`: `comprimido capsula liquido injecao pomada spray outro`
- `FREQUENCIES`: `diario dias_alternados semanal personalizado quando_necessario`
- Stock: CRITICAL <7d · LOW <14d · NORMAL <30d · HIGH ≥30d

---

## Serviços-chave

- **adherenceService** (`apps/web/src/services/api/`): `calculateAdherence(period)`, `calculateProtocolAdherence(id,period)`, `calculateAllProtocolsAdherence(period)`, `getCurrentStreak()`, `getDailyAdherence(days)`, `getAdherenceSummary(period)`
- **analyticsService** (`features/dashboard/services/`): `track`, `getEvents`, `getSummary` — localStorage, máx 1000 eventos/30d
- **insightService** (`features/dashboard/services/`): prioridade `critical>high>medium>low>info`, frequency capping via localStorage

---

## MCP code-review-graph

Usar **antes** de Grep/Glob/Read — mais rápido, dá contexto estrutural.

| Tool | Quando |
|------|--------|
| `semantic_search_nodes` | achar funções/classes por nome |
| `detect_changes` | revisar mudanças com risk score |
| `get_impact_radius` | blast radius |
| `query_graph` | rastrear callers/callees/imports/tests |
| `get_architecture_overview` | visão alto nível |

---

## Lições críticas (Sprint 7)

Schema drift Zod/SQL · env vars faltando em prod (validar startup + fallbacks) · auth faltando para blob privado · `res.json()` quebra no Vercel · `.optional()` rejeita null · nunca auto-merge sem review.
