# Phase 2: Implementation Patterns

> Code patterns required for all new code. Copy, don't memorize.

---

## React Hooks Pattern (CRITICAL — Immutable Order)

```jsx
// ✅ CORRECT ORDER (never swap)
export default function MyComponent({ onAction, initialData }) {
  // 1️⃣  States (useState)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // 2️⃣  Memos (useMemo) — depend on states above
  const processed = useMemo(() => {
    if (!data) return null
    return expensiveTransform(data)
  }, [data])

  // 3️⃣  Effects (useEffect) — depend on states and memos above
  useEffect(() => {
    setLoading(true)
    fetchData().then(setData).catch(setError).finally(() => setLoading(false))
  }, []) // Only runs on mount

  // 4️⃣  Handlers (useCallback) — depend on states/memos above
  const handleClick = useCallback(() => {
    onAction?.(processed)
  }, [onAction, processed])

  // 5️⃣  Guard clauses AFTER all hooks
  if (loading) return <Loading />
  if (error) return <Error message={error.message} />
  if (!data) return <Empty />

  // 6️⃣  Render
  return (
    <div className="component" onClick={handleClick}>
      {processed?.name}
    </div>
  )
}
```

### Why This Order?
- **States first** → define data
- **Memos next** → transform data (depends on states)
- **Effects next** → side effects (depends on memos + states)
- **Callbacks next** → handlers (depends on everything above)
- **Guards after** → React rules require all hooks before conditionals
- **Render last** → return JSX

### ❌ WRONG (will fail with ReferenceError: TDZ)
```jsx
// DON'T DO THIS — guard clause before hooks
if (!props) return null
const [data, setData] = useState() // ← ReferenceError!
```

---

## Zod Schema Pattern

```javascript
// ✅ CORRECT
import { z } from 'zod'

// 1️⃣  Constants (enums in PORTUGUESE)
export const FREQUENCIES = ['diário', 'semanal', 'dias_alternados', 'quando_necessário']
export const DOSAGE_UNITS = ['mg', 'mcg', 'g', 'ml', 'ui', 'cp', 'gotas']

// 2️⃣  Schema (use .nullable().optional() for optional nullable)
export const medicineSchema = z.object({
  // Required fields
  name: z.string().min(2, 'Nome deve ter 2+ caracteres').max(200),
  dosage_per_pill: z.coerce.number().positive('Deve ser positivo'),

  // Optional string (can't be null)
  notes: z.string().optional(),

  // Optional AND nullable (can be null or string)
  therapeutic_class: z.string().nullable().optional(),

  // Enum (PORTUGUESE values)
  frequency: z.enum(FREQUENCIES),
})

// 3️⃣  Validation (use .safeParse() — non-blocking)
export function validateMedicineCreate(data) {
  const result = medicineSchema.safeParse(data)

  if (!result.success) {
    // Return errors in format your API expects
    return {
      success: false,
      errors: result.error.issues.map(issue => ({
        field: issue.path[0],
        message: issue.message
      }))
    }
  }

  return {
    success: true,
    data: result.data
  }
}

// 4️⃣  Type export (for TypeScript)
export type Medicine = z.infer<typeof medicineSchema>
```

### Key Rules
- **Enums always Portuguese**: `['diário', 'semanal']` not `['daily', 'weekly']`
- **Nullable fields**: `.nullable().optional()` (not just `.optional()`)
- **Number inputs**: `.coerce.number()` (auto-converts strings from forms)
- **Always use `.safeParse()`**: never `.parse()` (throws instead of returning)
- **Validation messages in Portuguese**: 'Deve ser positivo' not 'Must be positive'

### ❌ WRONG
```javascript
// DON'T: .optional() without .nullable()
field: z.string().optional()  // Rejects null values silently!

// DON'T: .parse() blocking
const data = schema.parse(input)  // Throws on invalid

// DON'T: Enums in English
export const STATUS = ['active', 'inactive']  // Should be português
```

---

## Service Pattern

```javascript
// ✅ CORRECT
// File: src/features/medications/services/medicineService.js

import { supabase, getUserId } from '@shared/utils/supabase'
import { validateMedicineCreate } from '@schemas/medicineSchema'

export const medicineService = {
  // 1️⃣  Query (return all for user)
  async getAll() {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })

    if (error) throw new Error(`Failed to fetch medicines: ${error.message}`)
    return data
  },

  // 2️⃣  Query by ID
  async getById(id) {
    const userId = await getUserId()
    const { data, error } = await supabase
      .from('medicines')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) throw new Error(`Medicine not found: ${error.message}`)
    return data
  },

  // 3️⃣  Create (validate first, then insert)
  async create(input) {
    // Validate input
    const validation = validateMedicineCreate(input)
    if (!validation.success) {
      throw new Error(
        validation.errors
          .map(e => `${e.field}: ${e.message}`)
          .join('; ')
      )
    }

    // Get user
    const userId = await getUserId()

    // Insert
    const { data, error } = await supabase
      .from('medicines')
      .insert([{ ...validation.data, user_id: userId }])
      .select()
      .single()

    if (error) throw new Error(`Failed to create medicine: ${error.message}`)
    return data
  },

  // 4️⃣  Update (validate, check ownership, update)
  async update(id, input) {
    // Validate
    const validation = validateMedicineCreate(input)
    if (!validation.success) {
      throw new Error(
        validation.errors
          .map(e => `${e.field}: ${e.message}`)
          .join('; ')
      )
    }

    // Check ownership (user owns this medicine)
    const medicine = await this.getById(id)  // throws if not found

    // Update
    const { data, error } = await supabase
      .from('medicines')
      .update(validation.data)
      .eq('id', id)
      .eq('user_id', medicine.user_id)  // Ensure user owns it
      .select()
      .single()

    if (error) throw new Error(`Failed to update medicine: ${error.message}`)
    return data
  },

  // 5️⃣  Delete (check ownership)
  async delete(id) {
    const medicine = await this.getById(id)  // throws if not found
    const { error } = await supabase
      .from('medicines')
      .delete()
      .eq('id', id)
      .eq('user_id', medicine.user_id)

    if (error) throw new Error(`Failed to delete medicine: ${error.message}`)
  }
}
```

