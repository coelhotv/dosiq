# 📋 Padrões de Código - Meus Remédios

Convenções e melhores práticas para manter consistência no projeto.

> **⚠️ AUTORIDADE:** Este documento deve ser usado em conjunto com:
> - **[`CLAUDE.md`](../CLAUDE.md)** - Regras canônicas do projeto (fonte da verdade para agentes)
> - **[`.memory/rules.md`](../.memory/rules.md)** - Regras positivas (R-NNN)
> - **[`.memory/anti-patterns.md`](../.memory/anti-patterns.md)** - Anti-patterns (AP-NNN)
> - **[`ARQUITETURA.md`](./ARQUITETURA.md)** - Framework arquitetural completo

## 📚 Referências Rápidas

| Documento | Conteúdo | Público |
|-----------|----------|---------|
| [`CLAUDE.md`](../CLAUDE.md) | Regras canônicas, checklist pré/pós-código | Todos os agentes |
| [`.memory/rules.md`](../.memory/rules.md) | Regras positivas (R-NNN) — padrões que funcionam | Agentes de código |
| [`.memory/anti-patterns.md`](../.memory/anti-patterns.md) | Anti-patterns (AP-NNN) — erros a evitar | Agentes de código |
| [`ARQUITETURA.md`](./ARQUITETURA.md) | Framework arquitetural completo | Desenvolvedores |


---

## 🚨 REGRAS OBRIGATÓRIAS

### 1. Validação Obrigatória (Pré-Commit)

Todo código DEVE passar pelas seguintes validações ANTES de commit:

```bash
# 1. Validação de sintaxe
node -c arquivo.js

# 2. Lint - deve passar sem erros
npm run lint

# 3. Build - deve gerar sem erros
npm run build
```

### 2. Git Workflow Obrigatório (RIGID PROCESS)

> **⚠️ CRITICAL:** ALL code/documentation changes MUST follow this workflow exactly. NO exceptions.
> **Autoridade:** Veja [`CLAUDE.md`](../CLAUDE.md) (regras canônicas) e [`.memory/rules.md`](../.memory/rules.md)

**⚠️ NUNCA commitar diretamente na `main`**

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

#### Step 1: CREATE BRANCH (MANDATORY)

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

#### Step 2: MAKE CHANGES

- Edit files following:
  - [`CLAUDE.md`](../CLAUDE.md) (coding standards + checklist)
  - [`.memory/anti-patterns.md`](../.memory/anti-patterns.md) (patterns to avoid)
- Keep changes focused and atomic
- One logical change per commit

#### Step 3: VALIDATE LOCALLY (MANDATORY - ALL MUST PASS)

```bash
# Comando principal (obrigatório pré-push):
npm run validate:agent  # Lint + testes + build (10-min kill switch)

# Alternativas para dev rápido:
npm run lint            # Somente lint
npm run test:critical   # Testes essenciais (services, utils, schemas)
npm run validate:quick  # Lint + testes alterados
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

#### Step 4: COMMIT (Atomic / Semantic)

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

#### Step 5: PUSH BRANCH

```bash
git push origin feature/wave-X/nome-descritivo
```

#### Step 6: CREATE PULL REQUEST (MANDATORY)

**Using GitHub CLI:**
```bash
gh pr create --title "feat: descrição resumida" \
             --body-file docs/PULL_REQUEST_TEMPLATE.md
```

**Using GitHub Web:**
1. Go to: https://github.com/coelhotv/meus-remedios/pulls
2. Click "New Pull Request"
3. Select: `main` ← `feature/wave-X/nome-descritivo`
4. **USE TEMPLATE:** Copy from [`docs/PULL_REQUEST_TEMPLATE.md`](./PULL_REQUEST_TEMPLATE.md)
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

#### Step 7: WAIT FOR REVIEW

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

#### Step 8: MERGE & CLEANUP

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

### Workflow Summary Card

```
┌─────────────────────────────────────────────┐
│  BEFORE ANY CODE CHANGE:                    │
│  1. git checkout -b feature/wave-X/name     │
│                                             │
│  BEFORE PUSH:                               │
│  2. npm run validate:agent                  │
│                                             │
│  AFTER PUSH:                                │
│  3. Create PR with template                 │
│  4. Wait for review                         │
│  5. Merge with --no-ff                      │
│  6. Delete branch                           │
└─────────────────────────────────────────────┘
```

### 3. Nomenclatura Obrigatória

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Componentes | PascalCase | `AdherenceWidget.jsx` |
| Funções | camelCase | `calculateAdherence` |
| Constantes | SCREAMING_SNAKE | `MAX_RETRY` |
| Arquivos | kebab-case | `adherence-service.js` |
| Branches | kebab-case | `feature/wave-2/fix-login` |
| Hooks | use + PascalCase | `useCachedQuery` |

### 4. Estrutura de Arquivos Obrigatória (v2.8.0)

#### Estrutura Feature-Based (F4.6)

```
src/
├── features/              # Domínios de negócio (novo em v2.8.0)
│   ├── adherence/         # Adesão ao tratamento
│   │   ├── components/    # Componentes específicos
│   │   ├── hooks/         # Hooks do domínio
│   │   ├── services/      # Services específicos
│   │   └── utils/         # Utilitários do domínio
│   ├── dashboard/         # Dashboard e widgets
│   ├── medications/       # Medicamentos
│   ├── protocols/         # Protocolos e titulação
│   └── stock/             # Estoque
│
├── shared/                # Recursos compartilhados (novo em v2.8.0)
│   ├── components/        # Componentes reutilizáveis
│   │   ├── ui/           # UI atômicos (Button, Card, Modal)
│   │   ├── log/          # LogEntry, LogForm
│   │   ├── gamification/ # BadgeDisplay, MilestoneCelebration
│   │   ├── onboarding/   # OnboardingWizard, Steps
│   │   └── pwa/          # PushPermission, InstallPrompt
│   ├── hooks/            # Hooks customizados
│   ├── services/         # Services com cache SWR
│   ├── constants/        # Schemas Zod
│   ├── utils/            # Utilitários puros
│   └── styles/           # CSS tokens e temas
│
├── views/                 # Páginas/Views
└── [legacy folders]       # Em migração para features/shared
```

#### Path Aliases (Vite + ESLint)

```javascript
// ✅ CORRETO - Use path aliases
import { Button } from '@shared/components/ui/Button'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'
import { medicineService } from '@features/medications/services/medicineService'

