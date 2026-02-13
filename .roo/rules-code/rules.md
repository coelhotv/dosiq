# 📝 Regras de Código - Meus Remédios

> **Versão:** 2.8.0 | **Atualizado:** 2026-02-13  
> Documento consolidado de padrões de código para desenvolvedores e agentes de IA.

---

## 🎯 Convenção de Idiomas

| Contexto | Idioma | Exemplo |
|----------|--------|---------|
| **Raciocínio interno / Pensamento** | Inglês | "I need to create a new component" |
| **Código (variáveis, funções)** | Inglês | `const medicineName = ''` |
| **Comentários de código** | Português | `// Verifica se o medicamento existe` |
| **Documentação técnica** | Português | Este arquivo |
| **Mensagens de erro** | Português | `'Nome é obrigatório'` |
| **UI (labels, botões)** | Português | `Salvar Medicamento` |
| **Commits** | Português | `feat: adiciona validação Zod` |
| **Nomes de arquivos** | Inglês | `medicineService.js` |
| **Tabelas/Colunas DB** | Português | `medicamentos.nome` |

> **Nota:** Use inglês para todo o processamento lógico e raciocínio técnico interno. Use português exclusivamente para documentação, comentários de código e feedback ao usuário humano.

---

## 🏷️ Nomenclatura Obrigatória

### Elementos de Código

| Elemento | Convenção | Exemplo | ❌ Incorreto |
|----------|-----------|---------|--------------|
| **Componentes React** | PascalCase | `MedicineCard.jsx` | `medicineCard.jsx` |
| **Funções** | camelCase | `calculateAdherence()` | `calculate_adherence()` |
| **Variáveis** | camelCase | `medicineName` | `medicine_name` |
| **Constantes** | SCREAMING_SNAKE | `MAX_RETRY`, `CACHE_STALE_TIME` | `maxRetry` |
| **Hooks Customizados** | use + PascalCase | `useCachedQuery()` | `cachedQueryHook()` |
| **Arquivos de service** | kebab-case | `medicine-service.js` | `medicineService.js` |
| **Schemas** | nome + Schema | `medicineSchema.js` | `medicine-schema.js` |
| **Branches** | kebab-case | `feature/wave-2/fix-login` | `feature_wave2_fixLogin` |

### Banco de Dados

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| **Tabelas** | snake_case, português | `medicamentos`, `protocolos` |
| **Colunas** | snake_case, português | `nome`, `dosagem_por_comprimido` |
| **Foreign Keys** | tabela_id | `medicamento_id`, `protocolo_id` |
| **Timestamps** | created_at, updated_at | Padrão Supabase |

---

## 📁 Estrutura de Arquivos

### Organização por Domínio (v2.8.0+)

```
src/
├── features/              # Domínios de negócio (F4.6)
│   ├── adherence/         # Adesão ao tratamento
│   ├── dashboard/         # Dashboard e widgets
│   ├── medications/       # Medicamentos
│   ├── protocols/         # Protocolos e titulação
│   └── stock/             # Estoque
│
├── shared/                # Recursos compartilhados (F4.6)
│   ├── components/
│   │   ├── ui/           # UI atômicos (Button, Card, Modal)
│   │   ├── log/          # LogEntry, LogForm
│   │   ├── gamification/ # BadgeDisplay
│   │   ├── onboarding/   # OnboardingWizard
│   │   └── pwa/          # PushPermission, InstallPrompt
│   ├── hooks/            # Hooks customizados
│   ├── services/         # Services com cache SWR
│   ├── constants/        # Schemas Zod
│   ├── utils/            # Utilitários puros
│   └── styles/           # CSS tokens e temas
│
└── views/                 # Páginas/Views
```

### Path Aliases (Vite Config)

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

### Regras de Arquivos

```
✅ BOM:
src/components/medicine/
├── MedicineCard.jsx      # PascalCase
├── MedicineCard.css      # Mesmo nome do componente
└── MedicineCard.test.jsx # Teste do componente

❌ EVITAR:
src/components/
├── medicine-card.jsx         # kebab-case
├── MedicineCard/
│   └── index.jsx             # index desnecessário
```

---

## 📋 Ordem de Imports

