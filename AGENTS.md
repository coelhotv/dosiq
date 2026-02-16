# Meus Remédios - AI Agent Guide

> **Aplicativo de gerenciamento de medicamentos em português brasileiro**
> Versão: 2.7.0 | React 19 + Vite + Supabase

---

## 📋 Project Overview

**Meus Remédios** is a comprehensive medication management application that only uses free tier services, featuring:

- **Multi-user authentication** via Supabase Auth with Row-Level Security (RLS)
- **Treatment protocols** with complex scheduling and dose titration support
- **Stock management** with automatic tracking and alerts
- **Telegram Bot integration** for reminders and conversational interactions
- **Dashboard** with insights, adherence tracking, and gamification
- **Onboarding wizard** (4 steps) for new users

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTE (BROWSER)                              │
│                        React 19 + Vite (SPA)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐ │
│  │   Views     │  │ Components  │  │   Services Layer (Zod + SWR Cache)  │ │
│  │  (Pages)    │  │  (UI/Forms) │  │   ├─ medicineService.js             │ │
│  └─────────────┘  └─────────────┘  │   ├─ protocolService.js             │ │
│                                    │   ├─ stockService.js                │ │
│                                    │   └─ logService.js                  │ │
│                                    └─────────────────┬───────────────────┘ │
│                                                      │                      │
│                                           ┌──────────▼──────────┐          │
│                                           │   Supabase Client   │          │
│                                           └──────────┬──────────┘          │
└──────────────────────────────────────────────────────┼──────────────────────┘
                                                       │
                                    ┌──────────────────┼──────────────────┐
                                    │                  │                  │
                              ┌─────▼─────┐     ┌─────▼─────┐     ┌──────▼──────┐
                              │  VERCEL   │     │  VERCEL   │     │  TELEGRAM   │
                              │  STATIC   │     │   API     │     │    BOT      │
                              │  (SPA)    │     │ (Webhooks)│     │ (Node.js)   │
                              └───────────┘     └─────┬─────┘     └─────────────┘
                                                      │
                                               ┌──────▼───────┐
                                               │  SUPABASE    │
                                               │ ┌──────────┐ │
                                               │ │PostgreSQL│ │
                                               │ │  + RLS   │ │
                                               │ └──────────┘ │
                                               │ ┌──────────┐ │
                                               │ │  Auth    │ │
                                               │ └──────────┘ │
                                               └──────────────┘
```

---

## 🏗️ Technology Stack

### Core Technologies

| Camada | Tecnologia | Versão | Propósito |
|--------|-----------|--------|-----------|
| **Frontend** | React | 19.2.0 | UI Library (ES Modules nativo) |
| **Build Tool** | Vite | 7.2.4 | Build e Dev Server |
| **Backend** | Supabase | 2.90.1 | PostgreSQL + Auth + REST API |
| **Validação** | Zod | 4.3.6 | Runtime validation |
| **Cache** | SWR Custom | - | Stale-While-Revalidate cache |
| **Estilos** | CSS Vanilla | - | Design system customizado |
| **Testes** | Vitest | 4.0.16 | Unit testing |
| **Bot** | node-telegram-bot-api | 0.67.0 | Telegram integration |
| **Deploy** | Vercel | - | Hosting + Serverless Functions |
| **Cron** | cron-job.org | - | Free crons for Telegram bot |

### Key Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.90.1",
    "framer-motion": "^12.33.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "zod": "^4.3.6"
  }
}
```

---

## 📁 Project Structure

