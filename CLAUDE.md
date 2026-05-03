# CLAUDE.md — Dosiq

> **DEVFLOW é o processo oficial de desenvolvimento deste projeto.**
> Skill: `/devflow` | Contexto do agente: `.agent/DEVFLOW.md` | Memória canônica: `.agent/memory/`
> Migração completa (2026-04-08). Waves 0–7 concluídas. `.memory/` **aposentado** (somente leitura histórica).
>
> **Antes de qualquer tarefa:**
> 1. Leia `.agent/state.json` (estado do projeto)
> 2. Execute `/devflow` para bootstrap seletivo (`hot` + `warm` por contexto; `cold` apenas sob demanda)
> 3. Use `/deliver-sprint` para entregas e `/devflow distill` periodicamente

> Contexto completo do projeto para agentes Claude. Leia este arquivo INTEIRO antes de qualquer tarefa.

## Projeto

**Dosiq** e um PWA de gerenciamento de medicamentos pessoal.
Stack: React 19 + Vite 7 + Supabase (Postgres + Auth + RLS) + Zod 4 + Framer Motion 12 + Vitest 4.
Deploy: Vercel Hobby (gratis). Bot: Telegram via Node.js. Custo operacional: R$ 0.

**Versao atual:** v3.3.0 (Fases 1-5 COMPLETAS ✅) + **Mobile Performance Initiative M0-M8 + HealthHistory Fix P1-P4 + Chatbot IA F8.1 + REDESIGN WAVE 4 COMPLETOS** ✅
**Fase 5 Entregas:** Cost Analysis (F5.10) + ANVISA Base (F5.6) + Onboarding v3.2 (F5.C) + Landing Redesign (F5.D) — todos mergeados
**Mobile Perf M2:** Lazy loading de 13 views + Vite manualChunks (8 vendor/feature chunks) + ViewSkeleton pattern — Bundle: 989KB → 102.47kB gzip (89% reduction) ✅
**HealthHistory Fix P1-P3 (v3.3.0):** Browser freeze mobile eliminado (12+ → 2 requests simultâneos) + cache SWR adherence + slim select timeline (76% payload reduction) ✅
**Dashboard Perf P4:** Slim select DashboardProvider + getUserId cache com promise coalescence (13 → 1 auth roundtrip) + calculateStreaks otimizado + Zod validation em todos read methods ✅
**Chatbot IA F8.1 (Sprint 8.3 + 8.3.1):** Groq API + contextBuilder + safetyGuard + Framer Motion UI + hallucination fixes (active_ingredient grounding, temperature 0.2) ✅
**Redesign Wave 4 (2026-03-25):** Navigation Shell — BottomNavRedesign (mobile) + Sidebar (desktop) + App.jsx integration + Page transitions (Commit b02c0b7) ✅
**Redesign Wave 5 (2026-03-25):** Motion Language — motionConstants.js (6 archetypes) + CSS keyframes + useMotion hook + AI review cycle (staticFallback bug fix + useMemo perf optimization) (Commit 4e6b312) ✅
**Proxima:** Wave 6 — Dashboard Redesign (roadmap em `plans/backlog-redesign/`)

---

## Estrutura do Projeto

