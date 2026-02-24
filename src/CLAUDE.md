# src/ — Padroes de Codigo

> Referencia rapida para agentes trabalhando no frontend React.

## Padrao de Service

```javascript
// src/features/{feature}/services/{feature}Service.js
import { supabase, getUserId } from '@shared/utils/supabase'
import { validateXxxCreate } from '@schemas/xxxSchema'

export const xxxService = {
  async getAll() {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('tabela')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    return data
  },

  async create(input) {
    const validation = validateXxxCreate(input)
    if (!validation.success) throw new Error(validation.errors.map(e => e.message).join(', '))
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('tabela')
      .insert([{ ...validation.data, user_id: userId }])
      .select()
      .single()
    if (error) throw error
    return data
  }
}
```

## Padrao de Componente

```jsx
// src/features/{feature}/components/{Component}.jsx
import { useState, useMemo, useEffect, useCallback } from 'react'
import { useDashboardContext } from '@dashboard/hooks/useDashboardContext.jsx'
import Button from '@shared/components/ui/Button'
import './Component.css'

export default function Component({ onAction }) {
  // 1. States
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  // 2. Context
  const { dashboardData } = useDashboardContext()

  // 3. Memos
  const processed = useMemo(() => {
    if (!data) return null
    return transform(data)
  }, [data])

  // 4. Effects
  useEffect(() => {
    setLoading(true)
    fetchData().then(setData).finally(() => setLoading(false))
  }, [])

  // 5. Handlers
  const handleClick = useCallback(() => {
    onAction?.(processed)
  }, [onAction, processed])

  if (loading) return <Loading />

  return (
    <div className="component">
      {/* render */}
    </div>
  )
}
```

## Padrao de Schema Zod

```javascript
// src/schemas/xxxSchema.js
import { z } from 'zod'

// Constantes (enums em PORTUGUES)
export const STATUS_OPTIONS = ['ativo', 'inativo', 'pausado']

// Schema
const xxxSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(200),
  status: z.enum(STATUS_OPTIONS),
  optional_field: z.string().nullable().optional(), // NUNCA so .optional() para campos que podem ser null
  date_field: z.string().date() // ou z.coerce.date()
})

// Validacao
export function validateXxxCreate(data) {
  const result = xxxSchema.safeParse(data)
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(i => ({ field: i.path[0], message: i.message }))
    }
  }
  return { success: true, data: result.data }
}
```

## Padrao de Teste

```javascript
// src/features/{feature}/services/__tests__/xxxService.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks ANTES dos imports do modulo testado
vi.mock('@shared/utils/supabase', () => ({
  supabase: { from: vi.fn() },
  getUserId: vi.fn(() => Promise.resolve('test-user-id'))
}))

import { xxxService } from '../xxxService'

describe('xxxService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('deve retornar dados do usuario', async () => {
    // arrange
    // act
    // assert
  })
})
```

### Regras de Teste
- Arquivo <= 300 linhas
- Um hook/componente/service por arquivo
- `afterEach` com cleanup OBRIGATORIO
- Usar `waitFor()` nao `setTimeout` em `act()`
- Mock Supabase no nivel do modulo
- Nao usar localStorage em testes (verificar `NODE_ENV`)

## SmartAlerts — Como Integrar

```jsx
// Formato de alerta para SmartAlerts
const alert = {
  id: 'unique-alert-id',        // string unica
  severity: 'warning',           // 'critical' | 'warning' | 'info'
  title: 'Titulo do Alerta',
  message: 'Descricao detalhada',
  actions: [
    { label: 'Acao', type: 'primary' }
  ]
}

// Adicionar ao array de alerts no Dashboard.jsx
<SmartAlerts alerts={alerts} onAction={(alertId, actionLabel) => { ... }} />
```

## Date Handling

```javascript
import { formatLocalDate, parseLocalDate } from '@utils/dateUtils'

// CORRETO
const today = formatLocalDate(new Date())     // "2026-02-24" (local)
const date = parseLocalDate('2026-02-24')     // Date object correto em GMT-3

// ERRADO - NUNCA FAZER
const date = new Date('2026-02-24')           // UTC midnight = 23:00 dia 23 em BRT
```

## Dashboard Context

```jsx
import { useDashboardContext } from '@dashboard/hooks/useDashboardContext.jsx'

// Dentro de qualquer componente filho de DashboardProvider
const { dashboardData, loading, error, refetch } = useDashboardContext()
// dashboardData contém: medicines, protocols, logs, stocks, adherence, etc.
```

## Analytics Tracking

```javascript
import { analyticsService } from '@dashboard/services/analyticsService'

analyticsService.track('event_name', { key: 'value' })
// Privacy-first: localStorage only, sem PII, 30 dias retencao
```
