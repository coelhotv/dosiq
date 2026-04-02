# Wave 14.5 — Tratamentos: CRUD Completo & Usabilidade
## Spec de Execução — Meus Remédios Redesign

**Versão:** 1.0
**Data:** 2026-04-02
**Status:** ✅ MERGED #444 (2026-04-02)
**Branch alvo:** `feature/redesign/wave-14.5/treatments-crud-usability`
**PR base:** `main`
**Referência:** `MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`

---

## Contexto e Objetivos

Com W4–W14 entregues, o redesign visual da view de Tratamentos está completo. Porém, durante a
análise pós-entrega identificou-se que **operações essenciais de CRUD ficaram inacessíveis** após
a reorganização da navegação (W4) e a reestruturação da view (W7):

| Entidade | Adicionar | Editar | Deletar |
|---|---|---|---|
| Medicamento | ⚠️ Só via busca ANVISA | ❌ `MedicinesRedesign` sem entrada no BottomNav | ❌ idem |
| Tratamento (protocolo) | ⚠️ Só pelo Wizard pós-busca | ✅ ProtocolForm modal | ❌ Só "Pausar" |
| Plano de tratamento | ⚠️ Campo oculto no Wizard | ❌ `handleEditPlan` tem `// TODO` | ❌ Ausente |

**Objetivo desta wave:** Fechar todos os gaps acima sem criar novas views ou tabs —
integrando as operações na view `TreatmentsRedesign` existente, respeitando o design
do santuário terapêutico.

**Nota de terminologia:** O termo "protocolo" é técnico demais para o paciente.
A partir desta wave, toda a UI usa **"tratamento"** no lugar de "protocolo".
O modelo de dados não muda (tabela `protocols` permanece).

---

## Wireframes de referência

### Layout aprovado (desktop complexo)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Meus Tratamentos              [+ Novo ▼]                                        │
│ 11 tratamentos                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  [ANVISA 🔍 Buscar medicamento...                                              ] │
│  💊 todos medicamentos →                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Ativos (9)  │  Pausados (2)  │  Finalizados                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ● 🫀 Cardiovascular                             4×  ⚠  ▲  [✏️] [🗑]            │
│  ┌───────────────────────────┬──────────────┬───────────┬──────────┬─────┐      │
│  │ MEDICAMENTO               │ FREQUÊNCIA   │ ADESÃO 7D │ ESTOQUE  │     │      │
│  ├───────────────────────────┼──────────────┼───────────┼──────────┼─────┤      │
│  │ Losartana 50mg            │ Diário 08:00 │ ░░░▓▓▓    │ 🟡 8d    │ [🗑]│      │
│  │ Metformina 850mg          │ Diário 08/20 │ ▓▓▓▓▓▓    │ 🟢 22d   │ [🗑]│      │
│  └───────────────────────────┴──────────────┴───────────┴──────────┴─────┘      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile complexo

```
┌──────────────────────────────────────────┐
│ Meus Tratamentos      [+ Novo ▼]         │
│ 11 tratamentos                           │
├──────────────────────────────────────────┤
│ [ANVISA 🔍 Buscar medicamento...       ] │
│ 💊 todos medicamentos →                 │
├──────────────────────────────────────────┤
│  Ativos (9) │ Pausados (2) │ Finalizados  │
├──────────────────────────────────────────┤
│  ● 🫀 Cardiovascular  4×  ⚠  ▲  [✏️][🗑]│
│  ┌────────────────────────────────────┐  │
│  │ Losartana 50mg          🟡 8d  [🗑]│  │
│  │ 1cp · Diário · 08:00    ░░░▓▓▓     │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Mobile/Desktop simples

```
┌──────────────────────────────────────────┐
│ Meus Tratamentos      [+ Novo ▼]         │
│ 3 tratamentos                            │
├──────────────────────────────────────────┤
│ [ANVISA 🔍 Buscar medicamento...       ] │
│ 💊 todos medicamentos →                 │
├──────────────────────────────────────────┤
│  Ativos (3) │ Pausados (1) │ Finalizados  │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ Losartana  50mg           🟡 8d    │  │
│  │ 1 comprimido                       │  │
│  │ Diário · 08:00            ░░░▓▓▓   │  │
│  │                   [✏️ Editar] [🗑] │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Dropdown `[+ Novo ▼]`