```
apps/web/            # Web app (workspace @dosiq/web)
  src/
    features/          # Feature modules (fonte canonica)
      adherence/       # Streaks, trends, widgets de adesao
      dashboard/       # Dashboard principal, analytics, insights, widgets
      medications/     # CRUD de medicamentos
      protocols/       # Protocolos de tratamento, titulacao
      stock/           # Controle de estoque
    schemas/           # Schemas Zod (UNICO local para schemas)
    services/api/      # Services compartilhados (adherenceService, dlq)
    shared/
      components/ui/   # Componentes reutilizaveis (Button, Card, Modal, AlertList, Calendar)
      components/log/  # Componentes de registro de doses
      components/pwa/  # InstallPrompt, PushPermission
      components/onboarding/
      hooks/           # useCachedQuery, useTheme, usePushSubscription
      services/        # queryCache, analytics, shared services
      utils/           # supabase client, dateUtils, queryCache
      styles/          # CSS tokens, temas
    utils/             # adherenceLogic, dateUtils
    views/             # View wrappers (Dashboard, Medicines, Stock, etc.)
  vite.config.js       # Aliases, manualChunks, build config
  vitest.config.js     # (+ critical/smoke/lowram/ci variants)
  package.json         # @dosiq/web — scripts locais
apps/mobile/         # React Native / Expo app (workspace @dosiq/mobile)
api/                 # Vercel serverless functions
  gemini-reviews/    # Integracao Gemini Code Assist
  health/            # Health checks
  dlq/               # Dead Letter Queue admin
server/bot/          # Telegram bot
  tasks.js           # Schedulers + message formatters
  callbacks/         # Callback handlers
  commands/          # Command handlers
  middleware/        # Request processing
  utils/             # Helpers
plans/               # PRDs, specs de execucao, roadmap
docs/                # Documentacao do projeto
.agent/              # DEVFLOW — MEMORIA CANONICA DO PROJETO ✅
  DEVFLOW.md         #   - Skill definition (nao modificar sem /devflow meta-evolve)
  state.json         #   - Estado da sessao (sprint, goal, contadores de memoria)
  decisions.json     #   - ADRs (25 decisoes arquiteturais)
  decisions_detail/  #   - ADR detail files (ADR-001.md through ADR-025.md)
  memory/
    rules.json       #   - Indice de regras R-NNN (96 ativas) — carregar `hot` primeiro e expandir `warm` por contexto
    anti-patterns.json #  - Indice AP-NNN (54 ativos) — carregar `hot` primeiro e expandir `warm` por contexto
    contracts.json   #   - Contratos de interface CON-NNN (16)
    knowledge.json   #   - Domain facts K-NNN (70 fatos)
    rules_detail/    #   - R-NNN.md on-demand
    anti-patterns_detail/ # AP-NNN.md on-demand
    knowledge_detail/ #  - K-NNN.md on-demand
    journal/         #   - JSONL journals por sprint (2026-W*.jsonl)
    journal/archive/ #   - Journals comprimidos pos-distilacao
  evolution/
    genes.json       #   - Parametros de comportamento (threshold, cadencias)
    evolution_log.jsonl # - Historico de mutacoes (append-only)
  sessions/
    events.jsonl     #   - Eventos da sessao atual (append-only)
    .lock            #   - Lock otimista para escritas concorrentes
  synthesis/
    pending_export.json # - Regras/APs candidatos ao global_base
.memory/             # LEGADO — somente leitura historica (W01-W11, aposentado 2026-04-08)
  rules.md           #   ⚠️ NAO ATUALIZAR — use .agent/memory/rules.json
  anti-patterns.md   #   ⚠️ NAO ATUALIZAR — use .agent/memory/anti-patterns.json
  knowledge.md       #   ⚠️ NAO ATUALIZAR — use .agent/memory/knowledge.json
  journal/           #   ⚠️ NAO ATUALIZAR — use .agent/memory/journal/
```

---

## Path Aliases (apps/web/vite.config.js)

Aliases definidos em `apps/web/vite.config.js` — os caminhos abaixo são relativos à raiz do monorepo:

```
@           -> apps/web/src/
@features   -> apps/web/src/features/
@shared     -> apps/web/src/shared/
@services   -> apps/web/src/services/
@dashboard  -> apps/web/src/features/dashboard/
@medications -> apps/web/src/features/medications/
@protocols  -> apps/web/src/features/protocols/
@stock      -> apps/web/src/features/stock/
@adherence  -> apps/web/src/features/adherence/
@schemas    -> apps/web/src/schemas/
@utils      -> apps/web/src/utils/
@design-tokens -> packages/design-tokens/src/
```

SEMPRE use aliases nos imports. NUNCA use caminhos relativos longos.

---

## Convencoes de Codigo

### Idioma
| Contexto | Idioma |
|----------|--------|
| Codigo (variaveis, funcoes) | Ingles |
| Comentarios, JSDoc | Portugues |
| Commits | Portugues (semanticos: `feat(scope): descricao`) |
| UI/mensagens de erro | Portugues |
| Nomes de arquivo | Ingles |
| Database tables/columns | Portugues (snake_case) |

