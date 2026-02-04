# 📋 Padrões de Código - Meus Remédios

Convenções e melhores práticas para manter consistência no projeto.

> **⚠️ AUTORIDADE:** Este documento deve ser usado em conjunto com [`ARQUITETURA_FRAMEWORK.md`](ARQUITETURA_FRAMEWORK.md:1), que contém as regras obrigatórias de governança técnica.

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

### 2. Git Workflow Obrigatório

**⚠️ NUNCA commitar diretamente na `main`**

```bash
# 1. Criar branch ANTES de alterações
git checkout main
git pull origin main
git checkout -b feature/wave-X/nome-descritivo

# 2. Desenvolver com commits semânticos

# 3. Validar localmente
npm run lint
npm run test:critical
npm run build

# 4. Criar PR para main

# 5. Aguardar review

# 6. Merge via --no-ff apenas
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

### 4. Estrutura de Arquivos Obrigatória

```
src/
├── components/          # Componentes React por domínio
│   ├── ui/             # Componentes genéricos
│   ├── medicine/       # Domínio: Medicamentos
│   ├── protocol/       # Domínio: Protocolos
│   ├── adherence/      # Domínio: Adesão
│   └── dashboard/      # Domínio: Dashboard
├── services/api/       # Lógica de negócio
├── hooks/              # Hooks customizados
├── utils/              # Funções puras
└── schemas/            # Validação Zod
```

### 5. Scripts Obrigatórios

| Quando | Comando | Propósito |
|--------|---------|-----------|
| Pre-commit | `npm run lint` | Qualidade de código |
| Pre-push | `npm run test:critical` | Testes essenciais |
| Pre-merge | `npm run test:full` | Suite completa |
| Diagnóstico | `npm run test:smoke` | Verificação rápida |

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
| Desenvolvimento rápido | `npm run test:related` | 30s-2min | Alterações locais |
| Pre-commit | `npm run test:changed` | 1-3min | Antes de commit |
| Pre-push | `npm run test:critical` | 2-3min | Antes de push |
| CI/CD Completo | `npm run test` | 5-10min | Pull requests |
| Smoke test | `npm run test:smoke` | 10-30s | Verificação rápida |
| Validação completa | `npm run validate` | 3-5min | Antes de release |

### Matriz de Decisão

| Tipo de Arquivo | Comando Recomendado |
|-----------------|---------------------|
| Componente UI isolado | `test:related` |
| Service/API | `test:critical` |
| Schema/Validação | `test:critical` |
| Hook reutilizável | `test:critical` |
| CSS/SVG/Assets | `test:smoke` ou nenhum |
| Configuração (vite, eslint) | `test:smoke` |
| Arquivos de teste | `test:related` |

### Pipeline de Validação

```bash
# Durante desenvolvimento (a cada alteração)
npm run lint          # ESLint rápido
npm run test:related  # Testes de impacto

# Antes de commit
npm run validate:quick # Lint + testes relacionados

# Antes de push/PR
npm run validate       # Lint + testes críticos

# Verificação rápida de health check
npm run test:smoke     # Suite mínima de testes
```

### Scripts Disponíveis

```bash
# --- Testes Base ---
npm run test           # Todos os testes (CI/CD)
npm run test:watch     # Modo watch para desenvolvimento

# --- Otimizações Fase 1 ---
npm run test:changed   # Apenas testes de arquivos modificados
npm run test:related   # Testes relacionados aos arquivos staged
npm run test:critical  # Testes de services, utils, schemas, hooks
npm run test:unit      # Exclui testes de integração
npm run test:quick     # Saída resumida (30 primeiras linhas)

# --- Fase 2: Seleção Inteligente ---
npm run test:smart     # Script customizado baseado em git diff
npm run test:git       # Alias para test:changed
npm run test:affected  # Alias para test:related
npm run test:smoke     # Suite mínima de smoke tests

# --- Validação Rápida ---
npm run validate       # Lint + testes críticos
npm run validate:quick # Lint + testes relacionados
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

## 🌐 Português vs Inglês

### Regras

| Contexto | Idioma | Exemplo |
|----------|--------|---------|
| Código (variáveis, funções) | Inglês | `const medicineName = ''` |
| Mensagens de erro | Português | `'Nome é obrigatório'` |
| UI (labels, botões) | Português | `Salvar Medicamento` |
| Documentação | Português | Este arquivo |
| Commits | Português | `feat: adiciona validação Zod` |
| Nomes de arquivos | Inglês | `medicineService.js` |
| Tabelas/Colunas DB | Português | `medicamentos.nome` |

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

## 🔧 ESLint Config

```javascript
// eslint.config.js
export default [
  {
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      'no-var': 'error'
    }
  }
]
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

- **[`ARQUITETURA_FRAMEWORK.md`](ARQUITETURA_FRAMEWORK.md:1)** - Framework arquitetural e governança técnica completa
- **[`LINT_COVERAGE.md`](LINT_COVERAGE.md:1)** - Configurações ESLint e boas práticas
- **[`OTIMIZACAO_TESTES_ESTRATEGIA.md`](OTIMIZACAO_TESTES_ESTRATEGIA.md:1)** - Estratégia completa de testes
- **[`ARQUITETURA.md`](ARQUITETURA.md:1)** - Visão arquitetural técnica

### Templates

- **[`PULL_REQUEST_TEMPLATE.md`](PULL_REQUEST_TEMPLATE.md:1)** - Template para PRs

---

*Última atualização: 04/02/2026 - Consolidado com aprendizados da Onda 2*