// ❌ INCORRETO - Evite imports relativos longos
import { Button } from '../../../shared/components/ui/Button'
```

**Aliases configurados:**
- `@` → `src/`
- `@features` → `src/features/`
- `@shared` → `src/shared/`
- `@dashboard`, `@medications`, `@protocols`, `@stock`, `@adherence`

### 5. Scripts Obrigatórios

| Quando | Comando | Propósito |
|--------|---------|-----------|
| **Pre-push (obrigatório)** | **`npm run validate:agent`** | **Lint + testes + build, kill switch 10min** |
| Pre-commit | `npm run validate:quick` | Lint + testes alterados |
| Dev rápido | `npm run test:critical` | Testes essenciais (services, utils, schemas) |
| Dev rápido | `npm run test:fast` | 1 thread, todos os testes |
| Low-RAM | `npm run test:lowram` | Sequencial ~20min |
| CI completo | `npm run validate:full` | Lint + coverage + build |
| Diagnóstico | `npm run test:smoke` | Suite mínima de smoke tests |

---

## 🗂️ Estrutura de Arquivos

### Regras Gerais

```
✅ BOM:
src/
├── components/
│   ├── medicine/
│   │   ├── MedicineCard.jsx      # PascalCase
│   │   ├── MedicineCard.css      # Mesmo nome do componente
│   │   └── MedicineCard.test.jsx # Teste do componente
│   └── ui/
│       └── Button/
│           ├── Button.jsx
│           └── Button.css

❌ EVITAR:
├── components/
│   ├── medicine-card.jsx         # kebab-case
│   ├── MedicineCard/
│   │   └── index.jsx             # index desnecessário
```

### Organização por Domínio

```
src/components/
├── ui/              # Componentes genéricos (Button, Card, Modal)
├── medicine/        # Domínio: Medicamentos
├── protocol/        # Domínio: Protocolos
├── stock/           # Domínio: Estoque
├── log/             # Domínio: Registros
└── onboarding/      # Domínio: Onboarding
```

---

## 📝 Nomenclatura

### Componentes React

```jsx
// ✅ PascalCase
function MedicineCard({ medicine }) { }
function Button({ children, onClick }) { }

// ❌ camelCase ou kebab-case
function medicineCard() { }
function medicine_card() { }
```

### Hooks Customizados

```javascript
// ✅ Prefixo 'use' + PascalCase
useCachedQuery(key, fetcher, options)
useOnboarding()
useAuth()

// ❌ Sem prefixo 'use'
cachedQueryHook()
```

### Funções e Variáveis

```javascript
// ✅ camelCase
const medicineName = 'Dipirona'
const handleSubmit = () => { }
const isLoading = true

// ✅ Maiúsculas para constantes
const CACHE_CONFIG = { STALE_TIME: 30000 }
const MAX_RETRIES = 3

// ❌ snake_case
const medicine_name = ''
const handle_submit = () => { }
```

### Arquivos de Schema

```javascript
// ✅ schema + Nome + .js
medicineSchema.js
protocolSchema.js
stockSchema.js

// ✅ Exportações nomeadas
export const medicineSchema = z.object({...})
export const medicineCreateSchema = ...
export const validateMedicine = (data) => { }
```

---

## 🎨 Estilo de Código

### Imports (Ordem)

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

### Componentes Funcionais

```jsx
// ✅ Props desestruturadas com valores padrão
function MedicineCard({ 
  medicine, 
  onEdit, 
  onDelete,
  showStock = true 
}) {
  // Estado primeiro
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Effects depois
  useEffect(() => {
    // ...
  }, [medicine.id])
  
  // Handlers
  const handleEdit = () => onEdit?.(medicine)
  
  // Render
  return (
    <Card className="medicine-card">
      {/* ... */}
    </Card>
  )
}

export default MedicineCard
```

### Async/Await

```javascript
// ✅ Sempre try/catch para operações async
try {
  const data = await medicineService.getAll()
  setMedicines(data)
} catch (error) {
  console.error('Erro ao carregar medicamentos:', error)
  setError('Não foi possível carregar os medicamentos')
}

