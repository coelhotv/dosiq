# Wave 11 — Forms & Modals Redesign

**Status:** ✅ MERGED #439 (2026-03-30)
**Data de criação:** 2026-03-29
**Data de entrega:** 2026-03-30
**Dependências:** W0-W10C ✅ (todos mergeados em main)
**Risco:** ALTO — Modal.jsx é keystone blocker (12+ usages); forms são usados em onboarding (W13 depende)
**Estimativa:** ~7 sprints, ~600 linhas CSS novo + ~200 linhas JSX alterado

---

## Por que esta wave existe

Todas as views principais (Dashboard, Treatments, Stock, Profile, Settings, HealthHistory, Emergency) já foram redesenhadas. Porém, quando o usuário clica em "Registrar Dose", "Adicionar Medicamento", "Exportar Dados" ou qualquer ação que abre um formulário ou modal, o visual **volta para o tema neon/cyberpunk antigo**. Isso cria uma experiência visual inconsistente e confusa.

O `Modal.jsx` base é o **keystone blocker**: ele é usado por 12+ componentes. Redesenhá-lo primeiro desbloqueia todos os diálogos. Em seguida, cada formulário precisa de ajustes CSS para usar os tokens do design system Santuário.

---

## Estratégia de Implementação

### Princípio: CSS-ONLY Redesign (ZERO mudanças em lógica JSX)

**REGRA ABSOLUTA:** Nesta wave, NÃO se altera a lógica dos componentes React. Toda mudança é em **CSS** via scoping `[data-redesign="true"]`. Os forms usam classes CSS como `.form-group`, `.form-actions`, `.error-banner`, `.error-message`, etc. O redesign consiste em:

1. Adicionar regras CSS com seletor `[data-redesign="true"]` nos arquivos CSS existentes de cada form
2. Atualizar o `Modal.jsx` e `Modal.css` para suportar o novo visual (mínima mudança JSX: trocar `✕` por ícone lucide `X`)
3. O CSS existente continua funcionando quando `[data-redesign="true"]` NÃO está presente (fallback neon)

### Exceções JSX (mínimas, listadas explicitamente):
- `Modal.jsx`: trocar texto `✕` por ícone `X` de `lucide-react`
- NENHUMA outra mudança JSX é permitida nesta wave

---

## Referência de Design Tokens (já existem em `components.redesign.css`)

Os seguintes tokens JÁ ESTÃO definidos e ativos quando `[data-redesign="true"]`:

```css
/* Inputs — JÁ EXISTEM em components.redesign.css (Sprint 3.3) */
/* Todas as tags input, textarea, select já recebem: */
/*   font-family: var(--font-body)                    → Lexend */
/*   font-size: var(--text-body-lg)                   → 1rem */
/*   background-color: var(--color-surface-container-low)  → #f2f4f5 */
/*   border: 2px solid transparent                    */
/*   border-radius: var(--radius-input)               → 1rem */
/*   min-height: 56px                                 */
/*   focus: border-color var(--color-primary)          → #006a5e */

/* Buttons — JÁ EXISTEM em components.redesign.css (Sprint 3.2) */
/*   .btn-primary: gradient(135deg, #006a5e, #008577) */
/*   .btn-ghost: transparent, hover surface-container-low */
/*   .btn-outline: border primary, transparent bg */
/*   .btn-danger: error color */
/*   .btn-lg: min-height 56px, padding 1rem 2rem */

/* Form group — JÁ EXISTE */
/*   .form-group: margin-bottom 1.5rem */

/* Error input — JÁ EXISTE */
/*   .input-error: border-color var(--color-error) */
/*   .input-error-message: color var(--color-error), font-size title-sm */
```

### O que FALTA definir nesta wave (classes usadas pelos forms mas SEM redesign):