```
meus-remedios/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes atômicos (Button, Card, Modal, Loading)
│   │   ├── medicine/        # Domínio: Medicamentos (MedicineCard, MedicineForm)
│   │   ├── protocol/        # Domínio: Protocolos (ProtocolCard, ProtocolForm, TitrationWizard)
│   │   ├── stock/           # Domínio: Estoque (StockCard, StockForm, StockIndicator)
│   │   ├── log/             # Domínio: Registros (LogEntry, LogForm)
│   │   ├── dashboard/       # Domínio: Dashboard (InsightCard, HealthScoreCard, etc)
│   │   ├── adherence/       # Domínio: Adesão (AdherenceWidget, StreakBadge)
│   │   ├── onboarding/      # Wizard de primeiros passos (4 steps)
│   │   └── animations/      # Efeitos visuais (Confetti, Pulse, Shake)
│   ├── hooks/
│   │   ├── useCachedQuery.js    # Hook SWR para cache de queries
│   │   ├── useDashboardContext.jsx
│   │   ├── useInsights.js
│   │   └── useAdherenceTrend.js
│   ├── lib/
│   │   ├── supabase.js      # Cliente Supabase configurado
│   │   └── queryCache.js    # Implementação SWR customizada
│   ├── schemas/             # Validação Zod (23+ testes)
│   │   ├── index.js         # Exportações centralizadas
│   │   ├── medicineSchema.js
│   │   ├── protocolSchema.js
│   │   ├── stockSchema.js
│   │   ├── logSchema.js
│   │   └── validationHelper.js
│   ├── services/
│   │   ├── api/             # Serviços da API
│   │   │   ├── cachedServices.js   # Wrappers com cache SWR
│   │   │   ├── medicineService.js
│   │   │   ├── protocolService.js
│   │   │   ├── stockService.js
│   │   │   ├── logService.js
│   │   │   ├── treatmentPlanService.js
│   │   │   ├── adherenceService.js
│   │   │   └── titrationService.js
│   │   ├── api.js           # Exportações principais
│   │   ├── insightService.js
│   │   ├── analyticsService.js
│   │   ├── milestoneService.js
│   │   └── paginationService.js
│   ├── utils/
│   │   ├── adherenceLogic.js
│   │   └── titrationUtils.js
│   ├── styles/
│   │   ├── tokens.css       # Design tokens (cores, espaçamentos)
│   │   └── index.css        # Estilos globais
│   ├── views/               # Páginas principais
│   │   ├── Auth.jsx
│   │   ├── Dashboard.jsx
│   │   ├── History.jsx
│   │   ├── Landing.jsx
│   │   ├── Medicines.jsx
│   │   ├── Protocols.jsx
│   │   ├── Settings.jsx
│   │   └── Stock.jsx
│   ├── App.jsx              # Componente principal com roteamento
│   ├── main.jsx             # Entry point
│   └── test/
│       └── setup.js         # Configuração Vitest
├── server/                  # Bot do Telegram (Node.js independente)
│   ├── bot/
│   │   ├── commands/        # Comandos Telegram (/start, /hoje, /registrar, etc)
│   │   ├── callbacks/       # Handlers de callback queries
│   │   ├── middleware/      # Middlewares (auth, logging)
│   │   ├── alerts.js        # Sistema de alertas inteligentes
│   │   ├── scheduler.js     # Agendador de tarefas
│   │   ├── tasks.js         # Tarefas do cron
│   │   ├── logger.js        # Logger estruturado
│   │   └── health-check.js  # Health checks
│   ├── services/
│   │   └── supabase.js      # Cliente Supabase para o bot
│   └── index.js             # Entry point do bot
├── api/                     # Serverless Functions (Vercel)
│   ├── telegram.js          # Webhook para bot (POST)
│   └── notify.js            # Cron job endpoint (GET/POST)
├── .migrations/             # Migrações SQL
│   └── *.sql
├── docs/                    # Documentação técnica
│   ├── ARQUITETURA.md
│   ├── PADROES_CODIGO.md
│   ├── API_SERVICES.md
│   ├── HOOKS.md
│   └── ...
├── package.json
├── vite.config.js
├── vitest.config.js         # Configurações múltiplas de teste
├── eslint.config.js
└── vercel.json              # Configuração de rotas Vercel
```

---

## 🔧 Environment Setup

### CLI Tools PATH

**IMPORTANTE:** Antes de executar comandos CLI (gh, vercel, etc.), configure o PATH:

```bash
# Adicionar ao PATH para a sessão atual
export PATH="/usr/local/sbin:/usr/local/bin:/opt/local/bin:/opt/local/sbin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# Verificar se gh está disponível
which gh
```

**Para persistir:** Adicione as linhas de `export` ao final do seu arquivo de configuração de shell (ex: `~/.zshrc` para Zsh ou `~/.bash_profile` para Bash).

### CLI Tools Disponíveis

| Tool | Instalação | Uso |
|------|-----------|-----|
| `gh` (GitHub CLI) | `brew install gh` | Criar PRs, issues, reviews |
| `vercel` | `npm i -g vercel` | Deploy e logs de produção |

---

## 🚀 Build and Development Commands

### Development

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento (Vite)
npm run dev
# Acesse: http://localhost:5173

# Iniciar bot do Telegram localmente (em outro terminal)
npm run bot
# ou: cd server && npm run dev
```

### Build and Deploy

```bash
# Build de produção
npm run build

# Preview do build local
npm run preview

# Deploy na Vercel
vercel --prod
```

### Linting

```bash
# ESLint - verificação de código
npm run lint
```

---

## 🧪 Testing Commands

O projeto possui 110+ testes unitários com Vitest e múltiplas configurações otimizadas:

### Testes Base

```bash
# Todos os testes (CI/CD completo)
npm run test

# Modo watch para desenvolvimento
npm run test:watch
```

### Testes Otimizados (Fase 1)

```bash
# Apenas arquivos modificados desde main
npm run test:changed

# Testes relacionados aos arquivos staged
npm run test:related

# Testes críticos (services, utils, schemas, hooks)
npm run test:critical

