# CLAUDE.md — Meus Remedios

> Contexto completo do projeto para agentes Claude. Leia este arquivo INTEIRO antes de qualquer tarefa.

## Projeto

**Meus Remedios** e um PWA de gerenciamento de medicamentos pessoal.
Stack: React 19 + Vite 7 + Supabase (Postgres + Auth + RLS) + Zod 4 + Framer Motion 12 + Vitest 4.
Deploy: Vercel Hobby (gratis). Bot: Telegram via Node.js. Custo operacional: R$ 0.

**Versao atual:** v3.2.0 (Fases 1-5 COMPLETAS ✅)
**Fase 5 Entregas:** Cost Analysis (F5.10) + ANVISA Base (F5.6) + Onboarding v3.2 (F5.C) + Landing Redesign (F5.D) — todos mergeados
**Proxima:** Fase 6 — Portabilidade, Performance e Monetizacao (roadmap em `plans/ROADMAP_v4.md`)

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
.memory/             # Memoria do projeto (regras, anti-patterns, knowledge)
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

**Obrigatorio:** Ao final de qualquer sessao de desenvolvimento, antes de commitar, perguntar:
> *"Cometi algum erro que um proximo agente repetiria? Aprendi algum padrao novo?"*

### Quando registrar
| Situacao | Acao |
|----------|------|
| Corrigi um bug causado por um padrao errado | Adicionar anti-pattern em `.memory/anti-patterns.md` |
| Descobri que uma abordagem X falha neste projeto | Adicionar regra preventiva em `.memory/rules.md` |
| A spec tinha caminho de arquivo errado | Anotar no journal + regra de processo |
| Usei tecnica nova que funcionou bem | Regra positiva em `rules.md` |
| Entregai feature/fase completa | Entrada no `.memory/journal/YYYY-WWW.md` |

### Onde registrar
- **Regras novas** → `.memory/rules.md` (proximo numero R-NNN disponivel)
- **Anti-patterns novos** → `.memory/anti-patterns.md` (proximo AP-NNN disponivel)
- **Sessao/entrega** → `.memory/journal/YYYY-WWW.md` (criar arquivo se nao existir)

### Regra de ouro
Nao espere pelo final da sprint. Registre **imediatamente apos corrigir um erro nao-trivial**, enquanto o contexto esta fresco. Erros esquecidos se repetem.

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

## Navegacao (App.jsx)

Sistema view-based (nao React Router). Views atuais:
- `dashboard` (default), `medicines`, `stock`, `protocols`, `history`, `settings`, `admin-dlq`, `landing`

Navegacao via `setCurrentView()` + `BottomNav` component.
`DashboardProvider` wrapa toda a app (context compartilhado).

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

- `docs/INDEX.md` — indice mestre
- `docs/reference/SCHEMAS.md` — schemas Zod
- `docs/standards/GEMINI_INTEGRATION.md` — code review automatico
- `docs/architecture/TELEGRAM_BOT.md` — bot + notificacoes
- `.memory/rules.md` — 97 regras (R-001 a R-097)
- `.memory/anti-patterns.md` — 50 anti-patterns (AP-001..023, AP-T01..T10, AP-S01..S11, AP-W01..W06)
- `.memory/knowledge.md` — domain facts, APIs, schemas
- `.roo/rules-code/rules.md` — regras de codigo consolidadas
- `plans/EXEC_SPEC_FASE_5.md` — spec de execucao da Fase 5

---

## Checklist Pre-Codigo

- [ ] Li CLAUDE.md (este arquivo)
- [ ] Li `.memory/rules.md` e `.memory/anti-patterns.md`
- [ ] Verifiquei duplicatas do arquivo alvo
- [ ] Confirmei path aliases
- [ ] Sei qual view/feature estou modificando
- [ ] Vou usar `parseLocalDate()` para datas
- [ ] Vou rodar `npm run validate:agent` antes de push

## Checklist Pos-Codigo (antes do commit)

- [ ] Corrigi algum erro nao-trivial? → registrar em `.memory/anti-patterns.md`
- [ ] Descobri padrao novo ou pegadinha do projeto? → registrar em `.memory/rules.md`
- [ ] Esta e uma entrega significativa? → adicionar entrada em `.memory/journal/YYYY-WWW.md`
- [ ] Atualizei as contagens na secao Documentacao acima (R-NNN, AP count)?
