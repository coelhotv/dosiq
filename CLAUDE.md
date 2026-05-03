# CLAUDE.md — Dosiq

> **DEVFLOW é o processo oficial de desenvolvimento deste projeto.**
> Skill: `/devflow` | Definição completa: `.agent/DEVFLOW.md` | Memória canônica: `.agent/memory/`
>
> **Antes de qualquer tarefa:**
> 1. Leia `.agent/state.json`
> 2. Execute `/devflow` (bootstrap: `hot` + `warm` por contexto; `cold` sob demanda)
> 3. Use `/deliver-sprint` para entregas e `/devflow distill` quando `journal_entries >= 15`

## Projeto

**Dosiq** — PWA de gerenciamento de medicamentos. React 19 + Vite 7 + Supabase + Zod 4 + Framer Motion 12 + Vitest 4. Deploy: Vercel Hobby (grátis).

**v3.3.0** — Fases 1-5 ✅ + Mobile M0-M8 ✅ + HealthHistory P1-P4 ✅ + Chatbot F8.1 ✅ + Redesign Wave 4-5 ✅
**Próxima:** Wave 6 — Dashboard Redesign (`plans/backlog-redesign/`)

---

## Estrutura do Projeto

```
apps/web/src/
  features/        # adherence/ dashboard/ medications/ protocols/ stock/
  schemas/         # Schemas Zod — ÚNICO local
  services/api/    # adherenceService.js, dlqService.js (somente estes 2)
  shared/
    components/    # ui/ log/ pwa/ onboarding/ gamification/
    hooks/         # useCachedQuery, useTheme, usePushSubscription
    services/      # cachedServices, migrationService, api/logService
    utils/         # supabase.js, queryCache.js
    styles/        # CSS tokens, temas
  utils/           # adherenceLogic, dateUtils, titrationUtils
  views/           # View wrappers — TODAS lazy-loaded (R-117)
api/               # Vercel serverless (máx 12 funções — Hobby)
server/bot/        # Telegram bot (tasks.js, scheduler.js, bot-factory.js)
.agent/            # DEVFLOW — memória canônica (rules/APs/ADRs/knowledge/journal)
```

---

## Path Aliases (`apps/web/vite.config.js`)

```
@           → apps/web/src/
@features   → apps/web/src/features/
@shared     → apps/web/src/shared/
@services   → apps/web/src/services/
@dashboard  → apps/web/src/features/dashboard/
@medications → apps/web/src/features/medications/
@protocols  → apps/web/src/features/protocols/
@stock      → apps/web/src/features/stock/
@adherence  → apps/web/src/features/adherence/
@schemas    → apps/web/src/schemas/
@utils      → apps/web/src/utils/
@design-tokens → packages/design-tokens/src/
```

SEMPRE use aliases. NUNCA caminhos relativos longos.

---

## Convenções de Código

### Idioma
| Contexto | Idioma |
|----------|--------|
| Código (variáveis, funções) | Inglês |
| Comentários, JSDoc | Português |
| Commits | Português semântico (`feat(scope): descrição`) |
| UI / mensagens de erro | Português |
| Database tables/columns | Português snake_case |

### Nomenclatura
- Componentes: `PascalCase` | Funções/vars: `camelCase` | Constantes: `SCREAMING_SNAKE`
- Hooks: `use` + PascalCase | Services: `camelCase.js` | Schemas: `{name}Schema.js`

### Ordem de Declaração em React — CRÍTICO (TDZ)

```jsx
// OBRIGATÓRIO: States → Memos → Effects → Handlers
const [data, setData] = useState()
const processed = useMemo(() => data + 1, [data])
useEffect(() => { ... }, [processed])
const handleClick = () => { ... }
```

### Ordem de Imports
1. React & libs externas
2. Componentes internos
3. Hooks & utils (`@shared`)
4. Services & schemas
5. CSS (sempre por último)

---

## Regras Críticas