| Classe CSS | Usado em | Precisa de regra `[data-redesign="true"]` |
|-----------|----------|------------------------------------------|
| `.form-row` | ProtocolForm, StockForm | flexbox horizontal, gap |
| `.form-actions` | Todos os forms | flex end, gap, border-top |
| `.error-banner` | Todos os forms | error container com ícone |
| `.error-message` | Todos os forms | inline error text |
| `.success-message` | MedicineForm, ProtocolForm | success feedback |
| `.required` | Todos os forms | asterisco vermelho |
| `.field-hint` | MedicineForm | small text abaixo do input |
| `.checkbox-label` | ProtocolForm, ExportDialog | label com checkbox |
| `.checkbox-group` | ExportDialog | grupo de checkboxes |
| `.time-chip` | ProtocolForm | chip de horário com remove |
| `.time-schedule-list` | ProtocolForm | lista de chips |
| `.time-input-group` | ProtocolForm | input + botão |
| `.log-type-toggle` | LogForm | segmented control protocol/plan |
| `.protocol-info` | LogForm | info box com detalhes |
| `.plan-medicines-list` | LogForm | lista de checkboxes do plano |
| `.autocomplete-badge` | MedicineForm | badge "Fonte: ANVISA" |
| `.dosage-input-group` | MedicineForm | grid 2fr 1fr |
| `.format-selector` | ExportDialog | radio group |
| `.format-option` | ExportDialog | radio item |
| `.date-range` | ExportDialog | pair of date inputs |
| `.export-section` | ExportDialog | section container |
| `.export-label` | ExportDialog | section label |
| `.export-error` | ExportDialog | error message |
| `.export-actions` | ExportDialog | action buttons |
| `.modal-overlay` | Modal | overlay background |
| `.modal-content` | Modal | modal card |
| `.modal-header` | Modal | header with title + close |
| `.modal-close` | Modal | close button |
| `.modal-body` | Modal | content area |

---

## Sprint 11.1 — Modal Base Redesign (KEYSTONE)

**Prioridade:** CRÍTICA — desbloqueia todos os outros sprints
**Arquivos a modificar:**
- `src/shared/components/ui/Modal.jsx` (mínima mudança JSX)
- `src/shared/components/ui/Modal.css` (adicionar bloco redesign)

### Mudança JSX em Modal.jsx

**ÚNICA mudança permitida:** Trocar o botão close de texto `✕` para ícone lucide `X`.

```jsx
// ANTES (linha 35):
<button className="modal-close" onClick={onClose} aria-label="Fechar">
  ✕
</button>

// DEPOIS:
import { X } from 'lucide-react'
// ...
<button className="modal-close" onClick={onClose} aria-label="Fechar">
  <X size={20} />
</button>
```

**NENHUMA outra mudança** no Modal.jsx. A lógica de `useEffect` (body overflow, escape key), a estrutura HTML, e as props permanecem idênticas.

### CSS a adicionar em Modal.css (APÓS o bloco existente, no final do arquivo)

Adicionar o seguinte bloco **depois** da última regra existente (linha 118):

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   Ativo apenas quando [data-redesign="true"]
   ============================================ */

[data-redesign='true'] .modal-overlay {
  background: rgba(25, 28, 29, 0.40);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: modalFadeIn 200ms ease-out;
}

[data-redesign='true'] .modal-content {
  background: var(--color-surface-container-lowest);
  border: none;
  border-radius: 2rem;
  box-shadow: 0 24px 48px rgba(25, 28, 29, 0.12);
  max-width: 560px;
  animation: modalScaleIn 200ms ease-out;
}

@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-redesign='true'] .modal-content {
    animation: none;
  }
  [data-redesign='true'] .modal-overlay {
    animation: none;
  }
}

[data-redesign='true'] .modal-header {
  padding: 1.5rem 2rem;
  border-bottom: none;
  background: transparent;
}

[data-redesign='true'] .modal-header h2 {
  font-family: var(--font-body);
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  margin: 0;
}