### Key Rules
- **Always call `getUserId()`** before querying/inserting
- **Validate before insert/update** using schema
- **Check ownership on update/delete** (ensure user owns the record)
- **Throw errors with context** (not just error.message)
- **Use `.single()`** for queries that must return exactly 1 row
- **Always check `.error` object** from Supabase

### ❌ WRONG
```javascript
// DON'T: Skip validation
const { data } = await supabase.from('medicines').insert([input])

// DON'T: Forget getUserId()
const { data } = await supabase.from('medicines').select('*')

// DON'T: Don't check ownership on update
await supabase.from('medicines').update(input).eq('id', id)

// DON'T: Don't handle errors
const { data } = await supabase.from('medicines').select()
```

---

## Component Pattern

```jsx
// ✅ CORRECT
// File: src/features/medications/components/MedicineCard.jsx

import { useState, useMemo, useEffect, useCallback } from 'react'
import { medicineService } from '@medications/services/medicineService'
import Button from '@shared/components/ui/Button'
import Card from '@shared/components/ui/Card'
import './MedicineCard.css'

/**
 * Componente que displays medication card with edit/delete actions.
 *
 * Props:
 * - medicineId: string — ID do medicamento
 * - onUpdate: () => void — callback ao atualizar
 * - onDelete: () => void — callback ao deletar
 */
export default function MedicineCard({ medicineId, onUpdate, onDelete }) {
  // States
  const [medicine, setMedicine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Memos
  const dosageLabel = useMemo(() => {
    if (!medicine) return ''
    return `${medicine.dosage_per_pill} ${medicine.dosage_unit}`
  }, [medicine])

  // Effects
  useEffect(() => {
    const loadMedicine = async () => {
      try {
        setLoading(true)
        const data = await medicineService.getById(medicineId)
        setMedicine(data)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadMedicine()
  }, [medicineId])

  // Handlers
  const handleDelete = useCallback(async () => {
    if (!confirm('Deletar medicamento?')) return
    try {
      await medicineService.delete(medicineId)
      onDelete?.()
    } catch (err) {
      setError(err.message)
    }
  }, [medicineId, onDelete])

  // Guards
  if (loading) return <Card><div className="skeleton"></div></Card>
  if (error) return <Card><div className="error">{error}</div></Card>
  if (!medicine) return <Card><div className="empty">Medicamento não encontrado</div></Card>

  // Render
  return (
    <Card className="medicine-card">
      <div className="medicine-card__header">
        <h3 className="medicine-card__name">{medicine.name}</h3>
        <div className="medicine-card__actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onUpdate?.(medicine)}
          >
            Editar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
          >
            Deletar
          </Button>
        </div>
      </div>

      <div className="medicine-card__details">
        <p><strong>Dosagem:</strong> {dosageLabel}</p>
        {medicine.therapeutic_class && (
          <p><strong>Classe Terapêutica:</strong> {medicine.therapeutic_class}</p>
        )}
      </div>
    </Card>
  )
}
```

### Key Rules
- **JSDoc comments in Portuguese** (describe what component does)
- **Props documented** (type, meaning, callbacks)
- **States before effects** (always)
- **Error messages in Portuguese** ("Medicamento não encontrado")
- **Empty state handling** (not found, loading, error all handled)
- **No inline styles** (use `.css` file with semantic class names)

### ❌ WRONG
```jsx
// DON'T: Inline styles
<div style={{ color: 'red', marginTop: '10px' }}>

// DON'T: Hardcoded English errors
<div>{error}</div>  // Could be "UNIQUE constraint failed"

// DON'T: Skip loading state
if (!medicine) return <div>{medicine.name}</div>

// DON'T: Callback without null check
onUpdate(medicine)  // Should be onUpdate?.(medicine)
```

---

## CSS Pattern (No Inline Styles)

