# CLAUDE.md — Dosiq

> **DEVFLOW** = processo oficial. Skill: `/devflow` | Memória: `.agent/memory/`
>
> **Antes de qualquer tarefa:** ler `.agent/state.json` → `/devflow` (hot+warm; cold sob demanda) → carregar `R-221 SQP` antes de alterar código → `/deliver-sprint` para entregas → `/devflow distill` quando `journal_entries >= 15`.

## Projeto

**Dosiq** — gerenciamento de medicamentos. Monorepo npm workspaces + Turborepo. **100% TypeScript desde o épico 040** (2026-07-08; `strict: false` global + strict islands — ver §TypeScript).

| App | Stack | Deploy |
|-----|-------|--------|
| `apps/web` (`@dosiq/web`) | React 19 + Vite 7 + **TS 5.9** + Supabase + Zod 4 + Framer Motion 12 + Vitest 4 (PWA Workbox) | Vercel Hobby |
| `apps/mobile` (`@dosiq/mobile`) | Expo 53 + RN 0.79 + **TS 5.9** + React Nav 7 + Firebase Analytics + AsyncStorage | EAS (iOS/Android) |

Versões atuais: sempre no `CHANGELOG.md` (topo) — não confiar em versões hardcoded em docs.

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
    views/         # camada de COMPOSIÇÃO — orquestra hooks/services/features (R-279)
                   # TODAS lazy (R-117), exceto Dashboard; subpastas history/ profile/
                   # settings/ emergency/ landing/. NÃO nasce lógica de domínio aqui
                   # (desce p/ @dosiq/core ou features/). Naming "redesign" aposentado (038)
  mobile/          # Expo: src/ assets/ android/ ios/ __tests__/
                   # App.tsx, index.ts; configs Expo ficam .js (app.config.js,
                   # eas.json, metro.config.js, babel.config.js — FR-010 do 040)
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
@calendar @emergency @prescriptions @settings(→views/settings)
@design-tokens(→packages/design-tokens/src)
@dosiq/core(→packages/core/src)
```

SEMPRE usar aliases. NUNCA caminhos relativos longos.
Aliases vivem em 3 configs que DEVEM espelhar: `vite.config.js` + `apps/web/tsconfig.json` (`paths`) + `eslint.config.js` (resolver). Mover alias = atualizar os três (AP-238).

---

## Convenções

| Contexto | Idioma |
|----------|--------|
| Código (vars/funções) | Inglês |
| Comentários, JSDoc, UI, erros | Português |
| Commits | Português semântico (`feat(scope): descrição`) |
| DB tables/columns | Inglês snake_case |

**Nomes:** Componentes `PascalCase.tsx` · funções/vars `camelCase` · constantes `SCREAMING_SNAKE` · hooks `usePascal` · services `camelCase.ts` · schemas `{name}Schema.ts` · tipos derivados de schema via `z.infer<>`.

**Ordem React (TDZ crítico):** States → Memos → Effects → Handlers.

**Imports:** React/libs → componentes internos → hooks/utils (`@shared`) → services/schemas → CSS (último).

---

## TypeScript (pós-040 — obrigatório)

Monorepo 100% TS. Regime: `strict: false` na base (`tsconfig.base.json`, moduleResolution bundler) + **strict islands** (`tsconfig.strict.json`, `strictNullChecks`) nos módulos nível A: `packages/core/src/{types,repositories,services,schemas}`, `server/notifications/`, hooks clínicos web/mobile. Meta futura: `strict: true` global.

**Gate permanente (R-283/R-284):** `./scripts/strict-island.sh` em TODA sessão que toca código — fonte nível A suja e erro cross-program (core compilado dentro dos programas api/server/mobile) são BLOQUEANTES; dívida nível B conta contra tetos por bucket (catraca: só desce, nunca sobe; abaixar o teto no mesmo commit que queima dívida).

- **Extensões (R-282):** imports relativos em `server/`/`api/` SEMPRE com `.js` (Node ESM puro; aponta pro `.ts` em compile). Vale também para packages que exportam src cru (`shared-data`/`storage`/`config`/`design-tokens`) e para os `.d.ts` do core (pós-build `packages/core/scripts/fix-dts-extensions.mjs` — não remover do build). Extensionless SÓ em código de bundler (Vite/Metro).
- **Nível A vs B:** exports públicos do core = 100% anotados, zero `any` (nível A). Código nível B tolera `any` interno com `// TODO(040-strict)` — mas se o fix real custa ≤ o any, fazer o fix real.
- **Narrowing no core (R-286):** união discriminada estreita com `=== false`, nunca `!x.success` (consumers non-strict não discriminam com `!`).
- **Dívida congelada:** web 37 + server 36 erros nível B (tetos no script). **Regra on-touch:** épico que tocar domínio X triageia/tipa os testes e a dívida de X antes de refatorar. Teste novo nasce strict-limpo.
- **Tipos DB:** `packages/shared-data/src/database.types.ts` gerado (`npm run supabase:types`); client tipado `SupabaseClient<Database>`. Exceção: client do `server/` ainda sem generic (cast de fronteira documentado; resolver no 043).
- `tsc -p apps/web/tsconfig.json --noEmit` deve permanecer ZERO erros.

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
- Enums em português **com acento**: `['diário','semanal','quando_necessário']` — o acento É o valor;
  o CHECK rejeita a versão sem (23514). Valores verbatim em §Schemas — enums.