```
  Modo Simples              Modo Complexo
  ┌──────────────────┐      ┌──────────────────────┐
  │ + Medicamento    │      │ + Medicamento         │
  │ + Tratamento     │      │ + Tratamento          │
  └──────────────────┘      │ + Plano de tratamento │
                            └──────────────────────┘
```

---

## Decisões de Arquitetura

| Decisão | Escolha | Justificativa |
|---|---|---|
| Onde vive o dropdown `[+ Novo]`? | `TreatmentsRedesign.jsx` (orquestrador) | Já gerencia todos os modais; bifurca modo simples/complexo |
| Componente do dropdown | Novo `NewTreatmentDropdown.jsx` em `@protocols/components/redesign/` | Isolado, testável, recebe `isComplex` e callbacks |
| Link "todos medicamentos" | Dentro de `AnvisaSearchBar.jsx` como prop opcional `onViewAll` | Agrupa semanticamente busca + acesso à lista completa |
| Delete de tratamento | Handler em `TreatmentsRedesign` + `ConfirmDialog` | Padrão já estabelecido em W12 para delete |
| Delete de plano | Handler em `TreatmentsRedesign` + `ConfirmDialog` | Idem |
| Editar plano (`handleEditPlan`) | Completar o `// TODO` existente abrindo `TreatmentPlanForm` em modal | Infraestrutura já existe; só falta o wiring |
| `TreatmentPlanForm` precisa de redesign? | **Sim** — usa classes `form-group`/`error-message` do design antigo | Atualizar para classes `form-row`/`form-label`/`form-error` + tokens |
| Delete de tratamento: soft ou hard? | Hard delete (`protocolService.delete()`) com ConfirmDialog duplo | Mesma abordagem do delete de medicamento em W12 |
| Onde fica o `[🗑]` no modo tabular desktop? | Coluna extra (5ª) já existente no grid | Grid já prevê a coluna sem nome |
| Onde fica o `[🗑]` no modo card mobile? | Inline no rodapé do card, ao lado do `[✏️ Editar]` | Consistente com modo simples |
| Terminologia UI | "tratamento" no lugar de "protocolo" em toda a UI | "Protocolo" é termo técnico; paciente pensa em "tratamento" |

---

## Pré-requisitos

- [x] W11 mergeada — `Modal.jsx`, `ProtocolForm`, `TreatmentWizard` com design santuário ✅
- [x] W12 mergeada — `ConfirmDialog` em `@shared/components/ui/` ✅ (movido em W14.0)
- [x] W14 mergeada — `ConfirmDialog` promovido para shared ✅
- [ ] Confirmar que `protocolService.delete(id)` existe e funciona
- [ ] Confirmar que `treatmentPlanService.delete(id)` existe e funciona

---

## Sprint 14.5.1 — Link "todos medicamentos" em AnvisaSearchBar

**Objetivo:** Adicionar link `💊 todos medicamentos →` imediatamente abaixo da barra de busca ANVISA,
agrupando semanticamente "tudo de medicamentos" num único bloco visual.

**Arquivo:** `src/features/protocols/components/redesign/AnvisaSearchBar.jsx`

### O que fazer

1. Adicionar prop `onViewAllMedicines?: () => void`
2. Renderizar abaixo do input, quando prop presente:

```jsx
{onViewAllMedicines && (
  <button
    className="anvisa-search__view-all"
    onClick={onViewAllMedicines}
  >
    <Pill size={14} />
    todos medicamentos
  </button>
)}
```

3. Adicionar CSS em `AnvisaSearchBar.css`:

```css
.anvisa-search__view-all {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
  padding: 0;
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.anvisa-search__view-all:hover {
  color: var(--color-primary-container);
}
```