```css
/* ✅ CORRECT */
/* File: src/features/medications/components/MedicineCard.css */

.medicine-card {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.medicine-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
  gap: var(--space-2);
}

.medicine-card__name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.medicine-card__actions {
  display: flex;
  gap: var(--space-1);
}

.medicine-card__details {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.6;
}

.medicine-card__details p {
  margin: 0 0 var(--space-2) 0;
}

.medicine-card__details p:last-child {
  margin-bottom: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .medicine-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .medicine-card__actions {
    width: 100%;
  }
}
```

### Key Rules
- **Use CSS variables** (never hardcode colors, spacing, etc)
- **BEM naming**: `.block__element--modifier`
- **Space scale**: 4px, 8px, 12px, 16px, 24px, 32px
- **Use semantic spacing**: `var(--space-1)`, `var(--space-2)`, etc
- **Responsive**: add `@media` for mobile
- **No margin on last child**: prevents extra spacing

---

## Testing Pattern

```javascript
// ✅ CORRECT
// File: src/features/medications/services/__tests__/medicineService.test.js

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks BEFORE importing the module
vi.mock('@shared/utils/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  getUserId: vi.fn(() => Promise.resolve('test-user-id')),
}))

import { supabase } from '@shared/utils/supabase'
import { medicineService } from '../medicineService'

describe('medicineService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  describe('getAll', () => {
    it('deve retornar lista de medicamentos do usuário', async () => {
      // Arrange
      const mockData = [
        { id: '1', name: 'Losartana', dosage_per_pill: 50 },
        { id: '2', name: 'Atenolol', dosage_per_pill: 25 },
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      } as any)

      // Act
      const result = await medicineService.getAll()

      // Assert
      expect(result).toEqual(mockData)
      expect(supabase.from).toHaveBeenCalledWith('medicines')
    })

    it('deve lançar erro se Supabase falhar', async () => {
      // Arrange
      const mockError = { message: 'Network error' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
          }),
        }),
      } as any)

      // Act & Assert
      await expect(medicineService.getAll()).rejects.toThrow('Failed to fetch')
    })
  })

  describe('create', () => {
    it('deve criar novo medicamento com dados válidos', async () => {
      // Arrange
      const input = {
        name: 'Losartana',
        dosage_per_pill: 50,
        dosage_unit: 'mg',
        type: 'comprimido',
      }

      const mockData = { id: '123', ...input, user_id: 'test-user-id' }

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      } as any)

      // Act
      const result = await medicineService.create(input)

      // Assert
      expect(result).toEqual(mockData)
    })

    it('deve rejeitar dados inválidos', async () => {
      // Arrange
      const input = {
        name: 'L',  // Too short
        dosage_per_pill: -10,  // Negative!
      }

      // Act & Assert
      await expect(medicineService.create(input)).rejects.toThrow()
    })
  })
})
```

### Key Rules
- **Mocks at TOP** (before imports)
- **afterEach cleanup** (clearAllMocks + clearAllTimers — REQUIRED)
- **Arrange/Act/Assert** structure
- **Test happy path + error cases**
- **No setTimeout in act()** — use waitFor()
- **Mock depth must match imports** (mock `@shared/utils`, not deep properties)

---

## Date Handling Pattern

```javascript
// ✅ CORRECT
import { parseLocalDate, formatLocalDate } from '@utils/dateUtils'

// NEVER do this
const date = new Date('2026-03-07')  // ❌ UTC midnight = day before in GMT-3

// DO THIS instead
const date = parseLocalDate('2026-03-07')  // ✅ Correct local time
const formatted = formatLocalDate(new Date())  // ✅ Returns 'YYYY-MM-DD'

// In forms
const [startDate, setStartDate] = useState('')
const handleDateChange = (e) => {
  setStartDate(e.target.value)  // 'YYYY-MM-DD' from input
  const parsed = parseLocalDate(e.target.value)  // Convert to Date
}
```

---

## Semantic Commits

```bash
# ✅ CORRECT — clear, specific, action-oriented

git commit -m "feat(medications): add ANVISA autocomplete to TreatmentWizard"
git commit -m "fix(medications): correct Mac Roman encoding in ETL"
git commit -m "refactor(stock): extract cost calculation to separate function"
git commit -m "test(protocols): add edge case tests for titration schedule"
git commit -m "docs(readme): update setup instructions"

# ❌ WRONG — vague, no scope, no action

git commit -m "update"
git commit -m "WIP"
git commit -m "fix typo"
git commit -m "cleanup"
git commit -m "make it work"
```

---

## Reference Checklist During Phase 2

- [ ] Hook order: States → Memos → Effects → Handlers → Guards → Render
- [ ] Zod: `.nullable().optional()` for nullable fields, never just `.optional()`
- [ ] Service: validate before insert, check ownership before update/delete
- [ ] Component: JSDoc, no inline styles, proper error/loading states
- [ ] CSS: use variables, BEM naming, semantic spacing
- [ ] Testing: mocks at top, afterEach cleanup, happy + error paths
- [ ] Dates: `parseLocalDate()`, never `new Date('YYYY-MM-DD')`
- [ ] Commits: semantic, Portuguese, action-oriented

---

**Copy patterns, don't memorize. Ref this file during Phase 2.**