// ✅ Early return para validações
async function createMedicine(data) {
  const validation = validateMedicineCreate(data)
  if (!validation.success) {
    throw new Error('Dados inválidos')
  }
  
  return await medicineService.create(validation.data)
}
```

---

## 🧪 Testes

### Estrutura de Testes

```jsx
// MedicineCard.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MedicineCard from './MedicineCard'

describe('MedicineCard', () => {
  const mockMedicine = {
    id: '1',
    name: 'Dipirona',
    dosage_per_pill: 500,
    dosage_unit: 'mg'
  }
  
  it('renderiza nome do medicamento', () => {
    render(<MedicineCard medicine={mockMedicine} />)
    expect(screen.getByText('Dipirona')).toBeInTheDocument()
  })
  
  it('chama onEdit quando clicar em editar', () => {
    const onEdit = vi.fn()
    render(<MedicineCard medicine={mockMedicine} onEdit={onEdit} />)
    
    fireEvent.click(screen.getByText('Editar'))
    expect(onEdit).toHaveBeenCalledWith(mockMedicine)
  })
})
```

### Cobertura Mínima

- **Services:** Todos os métodos CRUD
- **Schemas:** Todos os cenários de validação
- **Componentes:** Renderização e interações principais

---

## 🚀 Workflow de Testes Otimizado

### Comandos por Cenário

| Cenário | Comando | Tempo Estimado | Quando Usar |
|---------|---------|----------------|-------------|
| **Agente / Pre-push** | **`npm run validate:agent`** | **~10min max** | **Obrigatório antes de push** |
| Desenvolvimento rápido | `npm run test:fast` | ~6.5min | Alterações locais |
| Testes críticos | `npm run test:critical` | 2-3min | Services/utils/schemas |
| Testes alterados | `npm run test:changed` | 1-3min | Antes de commit |
| Low-RAM (8GB) | `npm run test:lowram` | ~20min | Ambientes restritos |
| Smoke test | `npm run test:smoke` | 10-30s | Verificação rápida |
| CI completo | `npm run validate:full` | 5-10min | Pull requests |

### Matriz de Decisão

| Tipo de Arquivo | Comando Recomendado |
|-----------------|---------------------|
| Componente UI isolado | `test:changed` |
| Service/API | `test:critical` |
| Schema/Validação | `test:critical` |
| Hook reutilizável | `test:critical` |
| CSS/SVG/Assets | `test:smoke` ou nenhum |
| Configuração (vite, eslint) | `test:smoke` |

### Pipeline de Validação

```bash
# Durante desenvolvimento (a cada alteração)
npm run lint            # ESLint rápido
npm run test:changed    # Testes dos arquivos modificados

# Antes de commit
npm run validate:quick  # Lint + testes alterados

# Antes de push/PR (OBRIGATÓRIO)
npm run validate:agent  # Lint + testes + build (kill switch 10min)

# Verificação rápida de health check
npm run test:smoke      # Suite mínima de testes
```

### Scripts Disponíveis

```bash
# --- Validação (use estes) ---
npm run validate:agent  # PRINCIPAL: lint + testes + build (10-min kill switch)
npm run validate:quick  # Lint + testes alterados
npm run validate:full   # Lint + cobertura + build (CI)

# --- Testes ---
npm run test            # Todos os testes
npm run test:watch      # Modo watch para desenvolvimento
npm run test:changed    # Apenas testes de arquivos modificados
npm run test:critical   # Services, utils, schemas, hooks
npm run test:fast       # 1 thread, ~6.5min
npm run test:lowram     # Sequencial (8GB RAM)
npm run test:smoke      # Suite mínima de smoke tests
```

### Configurações de Teste

O projeto possui 3 configurações de teste otimizadas:

1. **vite.config.js** - Configuração padrão com threads otimizadas
2. **vitest.critical.config.js** - Apenas testes essenciais (exclui UI)
3. **vitest.smoke.config.js** - Suite mínima para health check

---

## 🔒 Validação com Zod

### Padrão de Schema

```javascript
// medicineSchema.js
import { z } from 'zod'

// 1. Constantes
const DOSAGE_UNITS = ['mg', 'mcg', 'ml', 'g', 'UI', 'gotas']

// 2. Schema base (campos obrigatórios)
export const medicineSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200, 'Nome não pode ter mais de 200 caracteres')
    .trim(),
  
  dosage_per_pill: z.number()
    .positive('Dosagem deve ser maior que zero'),
  
  dosage_unit: z.enum(DOSAGE_UNITS, {
    errorMap: () => ({ message: 'Unidade inválida' })
  })
})

// 3. Schema de criação (pode ser igual ao base)
export const medicineCreateSchema = medicineSchema

// 4. Schema de atualização (parcial)
export const medicineUpdateSchema = medicineSchema.partial()

// 5. Schema completo (com IDs)
export const medicineFullSchema = medicineSchema.extend({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime()
})

// 6. Funções de validação
export function validateMedicine(data) {
  return validateWithSchema(medicineSchema, data)
}

export function validateMedicineCreate(data) {
  return validateWithSchema(medicineCreateSchema, data)
}
```

### Uso nos Services

```javascript
// medicineService.js
import { validateMedicineCreate, validateMedicineUpdate } from '../schemas/medicineSchema'

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

---

## 🚀 Cache SWR

### Regras de Uso

