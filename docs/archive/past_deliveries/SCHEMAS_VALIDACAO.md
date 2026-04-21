# 📋 Schemas de Validação Zod - Dosiq

Documentação completa dos schemas de validação implementados com Zod para garantir integridade dos dados.

## 📁 Estrutura de Arquivos

```
src/schemas/
├── index.js              # Exportações principais
├── validationHelper.js   # Helpers genéricos de validação
├── medicineSchema.js     # Validação de medicamentos
├── protocolSchema.js     # Validação de protocolos
├── stockSchema.js        # Validação de estoque
└── logSchema.js          # Validação de logs
```

## 🚀 Uso Rápido

### Validação em Services

```javascript
import { validateMedicineCreate } from '../schemas/medicineSchema'

async create(medicine) {
  const validation = validateMedicineCreate(medicine)
  if (!validation.success) {
    throw new Error(`Erro de validação: ${validation.errors.map(e => e.message).join(', ')}`)
  }
  // ... envio ao Supabase
}
```

### Validação em Formulários React

```javascript
import { validateMedicineCreate, mapMedicineErrorsToForm } from '../schemas/medicineSchema'

const handleSubmit = (data) => {
  const validation = validateMedicineCreate(data)
  if (!validation.success) {
    setErrors(mapMedicineErrorsToForm(validation.errors))
    return
  }
  // ... prossegue com envio
}
```

### Helper Genérico

```javascript
import { validateEntity, mapErrorsToForm } from '../schemas/validationHelper'

const result = validateEntity('medicine', data, 'create')
if (!result.success) {
  const formErrors = mapErrorsToForm('medicine', result.errors)
}
```

---

## 💊 Medicine Schema

### Campos Validados

| Campo | Tipo | Validação | Obrigatório |
|-------|------|-----------|-------------|
| `name` | string | Min 2, Max 200 caracteres | ✅ Sim |
| `laboratory` | string | Max 200 caracteres | ❌ Não |
| `active_ingredient` | string | Max 300 caracteres | ❌ Não |
| `dosage_per_pill` | number | > 0, Max 10000 | ✅ Sim |
| `dosage_unit` | enum | mg, mcg, ml, g, UI, gotas, comprimido, cápsula | ✅ Sim |
| `type` | enum | 'medicine' ou 'supplement' | ✅ Sim (default: 'medicine') |

### Exemplos de Erro

```javascript
// Nome muito curto
{ name: 'A', dosage_per_pill: 500, dosage_unit: 'mg' }
// ❌ Erro: "Nome deve ter pelo menos 2 caracteres"

// Dosagem negativa
{ name: 'Paracetamol', dosage_per_pill: -10, dosage_unit: 'mg' }
// ❌ Erro: "Dosagem deve ser maior que zero"

// Unidade inválida
{ name: 'Paracetamol', dosage_per_pill: 500, dosage_unit: 'tablets' }
// ❌ Erro: "Unidade de dosagem inválida. Use: mg, mcg, ml, g, UI, gotas, comprimido ou cápsula"
```

---

## 📅 Protocol Schema

### Campos Validados

| Campo | Tipo | Validação | Obrigatório |
|-------|------|-----------|-------------|
| `medicine_id` | UUID | Formato válido | ✅ Sim |
| `treatment_plan_id` | UUID | Formato válido | ❌ Não |
| `name` | string | Min 2, Max 200 caracteres | ✅ Sim |
| `frequency` | enum | daily, alternate, weekly, custom, as_needed | ✅ Sim |
| `time_schedule` | array | Array de horários HH:MM, Min 1, Max 10 | ✅ Sim |
| `dosage_per_intake` | number | > 0, Max 1000 | ✅ Sim |
| `titration_status` | enum | estável, titulando, alvo_atingido | ✅ Sim (default: 'estável') |
| `titration_schedule` | array | Array de estágios, Max 50 | ❌ Não |
| `current_stage_index` | number | Inteiro ≥ 0 | ✅ Sim (default: 0) |
| `stage_started_at` | datetime | ISO 8601 | ❌ Não |
| `active` | boolean | - | ✅ Sim (default: true) |
| `notes` | string | Max 1000 caracteres | ❌ Não |

### Validações Cruzadas