[data-redesign='true'] .modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: var(--radius-full);
  background: transparent;
  border: none;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  transition: background-color 200ms ease-out;
  font-size: inherit;
  padding: 0;
}

[data-redesign='true'] .modal-close:hover {
  background: var(--color-surface-container-low);
  color: var(--color-on-surface);
}

[data-redesign='true'] .modal-body {
  padding: 0 2rem 2rem;
}

/* Mobile — bottom sheet */
@media (max-width: 767px) {
  [data-redesign='true'] .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  [data-redesign='true'] .modal-content {
    max-width: 100%;
    max-height: 90vh;
    border-radius: 2rem 2rem 0 0;
    animation: modalSlideUp 250ms ease-out;
  }

  @keyframes modalSlideUp {
    from {
      opacity: 0;
      transform: translateY(100px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  [data-redesign='true'] .modal-header {
    padding: 1.25rem 1.5rem;
  }

  [data-redesign='true'] .modal-body {
    padding: 0 1.5rem 1.5rem;
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
  }
}

/* Scrollbar — redesign */
[data-redesign='true'] .modal-content::-webkit-scrollbar {
  width: 6px;
}

[data-redesign='true'] .modal-content::-webkit-scrollbar-track {
  background: transparent;
}

[data-redesign='true'] .modal-content::-webkit-scrollbar-thumb {
  background: var(--color-outline-variant);
  border-radius: var(--radius-full);
}
```

### Validação Sprint 11.1

- [ ] Modal abre com overlay glass (40% opacity + blur) quando redesign ativo
- [ ] Modal card é branco (#fff), sem border, radius 2rem, shadow ambient
- [ ] Header sem border-bottom, título Lexend 600
- [ ] Botão close é ícone lucide `X`, hover com circle background
- [ ] Mobile: bottom sheet (slide up from bottom), radius top 2rem
- [ ] Escape fecha modal (comportamento existente preservado)
- [ ] Body overflow hidden quando aberto (comportamento existente preservado)
- [ ] Sem redesign flag: visual neon antigo funciona normalmente

---

## Sprint 11.2 — Form Utility Classes

**Prioridade:** ALTA — usado por TODOS os forms subsequentes
**Arquivo a modificar:** `src/shared/styles/components.redesign.css`

Adicionar o seguinte bloco **depois** da seção "SPRINT 3.4 — BADGE COMPONENT" (ou no final do arquivo):

```css
/* ============================================
   WAVE 11 — FORM UTILITY CLASSES
   Classes compartilhadas por TODOS os forms.
   ============================================ */

/* --- Layout --- */

[data-redesign='true'] .form-row {
  display: flex;
  gap: 1rem;
}

@media (max-width: 640px) {
  [data-redesign='true'] .form-row {
    flex-direction: column;
    gap: 0;
  }
}

[data-redesign='true'] .form-row > .form-group {
  flex: 1;
}

[data-redesign='true'] .form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-outline-ghost);
  margin-top: 0.5rem;
}

@media (max-width: 640px) {
  [data-redesign='true'] .form-actions {
    flex-direction: column-reverse;
  }

  [data-redesign='true'] .form-actions .btn {
    width: 100%;
  }
}

/* --- Labels & Hints --- */

[data-redesign='true'] .form-group label,
[data-redesign='true'] .form-group > .form-label {
  display: block;
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  margin-bottom: 0.5rem;
}

[data-redesign='true'] .required {
  color: var(--color-error);
  font-weight: var(--font-weight-bold);
}

[data-redesign='true'] .field-hint,
[data-redesign='true'] .form-group small {
  display: block;
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--color-on-surface-variant);
  margin-top: 0.25rem;
  line-height: 1.4;
}

/* --- Feedback: errors --- */

[data-redesign='true'] .error-message {
  display: block;
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--color-error);
  margin-top: 0.25rem;
}

[data-redesign='true'] .error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-card);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: var(--font-weight-medium);
}