# Exclui testes de integração
npm run test:unit

# Saída resumida (30 primeiras linhas)
npm run test:quick
```

### Testes Fase 2 (Seleção Inteligente)

```bash
# Script customizado baseado em git diff
npm run test:smart

# Alias para test:changed
npm run test:git

# Alias para test:related
npm run test:affected

# Suite mínima de smoke tests
npm run test:smoke

# Configuração light de testes
npm run test:light
```

### Validação Completa

```bash
# Lint + testes críticos (pre-push)
npm run validate

# Lint + testes relacionados (pre-commit rápido)
npm run validate:quick
```

### Configurações de Teste

| Arquivo | Propósito |
|---------|-----------|
| `vitest.config.js` | Configuração padrão (threads otimizadas) |
| `vitest.critical.config.js` | Apenas testes essenciais (exclui UI) |
| `vitest.smoke.config.js` | Suite mínima para health check |
| `vitest.light.config.js` | Configuração leve para desenvolvimento rápido |

---

## 🎯 Design Principles & Heuristics

### Universal Constraints (Obrigatórios)

These rules prevent recurring errors and must be followed unconditionally:

#### 1. React Hook Declaration Order
**Rule:** States → Memos → Effects → Handlers
```jsx
// ✅ CORRECT - Prevents TDZ (Temporal Dead Zone)
function Component() {
  // 1. States first
  const [data, setData] = useState()
  const [loading, setLoading] = useState(false)
  
  // 2. Memos (depend on states)
  const processedData = useMemo(() => process(data), [data])
  
  // 3. Effects (depend on memos/states)
  useEffect(() => { /* ... */ }, [processedData])
  
  // 4. Handlers last
  const handleClick = () => { /* ... */ }
}

// ❌ WRONG - ReferenceError: Cannot access before initialization
function Component() {
  const processed = useMemo(() => data + 1, [data]) // data is undefined!
  const [data, setData] = useState(0) // Declared too late
}
```

#### 2. Zod Schema Values in Portuguese
**Rule:** All enum values must be in Portuguese for UI consistency
```javascript
// ✅ CORRECT
const FREQUENCIES = ['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário']
const MEDICINE_TYPES = ['comprimido', 'cápsula', 'líquido', 'injeção', 'pomada', 'spray', 'outro']
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// ❌ WRONG - Mixing languages causes UI inconsistencies
const FREQUENCIES = ['daily', 'weekly'] // Never use English in schemas
```

#### 3. Telegram Bot Callback Data Limits
**Rule:** `callback_data` must be < 64 bytes; use numeric indices instead of UUIDs
```javascript
// ❌ WRONG - Exceeds 64 bytes (BUTTON_DATA_INVALID)
callback_data: `reg_med:${medicineId}:${protocolId}` // ~81 chars

// ✅ CORRECT - Compact and within limits
callback_data: `reg_med:${index}` // ~15 chars
// Store mapping in session: session.set('medicineMap', medicines)
```

#### 4. Dosage Recording Units
**Rule:** Always record `quantity_taken` in pills, never in milligrams
```javascript
// dosage_per_intake = pills per dose (e.g., 4)
// dosage_per_pill = mg per pill (e.g., 500)
// dosage_real = 4 * 500 = 2000mg

// ✅ CORRECT - Store pills (within Zod limit of 100)
const pillsToDecrease = quantity / dosagePerPill
await logService.create({ quantity_taken: pillsToDecrease })