1. **Titration Schedule**: Se definido, `titration_status` deve ser 'titulando' ou 'alvo_atingido'
2. **Stage Index**: Deve ser menor que o número de estágios definidos

### Exemplo de Estágio de Titulação

```javascript
{
  dosage: 25,           // Quantidade do estágio (number, > 0, max 10000)
  duration_days: 7,     // Duração em dias (inteiro, 1-365)
  description: 'Semana 1' // Descrição opcional (max 500 caracteres)
}
```

---

## 📦 Stock Schema

### Campos Validados

| Campo | Tipo | Validação | Obrigatório |
|-------|------|-----------|-------------|
| `medicine_id` | UUID | Formato válido | ✅ Sim |
| `quantity` | number | > 0, Max 10000 | ✅ Sim |
| `purchase_date` | string | Formato YYYY-MM-DD, não futura | ✅ Sim |
| `expiration_date` | string | Formato YYYY-MM-DD | ❌ Não |
| `unit_price` | number | ≥ 0, Max 100000 | ❌ Não (default: 0) |
| `notes` | string | Max 500 caracteres | ❌ Não |

### Validações Cruzadas

1. **Expiration > Purchase**: Data de validade deve ser posterior à data de compra
2. **Expiration não muito antiga**: Não pode estar mais de 1 ano no passado

### Exemplos de Erro

```javascript
// Data futura
{ medicine_id: '...', quantity: 30, purchase_date: '2030-01-01' }
// ❌ Erro: "Data de compra não pode ser no futuro"

// Validade anterior à compra
{ medicine_id: '...', quantity: 30, purchase_date: '2024-01-15', expiration_date: '2023-12-01' }
// ❌ Erro: "Data de validade deve ser posterior à data de compra"
```

---

## 📝 Log Schema

### Campos Validados

| Campo | Tipo | Validação | Obrigatório |
|-------|------|-----------|-------------|
| `protocol_id` | UUID | Formato válido | ❌ Não |
| `medicine_id` | UUID | Formato válido | ✅ Sim |
| `taken_at` | datetime | ISO 8601, até 5 min no futuro | ✅ Sim |
| `quantity_taken` | number | > 0, Max 100 | ✅ Sim |
| `status` | enum | taken, skipped, late, missed | ✅ Sim (default: 'taken') |
| `notes` | string | Max 500 caracteres | ❌ Não |
| `scheduled_time` | string | Formato HH:MM | ❌ Não |

### Exemplos de Erro

```javascript
// Data no futuro (além de 5 min)
{ medicine_id: '...', quantity_taken: 1, taken_at: '2030-01-01T10:00:00Z' }
// ❌ Erro: "Data/hora não pode estar no futuro"

// Quantidade muito alta
{ medicine_id: '...', quantity_taken: 500, taken_at: '2024-01-15T10:00:00Z' }
// ❌ Erro: "Quantidade máxima por registro é 100"
```

---

## 🛠️ API de Schemas

### Funções de Validação

Cada schema exporta as seguintes funções:

#### `validate[Entity]Create(data)`
Valida dados para criação de entidade.

**Retorno:**
```javascript
{
  success: true,
  data: { /* dados validados e transformados */ }
}
// ou
{
  success: false,
  errors: [
    { field: 'name', message: 'Nome deve ter pelo menos 2 caracteres' }
  ]
}
```

#### `validate[Entity]Update(data)`
Valida dados para atualização (todos os campos opcionais).

#### `validate[Entity](data)`
Alias para `validate[Entity]Create`.

### Mapeamento de Erros

#### `map[Entity]ErrorsToForm(errors)`
Converte array de erros em objeto chave-valor para formulários.

```javascript
const errors = [
  { field: 'name', message: 'Nome muito curto' },
  { field: 'dosage_per_pill', message: 'Dosagem inválida' }
]

mapMedicineErrorsToForm(errors)
// Retorna: { name: 'Nome muito curto', dosage_per_pill: 'Dosagem inválida' }
```

### Validação em Lote (Bulk)

#### `validateLogBulkCreate(data)`
Valida múltiplos registros de medicação de uma vez.