### Nomenclatura
- Componentes: PascalCase (`MedicineCard.jsx`)
- Funcoes/variaveis: camelCase (`calculateAdherence()`)
- Constantes: SCREAMING_SNAKE (`MAX_RETRY`, `CACHE_STALE_TIME`)
- Hooks: `use` + PascalCase (`useCachedQuery()`)
- Services: camelCase (`medicineService.js`)
- Schemas: `{name}Schema.js`
- Testes: `{component}.test.js` ou `{service}.test.js`

### Ordem de Declaracao em React Hooks (CRITICO)

**OBRIGATORIO: States -> Memos -> Effects -> Handlers**

```jsx
// CORRETO
const [data, setData] = useState()
const processed = useMemo(() => data + 1, [data])
useEffect(() => { ... }, [processed])
const handleClick = () => { ... }

// ERRADO - ReferenceError (TDZ)
const processed = useMemo(() => data + 1, [data])
const [data, setData] = useState(0) // undefined!
```

### Ordem de Imports
1. React & libs externas
2. Componentes internos
3. Hooks & utils (`@shared`)
4. Services & schemas
5. CSS (sempre por ultimo)

---

## Regras Criticas

### Antes de Modificar QUALQUER Arquivo
1. Buscar duplicatas: `find src -name "*NomeArquivo*" -type f`
2. Rastrear importacoes: `grep -r "from.*NomeArquivo" src/`
3. Confirmar alias em vite.config.js

### Datas e Timezone
- **SEMPRE** usar `parseLocalDate()` de `@utils/dateUtils`
- **NUNCA** usar `new Date('YYYY-MM-DD')` — cria UTC midnight = dia anterior em GMT-3

### Zod & Validacao
- Enums SEMPRE em portugues: `['diario', 'semanal', 'quando_necessario']`
- Use `safeParse()` para validacao nao-bloqueante
- Campos que podem ser `null`: usar `.nullable().optional()` (nao so `.optional()`)
- Schemas Zod DEVEM estar sincronizados com CHECK constraints do banco

### Dosagem
- `quantity_taken` SEMPRE em comprimidos (nao mg) — limite Zod: 100
- `dosage_per_intake` = comprimidos por dose
- `dosage_per_pill` = mg por comprimido

### Operacao de Dose
Ordem obrigatoria: Validar -> Registrar -> Decrementar estoque

### LogForm
Retorna array (plan/bulk) ou objeto (protocol/single) — SEMPRE checar `Array.isArray()`

### Mobile Performance — Lazy Loading Pattern (R-117, M2 ✅)
- **OBRIGATORIO:** Todas as views (exceto Dashboard) DEVEM ser lazy-loaded com `React.lazy()` + `Suspense`
- **Suspense fallback DEVE SER ViewSkeleton** — nunca `null` ou spinner generico
- **Vite manualChunks:** 8 chunks (vendor + feature) para evitar loading desnecessario
  - Vendors: framer, supabase, virtuoso, pdf (este ultimo dinamico via import() em handlers)
  - Features: medicines-db, history, stock, landing
- **Resultado:** 89% reducao de bundle (989KB → 102.47kB gzip), FCP ~500ms mais rapido no mobile
- **Proximos sprints M3-M6:** DB indexes (M3), Offline UX (M4), CSS/Assets (M5), Touch UX (M6)
- Ver: `docs/standards/MOBILE_PERFORMANCE.md` + `plans/EXEC_SPEC_MOBILE_PERFORMANCE.md`

---

## Telegram Bot

- Callback data < 64 bytes (usar indices numericos, nao UUIDs)
- SEMPRE usar `escapeMarkdownV2()` para MarkdownV2 (escapar backslash PRIMEIRO)
- `shouldSendNotification()` ja faz log internamente — nunca chamar `logNotification()` depois
- Session: SEMPRE `await getSession(chatId)` e obter userId dinamicamente

---

## Vercel Serverless

### Limite de Funcoes (CRITICO)
- **Vercel Hobby: maximo 12 serverless functions por deploy** (R-090)
- Cada `.js` em `api/` conta como funcao. Utilitarios DEVEM estar em diretorios com prefixo `_` (ex: `api/gemini-reviews/_shared/`, `api/dlq/_handlers/`) para NAO serem contados (R-091)
- Antes de criar QUALQUER novo `.js` em `api/`, verificar o function budget atual (ver `api/CLAUDE.md`)
- Para novos endpoints, preferir consolidar em routers existentes (router pattern) ao inves de criar novos arquivos
- Plano de consolidacao completo: `plans/SERVERLESS_CONSOLIDATION.md`

