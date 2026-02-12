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

# 3. Em mudanças de experiência, aguardar a aprovação textual do humano

# 4. Validar localmente
npm run lint
npm run test:critical
npm run build

# 5. Criar PR para main

# 6. Aguardar review

# 7. Merge via --no-ff apenas
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
| Desenvolvimento rápido | `npm run test:critical` | 1-3min | Alterações locais |
| Pre-commit | `npm run test:changed` | 1-3min | Antes de commit |
| Pre-push | `npm run test:critical` | 2-3min | Antes de push |
| CI/CD Completo | `npm run test` | 5-10min | Pull requests |
| Smoke test | `npm run test:smoke` | 10-30s | Verificação rápida |
| Validação completa | `npm run validate` | 3-5min | Antes de release |

> **⚠️ NOTA:** O comando `test:related` pode não estar disponível em todas as versões do Vitest.
> Use `test:critical` ou `test:changed` como alternativas garantidas.

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

- **[`ARQUITETURA_FRAMEWORK.md`](ARQUITETURA_FRAMEWORK.md:1)** - Framework arquitetural e governança técnica completa
- **[`LINT_COVERAGE.md`](LINT_COVERAGE.md:1)** - Configurações ESLint e boas práticas
- **[`OTIMIZACAO_TESTES_ESTRATEGIA.md`](OTIMIZACAO_TESTES_ESTRATEGIA.md:1)** - Estratégia completa de testes
- **[`ARQUITETURA.md`](ARQUITETURA.md:1)** - Visão arquitetural técnica

### Templates

- **[`PULL_REQUEST_TEMPLATE.md`](PULL_REQUEST_TEMPLATE.md:1)** - Template para PRs

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

*Última atualização: 11/02/2026 - Adicionada seção de Padrões de Componentes Consolidados e documentação do LogForm*