- `safeParse()` para validação não-bloqueante
- Nullable: `.nullable().optional()` (nunca só `.optional()`)
- Schemas sincronizados com CHECK constraints SQL — na dúvida, `pg_get_constraintdef` é a verdade, não este doc

### Dosagem
- `quantity_taken` em comprimidos (não mg) — limite Zod 100
- `dosage_per_intake` = cp/dose · `dosage_per_pill` = mg/cp
- **Ordem dose:** Validar → Registrar → Decrementar estoque
- LogForm retorna array (plan/bulk) ou objeto (protocol/single) — checar `Array.isArray()`

### Lazy Loading mobile (R-117)
- Views (exceto Dashboard) **DEVEM** ser `React.lazy()` + `Suspense`
- Suspense fallback **DEVE** ser `ViewSkeleton`
- Vite manualChunks: vendor-{framer,supabase,virtuoso,pdf} + feature-{history,stock,landing} (medicines-db removido na 037 — JSON fora do build)
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
- Verificar budget antes de criar `.ts` em `api/` (ver `api/CLAUDE.md`)
- api/ é transpilado arquivo-a-arquivo pela Vercel (nodenext): import relativo `.js` obrigatório mesmo entre `.ts` (R-282); evitar `Object.hasOwn` (lib do builder < es2022)
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

**Regras:** `afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); })` obrigatório · `vi.mock()` antes dos imports · `waitFor()` em vez de `setTimeout` em `act()` · arquivo de teste ≤300 linhas · datas em fixture SEMPRE locais, nunca `toISOString()` p/ derivar dia (AP-270) · teste novo nasce strict-limpo; mock tipado contra o contrato atual do módulo (erro TS em teste costuma ser mock stale).

**Mobile:** Jest + jest-expo (`npm test --workspace @dosiq/mobile`).

---

## DEVFLOW C5 (antes do commit)

- Bug não-trivial → `AP-NNN` em `.agent/memory/ANTI_PATTERNS_INDEX.md` + `anti-patterns/_domain_/`
- Padrão novo → `R-NNN` em `.agent/memory/RULES_INDEX.md` + `rules/_domain_/`
- Decisão arquitetural → `ADR-NNN` em `.agent/memory/DECISIONS_INDEX.md` + `decisions/_domain_/`
- Entrega significativa → `.agent/memory/journal/YYYY-WWW.jsonl` (append)
- SQP release log → plataformas afetadas, tipo de bump, versões novas, entrada `CHANGELOG.md`, relevância para notas de loja
- Atualizar `.agent/state.json` (`journal_entries_since_distillation`)