### Arquitetura de Routers
- `api/dlq.js` — Router: GET list + POST retry + POST discard (auth compartilhada)
- `api/gemini-reviews.js` — Router: persist + create-issues + update-status + batch-update (auth por handler)
- `api/health/notifications.js` — Handler standalone (health check)
- `api/notify.js` — Cron orchestrator (maxDuration: 60s)
- `api/share.js` — PDF sharing via Vercel Blob
- `api/telegram.js` — Telegram webhook (maxDuration: 10s)

### Regras de Codigo
- **NUNCA** usar `process.exit()` — usar `throw new Error()`
- **SEMPRE** usar `res.status(code).json(body)` — nunca `res.json()` (estilo Express)
- Rewrites em `vercel.json`: novas rotas ANTES do catch-all `/(.*)`
- Endpoints service_role DEVEM ter autenticacao (Supabase Auth + ADMIN_CHAT_ID)
- Env vars: SEMPRE fornecer fallback: `process.env.X || process.env.VITE_X`
- Logging estruturado desde o primeiro commit (timestamp, level, context, correlationId)
- Validar env vars criticas no startup do endpoint (fail fast)

---

## Testes (Vitest 4)

### Comandos
| Contexto | Comando | Uso |
|----------|---------|-----|
| Dev rapido | `npm run test:fast` | 1 thread, ~6.5min |
| Criticos | `npm run test:critical` | services/schemas/utils/hooks |
| Alterados | `npm run test:changed` | desde main |
| Low-RAM (8GB) | `npm run test:lowram` | sequencial ~20min |
| **Agente** | **`npm run validate:agent`** | **OBRIGATORIO, 10-min kill switch** |
| CI completo | `npm run validate:full` | lint + coverage + build |
| Rapida | `npm run validate:quick` | lint + test:changed |

### Regras de Teste
- Arquivo de teste <= 300 linhas — dividir por escopo se necessario
- `afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers(); })` OBRIGATORIO
- Mocks com `vi.mock('path')` no nivel do modulo, ANTES dos imports
- NUNCA usar `setTimeout` em `act()` — usar `waitFor(() => expect(...))`
- Resolver promises pendentes em `finally` blocks
- `vi.useFakeTimers()` para testes dependentes de tempo
- Nao usar localStorage em testes (checar `NODE_ENV === 'test'`)
- Um hook ou componente por arquivo de teste

---

## DEVFLOW — Processo Oficial de Desenvolvimento

**DEVFLOW e o sistema de memoria e workflow deste projeto.** Nao use `.memory/` (aposentado).

### Skill: `/devflow` — Modos Disponíveis

| Modo | Comando | Proposito |
|------|---------|-----------|
| **Bootstrap** | `/devflow` (sem args) | **OBRIGATORIO** — carrega `state.json` + core `hot` + packs `warm` inferidos por goal/stack/arquivos; `cold` fica fora do bootstrap normal |
| **Status** | `/devflow status` | Painel de estado: sprint atual, memoria counts, distilacao pending, mutations |
| **Planning** | `/devflow planning "goal"` | Modo planejamento: analisa scope, cria specs, drafta ADRs, verifica contratos |
| **Coding** | `/devflow coding "task"` | Modo codificacao: C1-C4 checklist, contract gateway, quality gates |
| **Reviewing** | `/devflow reviewing "PR #N"` | Modo revisao: scan violations, sync memory, atualiza trigger counts de APs |
| **Distillation** | `/devflow distill` | Comprimir journals, revisar lifecycle de regras, preparar exports (quando journal_entries >= 15) |
| **Export** | `/devflow export` | Promover regras candidatas ao global_base (~/.devflow/global_base/) — requer aprovacao |

### Estrutura de Memoria (CANONICA — `.agent/memory/`)