**Arquivo:** `src/views/redesign/TreatmentsRedesign.jsx`

4. Passar a prop para `AnvisaSearchBar`:

```jsx
<AnvisaSearchBar
  ...props existentes...
  onViewAllMedicines={() => onNavigate('medicines')}
/>
```

> **Nota:** `TreatmentsRedesign` já recebe `onNavigateToProtocol`; verificar se `onNavigate`
> é o prop correto ou se é necessário adicionar `onNavigate` como prop da view.
> Conferir como `App.jsx` instancia `TreatmentsRedesign`.

---

## Sprint 14.5.2 — Dropdown `[+ Novo ▼]`

**Objetivo:** Substituir o botão "Novo" atual (se existir) ou adicionar um novo dropdown
`[+ Novo ▼]` no header de `TreatmentsRedesign` com as opções corretas por modo.

**Novo componente:** `src/features/protocols/components/redesign/NewTreatmentDropdown.jsx`

### Props

```jsx
NewTreatmentDropdown({
  isComplex: bool,           // true = modo complexo (3 opções)
  onAddMedicine: () => void, // abre TreatmentWizard sem preselectedMedicine
  onAddTreatment: () => void,// abre ProtocolForm em modo criação
  onAddPlan: () => void,     // abre TreatmentPlanForm em modo criação (só complexo)
})
```

### Comportamento

- Click no botão principal abre/fecha o dropdown (estado local `isOpen`)
- Click fora fecha (usar `useEffect` + `document.addEventListener('mousedown', ...)`)
- Opções:
  - **Modo simples:** "Medicamento" + "Tratamento"
  - **Modo complexo:** "Medicamento" + "Tratamento" + "Plano de tratamento"

### CSS (em `NewTreatmentDropdown.css`)

```css
.new-treatment-dropdown { position: relative; }

.new-treatment-dropdown__trigger {
  /* reutilizar classes btn btn-primary do design system */
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.new-treatment-dropdown__menu {
  position: absolute;
  top: calc(100% + var(--space-2));
  right: 0;
  min-width: 14rem;
  background: var(--color-surface-container-lowest);
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-card-sm);
  box-shadow: var(--shadow-editorial);
  z-index: 100;
  overflow: hidden;
}

.new-treatment-dropdown__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: none;
  border: none;
  color: var(--color-on-surface);
  font-size: var(--font-size-sm);
  cursor: pointer;
  text-align: left;
}
.new-treatment-dropdown__item:hover {
  background: var(--color-surface-container-low);
}
```

### Wiring em `TreatmentsRedesign.jsx`

Adicionar handlers e modais:

```jsx
// Estados novos
const [planFormOpen, setPlanFormOpen] = useState(false)
const [planFormData, setPlanFormData] = useState(null) // null = criação, objeto = edição
const [treatmentCreateOpen, setTreatmentCreateOpen] = useState(false)

// Handlers novos
function handleAddMedicine() {
  setWizardMedicine(null)
  setWizardOpen(true)        // TreatmentWizard sem preselectedMedicine = step 1 livre
}

function handleAddTreatment() {
  setFormProtocol(null)      // null = modo criação
  setTreatmentCreateOpen(true)
}

function handleAddPlan() {
  setPlanFormData(null)      // null = modo criação
  setPlanFormOpen(true)
}
```

> **Nota:** O `TreatmentWizard` sem `preselectedMedicine` já inicia no step 1 (Medicamento),
> permitindo criar medicamento novo ou selecionar existente. Confirmar esse comportamento
> antes de implementar.

---

## Sprint 14.5.3 — Editar e Deletar Plano de Tratamento

**Objetivo:** Completar o `handleEditPlan` (hoje com `// TODO`) e adicionar `handleDeletePlan`.

**Arquivo:** `src/views/redesign/TreatmentsRedesign.jsx`

### 14.5.3.1 — Completar `handleEditPlan`

Substituir o bloco atual com `console.log`:

```jsx
async function handleEditPlan(group) {
  try {
    setErrorMessage(null)
    const planId = group.groupKey.replace('plan:', '')
    const fullPlan = await treatmentPlanService.getById(planId)
    setPlanFormData(fullPlan)   // abre em modo edição
    setPlanFormOpen(true)
  } catch (err) {
    console.error('Erro ao carregar plano para edição:', err)
    setErrorMessage('Erro ao carregar plano. Tente novamente.')
  }
}
```

### 14.5.3.2 — Adicionar `handleDeletePlan`

```jsx
const [planToDelete, setPlanToDelete] = useState(null)

async function handleDeletePlan(group) {
  const planId = group.groupKey.replace('plan:', '')
  setPlanToDelete({ id: planId, name: group.groupLabel })
}

async function confirmDeletePlan() {
  try {
    setErrorMessage(null)
    await treatmentPlanService.delete(planToDelete.id)
    setPlanToDelete(null)
    refetch()
  } catch (err) {
    console.error('Erro ao deletar plano:', err)
    setErrorMessage('Erro ao deletar plano. Tente novamente.')
  }
}
```

### 14.5.3.3 — Wiring do TreatmentPlanForm modal

```jsx
<Modal isOpen={planFormOpen} onClose={() => { setPlanFormOpen(false); setPlanFormData(null) }}>
  <TreatmentPlanForm
    plan={planFormData}
    onSave={async (data) => {
      if (planFormData) {
        await treatmentPlanService.update(planFormData.id, data)
      } else {
        await treatmentPlanService.create(data)
      }
      setPlanFormOpen(false)
      setPlanFormData(null)
      refetch()
    }}
    onCancel={() => { setPlanFormOpen(false); setPlanFormData(null) }}
  />
</Modal>

<ConfirmDialog
  isOpen={!!planToDelete}
  title="Excluir plano de tratamento?"
  message={`"${planToDelete?.name}" e todos os seus dados serão removidos. Os tratamentos associados não serão excluídos.`}
  confirmLabel="Excluir plano"
  variant="danger"
  onConfirm={confirmDeletePlan}
  onCancel={() => setPlanToDelete(null)}
/>
```

### 14.5.3.4 — Passar `onDeletePlan` para `TreatmentsComplex`

```jsx
<TreatmentsComplex
  ...props existentes...
  onDeletePlan={handleDeletePlan}
/>
```

E em `TreatmentPlanHeader.jsx`, adicionar o botão `[🗑]` ao lado do `[✏️]` existente:

```jsx
import { PencilLine, Trash2 } from 'lucide-react'

{isPlan && onDeletePlan && (
  <button
    className="plan-header__delete-btn"
    onClick={(e) => { e.stopPropagation(); onDeletePlan(group) }}
    aria-label={`Excluir plano ${group.groupLabel}`}
    title="Excluir plano de tratamento"
  >
    <Trash2 size={15} />
  </button>
)}
```

CSS em `TreatmentPlanHeader.css` (ou onde estiver o CSS do componente):

```css
.plan-header__delete-btn {
  /* mesmo visual de plan-header__edit-btn, mas com cor de perigo */
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-error);
  padding: var(--space-1);
  border-radius: var(--radius-button);
  display: flex;
  align-items: center;
}
.plan-header__delete-btn:hover {
  background: var(--color-error-bg);
}
```

---

## Sprint 14.5.4 — Deletar Tratamento (protocolo)

**Objetivo:** Adicionar ação de exclusão nos cards de tratamento (modo simples e modo complexo).

**Arquivo:** `src/views/redesign/TreatmentsRedesign.jsx`

### 14.5.4.1 — Handlers

```jsx
const [treatmentToDelete, setTreatmentToDelete] = useState(null)

function handleDeleteTreatment(item) {
  setTreatmentToDelete(item)
}

async function confirmDeleteTreatment() {
  try {
    setErrorMessage(null)
    await protocolService.delete(treatmentToDelete.id)
    setTreatmentToDelete(null)
    refetch()
  } catch (err) {
    console.error('Erro ao deletar tratamento:', err)
    setErrorMessage('Erro ao deletar tratamento. Tente novamente.')
  }
}
```

