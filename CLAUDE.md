# CLAUDE.md — Dosiq

> **DEVFLOW** = processo oficial. Skill: `/devflow` | Memória: `.agent/memory/` | Estado: `.agent/state.json`
>
> **Antes de qualquer tarefa:** ler `.agent/state.json` → `/devflow` (hot+warm; cold sob demanda) → carregar `R-221 SQP` antes de alterar código → `/deliver-sprint` para entregas → `/devflow distill` quando `journal_entries >= 15`.
>
> **Este arquivo é o mínimo carregado em toda sessão.** Detalhe mora nos catálogos (`R-NNN`/`AP-NNN`/`ADR-NNN` em `.agent/memory/`) e em `docs/standards/` — os ponteiros aqui são obrigatórios de seguir quando o domínio é tocado.

## Projeto

**Dosiq** — gerenciamento de medicamentos. Monorepo npm workspaces + Turborepo, **100% TypeScript** (épico 040).

| App | Stack | Deploy |
|-----|-------|--------|
| `apps/web` (`@dosiq/web`) | React 19 + Vite 7 + TS 5.9 + Supabase + Zod 4 + Vitest 4 (PWA) | Vercel Hobby |
| `apps/mobile` (`@dosiq/mobile`) | Expo 53 + RN 0.79 + TS 5.9 + React Nav 7 + Jest | EAS (iOS/Android) |

Versões atuais: topo do `CHANGELOG.md` — não confiar em versão hardcoded em doc.

## Estrutura

```
apps/web/src/      features/ schemas/(Zod, único local) services/api/ shared/ utils/
                   views/(composição, todas lazy exceto Dashboard — R-279/R-117;
                          lógica de domínio desce p/ @dosiq/core ou features/)
apps/mobile/       Expo; configs Expo ficam .js (app.config.js, eas.json, metro, babel)
packages/          core/(compartilhado web↔mobile) config/ design-tokens/ shared-data/ storage/
api/               Vercel serverless (máx 12 — R-090; ver api/CLAUDE.md)
server/bot/        Telegram bot
.agent/            DEVFLOW — rules/APs/ADRs/journal
```

## Path Aliases (`apps/web/vite.config.js`)

```
@ @features @shared @services @schemas @utils @dashboard @medications @protocols
@stock @adherence @calendar @emergency @prescriptions @settings(→views/settings)
@design-tokens(→packages/design-tokens/src) @dosiq/core(→packages/core/src)
```

SEMPRE aliases, NUNCA relativo longo. Aliases vivem em 3 configs que DEVEM espelhar: `vite.config.js` + `apps/web/tsconfig.json` + `eslint.config.js` (AP-238).

## Convenções

Código EN · comentários/JSDoc/UI/erros PT · commits PT semântico (`feat(scope): descrição`) · DB snake_case EN.
Componentes `PascalCase.tsx` · hooks `usePascal` · constantes `SCREAMING_SNAKE` · schemas `{name}Schema.ts` · tipos via `z.infer<>`.
**Ordem React (TDZ):** States → Memos → Effects → Handlers.
**Imports:** React/libs → componentes → hooks/utils → services/schemas → CSS.

## TypeScript — regime e gate

`strict: false` base + **strict islands** nível A (core types/repositories/services/schemas, server/notifications, hooks clínicos). Detalhe: `docs/standards/TYPESCRIPT.md`.

- **Gate obrigatório (R-283/R-284):** `./scripts/strict-island.sh` em toda sessão que toca código — nível A sujo e erro cross-program BLOQUEIAM; dívida B tem teto por bucket (catraca só desce).
- Imports relativos em `server/`/`api/` e packages src-cru: SEMPRE `.js` (R-282); extensionless só em código de bundler.
- Core: união discriminada estreita com `=== false`, nunca `!x.success` (R-286). Exports públicos sem `any`.
- `tsc -p apps/web/tsconfig.json --noEmit` = ZERO erros, sempre.

## Regras Críticas