/* Error state para inputs (classe .error que os forms usam) */
[data-redesign='true'] input.error,
[data-redesign='true'] textarea.error,
[data-redesign='true'] select.error {
  border-color: var(--color-error);
}

/* --- Feedback: success --- */

[data-redesign='true'] .success-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-success-bg);
  color: var(--color-primary);
  border-radius: var(--radius-card);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: var(--font-weight-medium);
}

[data-redesign='true'] .success-message svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* --- Checkbox & Radio --- */

[data-redesign='true'] .checkbox-label,
[data-redesign='true'] .checkbox-group .checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--color-on-surface);
  cursor: pointer;
  padding: 0.5rem 0;
}

[data-redesign='true'] .checkbox-label input[type='checkbox'],
[data-redesign='true'] .checkbox-label input[type='radio'] {
  width: 20px;
  height: 20px;
  accent-color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}

[data-redesign='true'] .checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* --- Form title (h3 inside forms) --- */

[data-redesign='true'] form h3 {
  font-family: var(--font-body);
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  margin: 0 0 1.5rem 0;
}

/* --- Autocomplete badge (ANVISA source) --- */

[data-redesign='true'] .autocomplete-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 0.625rem;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 0.5rem;
  vertical-align: middle;
}
```

### Validação Sprint 11.2

- [ ] `.form-row` renderiza campos lado a lado em desktop, empilha em mobile (<640px)
- [ ] `.form-actions` alinha botões à direita, com border-top sutil
- [ ] `.error-message` exibe texto vermelho abaixo de inputs com erro
- [ ] `.error-banner` exibe banner de erro com background rosa claro
- [ ] `.success-message` exibe banner verde claro com ícone
- [ ] `.required` exibe asterisco vermelho
- [ ] `.checkbox-label` alinha checkbox + texto com gap adequado
- [ ] `form h3` usa Lexend 600, `title-lg`
- [ ] Sem redesign flag: todas essas classes ignoradas (CSS normal neon funciona)

---

## Sprint 11.3 — LogForm CSS Redesign

**Arquivo a modificar:** `src/shared/components/log/LogForm.css`

Adicionar o seguinte bloco **no final do arquivo** (depois da última regra existente, linha 111):

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .log-form {
  padding-bottom: 1rem;
}

[data-redesign='true'] .log-form h3 {
  /* Herda de form h3 em components.redesign.css */
}

[data-redesign='true'] .log-type-toggle {
  display: flex;
  background: var(--color-surface-container-low);
  padding: 4px;
  border-radius: var(--radius-full);
  gap: 4px;
}

[data-redesign='true'] .log-type-toggle button {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-on-surface-variant);
  padding: 0.625rem 1rem;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 200ms ease-out;
}

[data-redesign='true'] .log-type-toggle button.active {
  background: var(--color-surface-container-lowest);
  color: var(--color-primary);
  box-shadow: 0 1px 3px rgba(25, 28, 29, 0.08);
}

[data-redesign='true'] .log-type-toggle button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

[data-redesign='true'] .protocol-info {
  padding: 1rem;
  background: var(--color-surface-container-low);
  border: none;
  border-radius: var(--radius-card);
}

[data-redesign='true'] .info-item {
  font-family: var(--font-body);
}

[data-redesign='true'] .info-label {
  color: var(--color-on-surface-variant);
}

[data-redesign='true'] .info-value {
  color: var(--color-on-surface);
}

[data-redesign='true'] .plan-summary-title {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

[data-redesign='true'] .plan-medicines-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

[data-redesign='true'] .plan-med-item {
  border-bottom-color: var(--color-outline-ghost);
  color: var(--color-on-surface);
  font-family: var(--font-body);
}

@media (max-width: 640px) {
  [data-redesign='true'] .log-form {
    padding-bottom: 1rem;
  }
}
```

### Validação Sprint 11.3

