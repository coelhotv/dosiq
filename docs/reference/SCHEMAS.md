# Schemas Zod - Referência de Validação

**Versão:** 1.0  
**Última Atualização:** 2026-02-17  
**Status:** Referência de API

---

## Visão Geral

Este projeto usa **Zod** para validação de dados em runtime. Todos os schemas estão centralizados em `src/shared/constants/` e `src/schemas/`.

### Princípios

1. **Valores em Português**: Todos os enums e mensagens de erro em português brasileiro
2. **Validação Obrigatória**: Todo service DEVE validar antes de enviar ao Supabase
3. **Schemas Compartilhados**: Frontend e backend usam os mesmos schemas
4. **Type Inference**: TypeScript infere tipos automaticamente dos schemas

---

## Schemas Disponíveis

### Medicine Schema

**Localização**: `src/shared/constants/medicineSchema.js`

```javascript
import { z } from 'zod'

// Constantes
const DOSAGE_UNITS = ['mg', 'mcg', 'ml', 'g', 'UI', 'gotas']
const MEDICINE_TYPES = [
  'comprimido', 'cápsula', 'líquido', 
  'injeção', 'pomada', 'spray', 'outro'
]

// Schema base
const medicineSchema = z.object({
  name: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(200),
  dosage_per_pill: z.number().positive(),
  dosage_unit: z.enum(DOSAGE_UNITS),
  medicine_type: z.enum(MEDICINE_TYPES),
})

// Funções de validação
export function validateMedicine(data) {
  return validateWithSchema(medicineSchema, data)
}
```

### Protocol Schema

**Localização**: `src/shared/constants/protocolSchema.js`

```javascript
const FREQUENCIES = [
  'diário',
  'dias_alternados',
  'semanal',
  'personalizado',
  'quando_necessário'
]

const WEEKDAYS = [
  'domingo', 'segunda', 'terça', 'quarta',
  'quinta', 'sexta', 'sábado'
]

const protocolSchema = z.object({
  medicine_id: z.string().uuid(),
  dosage_per_intake: z.number().min(1).max(100),
  frequency: z.enum(FREQUENCIES),
  time_schedule: z.array(z.string()),
  is_titrating: z.boolean().optional(),
})
```

### Log Schema

**Localização**: `src/shared/constants/logSchema.js`

```javascript
const logSchema = z.object({
  medicine_id: z.string().uuid(),
  protocol_id: z.string().uuid().optional(),
  quantity_taken: z.number()
    .min(1, 'Quantidade deve ser maior que zero')
    .max(100, 'Quantidade máxima: 100 comprimidos'),
  log_date: z.string().datetime(),
  notes: z.string().max(500).optional(),
})
```

### Stock Schema

**Localização**: `src/shared/constants/stockSchema.js`

```javascript
const stockSchema = z.object({
  medicine_id: z.string().uuid(),
  current_quantity: z.number().min(0),
  alert_threshold: z.number().min(1).default(7),
  last_refill: z.string().datetime().optional(),
})
```

---

## Uso nos Services

### Pattern de Validação

```javascript
// medicineService.js
import { validateMedicine } from '@shared/constants/medicineSchema'

export const medicineService = {
  async create(medicine) {
    // 1. Validar antes de enviar
    const validation = validateMedicine(medicine)
    
    // 2. Verificar se passou
    if (!validation.success) {
      throw new Error(
        `Erro de validação: ${validation.errors.map(e => e.message).join(', ')}`
      )
    }
    
    // 3. Usar dados validados
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

## Helper de Validação

**Localização**: `src/schemas/validationHelper.js`

```javascript
export function validateWithSchema(schema, data) {
  const result = schema.safeParse(data)
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
      errors: []
    }
  }
  
  return {
    success: false,
    data: null,
    errors: result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }))
  }
}
```

---

## Constantes de Validação

### Unidades de Dosagem
```javascript
export const DOSAGE_UNITS = ['mg', 'mcg', 'ml', 'g', 'UI', 'gotas']
```

### Tipos de Medicamento
```javascript
export const MEDICINE_TYPES = [
  'comprimido',
  'cápsula',
  'líquido',
  'injeção',
  'pomada',
  'spray',
  'outro'
]
```

### Frequências
```javascript
export const FREQUENCIES = [
  'diário',
  'dias_alternados',
  'semanal',
  'personalizado',
  'quando_necessário'
]
```

### Dias da Semana
```javascript
export const WEEKDAYS = [
  'domingo', 'segunda', 'terça', 'quarta',
  'quinta', 'sexta', 'sábado'
]
```

### Status de Titulação
```javascript
export const TITRATION_STATUS = [
  'estável',
  'titulando',
  'alvo_atingido'
]
```

---

## Labels para UI

Cada enum tem labels correspondentes para exibição:

```javascript
export const FREQUENCY_LABELS = {
  diário: 'Diário',
  dias_alternados: 'Dias Alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessário: 'Quando Necessário'
}

export const MEDICINE_TYPE_LABELS = {
  comprimido: 'Comprimido',
  cápsula: 'Cápsula',
  líquido: 'Líquido',
  injeção: 'Injeção',
  pomada: 'Pomada',
  spray: 'Spray',
  outro: 'Outro'
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
- [`docs/standards/CODE_PATTERNS.md`](../standards/CODE_PATTERNS.md) - Padrões de código *(em migração)*
- [`docs/reference/SERVICES.md`](./SERVICES.md) - API de services
- [`.roo/rules-code/rules.md`](../../.roo/rules-code/rules.md) - Regras consolidadas

---

*Última atualização: 2026-02-17 | v1.0*