### Antes de Modificar QUALQUER Arquivo
1. Buscar duplicatas: `find src -name "*NomeArquivo*" -type f`
2. Rastrear importações: `grep -r "from.*NomeArquivo" src/`
3. Confirmar alias em `vite.config.js`

### Datas e Timezone
- **SEMPRE** `parseLocalDate()` de `@utils/dateUtils`
- **NUNCA** `new Date('YYYY-MM-DD')` — cria UTC midnight = dia anterior em GMT-3

### Zod & Validação
- Enums **sempre em português**: `['diario', 'semanal', 'quando_necessario']`
- `safeParse()` para validação não-bloqueante
- Campos nullable: `.nullable().optional()` — **não** só `.optional()`
- Schemas Zod sincronizados com CHECK constraints do banco

### Dosagem
- `quantity_taken` em comprimidos (não mg) — limite Zod: 100
- `dosage_per_intake` = comprimidos/dose | `dosage_per_pill` = mg/comprimido

### Ordem Obrigatória de Operação de Dose
Validar → Registrar → Decrementar estoque

### LogForm
Retorna array (plan/bulk) ou objeto (protocol/single) — checar `Array.isArray()`

### Mobile Performance — Lazy Loading (R-117)
- Todas as views (exceto Dashboard) **DEVEM** ser `React.lazy()` + `Suspense`
- Suspense fallback **DEVE SER** `ViewSkeleton` — nunca `null` ou spinner genérico
- Vite `manualChunks`: 8 chunks (vendors: framer/supabase/virtuoso/pdf; features: medicines-db/history/stock/landing)
- Bundle atual: **102.47 kB gzip** (de 989KB — 89% redução)

---

## Telegram Bot

- Callback data < 64 bytes (índices numéricos, não UUIDs)
- Sempre `escapeMarkdownV2()` para MarkdownV2 (escapar backslash **primeiro**)
- `shouldSendNotification()` já faz log — nunca chamar `logNotification()` depois
- Session: sempre `await getSession(chatId)` e obter `userId` dinamicamente

---

## Vercel Serverless — CRÍTICO

- **Hobby: máximo 12 serverless functions por deploy** (R-090)
- Utilitários em `api/_prefixo/` (não contados). Verificar budget antes de criar `.js` em `api/` (ver `api/CLAUDE.md`)
- Routers existentes: `api/dlq.js`, `api/gemini-reviews.js`, `api/notify.js`, `api/share.js`, `api/telegram.js`, `api/health/notifications.js`
- **Nunca** `process.exit()` — usar `throw new Error()`
- **Sempre** `res.status(code).json(body)` — nunca `res.json()`
- Env vars: sempre fallback `process.env.X || process.env.VITE_X`

---

## Testes (Vitest 4)

| Contexto | Comando |
|----------|---------|
| **Agente (obrigatório)** | `npm run validate:agent` (10-min kill switch) |
| Críticos (services/schemas/utils/hooks) | `npm run test:critical` |
| Alterados desde main | `npm run test:changed` |
| CI completo | `npm run validate:full` |
| Dev rápido | `npm run test:fast` |

**Regras:** `afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); })` obrigatório. `vi.mock()` antes dos imports. `waitFor()` em vez de `setTimeout` em `act()`. Arquivo de teste ≤ 300 linhas.

---

## DEVFLOW — Ciclo de Desenvolvimento

```
/devflow → bootstrap → codificar (C1-C4) → /deliver-sprint → C5 (memória) → distill
```

**C5 obrigatório antes do commit:**
- Bug não-trivial? → `AP-NNN` em `.agent/memory/anti-patterns.json` + `_detail/`
- Padrão novo? → `R-NNN` em `.agent/memory/rules.json` + `rules_detail/`
- Decisão arquitetural? → `ADR-NNN` em `.agent/memory/decisions.json` + `decisions_detail/`
- Entrega significativa? → `.agent/memory/journal/YYYY-WWW.jsonl` (append-only)
- Atualizar `.agent/state.json` (`journal_entries_since_distillation`)