```
.agent/
  state.json                    # Estado do projeto (sprint, goal, contadores)
  memory/
    rules.json                  # Indice de regras R-NNN (96 ativas)
    anti-patterns.json          # Indice de anti-patterns AP-NNN (54 ativos)
    contracts.json              # Contratos de interface CON-NNN (16)
    decisions.json              # ADRs ADR-NNN (25 decisoes arquiteturais)
    knowledge.json              # Domain facts K-NNN (70 fatos)
    rules_detail/R-NNN.md       # Detalhes on-demand
    anti-patterns_detail/AP-NNN.md
    journal/YYYY-WWW.jsonl      # Journals por sprint (JSONL, append-only)
    journal/archive/            # Journals comprimidos pos-distilacao
  evolution/
    genes.json                  # Parametros de comportamento do agente
    evolution_log.jsonl         # Historico de mutacoes
  sessions/
    events.jsonl                # Eventos da sessao atual
```

### Ciclo de Desenvolvimento (Assess → Execute → Record)

```
ANTES de codificar:
  1. /devflow → bootstrap (le state.json + carrega `hot` + `warm` relevantes)
  2. Verificar rules e APs relevantes para o goal atual
  3. Checar contratos (contracts.json) para interfaces tocadas

DURANTE (coding):
  - Seguir C1-C4 do DEVFLOW (checklist + contract gateway + order + quality gates)
  - /deliver-sprint para execucao estruturada de sprints

APOS codificar:
  - DEVFLOW C5: registrar novos R-NNN / AP-NNN / ADR-NNN se aplicavel
  - Append ao journal YYYY-WWW.jsonl
  - /devflow distill quando journal_entries >= 15
```

### Quando Registrar na Memoria DEVFLOW
| Situacao | Acao | Arquivo |
|----------|------|---------|
| Corrigi bug causado por padrao errado | AP-NNN | `anti-patterns.json` + `_detail/` |
| Descobri padrao que funciona | R-NNN | `rules.json` + `rules_detail/` |
| Decisao arquitetural tomada | ADR-NNN | `decisions.json` + `decisions_detail/` |
| Entrega de sprint/wave | Journal entry | `memory/journal/YYYY-WWW.jsonl` |
| Domain fact novo (API, schema) | K-NNN | `knowledge.json` + `knowledge_detail/` |

### `.memory/` — APOSENTADO (somente leitura historica)
Os arquivos em `.memory/` (rules.md, anti-patterns.md, knowledge.md, journal/) foram migrados
para o DEVFLOW em 2026-04-08 (waves 0-7). **Nao escreva nesses arquivos.** Consulte apenas
como referencia historica de W01-W11. Todo novo registro vai para `.agent/memory/`.

---

## Arquitetura de Ambientes Git (Mac Mini M2)

Este setup usa o padrão **gitdir externo** para isolar os objetos git do daemon de sync do iCloud, evitando locks e corrupção de índice.

### Estrutura de diretórios

```
~/git-icloud/dosiq/              ← working tree (iCloud sincroniza os arquivos fonte)
  .git                           ← ARQUIVO (não dir): "gitdir: ../../../../../local_git/dosiq/.git"
  src/, apps/, ...               ← código — sincronizado pelo iCloud

~/local_git/dosiq/.git/          ← gitdir REAL (fora do iCloud — sem locks do daemon)
  objects/, refs/, HEAD, config, hooks/, index...
  config → remotes: origin (GitHub) + bridge (iCloud_server bare)

~/Library/.../git_server/        ← bridge bare repo (relay via iCloud entre máquinas)
dosiq.git/

~/local/test-native-dosiq/       ← worktree para testes Expo/native (fora do iCloud,
                                    sem Watchman conflict)
```

### Por que gitdir externo?

O iCloud Drive tenta sincronizar **tudo** dentro de `~/git-icloud/`, incluindo o `.git/`. Isso causa:
- Locks em `index` e `COMMIT_EDITMSG` durante operações git
- Corrupção silenciosa de pack files
- Lentidão extrema em repos grandes (objetos são re-uploaded a cada commit)

Solução: o `.git` em `~/git-icloud/dosiq/` é um **arquivo texto** apontando para `~/local_git/dosiq/.git/`, que fica fora do iCloud. O iCloud só vê e sincroniza o código-fonte — nunca os objetos git.

