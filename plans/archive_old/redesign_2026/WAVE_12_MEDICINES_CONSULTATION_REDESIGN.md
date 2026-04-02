# Wave 12 — Medicines View & Consultation Mode Redesign

**Status:** ✅ ENTREGUE
**Data de criação:** 2026-03-30
**Data de entrega:** 2026-03-31
**PR:** #440 (mergeado com squash)
**Dependências:** W0-W11 (W11 entrega Modal + Forms redesenhados — **W11 é pré-requisito**)
**Risco:** MÉDIO — duas views independentes; Medicines usa `window.confirm()` que deve ser eliminado; Consultation tem layout próprio (purple gradient) que muda completamente
**Estimativa:** ~4 sprints, ~800 linhas JSX novo + ~600 linhas CSS novo

---

## Por que esta wave existe

Medicines e Consultation são as **duas únicas views que não têm branching `isRedesignEnabled`** no `App.jsx`. Quando o usuário navega para "Medicamentos" ou "Modo Consulta", o visual volta para o tema antigo (neon/glass para Medicines, purple gradient para Consultation). Após W11 entregar os forms e modais redesenhados, essas views são o próximo gargalo visual.

### Problemas específicos:

1. **Medicines** (`src/views/Medicines.jsx`):
   - Header com gradient neon (cyan→magenta) no título
   - Cards usam `glass-bg`, `glass-border`, `glow-hover-primary` — visual neon
   - `window.confirm()` em dois lugares (exclusão e criação de protocolo) — anti-pattern UX
   - Filter tabs com buttons genéricos (sem visual sanctuary)
   - Emoji-based labels (💊, ✏️, 🗑️, ➕) em vez de ícones Lucide