- [ ] LogForm dentro de Modal: visual Santuário completo (segmented control, inputs, botões)
- [ ] Segmented control (protocol/plan toggle): radius full, bg surface-container-low, active branco
- [ ] Protocol info box: sem border, bg surface-container-low
- [ ] Plan medicines list: sem border dashed, usa outline-ghost
- [ ] Form actions: botões alinhados à direita (herda de Sprint 11.2)

---

## Sprint 11.4 — MedicineForm CSS Redesign

**Arquivo a modificar:** `src/features/medications/components/MedicineForm.css`

Adicionar o seguinte bloco **no final do arquivo**:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .medicine-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

[data-redesign='true'] .medicine-form .dosage-input-group {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 0.5rem;
}

/* Os demais estilos (form h3, form-group, form-actions, error-*, success-*,
   autocomplete-badge, field-hint, required) são herdados de components.redesign.css
   via Sprint 11.2 — NÃO duplicar aqui. */
```

### Validação Sprint 11.4

- [ ] MedicineForm dentro de Modal: visual Santuário completo
- [ ] ANVISA autocomplete badge: pill verde com "Fonte: ANVISA"
- [ ] Dosage input grid: 2fr (número) + 1fr (unidade) lado a lado
- [ ] ShakeEffect continua funcionando (CSS animation não afetada pelo redesign)

---

## Sprint 11.5 — ProtocolForm + TitrationWizard CSS Redesign

**Arquivos a modificar:**
- `src/features/protocols/components/ProtocolForm.css` (adicionar bloco no final)
- `src/features/protocols/components/TitrationWizard.css` (adicionar bloco no final)

### ProtocolForm.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .protocol-form {
  padding-bottom: 1rem;
}

[data-redesign='true'] .time-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

[data-redesign='true'] .time-input-group input[type='time'] {
  flex: 1;
}

[data-redesign='true'] .time-schedule-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

[data-redesign='true'] .time-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--color-surface-container-low);
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
}

[data-redesign='true'] .time-chip .remove-time {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  padding: 0;
  transition: all 150ms ease-out;
}

[data-redesign='true'] .time-chip .remove-time:hover {
  background: var(--color-error-bg);
  color: var(--color-error);
}

/* Titration section container (inline style override) */
[data-redesign='true'] .protocol-form .form-row[style*="border"] {
  border-color: var(--color-outline-ghost) !important;
  background: var(--color-surface-container-low) !important;
  border-radius: var(--radius-card) !important;
}

/* Os demais estilos (form h3, form-group, form-row, form-actions, error-*,
   checkbox-label, required) são herdados de components.redesign.css via Sprint 11.2. */
```

### TitrationWizard.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .titration-wizard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

[data-redesign='true'] .wizard-header h4 {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  margin: 0;
}

[data-redesign='true'] .wizard-subtitle {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--color-on-surface-variant);
  margin: 0.25rem 0 0;
}

[data-redesign='true'] .titration-stage-card {
  background: var(--color-surface-container-lowest);
  border: none;
  border-radius: var(--radius-card);
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(25, 28, 29, 0.06);
}

[data-redesign='true'] .stage-number {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

[data-redesign='true'] .stage-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

[data-redesign='true'] .stage-grid .full-width {
  grid-column: 1 / -1;
}

[data-redesign='true'] .form-group-mini label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface-variant);
  display: block;
  margin-bottom: 0.25rem;
}

[data-redesign='true'] .form-group-mini input {
  min-height: 44px;
  font-size: 0.875rem;
}
```

### Validação Sprint 11.5

- [ ] ProtocolForm: time chips são pills com bg surface-container-low, remove button circular
- [ ] ProtocolForm: titration section com bg surface-container-low, sem border neon
- [ ] TitrationWizard: stage cards brancos, stage number em primary, sem glow neon
- [ ] form-row: lado a lado em desktop, empilhado em mobile

---

## Sprint 11.6 — StockForm + TreatmentPlanForm + TreatmentWizard CSS Redesign

**Arquivos a modificar:**
- `src/features/stock/components/StockForm.css` (adicionar bloco no final)
- `src/features/protocols/components/TreatmentPlanForm.css` (adicionar bloco no final)
- `src/features/protocols/components/TreatmentWizard.css` (adicionar bloco no final)

### StockForm.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .stock-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Os demais estilos (form h3, form-group, form-row, form-actions, error-*,
   required) são herdados de components.redesign.css via Sprint 11.2. */
```

