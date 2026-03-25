# CLAUDE.md — Meus Remedios

> Contexto completo do projeto para agentes Claude. Leia este arquivo INTEIRO antes de qualquer tarefa.

## Projeto

**Meus Remedios** e um PWA de gerenciamento de medicamentos pessoal.
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
**Proxima:** Wave 6 — Dashboard Redesign (roadmap em `plans/redesign/`)

---

## Estrutura do Projeto

```
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
.memory/             # Memoria de longo prazo do projeto (CANONICA — arquivos persistem entre sessoes)
  rules.md           #   - Regras positivas (R-NNN) — padroes que funcionam neste projeto
  anti-patterns.md   #   - Anti-patterns (AP-NNN) — erros a evitar, licoes aprendidas
  knowledge.md       #   - Domain facts (APIs, schemas, arquitetura)
  journal/           #   - Entregas e sprints (YYYY-WWW.md, uma entrada por semana)
    MEMORY.md        #   - Index de longo prazo (max 200 linhas, resumido)
```

---

## Path Aliases (vite.config.js)

```
@           -> src/
@features   -> src/features/
@shared     -> src/shared/
@services   -> src/services/
@dashboard  -> src/features/dashboard/
@medications -> src/features/medications/
@protocols  -> src/features/protocols/
@stock      -> src/features/stock/
@adherence  -> src/features/adherence/
@schemas    -> src/schemas/
@utils      -> src/utils/
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

## Learning Loops (Memoria de Longo Prazo)

**CRITICO:** Memoria de longo prazo vive em `/.memory/` **DENTRO DO PROJETO**, nao em structs externas (/.claude/projects/...).

**Obrigatorio:** Ao final de qualquer sessao de desenvolvimento, antes de commitar, perguntar:
> *"Cometi algum erro que um proximo agente repetiria? Aprendi algum padrao novo?"*

### Estrutura de Memoria (CANONICA)

```
.memory/
  rules.md                    # Regras positivas: R-001, R-002, ... R-NNN
  anti-patterns.md            # Armadilhas: AP-001, AP-T01, AP-S01, AP-P01, etc.
  knowledge.md                # Domain facts (APIs, schemas, arquitetura, integracoes)
  journal/
    2026-W11.md              # Sprint W11 (YYYY-WWW.md = year-week)
    2026-W12.md
  MEMORY.md                   # Auto-memory resumido (max 200 linhas, index only)
```

### Quando registrar
| Situacao | Acao | Arquivo |
|----------|------|---------|
| Corrigi bug causado por padrao errado | Adicionar novo item | `anti-patterns.md` |
| Descobri abordagem X que falha | Regra preventiva | `rules.md` |
| Entreguei feature/sprint/fase | Journal entry (YYYY-WWW.md) | `journal/` |
| Aprendi tecnica/pattern novo | Regra positiva | `rules.md` |
| Domain fact novo (API, schema) | Documentar | `knowledge.md` |

### Regra de Ouro
- **SEMPRE ler** `.memory/rules.md` + `.memory/anti-patterns.md` antes de codificar (R-065)
- **Registre IMEDIATAMENTE** apos corrigir erro nao-trivial (contexto fresco = memoria precisa)
- **Nao espere fim da sprint** para documentar (erros esquecidos se repetem)
- **Verifique duplicatas** em memoria antes de criar novo R-NNN ou AP-NNN

### Como Localizar Memoria
```bash
# Dentro do projeto (CANONICA)
cat .memory/rules.md
cat .memory/anti-patterns.md
cat .memory/knowledge.md
cat .memory/journal/2026-W11.md