```jsx
// 1. React e bibliotecas externas
import { useState, useEffect } from 'react'
import { z } from 'zod'

// 2. Componentes internos
import Button from '../ui/Button'
import Card from '../ui/Card'

// 3. Hooks e utils (via @shared)
import { useCachedQuery } from '@shared/hooks/useCachedQuery'
import { formatDate } from '@shared/utils/date'

// 4. Services e schemas
import { medicineService } from '@features/medications/services/medicineService'
import { validateMedicine } from '@shared/constants/medicineSchema'

// 5. CSS (sempre por último)
import './MedicineForm.css'
```

---

## ⚛️ React Patterns

### Ordem de Declaração (OBRIGATÓRIO)

**Regra:** States → Memos → Effects → Handlers

```jsx
// ✅ CORRETO - Prevents TDZ (Temporal Dead Zone)
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

### Props com Valores Padrão

```jsx
function MedicineCard({ 
  medicine, 
  onEdit, 
  onDelete,
  showStock = true   // ✅ Valor padrão explícito
}) {
  // ...
}
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

## 🔒 Validação Zod

### Valores em Português (OBRIGATÓRIO)

```javascript
// ✅ CORRETO - Todos os valores em português
const FREQUENCIES = [
  'diário', 
  'dias_alternados', 
  'semanal', 
  'personalizado', 
  'quando_necessário'
]

const MEDICINE_TYPES = [
  'comprimido', 
  'cápsula', 
  'líquido', 
  'injeção', 
  'pomada', 
  'spray', 
  'outro'
]

const TITRATION_STATUS = [
  'estável',
  'titulando',
  'alvo_atingido'
]

// ❌ WRONG - Nunca misturar idiomas nos schemas
const FREQUENCIES = ['daily', 'weekly'] // Proibido!
```

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

// 3. Schema de criação
export const medicineCreateSchema = medicineSchema

// 4. Schema de atualização (parcial)
export const medicineUpdateSchema = medicineSchema.partial()

// 5. Funções de validação
export function validateMedicine(data) {
  return validateWithSchema(medicineSchema, data)
}

export function validateMedicineCreate(data) {
  return validateWithSchema(medicineCreateSchema, data)
}
```

### Uso nos Services (OBRIGATÓRIO)

```javascript
// medicineService.js
import { validateMedicineCreate } from '../schemas/medicineSchema'