// ❌ WRONG - Exceeds Zod schema limit (100)
await logService.create({ quantity_taken: 2000 }) // mg exceeds limit!
```

#### 5. Operation Order for Dose Registration
**Rule:** Validate → Record → Decrement
```javascript
try {
  // 1. Validate stock
  if (stock < pillsToDecrease) throw new Error('Estoque insuficiente')
  
  // 2. Record dose
  await logService.create(log)
  
  // 3. Decrement stock
  await stockService.decrease(medicineId, pillsToDecrease)
}
```

### Context-Dependent Recommendations

#### When to Use Client-Side vs API Calculation
| Scenario | Recommendation | Rationale |
|----------|---------------|-----------|
| Data already in SWR cache | Client-side | Zero network requests |
| Complex aggregation | Client-side | Avoid server load |
| Data across multiple users | API | RLS constraints |
| Timezone-sensitive | Client-side | Use Brazil local time (GMT-3) |
| Large datasets (>1000 rows) | API | Memory optimization |

#### Test Command Selection Matrix
| File Type | Recommended Command | Rationale |
|-----------|---------------------|-----------|
| `*.service.js` | `npm run test:critical` | Services require integration context |
| `*.schema.js` | `npm run test:critical` | Schemas have critical validation logic |
| `*.util.js` | `npm run test:light` | Pure functions, no component deps |
| `*.jsx` (component) | `npx vitest --config vitest.component.config.js` | Isolated component testing |
| Config files | `npm run test:full` | May affect entire suite |

#### LogForm Return Type Handling
```jsx
// LogForm has TWO return modes - ALWAYS check both:
if (Array.isArray(logData)) {
  // type === 'plan' (bulk registration)
  await logService.createBulk(logData)
} else {
  // type === 'protocol' (single registration)
  await logService.create(logData)
}
```

## 🎨 Code Style Guidelines

### Nomenclatura Obrigatória

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Componentes | PascalCase | `MedicineCard.jsx` |
| Funções/Variáveis | camelCase | `calculateAdherence`, `medicineName` |
| Constantes | SCREAMING_SNAKE | `CACHE_STALE_TIME`, `MAX_RETRIES` |
| Arquivos | kebab-case ou PascalCase | `medicine-service.js`, `MedicineCard.jsx` |
| Hooks | use + PascalCase | `useCachedQuery`, `useDashboardContext` |
| Branches | kebab-case | `feature/wave-2/fix-login` |

### Idiomas

| Contexto | Idioma | Exemplo |
|----------|--------|---------|
| Código (variáveis, funções) | Inglês | `const medicineName = ''` |
| Mensagens de erro | Português | `'Nome é obrigatório'` |
| UI (labels, botões) | Português | `Salvar Medicamento` |
| Documentação | Português | Este arquivo |
| Commits | Português | `feat: adiciona validação Zod` |
| Nomes de arquivos | Inglês | `medicineService.js` |
| Tabelas/Colunas DB | Português | `medicamentos.nome` |
| Raciocínio interno | Inglês | Internal planning/thinking |
| Comentários de código | Português | `// Calcula a adesão` |

### Estrutura de Imports

```jsx
// 1. React e bibliotecas externas
import { useState, useEffect } from 'react'
import { z } from 'zod'

// 2. Componentes internos
import Button from '../ui/Button'
import Card from '../ui/Card'

// 3. Hooks e utils
import { useCachedQuery } from '../../hooks/useCachedQuery'
import { formatDate } from '../../utils/date'

// 4. Services e schemas
import { medicineService } from '../../services/api/medicineService'
import { validateMedicine } from '../../schemas/medicineSchema'

// 5. CSS (sempre por último)
import './MedicineForm.css'
```

### Regras de Validação Zod (Obrigatório)

Todo service DEVE validar dados com Zod antes de enviar ao Supabase:

```javascript
// medicineService.js
import { validateMedicineCreate } from '../schemas/medicineSchema'

export const medicineService = {
  async create(medicine) {
    // ✅ SEMPRE validar antes de enviar
    const validation = validateMedicineCreate(medicine)
    if (!validation.success) {
      throw new Error(`Erro de validação: ${validation.errors.map(e => e.message).join(', ')}`)
    }
    
    const { data, error } = await supabase
      .from('medicines')
      .insert(validation.data)
      .select()
      .single()
    
    if (error) throw error
    return data
  }
}
```

### Cache SWR (Obrigatório para Leituras)

```javascript
// ✅ SEMPRE usar cachedServices para leituras
import { cachedMedicineService } from '../services/api/cachedServices'

// Em componentes:
const { data, isLoading } = useCachedQuery(
  'medicines',
  () => cachedMedicineService.getAll(),
  { staleTime: 30000 }
)

// ✅ Invalidar cache após mutations
async function handleCreate(medicine) {
  await cachedMedicineService.create(medicine)
  // Cache é invalidado automaticamente no service
}
```

---

## 🤖 Agent Long-Term Memory System

### Memory Structure

This project uses a structured memory system for tracking lessons learned, patterns, and decisions:

```
.roo/rules/
├── memory.md              # Long-term memory (lessons learned, patterns)
├── rules-code/rules.md    # Coding standards and patterns
└── rules-architecture/rules.md  # Architecture governance
```

### Memory Entry Format

When adding to `.roo/rules/memory.md`, use this template:

```markdown
## Memory Entry — YYYY-MM-DD HH:MM
**Contexto / Objetivo**
- What was the goal of this task?

**O que foi feito (mudanças)**
- Files changed
- New files created
- Configurations modified

**O que deu certo**
- Successful patterns
- Solutions that worked

**O que não deu certo / riscos**
- Failures or challenges
- What to avoid

**Regras locais para o futuro (lições acionáveis)**
- Actionable lessons for future work

**Pendências / próximos passos**
- Outstanding tasks
- Follow-up actions
```

### Memory Retention Policy

| Memory Type | Retention | Update Frequency |
|-------------|-----------|------------------|
| Code patterns | Permanent | When patterns change |
| Architecture decisions | Permanent | When architecture evolves |
| Bug fixes | 1 year | After each fix |
| Temporary workarounds | Until resolved | After fix |