`.memory/` **aposentado** — somente leitura histórica (W01-W11). Todo novo registro vai para `.agent/memory/`.

---

## Git Workflow

```
1. /devflow bootstrap
2. CREATE BRANCH (feature/wave-X/nome)
3. MAKE CHANGES (C1-C4)
4. npm run validate:agent
5. DEVFLOW C5 — registrar lições
6. COMMIT semântico (português)
7. PUSH + CREATE PR
8. WAIT FOR GEMINI REVIEW → aplicar sugestões
9. WAIT USER APPROVAL → USER MERGES (R-060 — agente nunca auto-merge)
10. DEVFLOW C5 pós-merge + distill se journal >= 15
```

| Tipo | Uso |
|------|-----|
| `feat` | Nova feature |
| `fix` | Bug fix |
| `docs` | Documentação |
| `test` | Apenas testes |
| `refactor` | Refatoração |
| `style` | Formatação |
| `chore` | Manutenção |

**Gitdir externo (Mac Mini):** ver `docs/setup/GIT_ARCHITECTURE.md`. Usar `gsync` para sync com origin + bridge.

---

## Schemas (enums críticos)

- `DOSAGE_UNITS`: `['mg','mcg','g','ml','ui','cp','gotas']`
- `MEDICINE_TYPES`: `['comprimido','capsula','liquido','injecao','pomada','spray','outro']`
- `FREQUENCIES`: `['diario','dias_alternados','semanal','personalizado','quando_necessario']`
- Stock levels: CRITICAL <7d | LOW <14d | NORMAL <30d | HIGH ≥30d

---

## Serviços Chave

**adherenceService** (`src/services/api/`): `calculateAdherence(period)`, `calculateProtocolAdherence(id, period)`, `calculateAllProtocolsAdherence(period)`, `getCurrentStreak()`, `getDailyAdherence(days)`, `getAdherenceSummary(period)`

**analyticsService** (`src/features/dashboard/services/`): `track(name, props)`, `getEvents(filter)`, `getSummary()` — localStorage only, max 1000 eventos/30 dias

**insightService** (`src/features/dashboard/services/`): prioridade `critical > high > medium > low > info` — frequency capping via localStorage

---

## Lições Aprendidas — Sprint 7 (post-mortem)

Schema drift Zod/SQL • env vars faltando em prod (validar startup + fallbacks) • auth faltando para blob privado • `res.json()` não funciona no Vercel (usar `res.status().json()`) • `.optional()` rejeita null (usar `.nullable().optional()`) • nunca auto-merge sem review

---

## MCP Tools: code-review-graph

**Usar graph tools ANTES de Grep/Glob/Read** — mais rápido, menos tokens, dá contexto estrutural.

| Tool | Quando usar |
|------|------------|
| `semantic_search_nodes` | Encontrar funções/classes por nome |
| `detect_changes` | Revisar mudanças com risk score |
| `get_impact_radius` | Blast radius de uma mudança |
| `query_graph` | Rastrear callers/callees/imports/tests |
| `get_architecture_overview` | Visão de alto nível |

---

## Checklist Pré-Código

- [ ] `.agent/state.json` lido + `/devflow` executado
- [ ] Duplicatas verificadas (`find src -name "*File*" -type f`)
- [ ] Path alias confirmado em `vite.config.js`
- [ ] Datas: usar `parseLocalDate()`, nunca `new Date('YYYY-MM-DD')`
- [ ] `npm run validate:agent` antes do push

## Checklist Pós-Código (DEVFLOW C5)

- [ ] AP-NNN registrado se bug não-trivial
- [ ] R-NNN registrado se padrão novo
- [ ] ADR-NNN registrado se decisão arquitetural
- [ ] Journal entry se entrega significativa
- [ ] `.agent/state.json` atualizado
- [ ] `/devflow distill` se `journal_entries >= 15`