2. **Consultation** (`src/views/Consultation.jsx` → `ConsultationView.jsx`):
   - Header com gradient purple (#667eea → #764ba2) — nenhuma relação com Verde Saúde
   - Variáveis CSS locais (`--cv-*`) ao invés de tokens do design system
   - Footer fixo com botões purple gradient — precisa usar tokens sanctuary
   - Progress bars com gradient purple
   - Emoji-based section titles (💊, 📊, 📦, 📝, 🎯)
   - Sem integração com `useRedesign()` ou scoping `[data-redesign="true"]`

---

## Estratégia de Implementação

### Princípio: Novas Views Redesign (padrão W7-W10)

Diferente da W11 (CSS-only), esta wave cria **novas views** em `src/views/redesign/`:

1. `MedicinesRedesign.jsx` — reescrita da Medicines view usando design system Santuário
2. `ConsultationRedesign.jsx` — container wrapper que renderiza `ConsultationViewRedesign.jsx`
3. `ConsultationViewRedesign.jsx` — reescrita do presenter com tokens Santuário

As views originais (`Medicines.jsx`, `Consultation.jsx`, `ConsultationView.jsx`) **NÃO são modificadas**.

### Decisões arquiteturais:

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Medicines: criar nova view ou CSS-only? | **Nova view** | MedicineCard precisa de rewrite (glass→sanctuary); `window.confirm()` precisa virar Modal; emojis→Lucide |
| Consultation: container ou presenter? | **Novo presenter + manter container** | Container (`Consultation.jsx`) tem lógica de dados + PDF + Share que NÃO muda. Apenas o presenter visual muda. |
| MedicineCard: novo componente ou CSS-only? | **Novo componente** `MedicineCardRedesign.jsx` | Card usa `glass-bg`, emoji labels, `Card` wrapper — mudanças demais para CSS-only |
| `window.confirm()` → o quê? | **ConfirmDialog** (componente sanctuary) | Modal redesenhado (W11) + conteúdo padronizado de confirmação |
| Filter tabs: novo componente? | **Não** — usar classes sanctuary inline | São 3 botões; recriar como `<button>` com classes `.sr-chip` basta |

---

## Rollout: Padrão App.jsx

Ambas as views seguem o padrão de branching existente:

```jsx
// Em App.jsx — adicionar estes branches:
case 'medicines':
  return isRedesignEnabled ? (
    <Suspense fallback={<ViewSkeleton />}>
      <MedicinesRedesign onNavigateToProtocol={navigateToProtocol} />
    </Suspense>
  ) : (
    <Suspense fallback={<ViewSkeleton />}>
      <Medicines onNavigateToProtocol={navigateToProtocol} />
    </Suspense>
  )

case 'consultation':
  return isRedesignEnabled ? (
    <Suspense fallback={<ViewSkeleton />}>
      <ConsultationRedesign onBack={() => setCurrentView('profile')} />
    </Suspense>
  ) : (
    <Suspense fallback={<ViewSkeleton />}>
      <Consultation onBack={() => setCurrentView('profile')} />
    </Suspense>
  )
```

E adicionar os lazy imports no topo do App.jsx:
```jsx
const MedicinesRedesign = lazy(() => import('./views/redesign/MedicinesRedesign'))
const ConsultationRedesign = lazy(() => import('./views/redesign/ConsultationRedesign'))
```

---

## Sprint 12.1 — MedicineCardRedesign + ConfirmDialog

**Prioridade:** 1ª (desbloqueia Sprint 12.2)
**Arquivos criados:**
- `src/features/medications/components/redesign/MedicineCardRedesign.jsx`
- `src/features/medications/components/redesign/MedicineCardRedesign.css`
- `src/shared/components/ui/ConfirmDialog.jsx`
- `src/shared/components/ui/ConfirmDialog.css`

**Escopo:**

### 12.1.1 — MedicineCardRedesign

Componente de card de medicamento no estilo Santuário. Substitui `MedicineCard.jsx` na view redesign.

**Props (idênticas ao original):**
```jsx
function MedicineCardRedesign({ medicine, onEdit, onDelete, hasDependencies })
```

**Layout:**
```
┌──────────────────────────────────────┐
│  [Pill icon]  Nome do Medicamento    │  ← header row
│               Princípio Ativo        │
├──────────────────────────────────────┤
│  Laboratório    Dosagem    Tipo      │  ← details grid
│  Roche          100mg      Comprimido│
├──────────────────────────────────────┤
│  ⚠ Possui protocolos associados      │  ← dependency warning (condicional)
├──────────────────────────────────────┤
│  [Editar]            [Excluir]       │  ← actions row
└──────────────────────────────────────┘
```

**Regras visuais:**
- Background: `var(--color-surface-container-lowest)` (#ffffff)
- Border: nenhuma (NO-LINE RULE do design system)
- Border-radius: `var(--radius-lg)` (1rem)
- Shadow: `0 1px 3px rgba(25, 28, 29, 0.04)` (ambient shadow)
- Hover: shadow sutil `0 2px 8px rgba(25, 28, 29, 0.08)` — SEM `scale()`, SEM glow
- Font: `var(--font-body)` (Lexend) para body, `var(--font-heading)` (Public Sans) para nome
- Nome: `var(--text-title-lg)` (1.125rem), weight 600, color `var(--color-on-surface)`
- Active ingredient: `var(--text-body-md)`, color `var(--color-primary)`
- Details: grid de 2 ou 3 colunas, labels em `var(--color-on-surface-variant)`, values em `var(--color-on-surface)`
- Ícones: Lucide — `Pill` (header), `Building-2` (laboratório), `Beaker` (dosagem), `Tag` (tipo), `Pencil` (editar), `Trash-2` (excluir)
- Dependency warning: `var(--color-warning)` background sutil, ícone `AlertTriangle`
- Botão Editar: `btn-ghost` + ícone `Pencil` + texto "Editar"
- Botão Excluir: `btn-ghost` com color `var(--color-error)` + ícone `Trash-2` + texto "Excluir"
- Preço médio: se existir, mostrar em badge `var(--color-secondary-fixed)` background

**CSS (`MedicineCardRedesign.css`):**

```css
.sr-medicine-card {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-shadow: 0 1px 3px rgba(25, 28, 29, 0.04);
  transition: box-shadow 0.2s ease;
}

.sr-medicine-card:hover {
  box-shadow: 0 2px 8px rgba(25, 28, 29, 0.08);
}

.sr-medicine-card__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.sr-medicine-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-on-secondary-fixed, var(--color-primary));
}

.sr-medicine-card__name {
  font-family: var(--font-heading);
  font-size: var(--text-title-lg);
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
  line-height: 1.3;
}

.sr-medicine-card__ingredient {
  font-family: var(--font-body);
  font-size: var(--text-body-md);
  color: var(--color-primary);
  margin-top: 0.125rem;
}

.sr-medicine-card__details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.75rem;
}

.sr-medicine-card__detail {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sr-medicine-card__detail-label {
  font-size: var(--text-label-md);
  color: var(--color-on-surface-variant);
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.sr-medicine-card__detail-value {
  font-size: var(--text-body-lg);
  color: var(--color-on-surface);
  font-weight: 500;
}

.sr-medicine-card__warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(245, 158, 11, 0.08);
  border-radius: var(--radius-md);
  font-size: var(--text-body-sm);
  color: var(--color-warning, #b45309);
}

.sr-medicine-card__price {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: var(--color-secondary-fixed);
  border-radius: var(--radius-full);
  font-size: var(--text-label-md);
  font-weight: 500;
  color: var(--color-on-surface);
}

.sr-medicine-card__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.sr-medicine-card__actions button {
  flex: 1;
}

@media (max-width: 768px) {
  .sr-medicine-card__details {
    grid-template-columns: 1fr 1fr;
  }

  .sr-medicine-card__actions {
    flex-direction: column;
  }
}
```

**JSX (`MedicineCardRedesign.jsx`):**

```jsx
import { Pill, Building2, Beaker, Tag, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import './MedicineCardRedesign.css'

export default function MedicineCardRedesign({ medicine, onEdit, onDelete, hasDependencies }) {
  return (
    <div className="sr-medicine-card">
      <div className="sr-medicine-card__header">
        <div className="sr-medicine-card__icon">
          <Pill size={20} />
        </div>
        <div>
          <h4 className="sr-medicine-card__name">{medicine.name}</h4>
          {medicine.active_ingredient && (
            <span className="sr-medicine-card__ingredient">{medicine.active_ingredient}</span>
          )}
        </div>
      </div>

      <div className="sr-medicine-card__details">
        {medicine.laboratory && (
          <div className="sr-medicine-card__detail">
            <span className="sr-medicine-card__detail-label">
              <Building2 size={14} /> Laboratório
            </span>
            <span className="sr-medicine-card__detail-value">{medicine.laboratory}</span>
          </div>
        )}
        {medicine.dosage_per_pill && (
          <div className="sr-medicine-card__detail">
            <span className="sr-medicine-card__detail-label">
              <Beaker size={14} /> Dosagem
            </span>
            <span className="sr-medicine-card__detail-value">
              {medicine.dosage_per_pill} {medicine.dosage_unit || 'mg'}
            </span>
          </div>
        )}
        {medicine.type && (
          <div className="sr-medicine-card__detail">
            <span className="sr-medicine-card__detail-label">
              <Tag size={14} /> Tipo
            </span>
            <span className="sr-medicine-card__detail-value">
              {medicine.type === 'suplemento' ? 'Suplemento' : 'Medicamento'}
            </span>
          </div>
        )}
      </div>

      {medicine.avg_price != null && (
        <span className="sr-medicine-card__price">
          R$ {parseFloat(medicine.avg_price).toFixed(2)}
        </span>
      )}

      {hasDependencies && (
        <div className="sr-medicine-card__warning">
          <AlertTriangle size={16} />
          Possui protocolos e/ou estoque associados
        </div>
      )}

      <div className="sr-medicine-card__actions">
        <button className="btn-ghost btn-sm" onClick={() => onEdit(medicine)}>
          <Pencil size={16} /> Editar
        </button>
        <button className="btn-ghost btn-sm btn-danger" onClick={() => onDelete(medicine)}>
          <Trash2 size={16} /> Excluir
        </button>
      </div>
    </div>
  )
}
```

### 12.1.2 — ConfirmDialog

Componente reutilizável de diálogo de confirmação que substitui `window.confirm()` em todo o redesign.

**Props:**
```jsx
function ConfirmDialog({
  isOpen,          // boolean — controla visibilidade
  title,           // string — título do diálogo (ex: "Excluir medicamento")
  message,         // string — corpo descritivo (ex: "Esta ação não pode ser desfeita.")
  confirmLabel,    // string — texto do botão confirmar (default: "Confirmar")
  cancelLabel,     // string — texto do botão cancelar (default: "Cancelar")
  variant,         // 'danger' | 'warning' | 'default' — cor do botão confirmar
  onConfirm,       // function — callback ao confirmar
  onCancel,        // function — callback ao cancelar
})
```

**Layout:**
```
┌─────────────────────────────────┐
│  [AlertTriangle]                │
│  Excluir medicamento?           │  ← título
│                                 │
│  Esta ação não pode ser         │  ← mensagem
│  desfeita.                      │
│                                 │
│  [Cancelar]     [Excluir]       │  ← ações
└─────────────────────────────────┘
```

**Implementação:** Usa `Modal` redesenhado (de W11) internamente.

**JSX (`ConfirmDialog.jsx`):**

```jsx
import { AlertTriangle, Info } from 'lucide-react'
import Modal from '@shared/components/ui/Modal'
import './ConfirmDialog.css'

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null

  const Icon = variant === 'danger' || variant === 'warning' ? AlertTriangle : Info

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className="sr-confirm-dialog">
        <div className={`sr-confirm-dialog__icon sr-confirm-dialog__icon--${variant}`}>
          <Icon size={24} />
        </div>
        <h3 className="sr-confirm-dialog__title">{title}</h3>
        {message && <p className="sr-confirm-dialog__message">{message}</p>}
        <div className="sr-confirm-dialog__actions">
          <button className="btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

**CSS (`ConfirmDialog.css`):**

```css
.sr-confirm-dialog {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem;
  gap: 1rem;
}

.sr-confirm-dialog__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sr-confirm-dialog__icon--danger {
  background: rgba(186, 26, 26, 0.08);
  color: var(--color-error);
}

.sr-confirm-dialog__icon--warning {
  background: rgba(245, 158, 11, 0.08);
  color: var(--color-warning, #b45309);
}

.sr-confirm-dialog__icon--default {
  background: var(--color-secondary-fixed);
  color: var(--color-primary);
}

.sr-confirm-dialog__title {
  font-family: var(--font-heading);
  font-size: var(--text-title-lg);
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0;
}

.sr-confirm-dialog__message {
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0;
  max-width: 320px;
  line-height: 1.5;
}

.sr-confirm-dialog__actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
}

.sr-confirm-dialog__actions button {
  flex: 1;
  min-height: 48px;
  font-size: var(--text-body-lg);
  border-radius: var(--radius-md);
}
```

### Checklist Sprint 12.1

- [ ] `MedicineCardRedesign.jsx` criado com ícones Lucide, sem emojis
- [ ] `MedicineCardRedesign.css` segue NO-LINE RULE (sem borders), ambient shadow
- [ ] `ConfirmDialog.jsx` criado, usa Modal internamente
- [ ] `ConfirmDialog.css` criado, 3 variants (danger, warning, default)
- [ ] Testar MedicineCardRedesign isoladamente (render com dados mock)
- [ ] Testar ConfirmDialog: abrir, cancelar, confirmar
- [ ] ESLint 0 errors nos arquivos novos
- [ ] Não modificou nenhum arquivo existente neste sprint

---

## Sprint 12.2 — MedicinesRedesign View

**Prioridade:** 2ª (depende de 12.1)
**Arquivos criados:**
- `src/views/redesign/MedicinesRedesign.jsx`
- `src/views/redesign/MedicinesRedesign.css`
**Arquivos modificados:**
- `src/App.jsx` — adicionar lazy import + branching `case 'medicines'`

### Escopo

View de medicamentos completa no estilo Santuário. Reutiliza `MedicineCardRedesign` e `MedicineForm` (que W11 já redesenhou via CSS).

**Layout desktop:**
```
┌────────────────────────────────────────────────┐
│  Medicamentos                [+ Adicionar]     │  ← header
│  Gerencie seus medicamentos cadastrados        │
├────────────────────────────────────────────────┤
│  [Todos] [Medicamentos] [Suplementos]          │  ← filter chips
├────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  ← grid 3 colunas
│  │  Card 1  │  │  Card 2  │  │  Card 3  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│  ┌──────────┐  ┌──────────┐                    │
│  │  Card 4  │  │  Card 5  │                    │
│  └──────────┘  └──────────┘                    │
└────────────────────────────────────────────────┘
```

**Layout mobile:** Grid 1 coluna, botão "Adicionar" full-width.

### Diferenças da view original

| Aspecto | Original (`Medicines.jsx`) | Redesign |
|---------|---------------------------|----------|
| Título | Emoji `💊` + gradient neon text | Lucide `Pill` ícone + texto `var(--color-on-surface)` |
| Botão Adicionar | `➕ Adicionar` (Button primary) | Lucide `Plus` + "Adicionar" (`btn-primary` sanctuary gradient) |
| Filter tabs | `<Button variant="primary/outline">` | Chips sanctuary (`.sr-filter-chip`) |
| Cards | `MedicineCard` (glass, neon glow) | `MedicineCardRedesign` (sanctuary, ambient shadow) |
| Success banner | `.success-banner` (neon glow) | `.sr-toast` (sanctuary, ícone `CheckCircle2`, auto-dismiss) |
| Error banner | `.error-banner` (neon glow) | `.sr-error-banner` (sanctuary, surface + error left border) |
| Empty state | `EmptyState` component | `EmptyState` component (já funciona com redesign tokens) |
| Delete confirm | `window.confirm()` | `ConfirmDialog` (sanctuary modal) |
| Post-create confirm | `window.confirm()` para criar protocolo | `ConfirmDialog` com variant `default` |
| Loading | `<Loading>` component | `<Loading>` component (já funciona) |

### Handlers — Lógica preservada, UX modificada

**`handleSave`:**
A lógica original usa `window.confirm()` após criar medicamento para perguntar se quer criar protocolo. No redesign:

```jsx
// Estado para controlar ConfirmDialog de "criar protocolo"
const [showProtocolPrompt, setShowProtocolPrompt] = useState(false)
const [newMedicineId, setNewMedicineId] = useState(null)

const handleSave = async (medicineData) => {
  try {
    if (editingMedicine) {
      await medicineService.update(editingMedicine.id, medicineData)
      showSuccess('Medicamento atualizado com sucesso!')
    } else {
      const newMedicine = await medicineService.create(medicineData)
      showSuccess('Medicamento cadastrado com sucesso!')
      // Ao invés de window.confirm, mostrar ConfirmDialog
      setNewMedicineId(newMedicine.id)
      setShowProtocolPrompt(true)
      return // Não fechar modal ainda — ConfirmDialog vai decidir
    }
    setIsModalOpen(false)
    setEditingMedicine(null)
    await loadMedicines()
  } catch (err) {
    throw new Error('Erro ao salvar medicamento: ' + err.message)
  }
}
```

**`handleDelete`:**
```jsx
// Estado para ConfirmDialog de exclusão
const [deleteTarget, setDeleteTarget] = useState(null)

const handleDeleteRequest = (medicine) => {
  setDeleteTarget(medicine)
}

const handleDeleteConfirm = async () => {
  if (!deleteTarget) return
  try {
    await medicineService.delete(deleteTarget.id)
    showSuccess('Medicamento excluído com sucesso!')
    await loadMedicines()
  } catch (err) {
    setError('Erro ao excluir medicamento: ' + err.message)
  } finally {
    setDeleteTarget(null)
  }
}
```

### CSS (`MedicinesRedesign.css`)

```css
/* ============================================
   MedicinesRedesign — Santuário Terapêutico
   ============================================ */

.sr-medicines {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}

/* Header */
.sr-medicines__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  gap: 1rem;
}

.sr-medicines__title-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sr-medicines__title-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

.sr-medicines__title {
  font-family: var(--font-heading);
  font-size: var(--text-headline-md, 1.75rem);
  font-weight: 700;
  color: var(--color-on-surface);
  margin: 0;
}

.sr-medicines__subtitle {
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0.25rem 0 0;
}

/* Filter Chips */
.sr-medicines__filters {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.sr-filter-chip {
  font-family: var(--font-body);
  font-size: var(--text-body-md);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full, 999px);
  border: 2px solid transparent;
  background: var(--color-surface-container-low);
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
}

.sr-filter-chip:hover {
  background: var(--color-surface-container);
}

.sr-filter-chip--active {
  background: var(--color-primary);
  color: var(--color-on-primary, #ffffff);
  border-color: var(--color-primary);
}

/* Grid */
.sr-medicines__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
  align-items: start;
}

/* Feedback Banners */
.sr-medicines__success {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(16, 185, 129, 0.08);
  border-radius: var(--radius-md);
  color: var(--color-success, #065f46);
  font-size: var(--text-body-md);
  margin-bottom: 1rem;
  animation: sr-fade-in 0.3s ease;
}

.sr-medicines__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(186, 26, 26, 0.06);
  border-left: 4px solid var(--color-error);
  border-radius: var(--radius-md);
  color: var(--color-error);
  font-size: var(--text-body-md);
  margin-bottom: 1rem;
}

@keyframes sr-fade-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Responsive */
@media (max-width: 768px) {
  .sr-medicines {
    padding: 1rem;
  }

  .sr-medicines__header {
    flex-direction: column;
    align-items: stretch;
  }

  .sr-medicines__header .btn-primary {
    width: 100%;
  }

  .sr-medicines__grid {
    grid-template-columns: 1fr;
  }
}
```

### JSX (`MedicinesRedesign.jsx`) — Estrutura completa

```jsx
import { useState, useEffect, useCallback } from 'react'
import { Pill, Plus, CheckCircle2, AlertCircle } from 'lucide-react'
import { medicineService, protocolService, stockService } from '@shared/services'
import Loading from '@shared/components/ui/Loading'
import Modal from '@shared/components/ui/Modal'
import EmptyState from '@shared/components/ui/EmptyState'
import MedicineForm from '@medications/components/MedicineForm'
import MedicineCardRedesign from '@medications/components/redesign/MedicineCardRedesign'
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
import './MedicinesRedesign.css'

export default function MedicinesRedesign({ onNavigateToProtocol }) {
  // 1. States
  const [medicines, setMedicines] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMedicine, setEditingMedicine] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [medicineDependencies, setMedicineDependencies] = useState({})
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showProtocolPrompt, setShowProtocolPrompt] = useState(false)
  const [newMedicineId, setNewMedicineId] = useState(null)

  // 2. Callbacks
  const loadDependencies = useCallback(async (meds) => {
    const deps = {}
    for (const med of meds) {
      const [protocols, stock] = await Promise.all([
        protocolService.getByMedicineId(med.id),
        stockService.getByMedicine(med.id),
      ])
      deps[med.id] = {
        hasProtocols: protocols.length > 0,
        hasStock: stock.length > 0,
      }
    }
    setMedicineDependencies(deps)
  }, [])

  const loadMedicines = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await medicineService.getAll()
      setMedicines(data)
      await loadDependencies(data)
    } catch (err) {
      setError('Erro ao carregar medicamentos: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [loadDependencies])

  // 3. Effects
  useEffect(() => {
    loadMedicines()
  }, [loadMedicines])

  // 4. Handlers
  const showSuccess = (msg) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleAdd = () => {
    setEditingMedicine(null)
    setIsModalOpen(true)
  }

  const handleEdit = (medicine) => {
    setEditingMedicine(medicine)
    setIsModalOpen(true)
  }

  const handleSave = async (medicineData) => {
    try {
      if (editingMedicine) {
        await medicineService.update(editingMedicine.id, medicineData)
        showSuccess('Medicamento atualizado com sucesso!')
      } else {
        const newMedicine = await medicineService.create(medicineData)
        showSuccess('Medicamento cadastrado com sucesso!')
        setNewMedicineId(newMedicine.id)
        setIsModalOpen(false)
        setEditingMedicine(null)
        setShowProtocolPrompt(true)
        await loadMedicines()
        return
      }
      setIsModalOpen(false)
      setEditingMedicine(null)
      await loadMedicines()
    } catch (err) {
      throw new Error('Erro ao salvar medicamento: ' + err.message)
    }
  }

  const handleDeleteRequest = (medicine) => {
    setDeleteTarget(medicine)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await medicineService.delete(deleteTarget.id)
      showSuccess('Medicamento excluído com sucesso!')
      await loadMedicines()
    } catch (err) {
      setError('Erro ao excluir medicamento: ' + err.message)
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleProtocolPromptConfirm = () => {
    setShowProtocolPrompt(false)
    if (onNavigateToProtocol && newMedicineId) {
      onNavigateToProtocol(newMedicineId)
    }
    setNewMedicineId(null)
  }

  const handleProtocolPromptCancel = () => {
    setShowProtocolPrompt(false)
    setNewMedicineId(null)
  }

  // 5. Derived
  const filteredMedicines = medicines.filter(
    (m) => filterType === 'all' || m.type === filterType
  )

  if (isLoading) {
    return (
      <div className="sr-medicines">
        <Loading text="Carregando medicamentos..." />
      </div>
    )
  }

  return (
    <div className="sr-medicines">
      {/* Header */}
      <div className="sr-medicines__header">
        <div>
          <div className="sr-medicines__title-group">
            <div className="sr-medicines__title-icon">
              <Pill size={22} />
            </div>
            <h2 className="sr-medicines__title">Medicamentos</h2>
          </div>
          <p className="sr-medicines__subtitle">
            Gerencie seus medicamentos cadastrados
          </p>
        </div>
        <button className="btn-primary" onClick={handleAdd}>
          <Plus size={18} /> Adicionar
        </button>
      </div>

      {/* Filter Chips */}
      <div className="sr-medicines__filters">
        {[
          { key: 'all', label: 'Todos' },
          { key: 'medicamento', label: 'Medicamentos' },
          { key: 'suplemento', label: 'Suplementos' },
        ].map(({ key, label }) => (
          <button
            key={key}
            className={`sr-filter-chip ${filterType === key ? 'sr-filter-chip--active' : ''}`}
            onClick={() => setFilterType(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {successMessage && (
        <div className="sr-medicines__success">
          <CheckCircle2 size={18} /> {successMessage}
        </div>
      )}
      {error && (
        <div className="sr-medicines__error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Content */}
      {medicines.length === 0 ? (
        <EmptyState
          illustration="protocols"
          title="Nenhum medicamento cadastrado"
          description="Cadastre seus medicamentos para começar a controlar sua saúde"
          ctaLabel="Cadastrar Medicamento"
          onCtaClick={handleAdd}
        />
      ) : (
        <div className="sr-medicines__grid">
          {filteredMedicines.map((medicine) => (
            <MedicineCardRedesign
              key={medicine.id}
              medicine={medicine}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              hasDependencies={
                medicineDependencies[medicine.id]?.hasProtocols ||
                medicineDependencies[medicine.id]?.hasStock
              }
            />
          ))}
        </div>
      )}

      {/* Modal de Edição/Criação */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingMedicine(null)
        }}
      >
        <MedicineForm
          medicine={editingMedicine}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingMedicine(null)
          }}
        />
      </Modal>

      {/* ConfirmDialog: Exclusão */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Excluir "${deleteTarget?.name}"?`}
        message={
          medicineDependencies[deleteTarget?.id]?.hasProtocols ||
          medicineDependencies[deleteTarget?.id]?.hasStock
            ? 'Este medicamento possui protocolos e/ou estoque associados. Esta ação não pode ser desfeita.'
            : 'Esta ação não pode ser desfeita.'
        }
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ConfirmDialog: Criar protocolo */}
      <ConfirmDialog
        isOpen={showProtocolPrompt}
        title="Medicamento criado!"
        message="Deseja criar um protocolo de uso para ele agora?"
        confirmLabel="Criar Protocolo"
        cancelLabel="Depois"
        variant="default"
        onConfirm={handleProtocolPromptConfirm}
        onCancel={handleProtocolPromptCancel}
      />
    </div>
  )
}
```

### Modificações no App.jsx

**Adicionar lazy import (junto com os outros redesign imports):**
```jsx
const MedicinesRedesign = lazy(() => import('./views/redesign/MedicinesRedesign'))
```

**Alterar `case 'medicines'` (linhas ~149-154):**

De:
```jsx
case 'medicines':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <Medicines onNavigateToProtocol={navigateToProtocol} />
    </Suspense>
  )
```

Para:
```jsx
case 'medicines':
  return isRedesignEnabled ? (
    <Suspense fallback={<ViewSkeleton />}>
      <MedicinesRedesign onNavigateToProtocol={navigateToProtocol} />
    </Suspense>
  ) : (
    <Suspense fallback={<ViewSkeleton />}>
      <Medicines onNavigateToProtocol={navigateToProtocol} />
    </Suspense>
  )
```

### Checklist Sprint 12.2

- [ ] `MedicinesRedesign.jsx` criado em `src/views/redesign/`
- [ ] `MedicinesRedesign.css` criado em `src/views/redesign/`
- [ ] App.jsx: lazy import adicionado
- [ ] App.jsx: `case 'medicines'` com branching `isRedesignEnabled`
- [ ] Zero `window.confirm()` — todas confirmações via `ConfirmDialog`
- [ ] Zero emojis no JSX — todos substituídos por Lucide icons
- [ ] Filter chips com visual sanctuary (`.sr-filter-chip`)
- [ ] Grid responsivo: 3 colunas desktop, 1 coluna mobile
- [ ] Testar: criar medicamento → ConfirmDialog "criar protocolo?" → navega para protocols
- [ ] Testar: excluir medicamento com dependências → ConfirmDialog warning → confirma → exclui
- [ ] Testar: excluir medicamento sem dependências → ConfirmDialog simples → confirma → exclui
- [ ] Testar: filtro por tipo (todos/medicamentos/suplementos)
- [ ] Testar: editar medicamento → Modal com MedicineForm → salva → atualiza lista
- [ ] Empty state exibido quando não há medicamentos
- [ ] Success/error banners aparecem e desaparecem corretamente
- [ ] ESLint 0 errors
- [ ] `npm run validate:agent` passa

---

## Sprint 12.3 — ConsultationViewRedesign (Presenter)

**Prioridade:** 3ª (independente de 12.1-12.2, mas logicamente após)
**Arquivos criados:**
- `src/features/consultation/components/redesign/ConsultationViewRedesign.jsx`
- `src/features/consultation/components/redesign/ConsultationViewRedesign.css`

### Escopo

Reescrita visual do presenter `ConsultationView.jsx`. A lógica de dados (container `Consultation.jsx`) NÃO muda. Apenas a apresentação.

**Props (idênticas ao original):**
```jsx
function ConsultationViewRedesign({ data, onGeneratePDF, onShare, onBack })
```

### Mudanças visuais

| Elemento | Original | Redesign Santuário |
|----------|----------|--------------------|
| Header bg | Purple gradient `#667eea → #764ba2` | Verde Saúde gradient `var(--color-primary) → var(--color-primary-container)` (135deg) |
| Header text | Branco | `var(--color-on-primary)` (branco) |
| Back button | `← Voltar` (texto) | `arrow-left` (Lucide) + "Voltar" |
| Section titles | Emoji + texto (💊, 📊, etc.) | Lucide icons + texto |
| Section bg | White + border | `var(--color-surface-container-lowest)` + ambient shadow (NO borders) |
| Table | Custom styles com borders | Sanctuary table: no borders, alternating row bg, large font |
| Adherence bars | Hardcoded colors | Tokens: `var(--color-success)`, `var(--color-warning)`, `var(--color-error)` |
| Progress bars | Purple gradient | Primary gradient `var(--color-primary) → var(--color-primary-container)` |
| Status badges | Hardcoded bg colors | Sanctuary semantic tokens |
| Footer | White + border-top + shadow | `var(--color-surface)` + glassmorphism backdrop-blur |
| Footer buttons | `.action-button.primary` (purple) | `btn-primary` + `btn-outline` (sanctuary) |
| Typography | Local `--cv-*` vars | Design system tokens `var(--text-*)`, `var(--font-*)` |
| Motion | framer-motion | framer-motion (mantém — useMotion hook) |

### Layout desktop (≥1024px)

```
┌──────────────────────────────────────────────────┐
│  [←]  Nome do Paciente           Gerado: dd/mm   │  ← header Verde Saúde
├──────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐   │
│  │  Medicamentos Ativos (tabela full-width)  │   │  ← section 1 (full row)
│  └───────────────────────────────────────────┘   │
│  ┌──────────────┐ ┌──────────────┐               │
│  │ Adesão 30d   │ │ Adesão 90d   │               │  ← section 2 (2 cards)
│  └──────────────┘ └──────────────┘               │
│  ┌──────────────┐ ┌──────────────┐               │
│  │ Alertas      │ │ Prescrições  │               │  ← sections 3-4
│  └──────────────┘ └──────────────┘               │
│  ┌───────────────────────────────────────────┐   │
│  │  Titulação (full-width)                   │   │  ← section 5
│  └───────────────────────────────────────────┘   │
├──────────────────────────────────────────────────┤
│  [Gerar PDF]                    [Compartilhar]   │  ← footer fixo
└──────────────────────────────────────────────────┘
```

### Ícones Lucide (substituem emojis)

| Original | Lucide | Contexto |
|----------|--------|----------|
| 💊 | `pill` | Medicamentos Ativos |
| 📊 | `chart-bar` | Aderência ao Tratamento |
| 📦 | `package` | Alertas de Estoque |
| 📝 | `clipboard-list` | Status das Prescrições |
| 🎯 | `crosshair` | Progresso de Titulação |
| ⚠️ (stock critical) | `triangle-alert` | Alerta crítico |
| ⚡ (stock warning) | `circle-alert` | Alerta warning |
| ❌ (vencida) | `circle-x` | Prescrição vencida |
| ⚠️ (vencendo) | `triangle-alert` | Prescrição vencendo |
| ✅ (vigente) | `circle-check` | Prescrição vigente |
| 🔔 (transição) | `bell` | Transição pendente |
| 📄 | `file-text` | Gerar PDF |
| ↗️ | `share-2` | Compartilhar |
| ← | `arrow-left` | Voltar |

### CSS (`ConsultationViewRedesign.css`)

```css
/* ============================================
   ConsultationViewRedesign — Santuário Terapêutico
   ============================================ */

.sr-consultation {
  min-height: 100vh;
  background: var(--color-surface);
  color: var(--color-on-surface);
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  line-height: 1.6;
  padding-bottom: calc(80px + 64px + env(safe-area-inset-bottom, 0px) + 0.75rem);
}

/* Header */
.sr-consultation__header {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container));
  color: var(--color-on-primary, #ffffff);
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 106, 94, 0.12);
}

.sr-consultation__header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  max-width: 1200px;
  margin: 0 auto;
}

.sr-consultation__patient-name {
  font-family: var(--font-heading);
  font-size: var(--text-display-sm, 1.875rem);
  font-weight: 700;
  margin: 0;
  line-height: 1.2;
}

.sr-consultation__patient-age {
  display: inline-block;
  margin-top: 0.25rem;
  font-size: var(--text-title-md);
  opacity: 0.9;
}

.sr-consultation__gen-info {
  text-align: right;
  font-size: var(--text-body-md);
}

.sr-consultation__gen-label {
  display: block;
  opacity: 0.8;
  font-size: var(--text-body-sm);
}

.sr-consultation__gen-time {
  font-weight: 500;
}

.sr-consultation__back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--text-body-lg);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.sr-consultation__back-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Content */
.sr-consultation__content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Sections */
.sr-consultation__section {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(25, 28, 29, 0.04);
}

.sr-consultation__section-title {
  font-family: var(--font-heading);
  font-size: var(--text-title-lg);
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sr-consultation__section-title svg {
  color: var(--color-primary);
}

.sr-consultation__empty {
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  text-align: center;
  padding: 1.5rem;
  font-style: italic;
}

/* Table */
.sr-consultation__table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.sr-consultation__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-body-lg);
}

.sr-consultation__table thead {
  background: var(--color-surface-container-low);
}

.sr-consultation__table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: var(--color-on-surface);
  font-size: var(--text-body-md);
}

.sr-consultation__table td {
  padding: 0.75rem 1rem;
}

.sr-consultation__table tbody tr:nth-child(even) {
  background: var(--color-surface-container-low);
}

.sr-consultation__med-name {
  font-weight: 600;
  color: var(--color-on-surface);
}

.sr-consultation__dosage-detail {
  font-size: var(--text-body-md);
  color: var(--color-on-surface-variant);
}

.sr-consultation__dosage-unknown {
  color: var(--color-on-surface-variant);
  font-style: italic;
}

/* Adherence Grid */
.sr-consultation__adherence-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.sr-adherence-card {
  background: var(--color-surface-container-low);
  border-radius: var(--radius-md);
  padding: 1.25rem;
}

.sr-adherence-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.sr-adherence-card__period {
  font-size: var(--text-title-md);
  font-weight: 600;
  color: var(--color-on-surface-variant);
}

.sr-adherence-card__score {
  font-family: var(--font-heading);
  font-size: var(--text-headline-sm, 1.5rem);
  font-weight: 700;
}

.sr-adherence-card__bar {
  height: 20px;
  background: var(--color-surface-container);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.sr-adherence-card__bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 0.8s ease-out;
}

.sr-adherence-card__details {
  display: flex;
  gap: 1.5rem;
}

.sr-adherence-card__detail-value {
  font-size: var(--text-title-md);
  font-weight: 700;
  color: var(--color-on-surface);
}

.sr-adherence-card__detail-label {
  font-size: var(--text-body-sm);
  color: var(--color-on-surface-variant);
}

/* Stock Alerts */
.sr-consultation__alerts {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr-stock-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  border-left: 4px solid;
}

.sr-stock-alert--critical {
  background: rgba(186, 26, 26, 0.06);
  border-left-color: var(--color-error);
}

.sr-stock-alert--warning {
  background: rgba(245, 158, 11, 0.06);
  border-left-color: var(--color-warning, #b45309);
}

.sr-stock-alert__icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.sr-stock-alert--critical .sr-stock-alert__icon {
  color: var(--color-error);
}

.sr-stock-alert--warning .sr-stock-alert__icon {
  color: var(--color-warning, #b45309);
}

.sr-stock-alert__name {
  font-weight: 600;
  font-size: var(--text-body-lg);
}

.sr-stock-alert__message {
  color: var(--color-on-surface-variant);
}

.sr-stock-alert__days {
  font-size: var(--text-body-sm);
  color: var(--color-on-surface-variant);
  font-style: italic;
}

/* Prescriptions */
.sr-consultation__prescriptions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sr-prescription {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-container-low);
  border-radius: var(--radius-md);
  flex-wrap: wrap;
}

.sr-prescription__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: var(--text-label-md);
  font-weight: 600;
  white-space: nowrap;
}

.sr-prescription__badge--vigente {
  background: rgba(16, 185, 129, 0.1);
  color: #065f46;
}

.sr-prescription__badge--vencendo {
  background: rgba(245, 158, 11, 0.1);
  color: #92400e;
}

.sr-prescription__badge--vencida {
  background: rgba(186, 26, 26, 0.08);
  color: #991b1b;
}

.sr-prescription__name {
  flex: 1;
  font-size: var(--text-body-lg);
  font-weight: 500;
  min-width: 150px;
}

.sr-prescription__days {
  font-size: var(--text-body-md);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
}

/* Titration */
.sr-consultation__titrations {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sr-titration-card {
  background: var(--color-surface-container-low);
  border-radius: var(--radius-md);
  padding: 1.25rem;
}

.sr-titration-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.sr-titration-card__name {
  font-weight: 600;
  font-size: var(--text-body-lg);
}

.sr-titration-card__dosage {
  font-size: var(--text-body-lg);
  font-weight: 600;
  color: var(--color-primary);
  background: var(--color-surface-container-lowest);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
}

.sr-titration-card__progress-bar {
  height: 16px;
  background: var(--color-surface-container);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 0.375rem;
}

.sr-titration-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-container));
  border-radius: var(--radius-full);
  transition: width 1s ease-out;
}

.sr-titration-card__progress-text {
  font-size: var(--text-body-md);
  color: var(--color-on-surface-variant);
  font-weight: 500;
}

.sr-titration-card__note {
  font-size: var(--text-body-md);
  color: var(--color-on-surface-variant);
  font-style: italic;
  margin: 0.5rem 0;
}

.sr-titration-card__transition {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  background: rgba(245, 158, 11, 0.1);
  color: #92400e;
  border-radius: var(--radius-full);
  font-size: var(--text-label-md);
  font-weight: 600;
  margin-top: 0.5rem;
}

/* Footer */
.sr-consultation__footer {
  position: fixed;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 0.75rem);
  left: 0;
  right: 0;
  height: 80px;
  background: rgba(248, 250, 251, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(25, 28, 29, 0.06);
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  z-index: 100;
}

.sr-consultation__footer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  font-weight: 600;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 160px;
}

.sr-consultation__footer-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sr-consultation__footer-btn--primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-container));
  color: var(--color-on-primary, #ffffff);
  box-shadow: 0 2px 8px rgba(0, 106, 94, 0.2);
}

.sr-consultation__footer-btn--primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(0, 106, 94, 0.3);
  transform: translateY(-1px);
}

.sr-consultation__footer-btn--secondary {
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
  border: 2px solid var(--color-surface-container);
}

.sr-consultation__footer-btn--secondary:hover:not(:disabled) {
  background: var(--color-surface-container-low);
}

.sr-consultation__footer-btn:active:not(:disabled) {
  transform: scale(0.98);
}

/* Responsive: Landscape/Desktop */
@media (min-width: 768px) and (orientation: landscape) {
  .sr-consultation {
    font-size: calc(var(--text-body-lg) + 1px);
  }

  .sr-consultation__content {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    align-items: start;
  }

  .sr-consultation__section--full {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1024px) {
  .sr-consultation__patient-name {
    font-size: var(--text-display-md, 2.25rem);
  }

  .sr-consultation__content {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Print */
@media print {
  .sr-consultation {
    padding-bottom: 0;
  }

  .sr-consultation__header {
    background: #e8f5f3 !important;
    color: #191c1d !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .sr-consultation__back-btn,
  .sr-consultation__footer {
    display: none !important;
  }

  .sr-consultation__section {
    break-inside: avoid;
    page-break-inside: avoid;
    box-shadow: none;
    border: 1px solid #ccc;
  }

  .sr-adherence-card__bar-fill,
  .sr-titration-card__progress-fill {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .sr-consultation,
  .sr-consultation * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

@media (prefers-contrast: high) {
  .sr-consultation__section {
    border: 3px solid var(--color-on-surface);
  }

  .sr-prescription__badge,
  .sr-titration-card__dosage,
  .sr-titration-card__transition {
    border: 2px solid currentColor;
  }
}
```

### JSX (`ConsultationViewRedesign.jsx`) — Estrutura

```jsx
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Pill, BarChart3, Package, ClipboardList, Target,
  AlertTriangle, AlertCircle, XCircle, CheckCircle2, Bell,
  FileText, Share2
} from 'lucide-react'
import './ConsultationViewRedesign.css'

export default function ConsultationViewRedesign({ data, onGeneratePDF, onShare, onBack }) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const {
    patientInfo, activeMedicines, adherenceSummary,
    stockAlerts, prescriptionStatus, activeTitrations, generatedAt,
  } = useMemo(() => data || {}, [data])

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true)
    try { await onGeneratePDF?.() } finally { setIsGeneratingPDF(false) }
  }

  const handleShare = async () => {
    setIsSharing(true)
    try { await onShare?.() } finally { setIsSharing(false) }
  }

  const formattedGeneratedAt = useMemo(() => {
    if (!generatedAt) return ''
    return new Date(generatedAt).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }, [generatedAt])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  }
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--color-success, #10b981)'
    if (score >= 60) return 'var(--color-warning, #f59e0b)'
    if (score >= 40) return '#f97316'
    return 'var(--color-error, #ef4444)'
  }

  return (
    <motion.div className="sr-consultation" initial="hidden" animate="visible" variants={containerVariants}>
      {/* Header */}
      <motion.header className="sr-consultation__header" variants={itemVariants}>
        <div className="sr-consultation__header-content">
          <div>
            <h1 className="sr-consultation__patient-name">
              {patientInfo?.name || 'Paciente'}
            </h1>
            {patientInfo?.age && (
              <span className="sr-consultation__patient-age">{patientInfo.age} anos</span>
            )}
          </div>
          <div className="sr-consultation__gen-info">
            <span className="sr-consultation__gen-label">Gerado em:</span>
            <span className="sr-consultation__gen-time">{formattedGeneratedAt}</span>
          </div>
        </div>
        {onBack && (
          <button className="sr-consultation__back-btn" onClick={onBack} type="button">
            <ArrowLeft size={18} /> Voltar
          </button>
        )}
      </motion.header>

      <main className="sr-consultation__content">
        {/* Medicamentos Ativos */}
        <motion.section className="sr-consultation__section sr-consultation__section--full" variants={itemVariants}>
          <h2 className="sr-consultation__section-title"><Pill size={20} /> Medicamentos Ativos</h2>
          {activeMedicines?.length > 0 ? (
            <div className="sr-consultation__table-wrap">
              <table className="sr-consultation__table">
                <thead>
                  <tr><th>Nome</th><th>Dosagem</th><th>Tipo</th></tr>
                </thead>
                <tbody>
                  {activeMedicines.map((med) => (
                    <tr key={med.id}>
                      <td className="sr-consultation__med-name">{med.name}</td>
                      <td>
                        {med.dosagePerIntake && med.timesPerDay ? (
                          <span>
                            {med.dosagePerIntake}{med.dosageUnit}
                            <span className="sr-consultation__dosage-detail">
                              {' '}({med.timesPerDay}x ao dia
                              {med.dailyDosage ? `, ${med.dailyDosage}${med.dosageUnit}/dia` : ''})
                            </span>
                          </span>
                        ) : med.dosagePerPill ? (
                          <span>{med.dosagePerPill}{med.dosageUnit}</span>
                        ) : (
                          <span className="sr-consultation__dosage-unknown">Não informado</span>
                        )}
                      </td>
                      <td>{med.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sr-consultation__empty">Nenhum medicamento ativo</p>
          )}
        </motion.section>

        {/* Aderência */}
        <motion.section className="sr-consultation__section" variants={itemVariants}>
          <h2 className="sr-consultation__section-title"><BarChart3 size={20} /> Aderência ao Tratamento</h2>
          <div className="sr-consultation__adherence-grid">
            {['last30d', 'last90d'].map((key) => {
              const d = adherenceSummary?.[key]
              const score = d?.score || 0
              return (
                <div key={key} className="sr-adherence-card">
                  <div className="sr-adherence-card__header">
                    <span className="sr-adherence-card__period">
                      Últimos {key === 'last30d' ? '30 dias' : '90 dias'}
                    </span>
                    <span className="sr-adherence-card__score" style={{ color: getScoreColor(score) }}>
                      {score}%
                    </span>
                  </div>
                  <div className="sr-adherence-card__bar">
                    <motion.div
                      className="sr-adherence-card__bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      style={{ backgroundColor: getScoreColor(score) }}
                    />
                  </div>
                  <div className="sr-adherence-card__details">
                    <div>
                      <span className="sr-adherence-card__detail-value">{d?.taken || 0}/{d?.expected || 0}</span>
                      <span className="sr-adherence-card__detail-label"> doses tomadas</span>
                    </div>
                    {(d?.punctuality || 0) > 0 && (
                      <div>
                        <span className="sr-adherence-card__detail-value">{d.punctuality}%</span>
                        <span className="sr-adherence-card__detail-label"> pontualidade</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.section>

        {/* Alertas de Estoque */}
        <motion.section className="sr-consultation__section" variants={itemVariants}>
          <h2 className="sr-consultation__section-title"><Package size={20} /> Alertas de Estoque</h2>
          {stockAlerts?.length > 0 ? (
            <div className="sr-consultation__alerts">
              {stockAlerts.map((alert) => (
                <div key={alert.medicineId} className={`sr-stock-alert sr-stock-alert--${alert.severity}`}>
                  <span className="sr-stock-alert__icon">
                    {alert.severity === 'critical' ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
                  </span>
                  <div>
                    <strong className="sr-stock-alert__name">{alert.medicineName}</strong>
                    <span className="sr-stock-alert__message"> — {alert.message}</span>
                    {alert.daysRemaining > 0 && (
                      <div className="sr-stock-alert__days">~{alert.daysRemaining} dias restantes</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="sr-consultation__empty">Estoque em dia</p>
          )}
        </motion.section>

        {/* Status de Prescrições */}
        <motion.section className="sr-consultation__section" variants={itemVariants}>
          <h2 className="sr-consultation__section-title"><ClipboardList size={20} /> Status das Prescrições</h2>
          {prescriptionStatus?.length > 0 ? (
            <div className="sr-consultation__prescriptions">
              {prescriptionStatus.map((rx) => {
                const BadgeIcon = rx.status === 'vencida' ? XCircle
                  : rx.status === 'vencendo' ? AlertTriangle : CheckCircle2
                return (
                  <div key={rx.protocolId} className="sr-prescription">
                    <span className={`sr-prescription__badge sr-prescription__badge--${rx.status}`}>
                      <BadgeIcon size={14} />
                      {rx.status === 'vigente' ? 'Vigente' : rx.status === 'vencendo' ? 'Vencendo' : 'Vencida'}
                    </span>
                    <span className="sr-prescription__name">{rx.medicineName}</span>
                    {rx.daysRemaining !== undefined && (
                      <span className="sr-prescription__days">
                        {rx.daysRemaining > 0 ? `${rx.daysRemaining} dias` : 'Hoje'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="sr-consultation__empty">Todas as prescrições em dia</p>
          )}
        </motion.section>

        {/* Titulação */}
        <motion.section className="sr-consultation__section sr-consultation__section--full" variants={itemVariants}>
          <h2 className="sr-consultation__section-title"><Target size={20} /> Progresso de Titulação</h2>
          {activeTitrations?.length > 0 ? (
            <div className="sr-consultation__titrations">
              {activeTitrations.map((t) => (
                <div key={t.protocolId} className="sr-titration-card">
                  <div className="sr-titration-card__header">
                    <strong className="sr-titration-card__name">{t.medicineName}</strong>
                    <span className="sr-titration-card__dosage">{t.currentDosage}mg</span>
                  </div>
                  <div className="sr-titration-card__progress-bar">
                    <motion.div
                      className="sr-titration-card__progress-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${t.progressPercent}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="sr-titration-card__progress-text">
                    {t.progressPercent}% — Etapa {t.currentStep}/{t.totalSteps}
                  </span>
                  {t.stageNote && <p className="sr-titration-card__note">{t.stageNote}</p>}
                  {t.isTransitionDue && (
                    <span className="sr-titration-card__transition">
                      <Bell size={14} /> Transição pendente
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="sr-consultation__empty">Nenhuma titulação ativa</p>
          )}
        </motion.section>
      </main>

      {/* Footer */}
      <motion.footer
        className="sr-consultation__footer"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 300 }}
      >
        <button
          className="sr-consultation__footer-btn sr-consultation__footer-btn--secondary"
          onClick={handleGeneratePDF}
          disabled={isGeneratingPDF}
          type="button"
        >
          <FileText size={18} />
          {isGeneratingPDF ? 'Gerando...' : 'Gerar PDF'}
        </button>
        <button
          className="sr-consultation__footer-btn sr-consultation__footer-btn--primary"
          onClick={handleShare}
          disabled={isSharing}
          type="button"
        >
          <Share2 size={18} />
          {isSharing ? 'Enviando...' : 'Compartilhar'}
        </button>
      </motion.footer>
    </motion.div>
  )
}
```

### Checklist Sprint 12.3

- [ ] `ConsultationViewRedesign.jsx` criado em `src/features/consultation/components/redesign/`
- [ ] `ConsultationViewRedesign.css` criado no mesmo diretório
- [ ] Zero emojis — todos substituídos por Lucide icons
- [ ] Header Verde Saúde gradient (não purple)
- [ ] Footer com glassmorphism (backdrop-blur)
- [ ] Progress bars com primary gradient (não purple)
- [ ] Tokens do design system (não variáveis locais `--cv-*`)
- [ ] `@media print`: header legível, footer oculto, sections com break-inside
- [ ] `@media (prefers-reduced-motion)`: animações desabilitadas
- [ ] `@media (prefers-contrast: high)`: borders visíveis
- [ ] Landscape: grid 2 colunas
- [ ] Desktop 1024px+: grid 2 colunas com sections full-width
- [ ] Não modificou nenhum arquivo existente neste sprint
- [ ] ESLint 0 errors

---

## Sprint 12.4 — ConsultationRedesign Container + App.jsx Integration

**Prioridade:** 4ª (depende de 12.3)
**Arquivos criados:**
- `src/views/redesign/ConsultationRedesign.jsx`
**Arquivos modificados:**
- `src/App.jsx` — lazy import + branching `case 'consultation'`

### Escopo

Container mínimo que reutiliza 100% da lógica do `Consultation.jsx` original, mas renderiza `ConsultationViewRedesign` ao invés de `ConsultationView`.

**ATENÇÃO: NÃO copiar-colar toda a lógica.** O container deve ser um wrapper fino que importa e reutiliza:
- `useDashboard()` — hook existente
- `getConsultationData()` — service existente
- `generateConsultationPDF()` — service existente
- `shareService` — service existente
- `analyticsService` — service existente
- `cachedAdherenceService` — service existente

### JSX (`ConsultationRedesign.jsx`)

```jsx
/**
 * ConsultationRedesign — Container view do Modo Consulta (Santuário Terapêutico).
 * Reutiliza 100% da lógica de dados do Consultation.jsx original.
 * Apenas o presenter muda (ConsultationViewRedesign).
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { getCurrentUser } from '@shared/utils/supabase'
import { cachedAdherenceService } from '@shared/services/cachedServices'
import { getConsultationData } from '@features/consultation/services/consultationDataService'
import ConsultationViewRedesign from '@features/consultation/components/redesign/ConsultationViewRedesign'
import Loading from '@shared/components/ui/Loading'
import { analyticsService } from '@dashboard/services/analyticsService'
import { generateConsultationPDF } from '@features/reports/services/consultationPdfService'
import { shareService } from '@features/reports/services/shareService'
import { formatLocalDate } from '@utils/dateUtils.js'

export default function ConsultationRedesign({ onBack }) {
  const [isLoading, setIsLoading] = useState(true)
  const [consultationData, setConsultationData] = useState(null)
  const [error, setError] = useState(null)

  const { medicines, protocols, logs, stockSummary, stats, dailyAdherence } = useDashboard()

  const dashboardData = useMemo(
    () => ({ medicines, protocols, logs, stockSummary, stats, dailyAdherence }),
    [medicines, protocols, logs, stockSummary, stats, dailyAdherence]
  )

  useEffect(() => {
    let isMounted = true

    const loadConsultationData = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const user = await getCurrentUser()
        const resolvedName = user?.user_metadata?.name || user?.user_metadata?.full_name || ''
        const resolvedEmail = user?.email || ''
        if (!isMounted) return
        if (!dashboardData.medicines || !dashboardData.protocols) {
          if (isMounted) { setConsultationData(null); setIsLoading(false) }
          return
        }
        const data = getConsultationData(dashboardData, resolvedName, null, resolvedEmail)
        setConsultationData(data)
      } catch (err) {
        if (!isMounted) return
        setError('Não foi possível carregar os dados para consulta.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadConsultationData()
    return () => { isMounted = false }
  }, [dashboardData])

  const handleGeneratePDF = useCallback(async () => {
    try {
      analyticsService.track('consultation_pdf_generated', { timestamp: Date.now() })
      const resolvedDailyAdherence = await cachedAdherenceService.getDailyAdherenceFromView(30)
      const pdfBlob = await generateConsultationPDF({
        consultationData,
        dashboardData: { ...dashboardData, dailyAdherence: resolvedDailyAdherence },
        period: '30d',
      })
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `consulta-medica-${formatLocalDate(new Date())}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Tente novamente.')
    }
  }, [consultationData, dashboardData])

  const handleShare = useCallback(async () => {
    try {
      analyticsService.track('consultation_share_initiated', { timestamp: Date.now() })
      const resolvedDailyAdherence = await cachedAdherenceService.getDailyAdherenceFromView(30)
      const pdfBlob = await generateConsultationPDF({
        consultationData,
        dashboardData: { ...dashboardData, dailyAdherence: resolvedDailyAdherence },
        period: '30d',
      })
      if (navigator.share && navigator.canShare) {
        const file = new File([pdfBlob], `consulta-medica-${formatLocalDate(new Date())}.pdf`, { type: 'application/pdf' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Dados da Consulta Médica',
            text: 'Relatório de tratamento e adesão aos medicamentos',
            files: [file],
          })
          analyticsService.track('consultation_shared', { method: 'web_share_api' })
          return
        }
      }
      const { url: shareUrl } = await shareService.shareReport(pdfBlob, {
        filename: `consulta-medica-${formatLocalDate(new Date())}.pdf`,
      })
      await navigator.clipboard.writeText(shareUrl)
      alert('Link de compartilhamento copiado para a área de transferência!')
      analyticsService.track('consultation_shared', { method: 'link' })
    } catch (err) {
      if (err.name !== 'AbortError') alert('Erro ao compartilhar. Tente novamente.')
    }
  }, [consultationData, dashboardData])

  const handleBack = useCallback(() => {
    analyticsService.track('consultation_mode_closed', { timestamp: Date.now() })
    onBack?.()
  }, [onBack])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1.5rem' }}>
        <Loading text="Carregando dados da consulta..." />
      </div>
    )
  }

  if (error || !consultationData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1.5rem', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '0.75rem', color: 'var(--color-on-surface)' }}>
          {error ? 'Erro ao carregar' : 'Nenhum dado disponível'}
        </h2>
        <p style={{ color: 'var(--color-on-surface-variant)', marginBottom: '1.5rem' }}>
          {error || 'Cadastre medicamentos e protocolos para visualizar dados na consulta.'}
        </p>
        <button className="btn-primary" onClick={handleBack}>Voltar</button>
      </div>
    )
  }

  return (
    <ConsultationViewRedesign
      data={consultationData}
      onGeneratePDF={handleGeneratePDF}
      onShare={handleShare}
      onBack={handleBack}
    />
  )
}
```

### Modificações no App.jsx

**Adicionar lazy import:**
```jsx
const ConsultationRedesign = lazy(() => import('./views/redesign/ConsultationRedesign'))
```

**Alterar `case 'consultation'` (linhas ~233-238):**

De:
```jsx
case 'consultation':
  return (
    <Suspense fallback={<ViewSkeleton />}>
      <Consultation onBack={() => setCurrentView('profile')} />
    </Suspense>
  )
```

Para:
```jsx
case 'consultation':
  return isRedesignEnabled ? (
    <Suspense fallback={<ViewSkeleton />}>
      <ConsultationRedesign onBack={() => setCurrentView('profile')} />
    </Suspense>
  ) : (
    <Suspense fallback={<ViewSkeleton />}>
      <Consultation onBack={() => setCurrentView('profile')} />
    </Suspense>
  )
```

### Checklist Sprint 12.4

- [ ] `ConsultationRedesign.jsx` criado em `src/views/redesign/`
- [ ] App.jsx: lazy import `ConsultationRedesign` adicionado
- [ ] App.jsx: `case 'consultation'` com branching `isRedesignEnabled`
- [ ] Lógica de dados 100% preservada do `Consultation.jsx` original
- [ ] Renderiza `ConsultationViewRedesign` (não `ConsultationView`)
- [ ] Testar: navegar para consulta → header Verde Saúde visível
- [ ] Testar: gerar PDF → download funciona
- [ ] Testar: compartilhar → Web Share API ou clipboard fallback
- [ ] Testar: voltar → navega para profile
- [ ] Testar: loading state → Loading component exibido
- [ ] Testar: sem dados → empty state com botão "Voltar"
- [ ] Testar: error state → mensagem de erro com botão "Voltar"
- [ ] **Testar toggle redesign OFF → Consultation.jsx original renderiza (regression check)**
- [ ] `npm run validate:agent` passa
- [ ] ESLint 0 errors

---

## Resumo de Arquivos

### Arquivos CRIADOS (6)

| Arquivo | Sprint | Linhas (est.) |
|---------|--------|--------------|
| `src/features/medications/components/redesign/MedicineCardRedesign.jsx` | 12.1 | ~70 |
| `src/features/medications/components/redesign/MedicineCardRedesign.css` | 12.1 | ~90 |
| `src/shared/components/ui/ConfirmDialog.jsx` | 12.1 | ~40 |
| `src/shared/components/ui/ConfirmDialog.css` | 12.1 | ~55 |
| `src/views/redesign/MedicinesRedesign.jsx` | 12.2 | ~200 |
| `src/views/redesign/MedicinesRedesign.css` | 12.2 | ~120 |
| `src/features/consultation/components/redesign/ConsultationViewRedesign.jsx` | 12.3 | ~220 |
| `src/features/consultation/components/redesign/ConsultationViewRedesign.css` | 12.3 | ~350 |
| `src/views/redesign/ConsultationRedesign.jsx` | 12.4 | ~130 |

### Arquivos MODIFICADOS (1)

| Arquivo | Sprint | Mudança |
|---------|--------|---------|
| `src/App.jsx` | 12.2 + 12.4 | 2 lazy imports + 2 case branches (`medicines`, `consultation`) |

### Arquivos NUNCA TOCADOS

- `src/views/Medicines.jsx` (original)
- `src/views/Medicines.css` (original)
- `src/views/Consultation.jsx` (original)
- `src/features/consultation/components/ConsultationView.jsx` (original)
- `src/features/consultation/components/ConsultationView.css` (original)
- `src/features/medications/components/MedicineCard.jsx` (original)
- `src/features/medications/components/MedicineCard.css` (original)
- `src/features/medications/components/MedicineForm.jsx` (forms redesenhados por W11)
- `src/features/consultation/services/consultationDataService.js` (dados não mudam)
- Qualquer service, schema, ou hook existente

---

## Ordem de Execução

```
Sprint 12.1 (MedicineCardRedesign + ConfirmDialog)
    ↓
Sprint 12.2 (MedicinesRedesign view + App.jsx)
    ↓ (pode rodar em paralelo com 12.3)
Sprint 12.3 (ConsultationViewRedesign presenter)
    ↓
Sprint 12.4 (ConsultationRedesign container + App.jsx)
```

**Sprints 12.2 e 12.3 podem ser paralelos** se houver dois agentes — não há dependência entre Medicines e Consultation.

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| W11 não entregue (Modal/Forms ainda neon) | BAIXO | ALTO | MedicinesRedesign abre MedicineForm em Modal — ambos precisam de W11. **Bloquear W12 até W11 mergeada.** |
| MedicineCardRedesign quebra grid layout | BAIXO | MÉDIO | Testar com 0, 1, 3, 10+ medicamentos. Verificar grid auto-fill. |
| ConsultationViewRedesign quebra print layout | MÉDIO | ALTO | Testar `Ctrl+P` em Chrome/Safari. Verificar `@media print`. |
| `ConfirmDialog` não recebe foco (acessibilidade) | MÉDIO | MÉDIO | Modal (W11) já gerencia focus trap. ConfirmDialog herda comportamento. |
| Footer consultation sobrepõe BottomNav | BAIXO | MÉDIO | CSS já calcula `bottom: calc(64px + safe-area)`. Testar em mobile. |

---

## Critérios de Conclusão Wave 12

- [x] `MedicinesRedesign.jsx` criado e integrado no App.jsx
- [x] `ConsultationRedesign.jsx` criado e integrado no App.jsx
- [x] `ConfirmDialog` criado como componente reutilizável
- [x] CRUD de medicamentos funciona end-to-end no redesign (add/edit/delete)
- [x] Zero `window.confirm()` na experiência redesign
- [x] Zero emojis no JSX das views redesign
- [x] Modo consulta renderiza dados em estilo Santuário (Verde Saúde, não purple)
- [x] Print layout funcional (header legível, footer oculto)
- [x] Responsivo: mobile single-column, desktop grid
- [x] Toggle redesign OFF → views originais funcionam normalmente
- [x] `npm run validate:agent` passa
- [x] ESLint 0 errors