### Sincronização: `gsync` e `gsync-native`

**`gsync`** (declarado em `~/.bashrc`) — sincroniza um repo com origin + bridge:

```
Fluxo:
  1. git fetch origin + bridge        (atualiza referências sem alterar local)
  2. Auto-repair: se bridge SHA ≠ origin SHA → force-push origin → bridge
  3. git pull --rebase origin $branch (origin é a fonte da verdade)
  4. git push origin $branch
  5. git push bridge origin/$branch   (espelha SHAs exatos — nunca rebasa para bridge)
```

**Regra crítica:** a bridge sempre espelha o origin (mesmo conteúdo, mesmo SHA). Nunca use `git pull bridge` como fonte — isso cria SHAs divergentes e gera warnings de "skipped previously applied commit" em runs futuros.

**`gsync-native`** (`~/.local/bin/gsync-native.sh`) — extensão para o worktree de testes:

```
1. Valida que gitdir externo (~/local_git/dosiq) está acessível — BLOQUEANTE
   (se sumir, todas as operações git no working tree falham)
2. Chama gsync a partir de ~/git-icloud/dosiq
3. Atualiza o native worktree: git fetch origin + reset --hard origin/$branch
4. Copia credenciais (.env.*, google-services.json) do iCloud para o worktree
```

### Diagnóstico rápido

```bash
# Ver estrutura gitdir
cat ~/git-icloud/dosiq/.git
# → gitdir: ../../../../../local_git/dosiq/.git

# Ver remotes configurados no gitdir
cat ~/local_git/dosiq/.git/config

# Checar divergência bridge vs origin
cd ~/git-icloud/dosiq
git fetch bridge origin --quiet
git log --oneline bridge/main -3
git log --oneline origin/main -3
# Se SHAs diferentes → rodar: git push bridge origin/main:refs/heads/main --force

# Forçar re-sync completo
source ~/.bashrc && gsync
```

### O que NÃO fazer

- **Nunca** criar um diretório `.git/` dentro de `~/git-icloud/dosiq/` — quebra o padrão gitdir e o iCloud passa a sincronizar os objetos
- **Nunca** usar `git push bridge $branch` diretamente — sempre via `gsync` que espelha origin
- **Nunca** ignorar o check de `~/local_git/dosiq` no `gsync-native` — é uma dependência crítica, não opcional

---

## Git Workflow

```
1. /devflow → bootstrap (ler state.json + `hot` + `warm` relevantes; consultar `cold` so quando necessario)
2. CREATE BRANCH (feature/wave-X/nome ou feature/fase-N/nome)
3. MAKE CHANGES (seguir padroes de codigo, DEVFLOW C1-C4)
4. VALIDATE LOCALLY (npm run validate:agent)
5. /devflow C5 — registrar licoes em .agent/memory/ (obrigatorio)
6. COMMIT (semantico, portugues)
7. PUSH BRANCH
8. CREATE PR
9. WAIT FOR GEMINI CODE ASSIST REVIEW
10. ANALYZE AND ACT ON REVIEWER SUGGESTIONS
11. ISSUE COMMENT FOR RE-REVIEW ('/gemini review')
12. MERGE & CLEANUP (--no-ff, deletar branch)
13. /devflow distill se journal_entries >= 15
```

**REGRA ABSOLUTA:** Code agents NUNCA mergeiam seus proprios PRs. Para agente realizar merge, precisa de aprovação humana EXPLICITA.
**Qualidade > Velocidade:** Um PR bem revisado > 3 PRs apressados.

### Tipos de Commit
| Tipo | Uso |
|------|-----|
| `feat` | Nova feature |
| `fix` | Bug fix |
| `docs` | Documentacao |
| `test` | Apenas testes |
| `refactor` | Refatoracao |
| `style` | Formatacao |
| `chore` | Manutencao |

---

## Schemas Existentes

### medicineSchema.js
- Required: `name`, `dosage_per_pill`, `dosage_unit`
- Enums: `DOSAGE_UNITS = ['mg','mcg','g','ml','ui','cp','gotas']`
- `MEDICINE_TYPES = ['comprimido','capsula','liquido','injecao','pomada','spray','outro']`