---

## 🤖 Gemini Code Reviewer Integration

### Overview

This project uses **Gemini Code Reviewer GitHub App** for automated code reviews in all PRs. The integration uses GitHub Actions to:

1. **Auto-trigger** review on new PRs
2. **Wait** 5 minutes for Gemini analysis
3. **Parse** review comments and identify issues
4. **Auto-fix** lint, formatting, logic, and architecture issues when safe
5. **Validate** fixes with lint and smoke tests
6. **Post** summary in PR

### Quick Start

#### Automatic (Recommended)
The workflow `.github/workflows/pr-auto-trigger.yml` automatically posts `/gemini review` on every PR opened.

#### Manual
In any PR comment, type:

```
/gemini review
```

### Workflow Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GEMINI CODE REVIEWER WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1️⃣  PR ABERTO                                                         │
│      └─→ pr-auto-trigger.yml posta /gemini review                         │
│                                                                             │
│  2️⃣  GEMINI ANALISA                                                    │
│      └─→ Aguarda 5 minutos para análise completa                          │
│                                                                             │
│  3️⃣  PARSE COMENTÁRIOS                                                 │
│      └─→ Identifica tipos de issues                                       │
│          ├─ Lint                                                          │
│          ├─ Formatting                                                    │
│          ├─ Logic                                                         │
│          ├─ Architecture                                                  │
│          └─ Conflicts                                                     │
│                                                                             │
│  4️⃣  AUTO-FIX                                                           │
│      └─→ Aplica fixes automaticamente quando seguro                       │
│          ├─ Lint: Sempre                                                  │
│          ├─ Formatting: Sempre                                             │
│          ├─ Logic: diff ≤ 5 linhas, sem business logic                    │
│          ├─ Architecture: arquivo único                                    │
│          └─ Conflicts: auto-resolvable                                    │
│                                                                             │
│  5️⃣  VALIDATE                                                           │
│      └─→ npm run lint + npm run test:smoke                                │
│                                                                             │
│  6️⃣  COMMIT & PUSH                                                      │
│      └─→ Cria commit automático se houver fixes                           │
│                                                                             │
│  7️⃣  POST SUMMARY                                                       │
│      └─→ Resume no PR com métricas                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Issue Types & Auto-Fix Rules

| Tipo | Auto-Fix | Condições | Requer Manual |
|------|----------|-----------|---------------|
| **Lint** | ✅ | Sempre | ❌ |
| **Formatting** | ✅ | Sempre | ❌ |
| **Logic** | ✅ | diff ≤ 5 linhas, sem business logic | ⚠️ Se complexo |
| **Architecture** | ✅ | Arquivo único afetado | ⚠️ Multi-arquivo |
| **Conflicts** | ✅ | Auto-resolvable | ⚠️ Complexos |
| **Security** | ❌ | Jamais | ✅ |
| **Business Logic** | ❌ | Jamais | ✅ |
| **Breaking Changes** | ❌ | Jamais | ✅ |

### Available Commands

| Comando | Ação |
|---------|------|
| `/gemini review` | Inicia review completa |
| `/gemini summary` | Resume apenas issues críticas |
| `/gemini skip` | Pula review para este PR |

### GitHub App