export const medicineService = {
  async create(medicine) {
    // ✅ SEMPRE validar antes de enviar ao Supabase
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

## 💾 Cache SWR

### Leituras com Cache (OBRIGATÓRIO)

```javascript
// ✅ SEMPRE usar cachedServices para leituras
import { cachedMedicineService } from '@shared/services/cachedServices'
import { useCachedQuery } from '@shared/hooks/useCachedQuery'

function MedicineList() {
  const { data, isLoading, error } = useCachedQuery(
    'medicines',
    () => cachedMedicineService.getAll()
  )
  // Cache automático: 30s stale time
  // Revalidação em background
}
```

### Invalidação Automática

```javascript
// ✅ cachedServices já invalidam cache automaticamente
async function handleCreate(medicine) {
  await cachedMedicineService.create(medicine)
  // Cache invalidado automaticamente
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

## 🧩 Padrões de Componentes

### 1. Mode-Based Components

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
  preselectedMedicine={medicine}
  onSave={handleSave}
  onSuccess={nextStep}
  autoAdvance={true}
/>
```

**Regras:**
- Valor padrão deve ser o modo mais completo (`mode='full'`)
- Modos devem ser mutuamente exclusivos
- Documentar diferenças entre modos

### 2. Optional Feature Props

```jsx
<Calendar
  markedDates={dates}
  // Features opcionais (default: false)
  enableLazyLoad={true}        // Ativa lazy loading
  enableSwipe={true}           // Ativa navegação por swipe
  enableMonthPicker={true}     // Ativa seletor de mês
  onLoadMonth={fetchData}
/>
```

**Regras:**
- Props de feature devem ter default `false`
- Prefixar com `enable` para clareza
- Combinar features livremente

### 3. Base Component with Variants

```jsx
// Componente base em ui/
export default function AlertList({
  alerts = [],
  onAction,
  variant = 'default',    // 'default' | 'smart' | 'stock' | 'dose'
  showExpandButton = true,
  emptyIcon = '✅',
  emptyMessage = 'Nenhum alerta'
})

// Wrappers específicos por domínio
function SmartAlerts({ alerts }) {
  return (
    <AlertList
      variant="smart"
      alerts={normalizeSmartAlerts(alerts)}
      showExpandButton={false}
    />
  )
}
```

### 4. Onboarding Integration

```jsx
<MedicineForm
  onSave={handleSave}
  // Props de onboarding (todas opcionais)
  onSuccess={nextStep}
  autoAdvance={true}
  showCancelButton={false}
  submitButtonLabel="Salvar e Continuar"
/>
```

### 5. LogForm - Dual Return Types (CRÍTICO)

```jsx
// LogForm pode retornar OBJETO ou ARRAY
async function handleLogMedicine(logData) {
  try {
    if (Array.isArray(logData)) {
      // Modo "Plano Completo" - bulk registration
      await logService.createBulk(logData)
    } else {
      // Modo "Único Remédio" - registro individual
      await logService.create(logData)
    }
  } catch (error) {
    showError('Erro ao registrar dose')
  }
}
```

**Regra de Ouro:**
- **Dashboard.jsx**: Sempre passa `treatmentPlans` → habilita modo "Plano Completo"
- **History.jsx**: Sempre passa `treatmentPlans` → habilita modo "Plano Completo"
- Sem `treatmentPlans` → apenas modo "Único Remédio"

---

## 🤖 Telegram Bot Patterns

### Callback Data Limits

```javascript
// ❌ NUNCA usar UUIDs (excede 64 bytes)
callback_data: `reg_med:${medicineId}:${protocolId}` // ~81 chars
// Erro: BUTTON_DATA_INVALID

// ✅ SEMPRE usar índices numéricos
callback_data: `reg_med:${index}` // ~15 chars

// Armazenar mapeamento na sessão
session.set('medicineMap', medicines)

// Recuperar no callback
const medicines = session.get('medicineMap')
const medicine = medicines[index]
```

### Dosagem - Unidades em Comprimidos

```javascript
// dosage_per_intake = comprimidos por dose (ex: 4)
// dosage_per_pill = mg por comprimido (ex: 500)
// dosage_real = 4 * 500 = 2000mg

// ✅ GRAVAR no banco: quantity_taken = pillsToDecrease (comprimidos)
// NUNCA gravar mg (2000 excede limite do schema Zod = 100)
const pillsToDecrease = quantity / dosagePerPill

// Ordem de operações: Validação → Gravação → Decremento
try {
  // 1. Validar estoque
  if (stock < pillsToDecrease) throw new Error('Estoque insuficiente')
  // 2. Gravar dose
  await logService.create({ quantity_taken: pillsToDecrease })
  // 3. Decrementar estoque
  await stockService.decrease(medicineId, pillsToDecrease)
}
```

### Sessão do Bot

```javascript
// SEMPRE usar await com getSession (função async)
const session = await getSession(chatId)
if (!session) {
  return bot.sendMessage(chatId, 'Sessão expirada. Use /start')
}

// SEMPRE obter userId dinamicamente (nunca MOCK_USER_ID)
const userId = await getUserIdByChatId(chatId)
```

---

## 🧪 Testes

### Estrutura de Testes

```javascript
// medicineService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock ANTES do import
vi.mock('../../lib/supabase.js', () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      // ...
    }))
  }
}))

import { medicineService } from '../medicineService.js'

describe('medicineService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deve retornar lista de medicamentos', async () => {
    const result = await medicineService.getAll()
    expect(result).toBeDefined()
  })
})
```

### Smoke Tests

```javascript
// medicine.smoke.test.js
import { describe, it, expect } from 'vitest'
import { medicineService } from '../medicineService.js'

describe('medicineService - Smoke', () => {
  it('deve exportar funções esperadas', () => {
    expect(medicineService).toHaveProperty('getAll')
    expect(medicineService).toHaveProperty('create')
  })
})
```

### Nomenclatura de Testes

| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Arquivos de teste | `*.test.js` | `meuService.test.js` |
| Smoke tests | `*.smoke.test.js` | `meuService.smoke.test.js` |
| Describe | Descreve o módulo | `'meuService'` |
| It | Começa com "deve" | `'deve retornar dados'` |

---

## ✅ Checklist Pre-Commit

Antes de commitar, verifique:

- [ ] Código segue a convenção de nomenclatura (PascalCase, camelCase, etc.)
- [ ] Props têm validação/valores padrão quando apropriado
- [ ] Zod validation aplicada em todos os services
- [ ] Cache invalidado após mutations (usar cachedServices)
- [ ] Erros tratados com try/catch
- [ ] Testes adicionados para nova lógica
- [ ] `console.log` de debug removidos
- [ ] CSS segue mobile-first
- [ ] Imports organizados na ordem correta
- [ ] Estados declarados ANTES de useMemo/useEffect

---

## ❌ Anti-Patterns Proibidos

### Qualidade de Código

| Anti-Pattern | Consequência | Prevenção |
|--------------|--------------|-----------|
| **Declarar estado após useMemo** | ReferenceError (TDZ) | Sempre: estados → memos → effects |
| **Ignorar erros de lint** | Build quebrado | `npm run lint` obrigatório |
| **Deixar `console.log` de debug** | Poluição do console | ESLint `no-console` |
| **Ignorar dependências de hooks** | Bugs difíceis | ESLint `react-hooks/exhaustive-deps` |
| **Exportar componentes e hooks do mesmo arquivo** | Fast Refresh quebrado | Separar em arquivos dedicados |
| **Duplicar lógica (DRY)** | Manutenção difícil | Extrair para services ou utils |
| **Quebrar build** | Deploy bloqueado | `npm run build` pre-push |

### Estrutura e Organização

| Anti-Pattern | Consequência | Prevenção |
|--------------|--------------|-----------|
| **Lógica de negócio em componentes** | Dificuldade de testar | Extrair para services |
| **Schemas duplicados** | Inconsistência de dados | Centralizar em `@shared/constants/` |
| **Imports relativos longos** | Código frágil | Usar path aliases `@shared/`, `@features/` |

### Git Workflow

| Anti-Pattern | Consequência | Prevenção |
|--------------|--------------|-----------|
| **Commit direto em main** | Código não revisado | Sempre criar branch primeiro |
| **Criar código sem branch** | Commits misturados | Verificar `git branch` antes de iniciar |
| **Merge sem review** | Bugs em produção | PR obrigatório para main |

---

## 🔧 ESLint Configuration

```javascript
// eslint.config.js
export default [
  {
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^(motion|AnimatePresence|[A-Z_])'
      }],
      'react-refresh/only-export-components': 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }]
    }
  }
]
```

**Framer Motion:** `motion` e `AnimatePresence` são ignorados por padrão no `varsIgnorePattern`.

---

## 🔄 Git Workflow (OBRIGATÓRIO)

> **⚠️ MANDATÓRIO:** Todo código alterado DEVE seguir o workflow completo.
> Veja detalhes completos em: [`.roo/rules-architecture/rules.md`](../rules-architecture/rules.md)

### Resumo do Processo

```
1. CREATE BRANCH
   git checkout -b feature/wave-X/nome-descritivo

2. MAKE CHANGES
   • Seguir padrões deste documento
   • Seguir arquitetura definida

3. VALIDATE LOCALLY
   npm run lint          # 0 erros
   npm run test:critical # 143 testes passando
   npm run build         # Build OK

4. COMMIT (Atomic/Semantic)
   git commit -m "type(scope): descrição em português"

5. PUSH BRANCH
   git push origin feature/wave-X/nome-descritivo

6. CREATE PULL REQUEST
   • Usar template: docs/PULL_REQUEST_TEMPLATE.md
   • Preencher todas as seções
   • Aguardar review

7. MERGE & CLEANUP
   • Merge via --no-ff (Create a merge commit)
   • Deletar branch após merge
```

### Checklist Pré-Commit

- [ ] Branch criada a partir da `main` atualizada
- [ ] `npm run lint` - 0 erros
- [ ] `npm run test:critical` - 143 testes passando
- [ ] `npm run build` - Build de produção OK
- [ ] Commits semânticos em português
- [ ] PR criada com template preenchido
- [ ] Review aprovado antes de merge

---

## 📚 Referências

- [`.roo/rules-architecture/rules.md`](../rules-architecture/rules.md) - Governança técnica e workflow completo
- [AGENTS.md](../../AGENTS.md) - Guia completo do agente
- [PADROES_CODIGO.md](../../docs/PADROES_CODIGO.md) - Convenções detalhadas
- [API_SERVICES.md](../../docs/API_SERVICES.md) - Documentação de services
- [TESTING_GUIDE.md](../../docs/TESTING_GUIDE.md) - Guia de testes
- [CSS_ARCHITECTURE.md](../../docs/CSS_ARCHITECTURE.md) - Padrões CSS

---

*Última atualização: 13/02/2026 | v2.8.0*