```javascript
// ✅ SEMPRE usar cachedServices para leituras
import { cachedMedicineService } from '../services/api/cachedServices'

// Em componentes:
const { data, isLoading } = useCachedQuery(
  'medicines',
  () => cachedMedicineService.getAll()
)

// ✅ Invalidar cache após mutations
async function handleCreate(medicine) {
  await cachedMedicineService.create(medicine)
  // Cache é invalidado automaticamente no service
}
```

### Chaves de Cache

```javascript
// ✅ Namespace consistente
const CACHE_KEYS = {
  MEDICINES: 'medicines',
  MEDICINE_BY_ID: 'medicine',           // medicine:{id}
  PROTOCOLS: 'protocols',
  PROTOCOLS_ACTIVE: 'protocols:active',
  STOCK_BY_MEDICINE: 'stock:medicine',  // stock:medicine:{id}
  STOCK_SUMMARY: 'stock:summary'
}
```

---

## 📱 Responsividade

### Breakpoints

```css
/* tokens.css */
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

### Mobile-First

```css
/* ✅ Mobile-first */
.medicine-card {
  padding: 1rem;        /* Mobile */
}

@media (min-width: 768px) {
  .medicine-card {
    padding: 1.5rem;    /* Desktop */
  }
}

/* ❌ Desktop-first (evitar) */
.medicine-card {
  padding: 1.5rem;      /* Desktop */
}

@media (max-width: 768px) {
  .medicine-card {
    padding: 1rem;      /* Mobile */
  }
}
```

---

## 🌐 Convenções de Idioma

### Para Agentes de IA

| Contexto | Idioma | Exemplo |
|----------|--------|---------|
| Raciocínio interno / Pensamento | Inglês | "I need to create a new component" |
| Código (variáveis, funções) | Inglês | `const medicineName = ''` |
| Comentários de código | Português | `// Verifica se o medicamento existe` |
| Documentação | Português | Este arquivo |
| Mensagens de erro | Português | `'Nome é obrigatório'` |
| UI (labels, botões) | Português | `Salvar Medicamento` |
| Commits | Português | `feat: adiciona validação Zod` |
| Nomes de arquivos | Inglês | `medicineService.js` |
| Tabelas/Colunas DB | Português | `medicamentos.nome` |

> **Nota para agentes:** Use inglês para todo o processamento lógico e raciocínio técnico interno.
> Use português exclusivamente para gerar documentação, comentários de código e feedback ao usuário humano.

---

## ✅ Checklist de Code Review

Antes de commitar:

- [ ] Código segue a convenção de nomenclatura
- [ ] Props têm validação/valores padrão quando apropriado
- [ ] Zod validation em todos os services
- [ ] Cache invalidado após mutations
- [ ] Erros tratados com try/catch
- [ ] Testes adicionados para nova lógica
- [ ] Console.logs removidos (exceto logs de cache)
- [ ] CSS segue mobile-first

---

## 🔍 Code Review Standards

### Overview

Este projeto utiliza **automated code review** via Gemini Code Reviewer GitHub App + GitHub Actions para auto-fixes.

### Workflow de Code Review

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GEMINI CODE REVIEW WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1️⃣  PR ABERTO                                                         │
│      └─→ Workflow posta /gemini review automaticamente                     │
│                                                                             │
│  2️⃣  GEMINI ANALISA                                                    │
│      └─→ Aguarda 5 minutos                                              │
│                                                                             │
│  3️⃣  PARSE COMENTÁRIOS                                                 │
│      └─→ Identifica tipos de issues                                      │
│          ├─ Lint                                                         │
│          ├─ Formatting                                                    │
│          ├─ Logic                                                        │
│          ├─ Architecture                                                 │
│          └─ Conflicts                                                    │
│                                                                             │
│  4️⃣  AUTO-FIX                                                           │
│      └─→ Aplica fixes quando seguro                                      │
│          ├─ Lint/Formatting: Sempre                                       │
│          ├─ Logic: ≤5 linhas, sem business logic                        │
│          ├─ Architecture: arquivo único                                   │
│          └─ Conflicts: auto-resolvable                                    │
│                                                                             │
│  5️⃣  VALIDATE                                                           │
│      └─→ lint + smoke tests                                              │
│                                                                             │
│  6️⃣  COMMIT & PUSH                                                      │
│      └─→ Commit automático se houver fixes                                │
│                                                                             │
│  7️⃣  POST SUMMARY                                                       │
│      └─→ Resumo no PR                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Responsabilidades por Tipo

| Tipo | Responsável | Tempo SLA |
|------|------------|-----------|
| Lint/Formatting | 🤖 Auto-fix | Imediato |
| Logic simples | 🤖 Auto-fix | Imediato |
| Logic complexo | 👤 Human Reviewer | 24h |
| Security | 👤 Human Reviewer | 4h |
| Architecture | 👤 Senior Reviewer | 48h |

### Critérios de Auto-Fix

```javascript
// ✅ AUTO-FIXÁVEL (sempre)
const x = 1  // Missing semicolon
function test() { }  // Extra whitespace

// ⚠️ AUTO-FIXÁVEL (com condições)
if (!data) return  // Null check simples
const result = a || b  // Lógica simples

// ❌ REQUER REVISÃO MANUAL
const x = calculate()  // Lógica complexa
if (condition) { return await db.save() }  // Database
```

### Salvaguardas Obrigatórias