### TreatmentPlanForm.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .treatment-plan-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Os demais estilos são herdados de components.redesign.css via Sprint 11.2. */
```

### TreatmentWizard.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .treatment-wizard {
  padding: 0;
}

[data-redesign='true'] .treatment-wizard .wizard-step {
  background: transparent;
}

[data-redesign='true'] .treatment-wizard .step-indicator {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1.5rem;
}

[data-redesign='true'] .treatment-wizard .step-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-outline-variant);
  transition: all 200ms ease-out;
}

[data-redesign='true'] .treatment-wizard .step-dot.active {
  width: 24px;
  background: var(--color-primary);
}

[data-redesign='true'] .treatment-wizard .step-dot.completed {
  background: var(--color-primary-fixed);
}

/* Herda form styles de components.redesign.css via Sprint 11.2. */
```

### Validação Sprint 11.6

- [ ] StockForm dentro de Modal: visual Santuário (inputs, botões, labels)
- [ ] TreatmentPlanForm: mesmos padrões
- [ ] TreatmentWizard: step dots com primary color, steps sem bg neon

---

## Sprint 11.7 — ExportDialog + ReportGenerator + EmergencyCardForm + DailyDoseModal CSS Redesign

**Arquivos a modificar:**
- `src/features/export/components/ExportDialog.css` (adicionar bloco no final)
- `src/features/reports/components/ReportGenerator.css` (adicionar bloco no final)
- `src/features/emergency/components/EmergencyCard.css` (adicionar bloco no final — **ATENÇÃO**: o EmergencyCardForm usa `EmergencyCard.css`, não `EmergencyCardForm.css`)
- `src/features/dashboard/components/DailyDoseModal.css` (adicionar bloco no final)

### ExportDialog.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .export-dialog {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

[data-redesign='true'] .export-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

[data-redesign='true'] .export-label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

[data-redesign='true'] .format-selector {
  display: flex;
  gap: 0.75rem;
}

[data-redesign='true'] .format-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-surface-container-low);
  border: 2px solid transparent;
  border-radius: var(--radius-card);
  cursor: pointer;
  transition: all 200ms ease-out;
  font-family: var(--font-body);
}

[data-redesign='true'] .format-option.selected {
  background: var(--color-surface-container-lowest);
  border-color: var(--color-primary);
}

[data-redesign='true'] .format-option input[type='radio'] {
  display: none;
}

[data-redesign='true'] .format-label {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

[data-redesign='true'] .date-range {
  display: flex;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  [data-redesign='true'] .date-range {
    flex-direction: column;
  }
}

[data-redesign='true'] .date-input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

[data-redesign='true'] .date-input-group label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--color-on-surface-variant);
}

[data-redesign='true'] .export-error {
  padding: 0.75rem 1rem;
  background-color: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-card);
  font-family: var(--font-body);
  font-size: 0.875rem;
}

[data-redesign='true'] .export-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--color-outline-ghost);
}
```

### ReportGenerator.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .report-generator {
  font-family: var(--font-body);
  color: var(--color-on-surface);
}

[data-redesign='true'] .report-generator .report-section {
  background: var(--color-surface-container-low);
  border: none;
  border-radius: var(--radius-card);
  padding: 1rem;
  margin-bottom: 1rem;
}

[data-redesign='true'] .report-generator .report-label {
  font-size: 0.875rem;
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

[data-redesign='true'] .report-generator .report-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
}

[data-redesign='true'] .report-generator .share-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

[data-redesign='true'] .report-generator .share-button {
  padding: 0.5rem 1rem;
  background: var(--color-surface-container-low);
  border: none;
  border-radius: var(--radius-full);
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  cursor: pointer;
  transition: background 200ms ease-out;
}

[data-redesign='true'] .report-generator .share-button:hover {
  background: var(--color-surface-container-high);
}
```