### 14.5.4.2 — ConfirmDialog

```jsx
<ConfirmDialog
  isOpen={!!treatmentToDelete}
  title="Excluir tratamento?"
  message={`O tratamento de "${treatmentToDelete?.medicineName}" será excluído permanentemente. O histórico de doses registradas será mantido.`}
  confirmLabel="Excluir tratamento"
  variant="danger"
  onConfirm={confirmDeleteTreatment}
  onCancel={() => setTreatmentToDelete(null)}
/>
```

### 14.5.4.3 — Passar `onDelete` para os filhos

```jsx
// TreatmentsSimple
<TreatmentsSimple
  ...props existentes...
  onDelete={handleDeleteTreatment}
/>

// TreatmentsComplex
<TreatmentsComplex
  ...props existentes...
  onDelete={handleDeleteTreatment}
/>
```

### 14.5.4.4 — Adicionar `onDelete` em `TreatmentsSimple.jsx`

```jsx
export default function TreatmentsSimple({ items, onEdit, onDelete, activeTab }) {
  ...
  <ProtocolRow
    ...props existentes...
    onDelete={onDelete}
  />
```

### 14.5.4.5 — Adicionar `onDelete` em `TreatmentsComplex.jsx`

```jsx
export default function TreatmentsComplex({ groups, onEdit, onEditPlan, onDeletePlan, onDelete, activeTab }) {
  ...
  <ProtocolRow
    ...props existentes...
    onDelete={onDelete}
  />
```

### 14.5.4.6 — Adicionar botão `[🗑]` em `ProtocolRow.jsx`

**Variante card (modo simples e complexo mobile):**

No rodapé do card, após as informações, adicionar linha de ações:

```jsx
import { Pencil, Trash2 } from 'lucide-react'

// No rodapé do protocol-row, fora do <button> principal:
<div className="protocol-row__actions">
  {onEdit && (
    <button
      className="protocol-row__action-btn"
      onClick={(e) => { e.stopPropagation(); onEdit(item) }}
      aria-label={`Editar tratamento ${item.medicineName}`}
    >
      <Pencil size={14} /> Editar
    </button>
  )}
  {onDelete && (
    <button
      className="protocol-row__action-btn protocol-row__action-btn--danger"
      onClick={(e) => { e.stopPropagation(); onDelete(item) }}
      aria-label={`Excluir tratamento ${item.medicineName}`}
    >
      <Trash2 size={14} />
    </button>
  )}
</div>
```

**Variante tabular (modo complexo desktop) — 5ª coluna:**

```jsx
{/* CÉLULA 5: Ações */}
<div className={`protocol-row-tabular__cell protocol-row-tabular__actions-cell ${hoverClass}`}>
  {onDelete && (
    <button
      className="protocol-row-tabular__delete-btn"
      onClick={(e) => { e.stopPropagation(); onDelete(item) }}
      aria-label={`Excluir ${item.medicineName}`}
    >
      <Trash2 size={14} />
    </button>
  )}
</div>
```

CSS (adicionar ao CSS de `ProtocolRow`):

```css
.protocol-row__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4) var(--space-3);
  border-top: 1px solid var(--color-outline-variant);
}

.protocol-row__action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: none;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-button);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.protocol-row__action-btn:hover {
  background: var(--color-surface-container-low);
}
.protocol-row__action-btn--danger {
  color: var(--color-error);
  border-color: var(--color-error);
}
.protocol-row__action-btn--danger:hover {
  background: var(--color-error-bg);
}

.protocol-row-tabular__delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  padding: var(--space-1);
  border-radius: var(--radius-button);
  display: flex;
  align-items: center;
  opacity: 0;
  transition: opacity 0.15s;
}
/* Mostrar o botão quando a linha está em hover (controlado pelo hoverClass) */
.protocol-row-tabular__cell--hovered .protocol-row-tabular__delete-btn {
  opacity: 1;
  color: var(--color-error);
}
```

---