# NUNCA usar estruturas externas (/.claude/projects/...) para memoria do projeto
# Aquelas sao para configuracoes do Claude Code, nao project memory
```

---

## Git Workflow

```
1. CREATE BRANCH (feature/wave-X/nome ou feature/fase-N/nome)
2. MAKE CHANGES (seguir padroes de codigo)
3. VALIDATE LOCALLY (npm run validate:agent)
4. UPDATE MEMORY — registrar licoes aprendidas em .memory/ (obrigatorio)
5. COMMIT (semantico, portugues)
6. PUSH BRANCH
7. CREATE PR
8. WAIT FOR GEMINI CODE ASSIST REVIEW
9. ANALYZE AND ACT ON REVIEWER SUGGESTIONS
10. ISSUE COMMENT FOR RE-REVIEW ('/gemini review')
11. MERGE & CLEANUP (--no-ff, deletar branch)
```

**REGRA ABSOLUTA:** Code agents NUNCA mergeiam seus proprios PRs.
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

**ViewSkeleton component:** Skeleton loading screen (src/App.jsx, lines 23-35) que exibe placeholder durante carregamento de chunks grandes (jsPDF, medicineDatabase, etc). Resultado: FCP melhorado ~500ms no mobile.

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
- `docs/architecture/TELEGRAM_BOT.md` — bot + notificacoes
- `docs/architecture/CHATBOT_AI.md` — **NOVO** — Arquitetura do Chatbot IA Multi-Canal (F8.1): contextBuilder, safetyGuard, Groq API, bugfixes hallucination
- `plans/EXEC_SPEC_FASE_5.md` — spec de execucao da Fase 5
- `plans/EXEC_SPEC_MOBILE_PERFORMANCE.md` — Roadmap M0-M6 para otimizacao mobile (M2 concluido ✅)
- `plans/EXEC_SPEC_DASHBOARD_FIRST_LOAD.md` — **NOVO** — Sprints D1-D6 para otimizar first load do Dashboard (target: 25 → ≤12 queries, ~15s → <5s em 4G)
- `plans/ROADMAP_v4.md` — roadmap futuro

### Memoria de Longo Prazo (em `/.memory/` — DENTRO DO PROJETO)
**IMPORTANTE:** Estes arquivos persistem entre sessoes e devem ser consultados/atualizados regularmente.
- `.memory/rules.md` — Regras positivas (R-NNN), padroes que funcionam neste projeto
- `.memory/anti-patterns.md` — Anti-patterns (AP-NNN), armadilhas e licoes aprendidas
- `.memory/knowledge.md` — Domain facts (APIs, schemas, arquitetura, integracoes, hacks conhecidos)
- `.memory/journal/YYYY-WWW.md` — Entregas por semana (ex: `2026-W11.md` = semana 11 de 2026)
- `.memory/MEMORY.md` — Auto-memory resumido (ate 200 linhas, index + contexto sessao passada)

---

## Checklist Pre-Codigo

- [ ] Li CLAUDE.md inteiro (este arquivo)
- [ ] Li `.memory/rules.md` e `.memory/anti-patterns.md` (R-065 — OBRIGATORIO)
  - Localizacao: PROJECT_ROOT/.memory/ (dentro do projeto, nao external)
- [ ] Verifiquei duplicatas do arquivo alvo (`find src -name "*File*" -type f`)
- [ ] Confirmei path aliases em vite.config.js
- [ ] Sei qual view/feature/service estou modificando
- [ ] Vou usar `parseLocalDate()` para datas, NUNCA `new Date('YYYY-MM-DD')`
- [ ] Vou rodar `npm run validate:agent` (10-min kill switch) antes de push
- [ ] Criei schemas Zod com validacao se novo service (schema-first approach)

## Checklist Pos-Codigo (antes do commit)

- [ ] Corrigi algum erro nao-trivial? → registrar em `.memory/anti-patterns.md`
- [ ] Descobri padrao novo ou pegadinha do projeto? → registrar em `.memory/rules.md`
- [ ] Esta e uma entrega significativa? → adicionar entrada em `.memory/journal/YYYY-WWW.md`
- [ ] Atualizei as contagens na secao Documentacao acima (R-NNN, AP count)?