### EmergencyCard.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO (EmergencyCardForm)
   ============================================ */

[data-redesign='true'] .emergency-card-form {
  font-family: var(--font-body);
  color: var(--color-on-surface);
}

[data-redesign='true'] .emergency-card-form .contact-card {
  background: var(--color-surface-container-low);
  border: none;
  border-radius: var(--radius-card);
  padding: 1rem;
  margin-bottom: 0.75rem;
}

[data-redesign='true'] .emergency-card-form .allergy-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.75rem;
  background: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: var(--font-weight-medium);
}

[data-redesign='true'] .emergency-card-form .allergy-chip button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-size: 0.875rem;
}
```

### DailyDoseModal.css — adicionar no final:

```css
/* ============================================
   REDESIGN: SANTUÁRIO TERAPÊUTICO
   ============================================ */

[data-redesign='true'] .daily-dose-modal {
  font-family: var(--font-body);
  color: var(--color-on-surface);
}

[data-redesign='true'] .daily-dose-modal .dose-summary {
  background: var(--color-surface-container-low);
  border: none;
  border-radius: var(--radius-card);
  padding: 1rem;
  margin-bottom: 1rem;
}

[data-redesign='true'] .daily-dose-modal .dose-list-header {
  font-size: 0.75rem;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-on-surface-variant);
  margin-bottom: 0.5rem;
}
```

### Validação Sprint 11.7

- [ ] ExportDialog: format selector com cards selecionáveis (border primary quando selecionado)
- [ ] ExportDialog: date range inputs lado a lado em desktop, empilhados em mobile
- [ ] ExportDialog: checkboxes com accent-color primary
- [ ] ReportGenerator: sections com bg surface-container-low, sem borders neon
- [ ] ReportGenerator: share buttons como pills
- [ ] EmergencyCardForm: contact cards com bg surface-container-low
- [ ] EmergencyCardForm: allergy chips vermelhos (error-bg)
- [ ] DailyDoseModal: dose summary com bg surface-container-low
- [ ] Todos os dialogs abrem em Modal redesenhado (Sprint 11.1)

---

## Ordem de Execução Obrigatória

```
Sprint 11.1 (Modal)         ← PRIMEIRO — keystone, desbloqueia tudo
    ↓
Sprint 11.2 (Form Utilities) ← SEGUNDO — classes compartilhadas
    ↓