## Sprint 14.5.5 — Atualizar `TreatmentPlanForm` para design santuário

**Contexto:** `TreatmentPlanForm.jsx` foi criado antes do redesign e usa classes antigas
(`form-group`, `error-message`, `error-banner`, `form-actions`) que não pertencem ao
design system do santuário terapêutico.

**Arquivo:** `src/features/protocols/components/TreatmentPlanForm.jsx`

Substituir o markup para usar as classes do padrão W11:

```jsx
return (
  <form className="treatment-plan-form" onSubmit={handleSubmit}>
    <div className="form-row">
      <label className="form-label" htmlFor="name">
        Nome do Plano <span aria-hidden="true">*</span>
      </label>
      <input
        type="text"
        id="name"
        name="name"
        className={`form-input ${errors.name ? 'form-input--error' : ''}`}
        value={formData.name}
        onChange={handleChange}
        placeholder="Ex: Quarteto Fantástico (IC)"
        autoFocus
      />
      {errors.name && <span className="form-error">{errors.name}</span>}
    </div>

    <div className="form-row">
      <label className="form-label" htmlFor="description">Descrição</label>
      <textarea
        id="description"
        name="description"
        className="form-input"
        value={formData.description}
        onChange={handleChange}
        placeholder="Ex: Protocolo para controle de insuficiência cardíaca."
        rows="3"
      />
    </div>

    <div className="form-row">
      <label className="form-label" htmlFor="objective">Objetivo do Tratamento</label>
      <input
        type="text"
        id="objective"
        name="objective"
        className="form-input"
        value={formData.objective}
        onChange={handleChange}
        placeholder="Ex: Titular Beta-bloqueador até 100mg"
      />
    </div>

    {errors.submit && (
      <div className="form-error-banner" role="alert">
        {errors.submit}
      </div>
    )}

    <div className="form-actions">
      <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
        Cancelar
      </Button>
      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Salvando...' : plan ? 'Atualizar Plano' : 'Criar Plano'}
      </Button>
    </div>
  </form>
)
```

**Arquivo:** `src/features/protocols/components/TreatmentPlanForm.css`

Substituir o conteúdo para usar tokens e as classes do padrão form W11:

```css
/* TreatmentPlanForm — design santuário terapêutico (W14.5) */
.treatment-plan-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-6);
}

.treatment-plan-form h3 {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-on-surface);
  margin: 0 0 var(--space-1);
}

.treatment-plan-form .form-help {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-variant);
  margin: 0;
}

.treatment-plan-form .form-error-banner {
  padding: var(--space-3) var(--space-4);
  background: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-card-sm);
  font-size: var(--font-size-sm);
}
```

> As classes `form-row`, `form-label`, `form-input`, `form-error`, `form-actions`
> já estão definidas globalmente em `src/shared/styles/forms.redesign.css` (W11).
> Não recriar — apenas usar.

---

## Sprint 14.5.6 — Substituição de terminologia na UI

**Objetivo:** Substituir "Protocolo" / "protocolo" por "Tratamento" / "tratamento" em
toda string visível ao usuário dentro da feature de tratamentos.

**Escopo:** apenas strings de UI (labels, placeholders, mensagens, aria-labels).
**Não alterar:** nomes de variáveis, funções, props, nomes de arquivo, tabelas do banco.

### Arquivos a auditar

```bash
grep -rn "rotocolo\|PROTOCOLO" \
  src/views/redesign/Treatments*.jsx \
  src/features/protocols/components/redesign/ \
  src/features/protocols/components/TreatmentWizard.jsx \
  --include="*.jsx"
```

Cada ocorrência deve ser avaliada: é código ou string de UI?
- String de UI → substituir por "tratamento"
- Código (variável, prop, service) → manter

---

## Ordem de execução recomendada

```
14.5.1 → AnvisaSearchBar + link "todos medicamentos"
14.5.2 → NewTreatmentDropdown + wiring em TreatmentsRedesign
14.5.3 → Editar + deletar plano (TreatmentPlanForm + TreatmentPlanHeader)
14.5.4 → Deletar tratamento (ProtocolRow + filhos)
14.5.5 → Redesign TreatmentPlanForm
14.5.6 → Substituição de terminologia
```