### protocolSchema.js
- Required: `medicine_id`, `name`, `frequency`, `time_schedule`, `dosage_per_intake`, `start_date`
- Optional: `end_date`, `titration_schedule`, `titration_status`
- `FREQUENCIES = ['diario','dias_alternados','semanal','personalizado','quando_necessario']`

### stockSchema.js
- Required: `medicine_id`, `quantity`, `purchase_date`, `unit_price` (>=0)
- Optional: `expiration_date`, `notes`

### logSchema.js
- Registro de doses com timestamps

### Niveis de Estoque
- CRITICAL: <7 dias (#ef4444)
- LOW: <14 dias (#f59e0b)
- NORMAL: <30 dias (#22c55e)
- HIGH: >=30 dias (#3b82f6)

---

## Servicos Chave

### adherenceService.js (`src/services/api/`)
- `calculateAdherence(period)` — score geral
- `calculateProtocolAdherence(protocolId, period)` — por protocolo
- `calculateAllProtocolsAdherence(period)` — todos os protocolos
- `getCurrentStreak()` — streak atual + maior
- `getDailyAdherence(days)` — dia a dia
- `getAdherenceSummary(period)` — resumo completo

### analyticsService.js (`src/features/dashboard/services/`)
- Privacy-first, localStorage only (`mr_analytics`)
- `track(name, properties)`, `getEvents(filter)`, `getSummary()`
- Max 1000 eventos, 500KB, 30 dias retencao

### insightService.js (`src/features/dashboard/services/`)
- Tipos: ADHERENCE, STREAK, STOCK_WARNING, PROTOCOL_REMINDER, etc.
- Sistema de prioridade: critical > high > medium > low > info
- Frequency capping via localStorage

---

## Navegacao (App.jsx) — Lazy Loading com Suspense (R-117)

Sistema view-based (nao React Router). Views atuais:
- `dashboard` (default), `medicines`, `stock`, `protocols`, `history`, `settings`, `admin-dlq`, `landing`

**CRITICO:** Todas as views DEVEM ser lazy-loaded com Suspense + ViewSkeleton para mobile performance (M2 ✅):

```jsx
// ✅ CORRETO — cada view eh lazy-loaded
const Landing = lazy(() => import('./views/Landing'))
const Medicines = lazy(() => import('./views/Medicines'))

// Renderizar com Suspense + fallback
<Suspense fallback={<ViewSkeleton />}>
  <Landing {...props} />
</Suspense>
```

**ViewSkeleton component:** Skeleton loading screen (apps/web/src/App.jsx, lines 23-35) que exibe placeholder durante carregamento de chunks grandes (jsPDF, medicineDatabase, etc). Resultado: FCP melhorado ~500ms no mobile.

Navegacao via `setCurrentView()` + `BottomNav` component.
`DashboardProvider` wrapa toda a app (context compartilhado).

**Vite manualChunks (M2 ✅):** 8 chunks separados para evitar loading desnecessario:
- `vendor-pdf` (jsPDF + html2canvas, 174KB) — carrega apenas em handlers de exportacao
- `vendor-framer` (Framer Motion)
- `vendor-supabase` (Supabase libs)
- `vendor-virtuoso` (Virtual scroll lists)
- `feature-medicines-db` (ANVISA database, 105KB) — carrega apenas em Medicines view
- `feature-history`, `feature-stock`, `feature-landing` — sob demanda

Main bundle: **102.47 kB gzip** (de 989KB original, 89% reducao).

---

## Infraestrutura Bot (server/bot/)

- `tasks.js` (~939 linhas) — schedulers + formatadores de mensagem
- `scheduler.js` — cron scheduling
- `bot-factory.js` — instanciacao do bot
- `health-check.js` — monitoramento
- `logger.js` + `correlationLogger.js` — logging estruturado
- Cron via `api/notify.js` (Vercel) — triggers: dose reminders, digests, stock alerts, titulacao, reports

---

## Licoes Aprendidas (Post-Mortems)

### Sprint 7 — Integracao Gemini (5 CRITICAL, 4 HIGH)
1. Schema drift Zod/SQL → manter sincronizados
2. Env vars faltando em producao → validar no startup + fallbacks
3. Auth faltando para blob privado → sempre incluir headers
4. Logging insuficiente → logger estruturado desde dia 1
5. `res.json()` nao funciona no Vercel → usar `res.status().json()`
6. `.optional()` rejeita null → usar `.nullable().optional()`
7. PRs mergeados sem review → separar roles estritamente
8. Arquivos de teste temporarios commitados → nunca commitar lixo

---

## Documentacao

### Projeto (em `src/`, `docs/`, `plans/`)
- `docs/INDEX.md` — indice mestre
- `docs/reference/SCHEMAS.md` — schemas Zod
- `docs/standards/GEMINI_INTEGRATION.md` — code review automatico
- `docs/standards/MOBILE_PERFORMANCE.md` — **NOVO** — Standards de performance mobile (lazy loading, code splitting, CSS animations, assets, touch UX)
- `docs/architecture/NOTIFICATIONS.md` — bot + notificações (Inbox-First)
- `docs/architecture/CHATBOT_AI.md` — **NOVO** — Arquitetura do Chatbot IA Multi-Canal (F8.1): contextBuilder, safetyGuard, Groq API, bugfixes hallucination
- `plans/EXEC_SPEC_FASE_5.md` — spec de execucao da Fase 5
- `plans/EXEC_SPEC_MOBILE_PERFORMANCE.md` — Roadmap M0-M6 para otimizacao mobile (M2 concluido ✅)
- `plans/EXEC_SPEC_DASHBOARD_FIRST_LOAD.md` — **NOVO** — Sprints D1-D6 para otimizar first load do Dashboard (target: 25 → ≤12 queries, ~15s → <5s em 4G)
- `plans/ROADMAP_v4.md` — roadmap futuro

### Memoria de Longo Prazo (DEVFLOW — `.agent/memory/`)
**IMPORTANTE:** A memoria canonica e gerenciada pelo DEVFLOW. Use `/devflow` para acessar e atualizar.
- `.agent/memory/rules.json` + `rules_detail/` — Regras R-NNN (96 ativas), com lifecycle `hot/warm/cold/archived`
- `.agent/memory/anti-patterns.json` + `anti-patterns_detail/` — AP-NNN (54 ativos), com lifecycle `hot/warm/cold/archived`
- `.agent/memory/knowledge.json` + `knowledge_detail/` — Domain facts K-NNN (70 fatos)
- `.agent/memory/decisions.json` + `decisions_detail/` — ADRs (25 decisoes arquiteturais)
- `.agent/memory/journal/YYYY-WWW.jsonl` — Journals JSONL por sprint (append-only)
- `.agent/state.json` — Estado atual (sprint, goal, contadores, last_distillation)

> `.memory/` esta **aposentado** (somente leitura historica W01-W11). Nunca escreva nele.

---

## Checklist Pre-Codigo

- [ ] Li CLAUDE.md inteiro (este arquivo)
- [ ] Executei `/devflow` bootstrap (`hot` + `warm` filtrados por goal; `cold` so sob demanda — R-065 OBRIGATORIO)
- [ ] Verifiquei duplicatas do arquivo alvo (`find src -name "*File*" -type f`)
- [ ] Confirmei path aliases em vite.config.js
- [ ] Sei qual view/feature/service estou modificando
- [ ] Vou usar `parseLocalDate()` para datas, NUNCA `new Date('YYYY-MM-DD')`
- [ ] Vou rodar `npm run validate:agent` (10-min kill switch) antes de push
- [ ] Criei schemas Zod com validacao se novo service (schema-first approach)

## Checklist Pos-Codigo — DEVFLOW C5 (antes do commit)

- [ ] Corrigi erro nao-trivial? → `AP-NNN` em `.agent/memory/anti-patterns.json` + `_detail/`
- [ ] Descobri padrao novo? → `R-NNN` em `.agent/memory/rules.json` + `rules_detail/`
- [ ] Decisao arquitetural tomada? → `ADR-NNN` em `.agent/memory/decisions.json` + `decisions_detail/`
- [ ] Entrega significativa? → entrada em `.agent/memory/journal/YYYY-WWW.jsonl`
- [ ] Atualizei `.agent/state.json` (journal_entries_since_distillation)?
- [ ] Se journal_entries >= 15 → executar `/devflow distill`

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