```javascript
import { validateLogBulkCreate } from '../schemas/logSchema'

const bulkData = {
  logs: [
    { medicine_id: '...', quantity_taken: 1, taken_at: '2024-01-15T08:00:00Z' },
    { medicine_id: '...', quantity_taken: 2, taken_at: '2024-01-15T20:00:00Z' }
  ]
}

const result = validateLogBulkCreate(bulkData)
```

**Regras:**
- Mínimo de 1 log, máximo de 100 logs por requisição
- Cada log dentro do array segue as mesmas regras do `logCreateSchema`

---

### Mensagens de Erro

#### `get[Entity]ErrorMessage(errors)`
Retorna mensagem formatada para exibição ao usuário.

```javascript
getMedicineErrorMessage(errors)
// 1 erro: "Nome deve ter pelo menos 2 caracteres"
// N erros: "Existem 3 erros no formulário. Verifique os campos destacados."
```

---

## 🔧 Helper Genérico

O arquivo `validationHelper.js` fornece uma interface unificada para todas as entidades.

### `validateEntity(entityType, data, operation)`

```javascript
import { validateEntity } from '../schemas/validationHelper'

// Criar medicamento
const result = validateEntity('medicine', data, 'create')

// Atualizar protocolo
const result = validateEntity('protocol', updates, 'update')

// Diminuir estoque
const result = validateEntity('stock', { medicine_id, quantity }, 'decrease')
```

### Tipos Suportados

| Entity | Operações |
|--------|-----------|
| `medicine` | create, update |
| `protocol` | create, update |
| `stock` | create, update, decrease, increase |
| `log` | create, update, bulk |

### Validações Utilitárias

```javascript
import { 
  isValidUUID, 
  isValidISODate, 
  isValidDateString, 
  isValidTime 
} from '../schemas/validationHelper'

isValidUUID('123e4567-e89b-12d3-a456-426614174000') // true
isValidISODate('2024-01-15T10:00:00Z') // true
isValidDateString('2024-01-15') // true
isValidTime('14:30') // true
```

---

## 🧪 Testando Validação

### Testes Manuais no Console

```javascript
// Importe em um componente React ou no console do navegador
import { validateMedicineCreate } from './src/schemas/medicineSchema'

// Teste válido
console.log(validateMedicineCreate({
  name: 'Paracetamol',
  dosage_per_pill: 500,
  dosage_unit: 'mg'
}))
// { success: true, data: {...} }

// Teste inválido
console.log(validateMedicineCreate({
  name: 'A',
  dosage_per_pill: -10,
  dosage_unit: 'invalid'
}))
// { success: false, errors: [...] }
```

### Executando Testes Unitários

```bash
# Testar schemas específicos
npm test -- src/schemas/__tests__

# Testar services com validação
npm test -- src/services/api/__tests__
```

---

## 📋 Checklist de Implementação

- [x] Instalação do Zod
- [x] Criação de schemas para todas as entidades
- [x] Mensagens de erro em português (pt-BR)
- [x] Integração nos services de API
- [x] Funções helper para mapeamento de erros
- [x] Validações cruzadas (dates, ranges)
- [x] Documentação completa
- [ ] Testes unitários (recomendado adicionar)

---

## 📝 Notas de Implementação

### Por que Zod?

1. **Type Safety**: Integração nativa com TypeScript (futuro)
2. **Erros Claros**: Mensagens customizáveis em português
3. **Composição**: Schemas podem ser combinados e estendidos
4. **Performance**: Validação rápida em runtime
5. **Tamanho**: Biblioteca leve (~10kb gzipped)

### Padrões Adotados

1. **Mensagens em pt-BR**: Todas as mensagens estão em português
2. **Transformações**: Valores são limpos (trim, null → undefined)
3. **Validações Realistas**: Limites baseados em casos de uso reais
4. **Sem Breaking Changes**: APIs dos services mantidas intactas
5. **Fail Fast**: Validação ocorre antes de qualquer operação

### Extensão

Para adicionar validação a uma nova entidade:

1. Crie `src/schemas/newEntitySchema.js`
2. Defina o schema com Zod
3. Exporte funções `validateNewEntityCreate/Update`
4. Adicione mapeamento em `validationHelper.js`
5. Integre no service correspondente
6. Atualize esta documentação