Sprints 11.3-11.7 (Forms individuais) ← em qualquer ordem
```

**Sprints 11.3-11.7 podem ser executados em QUALQUER ordem** porque todos dependem apenas de 11.1 + 11.2.

---

## Checklist Final da Wave 11

### Funcional
- [ ] TODOS os modais abrem com visual Santuário quando `[data-redesign="true"]`
- [ ] TODOS os forms dentro de modais usam inputs de 56px, Lexend, tokens de cor
- [ ] TODOS os botões de form usam gradient primary ou ghost/outline style
- [ ] ZERO visual neon visível em modais/forms quando redesign está ativo
- [ ] Sem redesign flag: ZERO mudança visual (neon antigo funciona normalmente)

### Técnico
- [ ] ZERO mudanças de lógica JSX (exceto Modal.jsx: `✕` → lucide `X`)
- [ ] ZERO novos arquivos criados (tudo em CSS existentes)
- [ ] `npm run validate:agent` passa (10-min kill switch)
- [ ] ESLint 0 erros novos
- [ ] Build Vite sem warnings novos

### Visual por componente
- [ ] Modal: overlay glass, card branco radius 2rem, bottom sheet mobile
- [ ] LogForm: segmented control pill, protocol info sem border
- [ ] MedicineForm: ANVISA badge verde, dosage grid 2fr+1fr
- [ ] ProtocolForm: time chips pills, titration section sem glow
- [ ] TitrationWizard: stage cards brancos, stage number em primary
- [ ] StockForm: form-row lado a lado, inputs Santuário
- [ ] TreatmentPlanForm: form básico Santuário
- [ ] TreatmentWizard: step dots, transitions preservadas
- [ ] ExportDialog: format cards selecionáveis, checkboxes accent primary
- [ ] ReportGenerator: sections com tonal bg, share buttons como pills
- [ ] EmergencyCardForm: contact cards, allergy chips vermelhos
- [ ] DailyDoseModal: dose summary com tonal bg

---

## Arquivos Modificados (resumo)

| Arquivo | Sprint | Tipo de Mudança |
|---------|--------|----------------|
| `src/shared/components/ui/Modal.jsx` | 11.1 | JSX mínimo: import lucide X, trocar `✕` |
| `src/shared/components/ui/Modal.css` | 11.1 | CSS: bloco `[data-redesign]` (~110 linhas) |
| `src/shared/styles/components.redesign.css` | 11.2 | CSS: form utility classes (~150 linhas) |
| `src/shared/components/log/LogForm.css` | 11.3 | CSS: bloco `[data-redesign]` (~70 linhas) |
| `src/features/medications/components/MedicineForm.css` | 11.4 | CSS: bloco `[data-redesign]` (~15 linhas) |
| `src/features/protocols/components/ProtocolForm.css` | 11.5 | CSS: bloco `[data-redesign]` (~80 linhas) |
| `src/features/protocols/components/TitrationWizard.css` | 11.5 | CSS: bloco `[data-redesign]` (~70 linhas) |
| `src/features/stock/components/StockForm.css` | 11.6 | CSS: bloco `[data-redesign]` (~10 linhas) |
| `src/features/protocols/components/TreatmentPlanForm.css` | 11.6 | CSS: bloco `[data-redesign]` (~10 linhas) |
| `src/features/protocols/components/TreatmentWizard.css` | 11.6 | CSS: bloco `[data-redesign]` (~40 linhas) |
| `src/features/export/components/ExportDialog.css` | 11.7 | CSS: bloco `[data-redesign]` (~80 linhas) |
| `src/features/reports/components/ReportGenerator.css` | 11.7 | CSS: bloco `[data-redesign]` (~50 linhas) |
| `src/features/emergency/components/EmergencyCard.css` | 11.7 | CSS: bloco `[data-redesign]` (~30 linhas) |
| `src/features/dashboard/components/DailyDoseModal.css` | 11.7 | CSS: bloco `[data-redesign]` (~25 linhas) |

**Total estimado:** ~14 arquivos, ~740 linhas CSS novo, 2 linhas JSX alterado

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Inline styles nos forms (ProtocolForm tem `style={{border: ...}}`) | Médio | `!important` no CSS redesign para overridar inline styles — documentado no Sprint 11.5 |
| CSS specificity conflicts com components.redesign.css existente | Baixo | Seletores `[data-redesign='true'] .classe` têm specificity alta o suficiente |
| ShakeEffect animations quebram com novos estilos | Baixo | ShakeEffect usa transform/opacity (GPU-only) — não conflita com redesign |
| Framer Motion variants no TreatmentWizard | Baixo | Framer anima transform/opacity; CSS redesign anima cores/bg — sem conflito |
| `padding-bottom: 120px` no LogForm para scroll | Médio | Redesign reduz para `1rem` pois Modal redesign tem padding correto no body |

---

*Last updated: 2026-03-29*
*Spec version: 1.0*
*Depends on: W0-W10C (all merged)*
*Blocks: W12 (Medicines view usa MedicineForm), W13 (Onboarding usa MedicineForm/ProtocolForm/StockForm)*
