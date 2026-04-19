# Schemas Zod - Referência de Validação

**Versão:** 4.0.0
**Última Atualização:** 2026-04-02
**Status:** Referência de API

---

## Visão Geral

Este projeto usa **Zod** para validação de dados em runtime. Todos os schemas estão centralizados em **`apps/web/src/schemas/`**.

### Princípios

1. **Valores em Português**: Todos os enums e mensagens de erro em português brasileiro
2. **Validação Obrigatória**: Todo service DEVE validar antes de enviar ao Supabase
3. **Schemas Sincronizados**: Schemas Zod devem refletir as constraints reais do banco (ver `DATABASE.md`)
4. **Nullable vs Optional**: campos que podem ser `null` no banco usam `.nullable().optional()`, NUNCA só `.optional()`

---

## Schemas Disponíveis

### Medicine Schema

**Localização**: `apps/web/src/schemas/medicineSchema.js`

```javascript
import { z } from 'zod'

export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'ml', 'ui', 'cp', 'gotas']
export const MEDICINE_TYPES = ['medicamento', 'suplemento']
export const REGULATORY_CATEGORIES = ['Genérico', 'Similar', 'Novo']

export const medicineSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  laboratory: z.string().max(200).optional().nullable(),
  active_ingredient: z.string().max(300).optional().nullable(),
  dosage_per_pill: z.number().positive().max(10000),
  dosage_unit: z.enum(DOSAGE_UNITS),
  type: z.enum(MEDICINE_TYPES).default('medicamento'),
  therapeutic_class: z.string().max(100).optional().nullable(),
  regulatory_category: z.enum(REGULATORY_CATEGORIES).optional().nullable(),
})
```

**Funções exportadas:** `validateMedicine`, `validateMedicineCreate`, `validateMedicineUpdate`, `mapMedicineErrorsToForm`

---

### Protocol Schema

**Localização**: `apps/web/src/schemas/protocolSchema.js`

```javascript
import { z } from 'zod'

export const FREQUENCIES = [
  'diário',
  'dias_alternados',
  'semanal',
  'personalizado',
  'quando_necessário',
]

export const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

const TITRATION_STATUSES = ['estável', 'titulando', 'alvo_atingido']

export const protocolSchema = z.object({
  medicine_id: z.string().uuid(),
  treatment_plan_id: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(200).trim(),
  frequency: z.enum(FREQUENCIES),
  time_schedule: z.array(z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)).min(1).max(10),
  dosage_per_intake: z.number().positive().max(1000),
  titration_status: z.enum(TITRATION_STATUSES).default('estável'),
  titration_schedule: z.array(titrationStageSchema).max(50).optional().default([]),
  current_stage_index: z.number().int().min(0).default(0),
  stage_started_at: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
  notes: z.string().max(1000).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})
```

> **Nota**: `titration_status` não tem CHECK constraint no banco — validado apenas via Zod.

**Funções exportadas:** `validateProtocol`, `validateProtocolCreate`, `validateProtocolUpdate`, `validateTitrationStage`, `mapProtocolErrorsToForm`

---

### Log Schema

**Localização**: `apps/web/src/schemas/logSchema.js`

```javascript
import { z } from 'zod'

export const logSchema = z.object({
  protocol_id: z.string().uuid().optional().nullable(),
  medicine_id: z.string().uuid(),
  taken_at: z.string().datetime(),  // ISO 8601, não pode estar no futuro
  quantity_taken: z.number().positive().max(100),
  notes: z.string().max(500).optional().nullable(),
})
```

> **Colunas que NÃO existem em `medicine_logs`**: `status`, `treatment_plan_id`. Não inclua em queries SELECT.

**Funções exportadas:** `validateLog`, `validateLogCreate`, `validateLogUpdate`, `validateLogBulkCreate`, `validateLogBulkArray`, `mapLogErrorsToForm`

---

### Stock Schema

**Localização**: `apps/web/src/schemas/stockSchema.js`

```javascript
import { z } from 'zod'

export const stockSchema = z.object({
  medicine_id: z.string().uuid(),
  quantity: z.number().positive().max(10000),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiration_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  unit_price: z.number().min(0).max(100000).optional().default(0),
  pharmacy: z.string().max(200).optional().nullable(),
  laboratory: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})
```

**Schemas adicionais:** `stockDecreaseSchema`, `stockIncreaseSchema`

`stockIncreaseSchema` agora suporta `medicine_log_id` para restauração exata de estoque a partir de um `medicine_log`.

**Funções exportadas:** `validateStock`, `validateStockCreate`, `validateStockUpdate`, `validateStockDecrease`, `validateStockIncrease`, `mapStockErrorsToForm`

---

## Uso nos Services

### Pattern de Validação

```javascript
// apps/web/src/features/{feature}/services/{feature}Service.js
import { validateMedicineCreate } from '@schemas/medicineSchema'

export const medicineService = {
  async create(medicine) {
    // 1. Validar antes de enviar
    const validation = validateMedicineCreate(medicine)
    if (!validation.success) {
      throw new Error(validation.errors.map(e => e.message).join(', '))
    }
    // 2. Usar dados validados
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

## Constantes de Validação

### Unidades de Dosagem (`medicineSchema.js`)
```javascript
export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'ml', 'ui', 'cp', 'gotas']
```

### Tipos de Medicamento (`medicineSchema.js`)
```javascript
export const MEDICINE_TYPES = ['medicamento', 'suplemento']
```

### Frequências (`protocolSchema.js`)
```javascript
export const FREQUENCIES = [
  'diário',
  'dias_alternados',
  'semanal',
  'personalizado',
  'quando_necessário',
]
```

### Dias da Semana (`protocolSchema.js`)
```javascript
export const WEEKDAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
```

### Status de Titulação (`protocolSchema.js`)
```javascript
const TITRATION_STATUSES = ['estável', 'titulando', 'alvo_atingido']
```

---

## Labels para UI

```javascript
// protocolSchema.js
export const FREQUENCY_LABELS = {
  diário: 'Diário',
  dias_alternados: 'Dias Alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessário: 'Quando Necessário',
}

export const WEEKDAY_LABELS = {
  segunda: 'Segunda-feira',
  terça: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sábado: 'Sábado',
  domingo: 'Domingo',
}

// medicineSchema.js
export const MEDICINE_TYPE_LABELS = {
  medicamento: 'Medicamento',
  suplemento: 'Suplemento',
}

export const DOSAGE_UNIT_LABELS = {
  mg: 'mg', mcg: 'mcg', g: 'g', ml: 'ml', ui: 'UI', cp: 'cp/cap', gotas: 'gotas',
}
```

---

## Mensagens de Erro

Todas as mensagens de erro devem ser em português:

```javascript
// ✅ CORRETO
z.string().min(2, 'Nome deve ter pelo menos 2 caracteres')

// ❌ ERRADO
z.string().min(2, 'Name must be at least 2 characters')
```

---

## Referências

- [Zod Documentation](https://zod.dev/)
- [`docs/architecture/DATABASE.md`](../architecture/DATABASE.md) — Schema real do banco (fonte de verdade)
- [`apps/web/src/schemas/`](../../apps/web/src/schemas/) — Implementação atual dos schemas

---

*Última atualização: 2026-03-18 | v2.0*