### 🔴🔴 Coluna de tabela: VERIFICAR NO BANCO antes de tipar (R-295)

**Nenhum nome de coluna entra em tipo, Zod, `select()`, filtro, insert/update ou RPC sem verificação no banco (1 chamada MCP no `information_schema`). Sem exceção.** O select é string: tsc/lint/teste NÃO pegam campo fantasma — só produção pega (AP-300, #749: derrubou web+mobile+cron).

Hierarquia de verdade: **banco** > `database.types.ts` (se regen em dia — R-289) > Zod > tipo à mão (*Like = hipótese) > este doc > sua memória. Escrever select a partir dos últimos 4 É o bug.

**Gate de saída** — select novo/alterado só vale EXECUTADO:
```bash
curl -s "$SUPABASE_URL/rest/v1/<tabela>?select=<SELECT>&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
(supabase-js remove whitespace do select → reproduzir com `tr -d '[:space:]'`. `200` ok · `42703` coluna · `42501` grant · `PGRST200` FK.)

### 🔴 Fato histórico não se resolve por join (R-299)

Linha que registra um FATO datado (dose agendada, tomada, compra) carrega os atributos que a
descrevem — **nunca** os deriva da entidade viva na leitura: a entidade evolui e o passado muda
junto, retroativamente, sem log nem teste vermelho. Identidade do medicamento de uma dose sai de
`dose_instances.medicine_id` via `resolveInstanceMedicine` (`@dosiq/core`); `instance.protocol.medicine`
é o bug (spec 052 · ADR-084 · `docs/architecture/DOSE_INSTANCES.md` §3.1).

### Antes de modificar arquivo
`find apps/web/src -name "*Nome*"` (duplicatas) → `grep -r "from.*Nome"` (quem importa) → conferir alias.

### Datas/Timezone (R-020)
SEMPRE `parseLocalDate()` de `@utils/dateUtils`; NUNCA `new Date('YYYY-MM-DD')` (UTC midnight = dia anterior em GMT-3).

### Zod (R-021)
Enums pt-BR **com acento** (o CHECK rejeita sem — 23514; valores verbatim em §Schemas) · `safeParse()` p/ validação não-bloqueante · nullable = `.nullable().optional()`, nunca só `.optional()` · na dúvida `pg_get_constraintdef` é a verdade.

### Dosagem
`quantity_taken` em comprimidos, não mg (limite Zod 100) · `dosage_per_intake` = cp/dose · `dosage_per_pill` = mg/cp · **ordem: Validar → Registrar → Decrementar estoque** · LogForm retorna array (plan/bulk) ou objeto (protocol/single) — checar `Array.isArray()`.

### Plataforma (ponteiros obrigatórios)
- **Mobile/lazy**: views lazy + `ViewSkeleton` (R-117); perf: `docs/standards/MOBILE_PERFORMANCE.md`.
- **Telegram bot**: callback <64 bytes, `escapeMarkdownV2` (escapar `\` primeiro) — R-031.
- **Migrações Supabase**: template de grants + SECURITY DEFINER **obrigatório** — `docs/standards/SUPABASE_MIGRATIONS.md` (novas tabelas NÃO ganham grants automáticos).
- **Vercel api/** (R-090): máx 12 funções (utilitários em `api/_prefixo/`); NUNCA `process.exit()`; SEMPRE `res.status(code).json(body)` (lint barra); env fallback `process.env.X || process.env.VITE_X`. Ver `api/CLAUDE.md`.

## Testes

| Uso | Comando |
|-----|---------|
| **Agente (obrigatório)** | `rtk npm run validate:agent` (kill switch 600s) |
| Críticos | `rtk npm run test:critical` |
| Alterados desde main | `npm run test:changed` |
| CI completo | `rtk npm run validate:full` |

`afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); })` obrigatório · datas em fixture SEMPRE locais, nunca `toISOString()` p/ derivar dia (AP-270) · teste novo nasce strict-limpo · mobile: `npm test --workspace @dosiq/mobile`. Detalhe: `docs/standards/TESTING.md`.

## DEVFLOW C5 (antes do commit) + SQP

- Bug não-trivial → `AP-NNN` · padrão novo → `R-NNN` · decisão → `ADR-NNN` (índices + detail em `.agent/memory/`)
- Entrega → journal (`.agent/memory/journal/YYYY-WWW.jsonl`) + `state.json` (counter)
- **SQP (R-221) antes de alterar código**: classificar impacto SemVer, bump, changelog PT (`docs/standards/CHANGELOG_AND_RELEASES.md` — R-242/243/244)
- `plans/` é **local-only** (gitignored) — refs em docs marcam "(local-only, não versionado)"
- **Distill**: auto quando counter ≥15; manual obrigatório ao fechar fase/épico. D5 reconcilia state × índices.

## Git Workflow

```
1. /devflow bootstrap → 2. branch → 3. SQP (R-221) → 4. C1-C4
5. validate:agent + strict-island.sh → 6. RC5 self-review (/devflow code-review) ANTES do PR
7. C5 → 8. commit PT → 9. push + PR → 10. RC6 review independente (obrigatório Tier 1+)
11. AGUARDAR aprovação → USER mergeia (R-060 — NUNCA auto-merge) → 12. C5 pós-merge
```

**Review (pós-Gemini, ADR-069):** L0 lint → L1 RC5 → L2 RC6 → L3 humano. Operação completa, comandos, chunking, egress guard e regras de quota: **`docs/standards/AI_REVIEW.md`** (leitura obrigatória antes de rodar RC6). Essência: `bash ~/SKILLS/devflow/scripts/ai-review.sh <PR#> --post` após abrir PR Tier 1+; roda UMA vez; finding `introduced` critical/high resolve antes de pedir aprovação; zero findings em diff gordo = conferir stderr; finding de schema → verificar no banco (R-295 vale contra o revisor). 📏 Até T051: appendar linha de medição em `plans/specs/034-gemini-sunset/measurement.md` no C5.