`.memory/` aposentado (somente leitura W01-W11). Tudo novo → `.agent/memory/`.

> **`plans/` é local-only** (gitignored desde 2026-06-23). Specs em `plans/specs/NNN-nome/`
> existem apenas no disco do PO — não são versionadas. Histórico purgado do GitHub
> (git-filter-repo + force-push). Refs em docs devem indicar "(local-only, não versionado)".

## SQP (R-221) — obrigatório antes de alterar código

- Seguir `R-221` como porta de entrada para qualquer alteração de código.
- SQP inclui classificação de impacto SemVer, bump de versão quando aplicável, changelog estruturado em português e logging no DEVFLOW C5.
- Não atualizar changelog de forma avulsa; usar `docs/standards/CHANGELOG_AND_RELEASES.md` e regras `R-242`, `R-243`, `R-244`.

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
3. R-221 SQP — classificar impacto, plataforma, versionamento e changelog
4. C1-C4
5. rtk npm run validate:agent + ./scripts/strict-island.sh (ratchet TS — R-283)
6. C5 — registrar lições + release log SQP
7. commit semântico (PT)
8. push + PR
9. AGUARDAR Gemini review → aplicar
10. AGUARDAR aprovação → USER faz merge (R-060 — agente nunca auto-merge)
11. C5 pós-merge + distill se journal>=15
```

Tipos: `feat fix docs test refactor style chore`.

**Gitdir externo (Mac Mini):** `docs/getting-started/GIT_ARCHITECTURE.md`. Usar `gsync` para sync origin+bridge.

---

## Schemas — enums

> Valores **verbatim** — conferidos contra os CHECK de prod E contra os schemas em 2026-07-16.
> Acento e caixa fazem parte do valor: `'diario'` e `'cp'` são REJEITADOS pelo banco (23514).
> Fonte: `packages/core/src/schemas/{medicineSchema,protocolSchema}.ts`.

| Enum | Valores | Coluna / CHECK |
|------|---------|----------------|
| `DOSAGE_UNITS` | `mg` `mcg` `g` `mg/ml` `ui/ml` `ui` `un` | `medicines.dosage_unit` — mg/ml e ui/ml são razões massa/volume: **líquido := `dosage_unit LIKE '%/ml'`** |
| `MEDICINE_TYPES` | `medicamento` `suplemento` | `medicines.type` — é a NATUREZA, não a forma |
| `PRESENTATIONS` | `comprimido` `capsula` `liquido` `injetavel` `pomada` `spray` `outro` | `medicines.presentation` — a FORMA farmacêutica mora aqui |
| `FREQUENCIES` | `diário` `dias_alternados` `semanal` `personalizado` `quando_necessário` | `protocols.frequency` — ⚠️ **`diário` e `quando_necessário` COM acento** |
| `INTAKE_UNITS` | `gotas` `ml` `UI` `mg` | `protocols.intake_unit` — ⚠️ **`UI` maiúsculo**; comprimido = **NULL**, não `'cp'` |

- Stock: CRITICAL <7d · LOW <14d · NORMAL <30d · HIGH ≥30d

**Duas armadilhas que já causaram bug (AP-299, #749):**
- `DOSAGE_UNITS` (mg/cp do medicamento) ≠ `INTAKE_UNITS` (unidade da tomada no protocol). São enums
  DIFERENTES, com valores diferentes. `cp` não existe em nenhum dos dois — comprimido é `intake_unit NULL`.
- `titration_steps.intake_unit` aceita `'cp'`; `protocols.intake_unit` **não**. Ao escrever de um pro
  outro: `NULLIF(unit, 'cp')` (fronteira N2→N1 — CON-032 §5).

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