```yaml
# NUNCA auto-fixar:
- Security vulnerabilities
- Business logic changes
- Database queries modifications
- API contract changes
- Breaking changes
```

### Labels Automáticos

| Label | Significado |
|-------|-------------|
| `🤖 auto-fixed` | Issues resolvidos automaticamente |
| `👀 needs-review` | Requer revisão humana |
| `✅ approved` | Aprovado pelo Gemini |
| `⚠️ blocked` | Issues bloqueantes encontrados |

### Best Practices

#### Para Desenvolvedores
1. **Validar localmente**: Sempre rode `npm run lint` antes de push
2. **Commits pequenos**: PRs < 400 linhas são mais rápidos de review
3. **Descrição clara**: Use PR template para contexto
4. **Auto-review**: Resolva issues óbvios antes de abrir PR

#### Para Reviewers Humanos
1. **Prioridade**: Security > Lógica > Style
2. **Feedback**: Sugira melhorias, não apenas critique
3. **Verificar Auto-Fix**: Confirme que auto-commits não quebram build
4. **Documentação**: Mantenha docs atualizados

### Troubleshooting

#### Gemini não comenta
```bash
# Verificar
1. App instalado? → Settings > GitHub Apps > Gemini Code Reviewer
2. Token tem permissões? → repo scope
3. Workflow rodando? → Actions tab > pr-auto-trigger
```

#### Auto-fix não funciona
```bash
# Possíveis causas
1. Issues não são lint/formatting
2. npm run lint --fix não funciona localmente
3. Conflito com pre-commit hooks
```

#### Build falha após Auto-Fix
- Workflow faz rollback automático
- Verificar logs do workflow
- Commit de backup é criado

---

## 🔧 ESLint Config

```javascript
// eslint.config.js
export default [
  {
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        // Ignora componentes Framer Motion usados como JSX
        varsIgnorePattern: '^(motion|AnimatePresence|[A-Z_])'
      }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
]
```

### Configuração para Framer Motion

Ao usar Framer Motion, adicione `motion` e `AnimatePresence` ao `varsIgnorePattern`:

```javascript
// ✅ Correto: ESLint não reportará "motion is defined but never used"
import { motion, AnimatePresence } from 'framer-motion'

function MyComponent() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <AnimatePresence>
        {/* ... */}
      </AnimatePresence>
    </motion.div>
  )
}
```

Execute `npm run lint` antes de commitar.

---

## ❌ ANTI-PATTERNS PROIBIDOS

### Git Workflow

| Anti-Pattern | Consequência | Prevenção |
|--------------|--------------|-----------|
| **Commit direto em main** | Código não revisado em produção | Sempre criar branch primeiro |
| **Criar código sem branch** | Commits misturados, estado inconsistente | Verificar `git branch` antes de iniciar |
| **Merge sem review** | Bugs podem entrar em produção | PR obrigatório para main |

### Qualidade de Código

| Anti-Pattern | Consequência | Prevenção |
|--------------|--------------|-----------|
| **Ignorar erros de lint** | Build quebrado, código inconsistente | `npm run lint` obrigatório pre-commit |
| **Deixar `console.log` de debug** | Poluição do console, possível vazamento de dados | ESLint `no-console`, revisar antes de merge |
| **Ignorar dependências de hooks** | Bugs difíceis de debugar | ESLint `react-hooks/exhaustive-deps` como error |
| **Exportar componentes e hooks do mesmo arquivo** | Fast Refresh do Vite quebrado | ESLint `react-refresh/only-export-components` como error |
| **Duplicar lógica (violação DRY)** | Manutenção difícil, bugs em múltiplos lugares | Extrair para services ou utils |
| **Quebrar build** | Deploy bloqueado, main instável | `npm run build` obrigatório pre-push |

### Estrutura e Organização

| Anti-Pattern | Consequência | Prevenção |
|--------------|--------------|-----------|
| **Lógica de negócio em componentes** | Dificuldade de testar, reuso impedido | Extrair para services |
| **Schemas de validação duplicados** | Inconsistência de dados | Centralizar em `src/schemas/` |
| **Importar hooks/componentes de arquivos com múltiplas exportações** | Fast Refresh quebrado | Separar em arquivos dedicados |

---

## 📚 Referências

### Documentação de Governança

- **[`ARQUITETURA_FRAMEWORK.md`](./archive/ARQUITETURA_FRAMEWORK.md)** - Framework arquitetural e governança técnica completa
- **[`LINT_COVERAGE.md`](./archive/LINT_COVERAGE.md)** - Configurações ESLint e boas práticas
- **[`OTIMIZACAO_TESTES_ESTRATEGIA.md`](./archive/OTIMIZACAO_TESTES_ESTRATEGIA.md)** - Estratégia completa de testes
- **[`ARQUITETURA.md`](./ARQUITETURA.md)** - Visão arquitetural técnica

### Templates

- **[`PULL_REQUEST_TEMPLATE.md`](./PULL_REQUEST_TEMPLATE.md)** - Template para PRs

---

## 🚀 Vercel CLI - Comandos Úteis

### Instalação e Autenticação

```bash
# Instalar CLI da Vercel
npm i -g vercel

# Login na Vercel
vercel login

# Vincular projeto local ao projeto da Vercel
vercel link
```

### Monitoramento de Logs