- **App**: [Gemini Code Reviewer](https://github.com/apps/gemini-code-reviewer)
- **Permissões**: read/write em PRs, issues
- **Instalação**: Automática via Organization settings

### Troubleshooting

#### Gemini não posta review
```bash
# Verificar:
1. App está instalado no repositório?
2. Token tem permissões 'repo'?
3. Workflow está habilitado em Actions tab?
```

#### Auto-fix não Commita
```bash
# Possíveis causas:
1. Issues não são do tipo auto-fixável
2. Token sem 'contents: write' permission
3. Branch protection bloqueando force push
4. Pre-commit hooks bloqueando
```

#### Build falha após Auto-Fix
```yaml
# O workflow faz rollback automático
# Verificar:
1. Log do workflow para ver o que quebrou
2. Commit de backup é criado automaticamente
3. PR recebe comentário de rollback
```

### For AI Agents

When working with code reviews, follow these guidelines:

1. **Don't skip the review process** - Always wait for Gemini to analyze your changes
2. **Check auto-fixes** - Review the auto-fix commits Gemini creates
3. **Address manual issues** - Some issues require human review
4. **Re-run when needed** - Use `/gemini review` after making changes

```bash
# Workflow for AI agents:
1. Make changes to code
2. git commit -m "feat: add new feature"
3. git push origin feature/branch
4. Wait for /gemini review to auto-trigger
5. Check Gemini's comments and auto-fixes
6. Address any manual issues
7. Use /gemini review again if needed
```

---

## 🔄 Git Workflow (RIGID PROCESS - MANDATORY)

> **⚠️ CRITICAL:** ALL code/documentation changes MUST follow this workflow exactly. NO exceptions.

### Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MANDATORY GITHUB WORKFLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1️⃣  CREATE BRANCH      (Never work on main!)                              │
│  2️⃣  MAKE CHANGES       (Follow all coding standards)                      │
│  3️⃣  VALIDATE LOCALLY   (Lint + Tests + Build)                             │
│  4️⃣  COMMIT             (Atomic commits, semantic messages)                │
│  5️⃣  PUSH BRANCH        (To origin)                                        │
│  6️⃣  CREATE PULL REQUEST (Use PR template)                                 │
│  7️⃣  WAIT FOR REVIEW    (Address all comments)                             │
│  8️⃣  MERGE & CLEANUP    (--no-ff, delete branch)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Steps

#### 1. CREATE BRANCH (MANDATORY)

```bash
# Step 1: Always start from updated main
git checkout main
git pull origin main

# Step 2: Create branch with proper naming
git checkout -b feature/wave-X/nome-descritivo

# Naming conventions:
#   feature/wave-2/add-login          - New features
#   fix/wave-2/fix-login-error        - Bug fixes
#   docs/wave-2/update-api-docs       - Documentation
#   hotfix/security-patch             - Critical fixes
```

**⚠️ NEVER:**
- Work directly on `main`
- Commit to `main`
- Push to `main` without PR

#### 2. MAKE CHANGES

- Edit files following:
  - `.roo/rules-code/rules.md` (coding standards)
  - `.roo/rules-architecture/rules.md` (architecture)
- Keep changes focused and atomic
- One logical change per commit

#### 3. VALIDATE LOCALLY (MANDATORY - ALL MUST PASS)

```bash
# Run ALL three validations:
npm run lint          # Must have 0 errors
npm run test:critical # 143 tests must pass
npm run build         # Production build must succeed

# Or use the combined command:
npm run validate      # Runs lint + test:critical
```

**If any validation fails:**
```bash
# 1. Fix all errors
# 2. Re-run validation
# 3. Only proceed when all pass
```

**⚠️ NEVER:**
- Skip validation
- Use `--no-verify` to bypass
- Commit with failing tests

#### 4. COMMIT (Atomic / Semantic)

```bash
# Stage related files
git add src/components/MedicineForm.jsx
git add src/components/MedicineForm.css

# Commit with semantic message (in Portuguese)
git commit -m "feat(medicine): adicionar validação de dosagem"

# Format: type(scope): description
type = feat|fix|docs|test|refactor|style|chore
scope = component|service|api|test|docs|config
description = em português, minúsculas
```

**Commit Types:**
| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(dashboard): adicionar widget de adesão` |
| `fix` | Bug fix | `fix(service): corrigir cálculo de estoque` |
| `docs` | Documentation | `docs(api): atualizar documentação de endpoints` |
| `test` | Tests only | `test(service): adicionar testes de protocolo` |
| `refactor` | Refactoring | `refactor(hook): simplificar useCachedQuery` |
| `style` | Formatting | `style(lint): corrigir formatação` |
| `chore` | Maintenance | `chore(deps): atualizar dependências` |

#### 5. PUSH BRANCH

```bash
git push origin feature/wave-X/nome-descritivo
```

#### 6. CREATE PULL REQUEST (MANDATORY)

**Using GitHub CLI:**
```bash
gh pr create --title "feat: descrição resumida" \
             --body-file docs/PULL_REQUEST_TEMPLATE.md
```

**Using GitHub Web:**
1. Go to: https://github.com/coelhotv/meus-remedios/pulls
2. Click "New Pull Request"
3. Select: `main` ← `feature/wave-X/nome-descritivo`
4. **USE TEMPLATE:** Copy from [`docs/PULL_REQUEST_TEMPLATE.md`](docs/PULL_REQUEST_TEMPLATE.md:1)
5. Fill ALL sections:
   - **Summary:** What this PR does
   - **Tasks:** Checklist of completed items
   - **Metrics:** Performance/quality improvements
   - **Files:** List of changed files
   - **Checklist:** Code quality verifications
   - **Testing:** How to test
6. Assign reviewers
7. Link related issues (Closes #123)
8. Add appropriate labels

**PR Title Format:**
```
feat(scope): brief description
fix(scope): brief description
docs(scope): brief description
```

#### 7. WAIT FOR REVIEW

**During Review:**
- Respond to comments within 24 hours
- Make requested changes promptly
- Explain reasoning if you disagree (respectfully)
- Re-request review after making changes
- Address ALL comments before merging

**Review Checklist for Reviewers:**
- [ ] Code follows naming conventions
- [ ] Zod validation applied
- [ ] Tests added/updated
- [ ] No console.log debug statements
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Documentation updated (if needed)

#### 8. MERGE & CLEANUP

**After PR Approval:**

```bash
# On GitHub:
# 1. Click "Merge pull request"
# 2. Select "Create a merge commit" (--no-ff)
# 3. Confirm merge

# Locally:
git checkout main
git pull origin main

# Delete branch
git branch -d feature/wave-X/nome-descritivo
git push origin --delete feature/wave-X/nome-descritivo
```

**⚠️ Merge Requirements:**
- All status checks pass (CI/CD)
- At least 1 approval from reviewer
- No unresolved comments
- Branch is up to date with main

### Anti-Patterns (STRICTLY PROHIBITED)

| Anti-Pattern | Consequence | What To Do Instead |
|--------------|-------------|-------------------|
| Commit directly to `main` | Unreviewed code in production | Always create feature branch |
| Skip local validation | Broken builds in CI/CD | Run `npm run validate` before every push |
| Push without PR | No code review | Create PR using template |
| Use `--no-verify` | Bypass quality gates | Fix errors, don't bypass |
| Merge own PR | No quality assurance | Wait for reviewer approval |
| Large PRs (>500 lines) | Difficult review | Split into smaller PRs |
| Keep merged branches | Repository clutter | Delete immediately after merge |

### Emergency Procedures

**Only for critical production issues:**

```bash
# ⚠️ REQUIRES human approval documented

# 1. Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-fix

# 2. Make minimal fix

# 3. Validate quickly
npm run lint && npm run test:critical

# 4. Commit with [HOTFIX] tag
git commit -m "hotfix: descrição da correção crítica"

# 5. Push and create PR with URGENT label
gh pr create --title "[HOTFIX] fix: descrição" --label urgent

# 6. Request immediate review

# 7. After merge, schedule post-incident review
```

**Post-Incident Requirements:**
1. Document what happened
2. Explain why normal process was bypassed
3. Schedule follow-up to prevent recurrence

### Workflow Summary Card

```
┌─────────────────────────────────────────────┐
│  BEFORE ANY CODE CHANGE:                    │
│  1. git checkout -b feature/wave-X/name     │
│                                             │
│  BEFORE COMMIT:                             │
│  2. npm run validate                        │
│                                             │
│  AFTER PUSH:                                │
│  3. Create PR with template                 │
│  4. Wait for review                         │
│  5. Merge with --no-ff                      │
│  6. Delete branch                           │
└─────────────────────────────────────────────┘
```

---

## 🛡️ Security Considerations

### Autenticação
- JWT tokens gerenciados pelo Supabase Auth
- Refresh automático de sessão
- RLS (Row Level Security) em todas as tabelas

### Autorização (RLS)
```sql
-- Exemplo de política RLS
CREATE POLICY "Users can only see their own medicines"
  ON medicines
  FOR ALL
  USING (user_id = auth.uid());
```

### Variáveis de Ambiente

Arquivo `.env` obrigatório:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-aqui

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=seu-token-do-botfather

# External Cron Secret (for cron-job.org)
CRON_SECRET=chave-secreta-aleatoria
```

⚠️ **NUNCA** commite o arquivo `.env` - já está no `.gitignore`.

### Validação de Dados
- **Zod Schemas:** Validação runtime em todos os services
- **Nenhum dado** chega ao backend sem validação
- Mensagens de erro em português

---

## 📚 Key Documentation

### Documentação Técnica (docs/)

| Arquivo | Conteúdo |
|---------|----------|
| `ARQUITETURA.md` | Visão arquitetural completa e fluxo de dados |
| `PADROES_CODIGO.md` | Convenções detalhadas de código e anti-patterns |
| `API_SERVICES.md` | Documentação das APIs internas dos services |
| `HOOKS.md` | Documentação dos hooks customizados |
| `SETUP.md` | Guia completo de configuração do ambiente |
| `QUICKSTART.md` | Início rápido para desenvolvedores |
| `database-schema.md` | Esquema completo do banco de dados |
| `CSS_ARCHITECTURE.md` | Documentação dos padrões de CSS a serem utilizados |

### Documentação de Funcionalidades

| Arquivo | Conteúdo |
|---------|----------|
| `GUIA_TITULACAO.md` | Tutorial de protocolos em titulação |
| `TRANSICAO_AUTOMATICA.md` | Sistema de transição automática de doses |
| `user-guide.md` | Guia do usuário final |

---

## 🔧 Development Tips

### Fluxo de Dados com Cache SWR

```
1. Componente solicita dados
         ↓
2. useCachedQuery verifica cache
         ↓
3. Cache HIT (fresh)? → Retorna imediatamente (~0-50ms)
   Cache HIT (stale)? → Retorna + revalida background
   Cache MISS? → Executa fetcher
         ↓
4. Dados armazenados no Map
         ↓
5. Componente atualizado
```

### Estratégias de Performance

| Estratégia | Implementação | Impacto |
|------------|---------------|---------|
| Cache SWR | `queryCache.js` | 95% mais rápido em re-leituras |
| View Materializada | `medicine_stock_summary` | 5x mais rápido consultas estoque |
| Deduplicação | `pendingRequests` Map | Evita requests duplicados |
| LRU Eviction | 50 entradas máximo | Previne memory leaks |
| React 19 | Compiler otimizado | Menos re-renders |

### Onboarding Flow

```
Novo Usuário
     ↓
Auth (Cadastro/Login)
     ↓
OnboardingProvider verifica user_settings.onboarding_completed
     ↓
Se FALSE → Abre OnboardingWizard
     ↓
Step 0: WelcomeStep (Boas-vindas)
     ↓
Step 1: FirstMedicineStep (Cadastro primeiro remédio)
     ↓
Step 2: FirstProtocolStep (Configura primeira rotina)
     ↓
Step 3: TelegramIntegrationStep (Bot opcional)
     ↓
Salva onboarding_completed = true
     ↓
Dashboard
```

---

## 🧪 Testing Strategies

### Component Testing Best Practices

#### Mocking Framer Motion
```jsx
// ✅ CORRECT - Destructure all animation props
vi.mock('framer-motion', () => ({
  motion: {
    div: vi.fn(({ initial, animate, transition, ...props }) => <div {...props} />),
  },
  AnimatePresence: vi.fn(({ children }) => <>{children}</>),
}))
```

#### Mock Path Resolution
```javascript
// Verify actual folder structure before mocking
// ❌ WRONG - incorrect relative path
vi.mock('../../../hooks/useCachedQuery')

// ✅ CORRECT - matches actual structure
vi.mock('../../hooks/useCachedQuery')
```

#### Date Handling in Tests
```javascript
// ✅ CORRECT - Use relative dates to avoid timezone issues
const getRelativeDate = (daysOffset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date.toISOString().split('T')[0]
}

// ❌ WRONG - Fixed dates may be filtered as future dates
const date = '2026-02-11' // May fail if component filters future dates
```

#### Component Testing Configuration
```bash
# Use dedicated config for component tests (excludes from default config)
npx vitest run --config vitest.component.config.js
```

### Smoke Test Requirements

Smoke tests must be isolated from other tests due to mock conflicts:

```bash
# ✅ CORRECT - Run smoke tests separately
npm run test:smoke

# ❌ WRONG - Don't include smoke tests with other test suites
```

**Configuration:** Smoke tests use `vitest.smoke.config.js` with isolated settings.

## 🚨 Common Issues

### ESLint e React Refresh
- **Problema:** Fast Refresh quebrado
- **Causa:** Exportar componentes e hooks do mesmo arquivo
- **Solução:** Separar em arquivos dedicados

### ESLint Unused Disable Directives
- **Problema:** ESLint reports "Unused eslint-disable directive"
- **Causa:** Código já está em conformidade, diretiva desnecessária
- **Solução:** Remover a diretiva — o código já está correto

### Vitest Pool Configuration (v4+)
- **Problema:** Erro com `poolOptions.threads`
- **Causa:** API mudou no Vitest 4
- **Solução:** Usar `pool: 'forks'` e `maxWorkers` em vez de `poolOptions.threads`

### Test Commands Not Available
- **Problema:** `--related` não existe no Vitest CLI
- **Solução:** Usar `--changed=main` como alternativa

### Cache SWR
- **Problema:** Dados desatualizados após mutation
- **Causa:** Esquecer de invalidar cache
- **Solução:** Usar sempre `cachedServices` que invalidam automaticamente

### Supabase RLS
- **Problema:** "Nenhum dado retornado"
- **Causa:** Política RLS bloqueando acesso
- **Solução:** Verificar se usuário está autenticado e políticas estão corretas

### Bot Telegram
- **Problema:** Bot não responde no webhook
- **Causa:** Token inválido ou webhook não configurado
- **Solução:** Verificar `TELEGRAM_BOT_TOKEN` e configurar webhook apontando para `/api/telegram`

### BUTTON_DATA_INVALID Error
- **Problema:** Telegram rejeita callback
- **Causa:** `callback_data` excede 64 bytes
- **Solução:** Usar índices numéricos em vez de UUIDs

---

## 📞 Resources

- **Supabase Docs:** https://supabase.com/docs
- **Vite Docs:** https://vitejs.dev/guide/
- **Vitest Docs:** https://vitest.dev/
- **Zod Docs:** https://zod.dev/
- **Telegram Bot API:** https://core.telegram.org/bots/api

---

*Última atualização: 12/02/2026*
*Versão do projeto: 2.7.0*