**Gitdir externo (Mac Mini):** `docs/getting-started/GIT_ARCHITECTURE.md`; sync via `gsync`.

## Schemas — enums (verificados contra CHECK de prod 2026-07-16)

> Acento e caixa fazem parte do valor: `'diario'` e `'cp'` são REJEITADOS pelo banco (23514).
> Fonte: `packages/core/src/schemas/{medicineSchema,protocolSchema}.ts` — na dúvida, o banco.

| Enum | Valores | Coluna |
|------|---------|--------|
| `DOSAGE_UNITS` | `mg` `mcg` `g` `mg/ml` `ui/ml` `ui` `un` | `medicines.dosage_unit` — líquido := `LIKE '%/ml'` |
| `MEDICINE_TYPES` | `medicamento` `suplemento` | `medicines.type` (NATUREZA, não forma) |
| `PRESENTATIONS` | `comprimido` `capsula` `liquido` `injetavel` `pomada` `spray` `outro` | `medicines.presentation` (a FORMA) |
| `FREQUENCIES` | `diário` `dias_alternados` `semanal` `personalizado` `quando_necessário` | `protocols.frequency` — ⚠️ COM acento |
| `INTAKE_UNITS` | `gotas` `ml` `UI` `mg` | `protocols.intake_unit` — ⚠️ `UI` maiúsculo; comprimido = **NULL**, não `'cp'` |

**Armadilhas que já causaram bug (AP-299, #749):** `DOSAGE_UNITS` ≠ `INTAKE_UNITS` (enums diferentes; `cp` não existe em nenhum) · `titration_steps.intake_unit` aceita `'cp'`, `protocols.intake_unit` não → fronteira N2→N1 usa `NULLIF(unit,'cp')` (CON-032 §5).

## MCP code-review-graph

Usar **antes** de Grep/Glob/Read: `semantic_search_nodes` (achar símbolo) · `get_impact_radius` (blast radius) · `query_graph` (callers/tests) · `get_architecture_overview`.