```bash
# Ver logs em tempo real (útil para debugs)
vercel logs --follow

# Ver logs das últimas N linhas
vercel logs -n 100

# Filtrar logs de uma função específica
vercel logs --filter="api/notify"

# Ver logs de um deployment específico
vercel logs <deployment-url>
```

### Deploy

```bash
# Deploy para produção
vercel --prod

# Deploy para preview
vercel

# Listar deployments recentes
vercel ls
```

### Diagnóstico

```bash
# Ver status do projeto
vercel status

# Ver informações do projeto
vercel inspect

# Ver variáveis de ambiente
vercel env ls

# Adicionar variável de ambiente
vercel env add NOME_DA_VARIAVEL valor

# Remover variável de ambiente
vercel env rm NOME_DA_VARIAVEL
```

### Exemplos de Uso

#### Cenário 1: Debugar erro no bot
```bash
# 1. Ver logs em tempo real
vercel logs --follow

# 2. Filtrar apenas logs do bot
vercel logs --filter="api/notify"

# 3. Ver logs das últimas 100 linhas
vercel logs -n 100
```

#### Cenário 2: Verificar deploy recente
```bash
# 1. Listar deployments
vercel ls

# 2. Ver logs de um deployment específico
vercel logs <deployment-url>
```

#### Cenário 3: Verificar variáveis de ambiente
```bash
# 1. Listar todas as variáveis
vercel env ls

# 2. Ver valor de uma variável específica
vercel env pull TELEGRAM_BOT_TOKEN
```

### Boas Práticas

- ✅ **Sempre usar `--follow`** para monitorar logs em tempo real durante debugs
- ✅ **Filtrar por função** para reduzir ruído nos logs (`--filter="api/notify"`)
- ✅ **Usar `-n`** para limitar quantidade de linhas e evitar sobrecarga
- ✅ **Verificar variáveis de ambiente** antes de fazer deploy
- ✅ **Usar `--prod`** apenas para deploy em produção (evita deploys acidentais)

---

## 🧩 Padrões de Componentes Consolidados

### 1. Pattern: Mode-Based Components

Use a prop `mode` para componentes que precisam de comportamentos diferentes:

```jsx
// ✅ BOM: ProtocolForm com mode
<ProtocolForm
  mode="full"                    // Modo padrão - todas as features
  medicines={medicines}
  treatmentPlans={treatmentPlans}
  onSave={handleSave}
/>

<ProtocolForm
  mode="simple"                  // Modo onboarding - simplificado
  preselectedMedicine={medicine} // Medicamento já selecionado
  onSave={handleSave}
  onSuccess={nextStep}           // Callback após sucesso
  autoAdvance={true}             // Avança automaticamente
/>
```

**Benefícios:**
- Um único componente mantido
- Comportamento consistente entre modos
- Backward compatibility via valores padrão (`mode='full'`)

### 2. Pattern: Optional Feature Props

Features avançadas ativadas via props booleanas com defaults `false`:

```jsx
// ✅ BOM: Calendar com features opcionais
<Calendar
  markedDates={dates}
  selectedDate={selected}
  onDayClick={handleDayClick}
  // Features opcionais (default: false)
  enableLazyLoad={true}        // Ativa lazy loading de meses
  onLoadMonth={fetchData}      // Callback para carregar dados
  enableSwipe={true}           // Ativa navegação por swipe
  enableMonthPicker={true}     // Ativa seletor de mês
  monthPickerRange={{ start: -12, end: 3 }}
/>
```

**Regras:**
- Props de feature devem ter default `false` para backward compatibility
- Nomear com prefixo `enable` para clareza
- Combinar features livremente

### 3. Pattern: Base Component with Variants

Crie um componente base genérico em `ui/` com wrappers específicos por domínio:

```jsx
// ✅ BOM: AlertList como componente base
// src/components/ui/AlertList.jsx
export default function AlertList({
  alerts = [],
  onAction,
  variant = 'default',    // 'default' | 'smart' | 'stock' | 'dose'
  showExpandButton = true,
  maxVisible = 3,
  emptyIcon = '✅',
  emptyMessage = 'Nenhum alerta',
  title,
  headerAction
})

// Wrapper específico para SmartAlerts
// src/components/dashboard/SmartAlerts.jsx
export default function SmartAlerts({ alerts, onAction }) {
  return (
    <AlertList
      alerts={normalizeSmartAlerts(alerts)}
      onAction={onAction}
      variant="smart"
      showExpandButton={false}
    />
  )
}

// Wrapper específico para StockAlertsWidget
// src/components/dashboard/StockAlertsWidget.jsx
export default function StockAlertsWidget({ lowStockItems, ... }) {
  return (
    <AlertList
      alerts={convertStockToAlerts(lowStockItems)}
      variant="stock"
      title="Alertas de Estoque"
      emptyIcon="📦"
    />
  )
}
```

**Benefícios:**
- Consistência visual garantida
- Manutenção centralizada
- Fácil adicionar novos tipos de alertas

### 4. Pattern: Onboarding Integration

Formulários que suportam fluxo de onboarding via props:

```jsx
// ✅ BOM: MedicineForm com props de onboarding
<MedicineForm
  // Props padrão
  medicine={existingMedicine}      // Dados para edição (opcional)
  onSave={handleSave}              // Callback ao salvar
  onCancel={handleCancel}          // Callback ao cancelar
  
  // Props de onboarding (opcionais)
  onSuccess={nextStep}             // Callback após sucesso
  autoAdvance={true}               // Chama onSuccess após delay
  showSuccessMessage={true}        // Mostra mensagem de sucesso
  showCancelButton={false}         // Oculta botão cancelar
  submitButtonLabel="Salvar e Continuar"
  title="Cadastre seu primeiro medicamento"
/>
```

**Props de Onboarding:**

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `onSuccess` | function | undefined | Callback após salvar com sucesso |
| `autoAdvance` | boolean | false | Chama onSuccess automaticamente |
| `showSuccessMessage` | boolean | true | Mostra mensagem de sucesso |
| `showCancelButton` | boolean | true | Mostra botão cancelar |
| `submitButtonLabel` | string | 'Salvar'/'Atualizar' | Label do botão submit |
| `title` | string | undefined | Título customizado do formulário |

### 5. Pattern: Component Consolidation Strategy

Estratégia para consolidar componentes duplicados:

```
1. Identificar diferenças entre componentes
2. Extrair diferenças como props opcionais
3. Manter valores padrão para backward compatibility
4. Refatorar consumidores para usar novo componente
5. Validar todos os casos de uso
6. Remover componentes antigos (após validação)
```

**Exemplo - Consolidando MedicineForm:**

```jsx
// ANTES: Dois componentes separados
// MedicineForm.jsx - uso geral
// FirstMedicineStep.jsx - onboarding específico (~200 linhas duplicadas)

// DEPOIS: Um componente com props de onboarding
// MedicineForm.jsx - suporta ambos os casos
<MedicineForm
  onSave={handleSave}
  onSuccess={nextStep}      // Opcional: ativa modo onboarding
  autoAdvance={true}        // Opcional: comportamento onboarding
/>

// FirstMedicineStep.jsx - wrapper simplificado
export default function FirstMedicineStep() {
  const { nextStep, updateOnboardingData } = useOnboarding()
  return (
    <MedicineForm
      onSave={async (data) => {
        const saved = await cachedMedicineService.create(data)
        updateOnboardingData('medicine', saved)
        return saved
      }}
      onSuccess={nextStep}
      autoAdvance={true}
      showCancelButton={false}
    />
  )
}
```

### 6. Pattern: 100% Backward Compatibility

Todas as mudanças devem manter compatibilidade:

```jsx
// ✅ BOM: Valores padrão mantêm comportamento anterior
function MedicineForm({
  medicine,
  onSave,
  onCancel,
  // Novas props com valores padrão que preservam comportamento
  onSuccess,
  autoAdvance = false,           // false = comportamento anterior
  showSuccessMessage = true,     // true = comportamento anterior
  showCancelButton = true,       // true = comportamento anterior
  submitButtonLabel = medicine ? 'Atualizar' : 'Salvar',
  title
}) {
  // ...
}
```

**Checklist de Backward Compatibility:**
- [ ] Props novas têm valores padrão apropriados
- [ ] APIs públicas não mudam (ou mudam de forma compatível)
- [ ] Componentes existentes funcionam sem modificação
- [ ] Testes existentes passam sem modificação
- [ ] Lint passa sem erros

---

## 📚 Documentação dos Componentes Consolidados

### MedicineForm

**Local:** [`src/components/medicine/MedicineForm.jsx`](src/components/medicine/MedicineForm.jsx)

```jsx
<MedicineForm
  medicine={object}              // Dados para edição (opcional)
  onSave={function}              // Callback ao salvar
  onCancel={function}            // Callback ao cancelar
  onSuccess={function}           // Callback após sucesso (onboarding)
  autoAdvance={boolean}          // Avança automaticamente
  showSuccessMessage={boolean}   // Mostra mensagem de sucesso
  showCancelButton={boolean}     // Mostra botão cancelar
  submitButtonLabel={string}     // Label do botão submit
  title={string}                 // Título do formulário
/>
```

### ProtocolForm

**Local:** [`src/components/protocol/ProtocolForm.jsx`](src/components/protocol/ProtocolForm.jsx)

```jsx
<ProtocolForm
  medicines={array}              // Lista de medicamentos
  treatmentPlans={array}         // Lista de planos (opcional)
  protocol={object}              // Dados para edição (opcional)
  initialValues={object}         // Valores iniciais (opcional)
  onSave={function}              // Callback ao salvar
  onCancel={function}            // Callback ao cancelar
  onSuccess={function}           // Callback após sucesso
  mode={'full'|'simple'}         // Modo de exibição
  autoAdvance={boolean}          // Avança automaticamente
  preselectedMedicine={object}   // Medicamento pré-selecionado
  showTitration={boolean}        // Mostra wizard de titulação
  showTreatmentPlan={boolean}    // Mostra seleção de plano
  title={string}                 // Título customizado
/>
```

### Calendar

**Local:** [`src/components/ui/Calendar.jsx`](src/components/ui/Calendar.jsx)

```jsx
<Calendar
  markedDates={array}            // Datas marcadas
  selectedDate={Date}            // Data selecionada
  onDayClick={function}          // Callback ao clicar em dia
  enableLazyLoad={boolean}       // Ativa lazy loading
  onLoadMonth={function}         // Callback para carregar mês
  enableSwipe={boolean}          // Ativa navegação por swipe
  enableMonthPicker={boolean}    // Ativa seletor de mês
  monthPickerRange={object}      // Range do seletor {start, end}
/>
```