Cada sprint pode ser commitado independentemente. Sugestão de commits:

```
feat(tratamentos): adicionar link "todos medicamentos" na busca ANVISA
feat(tratamentos): dropdown [+ Novo] com opções por modo de complexidade
feat(tratamentos): editar e excluir plano de tratamento
feat(tratamentos): excluir tratamento com confirmação
style(tratamentos): atualizar TreatmentPlanForm para design santuário
refactor(tratamentos): substituir "protocolo" por "tratamento" na UI
```

---

## Checklist de Validação

### Funcional
- [ ] Link "todos medicamentos" navega para `MedicinesRedesign`
- [ ] Dropdown simples exibe 2 opções; complexo exibe 3
- [ ] "+ Medicamento" abre `TreatmentWizard` no step 1 (sem medicine pré-selecionado)
- [ ] "+ Tratamento" abre `ProtocolForm` em modo criação
- [ ] "+ Plano de tratamento" abre `TreatmentPlanForm` em modo criação (só complexo)
- [ ] Editar plano: dados carregados corretamente no form
- [ ] Salvar plano: chama `treatmentPlanService.update()` e refetch
- [ ] Criar plano: chama `treatmentPlanService.create()` e refetch
- [ ] Deletar plano: ConfirmDialog aparece com nome correto; delete ocorre; refetch
- [ ] Deletar tratamento: ConfirmDialog aparece com nome do medicamento; delete ocorre; refetch
- [ ] `[🗑]` na variante tabular só aparece em hover
- [ ] `[🗑]` na variante card sempre visível

### Visual
- [ ] `TreatmentPlanForm` usa tokens do santuário (sem `#hex` hardcoded, sem classes `form-group`)
- [ ] Botões de delete usam `var(--color-error)` / `var(--color-error-bg)`
- [ ] Link "todos medicamentos" tem hierarquia visual menor que a barra de busca
- [ ] Dropdown fecha ao clicar fora

### Terminologia
- [ ] Nenhuma string de UI exibe "protocolo" ou "Protocolo" no fluxo de tratamentos

### Regressão
- [ ] Edição de tratamento (fluxo já existente) continua funcionando
- [ ] Busca ANVISA continua funcionando
- [ ] Tabs Ativos/Pausados/Finalizados continuam funcionando
- [ ] `npm run validate:agent` passa sem erros

---

## Mapeamento de arquivos alterados

| Arquivo | Tipo de mudança |
|---|---|
| `src/features/protocols/components/redesign/AnvisaSearchBar.jsx` | Adição de prop `onViewAllMedicines` + link |
| `src/features/protocols/components/redesign/AnvisaSearchBar.css` | CSS do link |
| `src/features/protocols/components/redesign/NewTreatmentDropdown.jsx` | **Novo componente** |
| `src/features/protocols/components/redesign/NewTreatmentDropdown.css` | **Novo arquivo CSS** |
| `src/features/protocols/components/redesign/TreatmentPlanHeader.jsx` | Adicionar botão `[🗑]` |
| `src/features/protocols/components/redesign/ProtocolRow.jsx` | Adicionar botão `[🗑]` nas duas variantes |
| `src/views/redesign/TreatmentsRedesign.jsx` | Handlers de delete/edit plano, dropdown wiring, modais |
| `src/views/redesign/TreatmentsSimple.jsx` | Passar `onDelete` para `ProtocolRow` |
| `src/views/redesign/TreatmentsComplex.jsx` | Passar `onDelete` e `onDeletePlan` |
| `src/features/protocols/components/TreatmentPlanForm.jsx` | Redesign para santuário |
| `src/features/protocols/components/TreatmentPlanForm.css` | Rewrite com tokens |

---

*Spec criada em 2026-04-02. Derivada da análise de gaps de CRUD pós-W14 e dos wireframes aprovados.*
