# 💻 API dos Services - Meus Remédios

**Versão:** 4.0.0
**Data:** 2026-04-02

Documentação completa das APIs internas dos services com exemplos de uso.

---

## 📑 Índice

- [Medicine Service](#medicine-service)
- [Protocol Service](#protocol-service)
- [Stock Service](#stock-service)
- [Log Service](#log-service)
- [Treatment Plan Service](#treatment-plan-service)
- [Cached Services](#cached-services)
- [Push API](#push-api) 🆕 (F4.3)
- [Analytics Service](#analytics-service) 🆕 (F4.4)

---

## Medicine Service

Local: [`apps/web/src/features/medications/services/medicineService.js`](../../apps/web/src/features/medications/services/medicineService.js)

### `getAll()`

Retorna todos os medicamentos do usuário atual com dados de estoque e preço médio.

```javascript
import { medicineService } from '../services/api/medicineService'

// Uso
const medicines = await medicineService.getAll()

// Retorno
[
  {
    id: 'uuid',
    name: 'Dipirona',
    laboratory: 'Medley',
    active_ingredient: 'Sódio dipirona monoidratada',
    dosage_per_pill: 500,
    dosage_unit: 'mg',
    type: 'medicine',
    price_paid: 25.90,
    user_id: 'uuid',
    created_at: '2024-01-15T10:30:00Z',
    stock: [...],           // Lotes remanescentes de inventário
    purchases: [...],       // Histórico imutável de compras
    avg_price: 23.50,       // Preço médio ponderado calculado via purchases
    regulatory_category: 'Genérico'
  }
]
```

---

### `getById(id)`

Retorna um medicamento específico.

```javascript
const medicine = await medicineService.getById('uuid-do-medicamento')

// Retorna null se não encontrado
```

---

### `create(medicine)`

Cria um novo medicamento. **Validação Zod obrigatória.**

```javascript
import { validateMedicineCreate } from '../schemas/medicineSchema'

// Dados de exemplo
const newMedicine = {
  name: 'Dipirona',
  laboratory: 'Medley',
  active_ingredient: 'Sódio dipirona monoidratada',
  dosage_per_pill: 500,
  dosage_unit: 'mg',
  type: 'medicine',
  price_paid: 25.90
}

// Validação antes de enviar (obrigatório)
const validation = validateMedicineCreate(newMedicine)
if (!validation.success) {
  console.error(validation.errors)
  return
}

// Criação
const created = await medicineService.create(validation.data)
```

---

### `update(id, updates)`

Atualiza campos de um medicamento. **Validação Zod obrigatória.**

```javascript
import { validateMedicineUpdate } from '../schemas/medicineSchema'

const updates = {
  name: 'Dipirona 500mg',
  price_paid: 29.90
}

const validation = validateMedicineUpdate(updates)
if (!validation.success) {
  console.error(validation.errors)
  return
}

const updated = await medicineService.update('uuid', validation.data)
```

---

### `delete(id)`

Remove um medicamento e seus estoques relacionados (CASCADE).

```javascript
await medicineService.delete('uuid-do-medicamento')
```

---

## Protocol Service

Local: [`apps/web/src/features/protocols/services/protocolService.js`](../../apps/web/src/features/protocols/services/protocolService.js)

### `getAll()`

Retorna todos os protocolos com informações do medicamento.

```javascript
const protocols = await protocolService.getAll()

// Retorno
[
  {
    id: 'uuid',
    name: 'Tratamento Dor de Cabeça',
    medicine_id: 'uuid',
    medicine: {          // Dados do medicamento (join)
      name: 'Dipirona',
      dosage_per_pill: 500,
      dosage_unit: 'mg'
    },
    frequency: 'every_8h',
    time_schedule: ['08:00', '16:00', '22:00'],
    dosage_per_intake: 1000,
    target_dosage: null,
    titration_status: 'estável',
    titration_schedule: null,
    current_stage_index: 0,
    active: true,
    notes: 'Tomar após as refeições'
  }
]
```

---

### `getActive()`

Retorna apenas protocolos ativos.

```javascript
const activeProtocols = await protocolService.getActive()
```

---

### `getById(id)`

Retorna protocolo específico.

```javascript
const protocol = await protocolService.getById('uuid')
```

---

### `create(protocol)`

Cria protocolo. Suporta titulação.

```javascript
import { validateProtocolCreate } from '../schemas/protocolSchema'

// Protocolo simples
const simpleProtocol = {
  medicine_id: 'uuid-medicamento',
  name: 'Dose Única Diária',
  frequency: 'daily',
  time_schedule: ['08:00'],
  dosage_per_intake: 500,
  active: true
}

// Protocolo com titulação
const titrationProtocol = {
  medicine_id: 'uuid-medicamento',
  name: 'Aumento Gradual',
  frequency: 'daily',
  time_schedule: ['08:00'],
  dosage_per_intake: 250,           // Dose inicial
  target_dosage: 1000,              // Dose alvo
  titration_status: 'aumentando',
  titration_schedule: [
    { stage: 1, dosage: 250, duration_days: 7 },
    { stage: 2, dosage: 500, duration_days: 7 },
    { stage: 3, dosage: 750, duration_days: 7 },
    { stage: 4, dosage: 1000, duration_days: null }
  ],
  current_stage_index: 0,
  stage_started_at: new Date().toISOString(),
  active: true
}

const validation = validateProtocolCreate(titrationProtocol)
if (validation.success) {
  const created = await protocolService.create(validation.data)
}
```

---

### `update(id, updates)`

Atualiza protocolo.

```javascript
const updates = {
  dosage_per_intake: 750,
  notes: 'Ajustado após consulta'
}

const validation = validateProtocolUpdate(updates)
if (validation.success) {
  const updated = await protocolService.update('uuid', validation.data)
}
```

---

### `toggleActive(id, active)`

Ativa/desativa protocolo.

```javascript
await protocolService.toggleActive('uuid', false) // Desativa
await protocolService.toggleActive('uuid', true)  // Ativa
```

---

### `advanceTitration(id)`

Avança para próxima etapa da titulação.

```javascript
const result = await protocolService.advanceTitration('uuid')
// Retorna: { completed: false, newDosage: 500 }
// Ou:      { completed: true, message: 'Titulação completada' }
```

---

## Stock Service

Local: [`apps/web/src/features/stock/services/stockService.js`](../../apps/web/src/features/stock/services/stockService.js)

### `getByMedicineId(medicineId)`

Retorna todos os lotes remanescentes de estoque de um medicamento.

```javascript
const stock = await stockService.getByMedicineId('uuid-medicamento')

// Retorno
[
  {
    id: 'uuid',
    medicine_id: 'uuid-medicamento',
    quantity: 30,              // Quantidade atual
    original_quantity: 30,     // Quantidade original
    purchase_date: '2024-01-01',
    expiration_date: '2025-01-01',
    unit_price: 0.86,          // Preço por unidade
    notes: 'Compra mensal'
  }
]
```

---

### `getSummaryByMedicineId(medicineId)`

Retorna resumo consolidado do estoque (usando view otimizada).

```javascript
const summary = await stockService.getSummaryByMedicineId('uuid')

// Retorno
{
  medicine_id: 'uuid',
  total_quantity: 60,
  avg_unit_price: 0.82,
  total_value: 49.20,
  next_expiration: '2025-06-01',
  stock_entries: 2
}
```

---

### `add(stock)`

Cria compra + lote de estoque via RPC transacional `create_purchase_with_stock`.

```javascript
import { validateStockCreate } from '../schemas/stockSchema'

const newStock = {
  medicine_id: 'uuid-medicamento',
  quantity: 30,
  purchase_date: '2024-01-15',
  expiration_date: '2025-01-15',
  unit_price: 25.90 / 30,  // Preço unitário
  notes: 'Compra farmácia'
}

const validation = validateStockCreate(newStock)
if (validation.success) {
  const created = await stockService.add(validation.data)
}
```

---

### `decrease(medicineId, amount, medicineLogId)`

Consome estoque via FIFO transacional e registra o vínculo em `stock_consumptions`.

```javascript
import { validateStockDecrease } from '../schemas/stockSchema'

const decreaseData = {
  medicine_id: 'uuid-medicamento',
  quantity: 2,              // Quantidade a diminuir
  medicine_log_id: 'uuid-log' // Obrigatório no fluxo canônico
}

const validation = validateStockDecrease(decreaseData)
if (validation.success) {
  const result = await stockService.decrease(
    validation.data.medicine_id,
    validation.data.quantity,
    validation.data.medicine_log_id
  )
  // Retorna resumo do consumo FIFO
}
```

**Algoritmo:** Usa FIFO (First In, First Out) - consome primeiro o estoque mais antigo.

---

### `increase(medicineId, amount, options?)`

Aumenta estoque por restauração de log ou ajuste manual positivo.

```javascript
const result = await stockService.increase('uuid-medicamento', 2, {
  medicine_log_id: 'uuid-log',
  reason: 'dose_deleted_restore'
})
```

---

### `delete(id)`

Remove entrada de estoque.

```javascript
await stockService.delete('uuid-estoque')
```

---

## Log Service

Local: [`apps/web/src/shared/services/api/logService.js`](../../apps/web/src/shared/services/api/logService.js)

### `getAll(options)`

Retorna registros com paginação.

```javascript
// Sem filtros
const logs = await logService.getAll()

// Com filtros
const filtered = await logService.getAll({
  medicineId: 'uuid-medicamento',
  protocolId: 'uuid-protocolo',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  limit: 50,
  offset: 0
})

// Retorno
{
  data: [...],
  total: 150,
  hasMore: true
}
```

---

### `getByMonth(year, month, options)`

Retorna registros de um mês específico.

```javascript
const januaryLogs = await logService.getByMonth(2024, 1, {
  medicineId: 'uuid'  // Opcional
})

// Retorno: Array de logs
[
  {
    id: 'uuid',
    protocol_id: 'uuid',
    medicine_id: 'uuid',
    taken_at: '2024-01-15T08:00:00Z',
    quantity_taken: 2,
    notes: null,
    protocol: { name: '...', medicine: {...} }
  }
]
```

---

### `create(log)`

Registra que tomou o remédio.

```javascript
import { validateLogCreate } from '../schemas/logSchema'

const logEntry = {
  protocol_id: 'uuid-protocolo',
  medicine_id: 'uuid-medicamento',
  taken_at: new Date().toISOString(),
  quantity_taken: 2,        // Quantidade de comprimidos
  notes: 'Tomei após café'
}

const validation = validateLogCreate(logEntry)
if (validation.success) {
  const created = await logService.create(validation.data)
  // Cria o medicine_log e consome estoque via consume_stock_fifo
}
```

---

### `update(id, updates)`

Atualiza registro (permite edição retroativa).

```javascript
const updates = {
  taken_at: '2024-01-15T09:30:00Z',  // Novo horário
  quantity_taken: 1,                  // Ajuste de dose
  notes: 'Correção: tomei só 1'
}

const validation = validateLogUpdate(updates)
if (validation.success) {
  const updated = await logService.update('uuid-log', validation.data)
}
```

**Nota:** Quando `quantity_taken` muda, o service restaura os lotes anteriores e reconsome via FIFO para manter rastreabilidade correta.

---

### `delete(id)`

Remove registro e restaura estoque.

```javascript
await logService.delete('uuid-log')
// Estoque é automaticamente restaurado
```

---

## Purchase Service

Local: [`apps/web/src/features/stock/services/purchaseService.js`](../../apps/web/src/features/stock/services/purchaseService.js)

Service canônico para histórico de compras e custo médio.

### Métodos principais

- `getByMedicine(medicineId)`
- `getLatestByMedicineIds(medicineIds)`
- `getHistoryByMedicineIds(medicineIds)`
- `getAverageUnitPriceByMedicineIds(medicineIds)`
- `create(input)` → chama `create_purchase_with_stock`

---

## Treatment Plan Service

Local: [`apps/web/src/features/protocols/services/treatmentPlanService.js`](../../apps/web/src/features/protocols/services/treatmentPlanService.js)

### `getAll()`

Retorna planos de tratamento com contagem de protocolos.

```javascript
const plans = await treatmentPlanService.getAll()

// Retorno
[
  {
    id: 'uuid',
    name: 'Tratamento Enxaqueca',
    description: 'Protocolo completo para crises',
    objective: 'Reduzir frequência das crises',
    protocols_count: 3,
    user_id: 'uuid'
  }
]
```

---

### `getById(id)`

Retorna plano com todos os protocolos.

```javascript
const plan = await treatmentPlanService.getById('uuid')

// Retorno
{
  id: 'uuid',
  name: '...',
  protocols: [
    { id: 'uuid', name: '...', medicine: {...} }
  ]
}
```

---

### `create(plan)`

Cria plano de tratamento.

```javascript
const newPlan = {
  name: 'Tratamento Enxaqueca',
  description: 'Protocolo para crises de enxaqueca',
  objective: 'Reduzir intensidade e frequência'
}

const created = await treatmentPlanService.create(newPlan)
```

---

### `update(id, updates)`

Atualiza plano.

```javascript
const updated = await treatmentPlanService.update('uuid', {
  name: 'Novo nome',
  objective: 'Novo objetivo'
})
```

---

### `delete(id)`

Remove plano (protocolos ficam sem plano).

```javascript
await treatmentPlanService.delete('uuid')
```

---

## Cached Services

Local: [`apps/web/src/shared/services/cachedServices.js`](../../apps/web/src/shared/services/cachedServices.js)

Versões cacheadas dos services para **leituras**. Usar em componentes React.

### Uso Básico

```javascript
// ✅ USE cachedServices para leituras
import { cachedMedicineService } from '../services/api/cachedServices'
import { useCachedQuery } from '../hooks/useCachedQuery'

function MedicineList() {
  const { data, isLoading, error } = useCachedQuery(
    'medicines',
    () => cachedMedicineService.getAll()
  )
  
  // Cache automático: 30s stale time
  // Revalidação em background
}
```

### API dos Cached Services

Cada cached service expõe os mesmos métodos do service original, mas com cache:

#### `cachedMedicineService`

| Método | Cache | Invalidação |
|--------|-------|-------------|
| `getAll()` | ✅ Sim | `create`, `update`, `delete` |
| `getById(id)` | ✅ Sim | `update` (mesmo ID), `delete` (mesmo ID) |
| `create(data)` | ❌ N/A | Invalida `getAll` |
| `update(id, data)` | ❌ N/A | Invalida `getAll` e `getById` |
| `delete(id)` | ❌ N/A | Invalida `getAll`, `getById`, estoque |

#### `cachedProtocolService`

| Método | Cache | Invalidação |
|--------|-------|-------------|
| `getAll()` | ✅ Sim | Todas mutations |
| `getActive()` | ✅ Sim | Todas mutations |
| `getById(id)` | ✅ Sim | `update` (mesmo ID) |
| `create(data)` | ❌ N/A | Invalida listas |
| `update(id, data)` | ❌ N/A | Invalida listas e item |
| `toggleActive(id)` | ❌ N/A | Invalida listas |

#### `cachedStockService`

| Método | Cache | Invalidação |
|--------|-------|-------------|
| `getByMedicineId(id)` | ✅ Sim | `create`, `decrease`, `increase` |
| `getSummaryByMedicineId(id)` | ✅ Sim | Qualquer mutation de estoque |
| `getLowStock()` | ✅ Sim | Qualquer mutation de estoque |
| `decrease(...)` | ❌ N/A | Invalida estoque do medicamento |
| `increase(...)` | ❌ N/A | Invalida estoque do medicamento |

#### `cachedLogService`

| Método | Cache | Invalidação |
|--------|-------|-------------|
| `getAll(options)` | ✅ Sim | `create`, `update`, `delete` |
| `getByMonth(...)` | ✅ Sim | `create`, `update`, `delete` |
| `getByProtocolId(id)` | ✅ Sim | `create`, `update`, `delete` |
| `create(data)` | ❌ N/A | Invalida logs e estoque |
| `update(id, data)` | ❌ N/A | Invalida logs e estoque |
| `delete(id)` | ❌ N/A | Invalida logs e estoque |

---

## 🔄 Exemplo Completo: Fluxo de Uso

```jsx
// MedicineManager.jsx
import { useState } from 'react'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { cachedMedicineService } from '../services/api/cachedServices'
import { validateMedicineCreate } from '../schemas/medicineSchema'

function MedicineManager() {
  // ✅ Leitura com cache
  const { 
    data: medicines, 
    isLoading, 
    error,
    refetch 
  } = useCachedQuery('medicines', () => cachedMedicineService.getAll())
  
  const [formData, setFormData] = useState({
    name: '',
    dosage_per_pill: '',
    dosage_unit: 'mg'
  })
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // ✅ Validação Zod
    const validation = validateMedicineCreate({
      ...formData,
      dosage_per_pill: Number(formData.dosage_per_pill)
    })
    
    if (!validation.success) {
      alert(validation.errors.map(e => e.message).join(', '))
      return
    }
    
    try {
      // ✅ Mutation invalida cache automaticamente
      await cachedMedicineService.create(validation.data)
      // Lista atualizada automaticamente na próxima re-render
      refetch()
      setFormData({ name: '', dosage_per_pill: '', dosage_unit: 'mg' })
    } catch (err) {
      alert('Erro ao criar: ' + err.message)
    }
  }
  
  if (isLoading) return <p>Carregando...</p>
  if (error) return <p>Erro: {error.message}</p>
  
  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input 
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          placeholder="Nome do medicamento"
        />
        {/* ... */}
        <button type="submit">Salvar</button>
      </form>
      
      <ul>
        {medicines?.map(m => (
          <li key={m.id}>{m.name} - {m.avg_price ? `R$ ${m.avg_price.toFixed(2)}` : 'Sem estoque'}</li>
        ))}
      </ul>
    </div>
  )
}
```

---

## ⚠️ Erros Comuns

### 1. Esquecer validação Zod

```javascript
// ❌ ERRADO
await medicineService.create({ name: '' }) // Vai falhar silenciosamente ou com erro de DB

// ✅ CORRETO
const validation = validateMedicineCreate({ name: '' })
if (validation.success) {
  await medicineService.create(validation.data)
}
```

### 2. Usar service sem cache para leituras

```javascript
// ❌ ERRADO - Sempre faz requisição
const data = await medicineService.getAll()

// ✅ CORRETO - Usa cache
const { data } = useCachedQuery('medicines', () => cachedMedicineService.getAll())
```

### 3. Não tratar erros

```javascript
// ❌ ERRADO
const data = await medicineService.getAll()
setMedicines(data)

// ✅ CORRETO
try {
  const data = await medicineService.getAll()
  setMedicines(data)
} catch (error) {
  setError(error.message)
}
```

---

## Push API (F4.3)

Endpoints para gerenciamento de notificações push.

### `POST /api/push-subscribe`

Gerencia inscrições de push notification.

**Request:**
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  },
  "action": "subscribe"  // ou "unsubscribe"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Inscrição realizada com sucesso"
}
```

**Response (400):**
```json
{
  "success": false,
  "error": "Assinatura push inválida"
}
```

**Response (401):**
```json
{
  "success": false,
  "error": "Não autenticado"
}
```

---

### `POST /api/push-send`

Envia notificações push (usado por cron jobs).

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Request:**
```json
{
  "userId": "uuid-do-usuario",
  "type": "dose_reminder",  // ou "dose_missed", "stock_low"
  "title": "Hora do remédio!",
  "body": "Dipirona - 1 comprimido",
  "data": {
    "medicineId": "uuid",
    "protocolId": "uuid",
    "doseTime": "2026-02-12T08:00:00Z"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "sent": 1,
  "failed": 0
}
```

**Rate Limiting:**
- Máximo 10 pushes/dia/usuário
- Exceder retorna 429 Too Many Requests

---

### `usePushSubscription` Hook

```javascript
import { usePushSubscription } from '@shared/hooks/usePushSubscription'

function PushSettings() {
  const {
    isSupported,
    permission,
    subscription,
    subscribe,
    unsubscribe,
    isLoading
  } = usePushSubscription()

  const handleSubscribe = async () => {
    try {
      await subscribe()
      alert('Notificações ativadas!')
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  if (!isSupported) {
    return <p>Seu navegador não suporta notificações push</p>
  }

  return (
    <div>
      <p>Status: {permission}</p>
      {permission === 'default' && (
        <button onClick={handleSubscribe} disabled={isLoading}>
          Ativar Notificações
        </button>
      )}
      {subscription && (
        <button onClick={unsubscribe} disabled={isLoading}>
          Desativar Notificações
        </button>
      )}
    </div>
  )
}
```

---

## Analytics Service (F4.4)

Serviço de analytics privacy-first para tracking de eventos PWA.

### `analyticsService.track(eventName, data?)`

Registra um evento de analytics.

```javascript
import { analyticsService } from '@shared/services/analyticsService'

// Evento simples
analyticsService.track('pwa_installed')

// Evento com dados
analyticsService.track('push_opted_in', {
  source: 'settings_page'
})
```

**Eventos PWA Trackeds:**

| Evento | Descrição | Dados |
|--------|-----------|-------|
| `pwa_installed` | App instalado | - |
| `pwa_install_prompt_shown` | Prompt de instalação exibido | - |
| `pwa_install_prompt_response` | Usuário respondeu ao prompt | `{ accepted: boolean }` |
| `pwa_install_prompt_dismissed` | Prompt fechado sem instalar | - |
| `push_opted_in` | Usuário ativou push | `{ source: string }` |
| `push_opted_out` | Usuário desativou push | `{ source: string }` |
| `push_permission_prompt_shown` | UI de permissão exibida | - |
| `push_permission_dismissed` | UI de permissão fechada | - |
| `offline_session` | Sessão offline detectada | `{ duration: number }` |
| `deep_link_accessed` | Navegação via deep link | `{ route: string }` |
| `view_changed` | Mudança de view interna | `{ from: string, to: string }` |

---

### `analyticsService.getSummary()`

Retorna resumo de métricas de uso.

```javascript
const summary = analyticsService.getSummary()

// Retorno:
{
  sessionCount: 42,
  eventsToday: 15,
  pwaInstalled: true,
  pushEnabled: true,
  lastActive: "2026-02-12T10:30:00.000Z"
}
```

---

### Privacy-First Design

O analytics service foi projetado para conformidade com LGPD/GDPR:

✅ **Sem PII:**
- Não coleta email, nome, userId, telefone ou CPF
- User agent truncado (apenas primeira palavra)
- IDs de evento são randomUUID (não correlacionáveis)

✅ **Armazenamento Local:**
- Todos os dados em localStorage apenas
- Nenhuma chamada de rede para analytics
- Dados nunca saem do dispositivo

✅ **Controle do Usuário:**
- `analyticsService.clear()` - Limpa todos os dados
- `analyticsService.optOut()` - Desativa tracking

---

## 📚 Veja Também

- [ARQUITETURA.md](./ARQUITETURA.md) - Visão geral da arquitetura
- [SCHEMAS_VALIDACAO.md](../archive/past_deliveries/SCHEMAS_VALIDACAO.md) - Documentação completa dos schemas Zod
- [HOOKS.md](./HOOKS.md) - Hooks customizados
- [CHANGELOG.md](../CHANGELOG.md) - Histórico de versões