### AlertList

**Local:** [`src/components/ui/AlertList.jsx`](src/components/ui/AlertList.jsx)

```jsx
<AlertList
  alerts={array}                 // Lista de alertas
  onAction={function}            // Callback para ações
  variant={string}               // 'default'|'smart'|'stock'|'dose'
  showExpandButton={boolean}     // Mostra botão expandir
  maxVisible={number}            // Máximo de itens visíveis
  emptyIcon={string}             // Ícone do estado vazio
  emptyMessage={string}          // Mensagem do estado vazio
  title={string}                 // Título do widget
  headerAction={node}            // Ação adicional no header
/>
```

### LogForm

**Local:** [`src/components/log/LogForm.jsx`](src/components/log/LogForm.jsx)

```jsx
<LogForm
  medicines={array}              // Lista de medicamentos
  protocols={array}              // Lista de protocolos
  treatmentPlans={array}         // Planos para bulk registration (opcional)
  initialData={object}           // Dados pré-preenchidos (opcional)
  onSubmit={function}            // Callback ao salvar
  onCancel={function}            // Callback ao cancelar
/>
```

**⚠️ Padrão Crítico - Dual Return Types:**

O `LogForm` pode retornar **dois tipos diferentes** dependendo do modo selecionado:

```javascript
// Quando type === 'protocol' → Retorna objeto único
const logData = {
  protocol_id: 'uuid',
  medicine_id: 'uuid',
  quantity_taken: 1,
  taken_at: '2026-02-11T10:00:00'
}

// Quando type === 'plan' → Retorna array (bulk registration)
const logData = [
  { protocol_id: 'uuid1', quantity_taken: 1, ... },
  { protocol_id: 'uuid2', quantity_taken: 2, ... }
]
```

**SEMPRE verificar ambos os casos no handler:**

```jsx
async function handleLogMedicine(logData) {
  try {
    if (Array.isArray(logData)) {
      // Modo "Plano Completo" - bulk registration
      await logService.createBulk(logData)
      showSuccess('Plano completo registrado com sucesso!')
    } else {
      // Modo "Único Remédio" - registro individual
      await logService.create(logData)
      showSuccess('Dose registrada com sucesso!')
    }
  } catch (error) {
    showError('Erro ao registrar dose')
  }
}
```

**Regra de Ouro:**
- **Dashboard.jsx**: Sempre passa `treatmentPlans` → habilita modo "Plano Completo"
- **History.jsx**: Sempre passa `treatmentPlans` → habilita modo "Plano Completo"
- Sem `treatmentPlans` → apenas modo "Único Remédio" disponível

---

---

## ⚡ Anti-Patterns de Performance (Mobile — M2, P1-P4, D0-D3)

Estes erros foram identificados e corrigidos nas iniciativas de performance mobile. Evite-os em código novo.

| Anti-Pattern | Código Errado | Código Correto | Regra |
|-------------|--------------|----------------|-------|
| Auth bypass do cache | `supabase.auth.getUser()` direto | `getUserId()` / `getCurrentUser()` | AP-P14, R-128 |
| Select desnecessário | `.select('*')` | `.select('id, name, quantity')` | AP-P10 |
| Import estático de chunk pesado | `import InteractionAlert from './InteractionAlert'` | `React.lazy(() => import('./InteractionAlert'))` | AP-B03, R-117 |
| Barrel export quebrando split | `export { refillPredictionService } from './index'` | Importar direto do arquivo | AP-B04 |
| N+1 queries | `for (id of ids) await fetch(id)` | `.in('id', ids)` em batch | AP-P09 |
| requestIdleCallback ausente | queries paralelas em background scroll | `requestIdleCallback(() => fetchNext())` | R-126 |
| CSS layout thrash | `width: X%` animado | `transform: scaleX(X)` animado | AP-CSS1 |
| Comparação de datas em loop | `new Date(a) > new Date(b)` | `a > b` (string YYYY-MM-DD) | AP-P15, R-129 |
| `import()` top-level em component | `const svc = await import('...')` no module | Dentro do handler/callback | D0 |

> **Referência completa:** [`.memory/anti-patterns.md`](../.memory/anti-patterns.md)

---

## 📚 Referências

### Documentação de Governança

- **[`CLAUDE.md`](../CLAUDE.md)** - Regras canônicas para agentes (fonte da verdade)
- **[`.memory/rules.md`](../.memory/rules.md)** - Regras positivas (R-NNN)
- **[`.memory/anti-patterns.md`](../.memory/anti-patterns.md)** - Anti-patterns (AP-NNN)
- **[`ARQUITETURA.md`](./ARQUITETURA.md)** - Visão arquitetural técnica
- **[`standards/MOBILE_PERFORMANCE.md`](./standards/MOBILE_PERFORMANCE.md)** - Standards de performance mobile

### Templates

- **[`PULL_REQUEST_TEMPLATE.md`](./PULL_REQUEST_TEMPLATE.md)** - Template obrigatório para PRs

---

*Última atualização: 20/03/2026 — v3.3.0: comandos de teste atualizados (validate:agent), anti-patterns de performance adicionados, referências .roo/ substituídas por CLAUDE.md + .memory/.*
