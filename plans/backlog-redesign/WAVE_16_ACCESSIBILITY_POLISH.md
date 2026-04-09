# Wave 16 — Accessibility & Polish
## Spec de Execução — Meus Remédios Redesign

**Versão:** 1.0
**Data:** 2026-04-02
**Status:** ⏳ PENDENTE
**Branch alvo:** `feature/redesign/wave-15/accessibility-polish`
**PR base:** `main`
**Referência:** `MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`, seção 20

---

## Contexto e Objetivos

Wave 16 é a wave de **compliance de acessibilidade**. Com W0–W15, toda a UI do Santuário Terapêutico foi construída (incluindo Smart Insights em W15). W16 não adiciona features — ela **garante que tudo que foi construído seja usável por todos os usuários**, incluindo pessoas com deficiências motoras, visuais ou vestibulares.

**Objetivo central:** Alcançar **Lighthouse Accessibility Score ≥ 95** e garantir navegação completa por teclado, leitores de tela e contextos de motion reduzido.

### O que W15 NÃO é
- Não é refatoração visual — cores e layout não mudam
- Não adiciona features novas
- Não desfaz decisões de design — apenas adiciona camada semântica e behavioral

### Estado atual (pós W0–W14)

| Área | Estado | Prioridade |
|------|--------|------------|
| `BottomNavRedesign` — `role="navigation"`, `aria-current`, `aria-hidden` nos ícones | ✅ OK | — |
| `DailyDoseModal` — focus trap completo, `role="dialog"`, `aria-modal` | ✅ OK | — |
| `RingGaugeRedesign` — `aria-label` no container | ✅ OK | Mas usa `window.matchMedia` em vez de hook React |
| `Modal.jsx` — Escape key handler | ✅ Parcial | **Faltam**: `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap |
| `App.jsx` — `<main>` existe | ✅ Parcial | **Falta**: `id="main-content"` + skip link |
| `Calendar.jsx` — renderiza grid visual | ✅ Parcial | **Faltam**: ARIA grid pattern (`role="grid"`, `role="gridcell"`) |
| Page transitions em `App.jsx` | ⚠️ | Framer Motion sem `useReducedMotion` |
| `RingGaugeRedesign`, `SparklineAdesao`, `SwipeRegisterItem` | ⚠️ | `window.matchMedia` em render — não reativo a mudanças em runtime |
| `btn-sm` — `min-height: 40px` | ⚠️ | Abaixo do mínimo WCAG 2.5.5 de 44px |
| Form inputs — sem `aria-describedby` para erros | ⚠️ | Screen readers não anunciam mensagens de erro |
| `--color-outline` como placeholder — 4.3:1 ratio | ⚠️ | Abaixo do mínimo AA (4.5:1) para texto normal |

---

## Pré-requisitos (verificar antes de iniciar)

- [ ] W14 mergeada — `Modal.jsx` com redesign CSS completo
- [ ] `useFocusTrap` existe em `DailyDoseModal.jsx` (linha 61) para extração
- [ ] `useMotion.js` em `@shared/hooks/useMotion.js` existe (W5 ✅)
- [ ] `framer-motion` tem `useReducedMotion` hook disponível ✅

---

## Decisões de Arquitetura

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| `useFocusTrap` — local em DailyDoseModal ou extrair para shared? | **Extrair para `@shared/hooks/useFocusTrap.js`** | Modal.jsx precisa do mesmo hook; evita duplicação |
| `window.matchMedia` para reduced motion — deixar ou refatorar? | **Refatorar para `useReducedMotion()`** | `window.matchMedia` lê uma vez na render, não reage a mudanças em runtime; `useReducedMotion()` é reativo |
| ARIA para Calendar — `role="grid"` ou `role="listbox"`? | **`role="grid"`** | O padrão WAI-ARIA para date pickers é `role="grid"` com `role="gridcell"` |
| Skip link — onde colocar CSS? | **`src/shared/styles/index.css`** | É um componente global, CSS global é o lugar certo; `App.css` tem escopo limitado |
| Form `aria-describedby` — alterar todos os form components? | **Sim, apenas os usados no redesign** | MedicineForm, ProtocolForm, StockForm, LogForm são os críticos |
| Lighthouse score — testar com ou sem redesign flag? | **Com `?redesign=1`** | W15 audita APENAS o novo design |

---

## Sprint 15.1 — Skip Link & Semântica App-Level

### 15.1.1 — `App.jsx` — Skip link + `id` no `<main>`

**Arquivo:** `src/App.jsx`

**Mudança 1:** Adicionar import de `useReducedMotion` junto com os outros imports de framer-motion:

```jsx
// ANTES (linha ~1)
import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// DEPOIS
import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
```

**Mudança 2:** Em `AppInner()`, adicionar o hook antes do return (após os outros hooks/estados):

```jsx
// Adicionar após: const { isRedesignEnabled, enableRedesign } = useRedesign()
const shouldReduceMotion = useReducedMotion()
```

**Mudança 3:** Adicionar skip link ANTES do `<OnboardingProvider>` no return de `AppInner`:

```jsx
return (
  <OnboardingProvider>
    <DashboardProvider>
      {/* Skip to main content — visível apenas no focus, para navegação por teclado */}
      <a href="#main-content" className="skip-to-content">
        Ir para conteúdo principal
      </a>

      <div className="app-container" data-redesign={isRedesignEnabled ? 'true' : undefined}>
        {/* ... resto do JSX existente ... */}
```

**Mudança 4:** Adicionar `id="main-content"` ao `<main>`:

```jsx
// ANTES
<main
  className={
    isAuthenticated && isRedesignEnabled ? 'app-main main-with-sidebar' : 'app-main'
  }
  style={{ paddingBottom: isRedesignEnabled ? undefined : '80px' }}
>

// DEPOIS
<main
  id="main-content"
  className={
    isAuthenticated && isRedesignEnabled ? 'app-main main-with-sidebar' : 'app-main'
  }
  style={{ paddingBottom: isRedesignEnabled ? undefined : '80px' }}
>
```

**Mudança 5:** Aplicar `shouldReduceMotion` na page transition (dentro do `{isRedesignEnabled ? ... : ...}` block):

```jsx
// ANTES
{isRedesignEnabled ? (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={currentView}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {renderCurrentView()}
    </motion.div>
  </AnimatePresence>
) : (

// DEPOIS
{isRedesignEnabled ? (
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={currentView}
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
    >
      {renderCurrentView()}
    </motion.div>
  </AnimatePresence>
) : (
```

### 15.1.2 — `ViewSkeleton` — usar `role="status"` 

No mesmo `App.jsx`, localizar a função `ViewSkeleton()` (próxima às linhas 49-65):

```jsx
// ANTES
function ViewSkeleton() {
  return (
    <div
      style={{ ... }}
      aria-busy="true"
      aria-label="Carregando..."
    >
      Carregando...
    </div>
  )
}

// DEPOIS
function ViewSkeleton() {
  return (
    <div
      role="status"
      style={{ ... }}
      aria-busy="true"
      aria-label="Carregando view..."
    >
      <span className="sr-only">Carregando...</span>
    </div>
  )
}
```

### 15.1.3 — CSS do skip link em `src/shared/styles/index.css`

Adicionar ao final do arquivo `src/shared/styles/index.css`:

```css
/* ============================================
   SKIP TO MAIN CONTENT LINK — W15 Accessibility
   Visível apenas quando focado via teclado
   ============================================ */
.skip-to-content {
  position: absolute;
  top: -100%;
  left: 0;
  z-index: 9999;
  background: var(--color-primary, #006a5e);
  color: var(--color-on-primary, #ffffff);
  padding: 0.75rem 1.5rem;
  font-family: var(--font-body, Lexend, sans-serif);
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  border-radius: 0 0 0.5rem 0;
  transition: top 150ms ease-out;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.skip-to-content:focus-visible {
  top: 0;
  outline: 2px solid var(--color-on-primary, #ffffff);
  outline-offset: 2px;
}

/* Classe utilitária para texto visível apenas para screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Sprint 15.2 — Modal: Focus Trap, ARIA e Role

### 15.2.1 — Extrair `useFocusTrap` para shared hook

**Criar:** `src/shared/hooks/useFocusTrap.js`

Copiar a implementação de `DailyDoseModal.jsx` (linhas 61–107) e torná-la um hook exportável:

```js
/**
 * useFocusTrap — Hook para gerenciar focus trap dentro de um container.
 *
 * Captura o Tab dentro do container enquanto isOpen=true.
 * Restaura o foco ao elemento original quando isOpen vira false.
 *
 * @param {boolean} isOpen - Se o container está aberto/visível
 * @returns {{ containerRef: React.RefObject, handleKeyDown: Function }}
 *
 * @example
 * const { containerRef, handleKeyDown } = useFocusTrap(isOpen)
 * return <div ref={containerRef} onKeyDown={handleKeyDown}>...</div>
 */
import { useRef, useEffect } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(isOpen) {
  const containerRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      // Salvar elemento com foco antes de abrir
      previousFocusRef.current = document.activeElement

      // Focar no primeiro elemento focável após a animação de abertura
      const timer = setTimeout(() => {
        const firstFocusable = containerRef.current?.querySelector(FOCUSABLE_SELECTOR)
        firstFocusable?.focus()
      }, 100)

      return () => clearTimeout(timer)
    } else if (previousFocusRef.current) {
      // Restaurar foco ao fechar
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return

    const focusableElements = containerRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
    if (!focusableElements?.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault()
      lastElement.focus()
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault()
      firstElement.focus()
    }
  }

  return { containerRef, handleKeyDown }
}
```

### 15.2.2 — `DailyDoseModal.jsx` — usar hook compartilhado

**Arquivo:** `src/features/dashboard/components/DailyDoseModal.jsx`

**Mudança 1:** Adicionar import do shared hook:
```jsx
import { useFocusTrap } from '@shared/hooks/useFocusTrap'
```

**Mudança 2:** Remover a função `useFocusTrap` local (linhas 61–107) — substituída pelo import acima.

**Mudança 3:** Verificar que o chamador permanece igual:
```jsx
// Deve continuar funcionando sem alteração:
const { containerRef: modalRef, handleKeyDown } = useFocusTrap(isOpen)
```

**NOTA:** A mudança apenas troca a função local pelo import. O destructuring pode usar alias `containerRef: modalRef` para preservar o nome `modalRef` usado no JSX existente.

### 15.2.3 — `Modal.jsx` — ARIA + focus trap

**Arquivo:** `src/shared/components/ui/Modal.jsx`

Substituir o conteúdo completo por:

```jsx
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useFocusTrap } from '@shared/hooks/useFocusTrap'
import './Modal.css'

/**
 * Modal — Componente de diálogo modal reutilizável.
 *
 * ARIA: role="dialog", aria-modal="true", aria-labelledby vinculado ao título.
 * Focus: trap via useFocusTrap + restauração ao fechar.
 * Keyboard: Escape fecha o modal.
 *
 * @param {boolean} isOpen - Controla visibilidade
 * @param {Function} onClose - Callback de fechamento
 * @param {React.ReactNode} children - Conteúdo do modal
 * @param {string} title - Título exibido no header (opcional)
 */
export default function Modal({ isOpen, onClose, children, title }) {
  const { containerRef, handleKeyDown } = useFocusTrap(isOpen)

  // Bloquear scroll do body quando aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Fechar com Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      aria-hidden="false"
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-label={!title ? 'Diálogo' : undefined}
        ref={containerRef}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar diálogo"
            type="button"
          >
            <X size={20} aria-hidden="true" />
          </button>
          {title && (
            <h2 id="modal-title">{title}</h2>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
```

**Verificar:** As props de `Modal.jsx` não mudam (`isOpen`, `onClose`, `children`, `title`) — zero impacto em callers.

---

## Sprint 15.3 — Reduced Motion: Window.matchMedia → useReducedMotion

**Contexto:** Cinco arquivos usam `window.matchMedia('(prefers-reduced-motion: reduce)').matches` diretamente no corpo do componente. Isso é problemático porque:
1. `window` pode não existir em SSR (embora não seja o caso aqui)
2. Lê o valor uma única vez durante o render — não reage se o usuário muda a preferência em runtime
3. Inconsistente com o padrão estabelecido em `useMotion.js` que usa `useReducedMotion()` da Framer Motion

### 15.3.1 — `RingGaugeRedesign.jsx`

**Arquivo:** `src/features/dashboard/components/RingGaugeRedesign.jsx`

**Mudança 1:** Substituir import manual por hook React:
```jsx
// ANTES (no topo do arquivo — sem import de useReducedMotion)
import { motion } from 'framer-motion'

// DEPOIS
import { motion, useReducedMotion } from 'framer-motion'
```

**Mudança 2:** Substituir a variável no corpo do componente:
```jsx
// ANTES (linhas 23-24)
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// DEPOIS
const prefersReducedMotion = useReducedMotion()
```

**Verificar:** Após esta mudança, o uso de `prefersReducedMotion` no JSX (para controlar animações do SVG) permanece idêntico — apenas a fonte do valor muda.

### 15.3.2 — `SparklineAdesao.jsx`

**Arquivo:** `src/features/dashboard/components/SparklineAdesao.jsx`

Aplicar o mesmo padrão:

**Mudança 1:** Adicionar `useReducedMotion` ao import de framer-motion (verificar se `motion` já é importado):
```jsx
import { motion, useReducedMotion } from 'framer-motion'
// ou, se usar AnimatePresence:
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
```

**Mudança 2:** Substituir (localizar na linha ~307):
```jsx
// ANTES (linhas ~307-308)
const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// DEPOIS
const prefersReducedMotion = useReducedMotion()
```

### 15.3.3 — `SwipeRegisterItem.jsx`

**Arquivo:** `src/features/dashboard/components/SwipeRegisterItem.jsx`

Este arquivo usa `window.matchMedia?.(...).matches` inline dentro de um prop de transição (linha ~103). Aplicar o mesmo padrão:

**Mudança 1:** Adicionar import:
```jsx
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
```

**Mudança 2:** Adicionar o hook no corpo do componente (no topo, antes do return):
```jsx
const prefersReducedMotion = useReducedMotion()
```

**Mudança 3:** Substituir o uso inline:
```jsx
// ANTES (linha ~103)
transition={{
  duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 0.4,
  ease: 'easeOut',
}}

// DEPOIS
transition={{
  duration: prefersReducedMotion ? 0 : 0.4,
  ease: 'easeOut',
}}
```

**NOTA:** `RingGauge.jsx` (legacy, não-redesign) também tem este padrão. **NÃO alterar `RingGauge.jsx`** — será removido em W16. Alterar apenas os componentes do redesign.

---

## Sprint 15.4 — Calendar: ARIA Grid Pattern

**Arquivo:** `src/shared/components/ui/Calendar.jsx`

**Contexto:** O Calendar renderiza um grid 7×N de dias. Sem ARIA grid, leitores de tela navegam pelos botões/divs sem contexto de "qual coluna/linha" o dia está. O padrão WAI-ARIA para calendários date pickers é `role="grid"`.

**ATENÇÃO:** Calendar.jsx é um arquivo relativamente longo. **Ler o arquivo completo antes de editar**. Os pontos de mudança são localizados mas requerem entendimento da estrutura atual.

### 15.4.1 — Adicionar imports necessários

Verificar e adicionar `useId` se não existir:
```jsx
// Calendar.jsx já importa: import { useState, useEffect } from 'react'
// Adicionar useId para gerar ids únicos por instância:
import { useState, useEffect, useId } from 'react'
```

### 15.4.2 — Container do grid de dias

Localizar o elemento que envolve os dias do calendário (provavelmente `.calendar-grid`). Adicionar:
- `role="grid"` no container
- `aria-label` dinâmico com mês e ano

```jsx
// Encontrar o padrão atual: <div className="calendar-grid">
// Substituir por:
<div
  className="calendar-grid"
  role="grid"
  aria-label={`Calendário de ${viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
>
```

### 15.4.3 — Weekday headers

Localizar o container `.calendar-weekdays`. Cada item de dia da semana deve ser `role="columnheader"`:

```jsx
// Encontrar o padrão atual com os nomes dos dias (Dom, Seg, Ter...)
// Adicionar role="columnheader" em cada célula de cabeçalho:
<div className="calendar-weekdays" role="row" aria-hidden="false">
  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
    <div key={day} role="columnheader" aria-label={fullDayName(day)}>
      {day}
    </div>
  ))}
</div>
```

**Nota:** Se o componente já tem os nomes dos dias mapeados, apenas adicionar os atributos ARIA nos elementos existentes — não reescrever a lógica.

### 15.4.4 — Células de dias (week rows + day cells)

O grid atual é um flat `display: grid` com 7 colunas. Para ARIA grid ser correto, cada linha de 7 dias precisa de `role="row"`. Há duas abordagens:

**Opção A (menos JSX changes) — implicit rows via CSS grid:**
Nos day cells, adicionar apenas `role="gridcell"` e os atributos ARIA por dia. Os screen readers inferem a linha pela posição no grid. Esta é a abordagem mais pragmática para este calendário.

**Usar Opção A:**

Localizar onde os dias são renderizados (provavelmente um `.map()` sobre o array de dias do mês). Em cada célula de dia:

```jsx
// Encontrar o padrão atual da célula de dia:
// <div className={`calendar-day ${classes}`} onClick={...}>
//   <span className="day-number">{day}</span>
//   {hasLog && <span className="log-dot" />}
// </div>

// Substituir por:
<div
  className={`calendar-day ${classes}`}
  onClick={isEmptyDay ? undefined : () => onDayClick?.(dayDate)}
  role={isEmptyDay ? 'gridcell' : 'button'}
  aria-selected={isSelected}
  aria-current={isToday ? 'date' : undefined}
  aria-label={
    !isEmptyDay
      ? `${day} de ${viewDate.toLocaleDateString('pt-BR', { month: 'long' })}${isToday ? ', hoje' : ''}${hasLog ? ', com registros' : ''}`
      : undefined
  }
  tabIndex={isEmptyDay ? -1 : 0}
  onKeyDown={
    !isEmptyDay
      ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onDayClick?.(dayDate)
          }
        }
      : undefined
  }
>
```

**Variáveis necessárias (verificar se já existem no render de cada célula):**
- `isEmptyDay` — célula vazia (preenchimento do início do mês)
- `isSelected` — dia igual a `selectedDate`
- `isToday` — dia igual à data atual
- `hasLog` — dia está em `markedDates`
- `dayDate` — objeto Date para o dia
- `day` — número do dia (1-31)

**ATENÇÃO:** Estas variáveis podem ter nomes diferentes no código atual. Ler o Calendar.jsx completo para identificar os nomes exatos antes de editar.

### 15.4.5 — Estado de loading do Calendar

O Calendar tem um loading skeleton (`.calendar-skeleton`). Adicionar `aria-busy` e `aria-label`:

```jsx
// Encontrar o loading state no Calendar:
<div className="calendar-skeleton">
  {/* skeleton days */}
</div>

// Substituir por:
<div className="calendar-skeleton" aria-busy="true" aria-label="Carregando calendário">
  {/* skeleton days */}
</div>
```

---

## Sprint 15.5 — Forms: ARIA para Validação

**Contexto:** Os forms do redesign (MedicineForm, ProtocolForm, StockForm, LogForm) usam `.input-error` e `.input-error-message` para erros visuais. Screen readers não conseguem associar a mensagem de erro ao campo sem `aria-describedby`.

**ATENÇÃO:** Antes de editar qualquer form, ler o arquivo completo para entender o padrão de error state usado (é `state.errors`, `error`, `fieldError`, etc.).

### 15.5.1 — Padrão de implementação (aplicar em todos os forms)

Para cada campo de input com possível erro, o padrão é:

```jsx
{/* ANTES */}
<div className="form-group">
  <label className="form-label">Nome do medicamento</label>
  <input
    type="text"
    className={`form-control ${errors.name ? 'input-error' : ''}`}
    value={name}
    onChange={...}
  />
  {errors.name && (
    <span className="input-error-message">{errors.name}</span>
  )}
</div>

{/* DEPOIS */}
<div className="form-group">
  <label className="form-label" htmlFor="field-name">Nome do medicamento</label>
  <input
    id="field-name"
    type="text"
    className={`form-control ${errors.name ? 'input-error' : ''}`}
    value={name}
    onChange={...}
    aria-invalid={errors.name ? 'true' : undefined}
    aria-describedby={errors.name ? 'field-name-error' : undefined}
  />
  {errors.name && (
    <span id="field-name-error" className="input-error-message" role="alert">
      {errors.name}
    </span>
  )}
</div>
```

**Regras:**
- `id` no input: usar padrão `field-{nome-do-campo}` (ex: `field-name`, `field-dosage`)
- `htmlFor` no label: igual ao `id` do input
- `aria-invalid="true"` apenas quando há erro (não `aria-invalid="false"` quando OK)
- `aria-describedby`: aponta para `{id-input}-error`
- `id` na mensagem de erro: `{id-input}-error`
- `role="alert"` na mensagem de erro: anuncia imediatamente aos screen readers

### 15.5.2 — `MedicineForm.jsx`

**Arquivo:** `src/features/medications/components/MedicineForm.jsx`

Aplicar o padrão 15.5.1 em todos os campos:
- Campo `name` (nome do medicamento)
- Campo `dosage_per_pill` (dosagem por comprimido)
- Campo `dosage_unit` (unidade — select)
- Campo `medicine_type` (tipo — select)

**Antes de editar:** Ler o arquivo para identificar: (a) como o estado de erro é armazenado (`errors.name`? `error`? `fieldErrors.name`?), (b) se os campos já têm `id`/`htmlFor`.

```bash
grep -n "input-error\|error\|htmlFor\|aria-" src/features/medications/components/MedicineForm.jsx | head -30
```

### 15.5.3 — `ProtocolForm.jsx`

**Arquivo:** `src/features/protocols/components/ProtocolForm.jsx`

Aplicar o padrão 15.5.1 em todos os campos obrigatórios:
- `name` (nome do protocolo)
- `dosage_per_intake` (doses por tomada)
- `time_schedule` (horários — campo especial, pode ser array)
- `start_date` (data de início)

```bash
grep -n "input-error\|error\|htmlFor\|aria-" src/features/protocols/components/ProtocolForm.jsx | head -30
```

### 15.5.4 — `StockForm.jsx`

**Arquivo:** `src/features/stock/components/StockForm.jsx`

Aplicar o padrão 15.5.1 em:
- `quantity` (quantidade)
- `purchase_date` (data de compra)
- `unit_price` (preço unitário)

### 15.5.5 — `LogForm.jsx`

**Arquivo:** `src/features/log/components/LogForm.jsx` (ou `src/shared/components/log/`)

```bash
find src -name "LogForm.jsx" -type f
```

Aplicar o padrão 15.5.1 nos campos obrigatórios.

---

## Sprint 15.6 — Touch Targets: btn-sm e Chips

### 15.6.1 — `components.redesign.css` — `btn-sm` touch target

**Arquivo:** `src/shared/styles/components.redesign.css`

WCAG 2.5.5 (Level AA) requer 44×44px como minimum target size. O `btn-sm` atual tem `min-height: 40px`.

Localizar (linha ~56):
```css
[data-redesign='true'] .btn-sm {
  padding: 0.5rem 1rem;
  font-size: var(--text-title-sm);
  min-height: 40px;
}
```

Substituir por:
```css
[data-redesign='true'] .btn-sm {
  padding: 0.5rem 1rem;
  font-size: var(--text-title-sm);
  min-height: 44px; /* WCAG 2.5.5: mínimo 44px */
}
```

### 15.6.2 — Verificar chips de filtro em views redesenhadas

Os chips de filtro (`.filter-chip` ou similar) em `MedicinesRedesign` e outras views podem ter `min-height` inferior a 44px.

Verificar:
```bash
grep -rn "filter-chip\|chip\|tab-pill\|segment" \
  src/views/redesign/*.css \
  src/views/redesign/**/*.css \
  src/features/*/components/redesign/*.css \
  2>/dev/null | grep "min-height\|height:" | head -20
```

Para qualquer chip/tab menor que 44px, adicionar `min-height: 44px` no CSS respectivo.

### 15.6.3 — Verificar calendar day cells

As células do calendário usam `aspect-ratio: 1` — em telas estreitas podem ficar menores que 44px.

```bash
grep -A5 "aspect-ratio: 1" src/shared/components/ui/Calendar.css
```

Se a célula pode ficar abaixo de 44px em telas estreitas (ex: 320px de largura = 320/7 ≈ 46px por célula — marginalmente OK), garantir que `min-height` e `min-width` estejam definidos:

Adicionar em `components.redesign.css` (seção Calendar):
```css
[data-redesign='true'] .calendar-day {
  /* ... estilos existentes de W14.3 ... */
  min-height: 40px; /* Mínimo razoável — 7 colunas em 320px = ~45px natural */
  min-width: 40px;
}
```

---

## Sprint 15.7 — Color Contrast: Placeholder e Texto Terciário

### 15.7.1 — Verificar ratio de contraste

**Problema identificado:** `--color-outline: #6d7a76` usado como placeholder e texto terciário tem ratio aproximado de **4.3:1** contra `--color-surface-container-low: #f2f4f5` (background dos inputs). WCAG AA exige **4.5:1** para texto normal.

**Verificação obrigatória antes de fazer qualquer mudança:**

```bash
# Procurar todos os usos de --color-outline como cor de texto
grep -n "color: var(--color-outline)" src/shared/styles/components.redesign.css
grep -n "color:.*outline" src/shared/styles/components.redesign.css
```

**Calculadora de contraste**: Use a ferramenta WebAIM Contrast Checker ou similar:
- `#6d7a76` vs `#f2f4f5` → se ratio < 4.5:1, aplicar a mudança abaixo

### 15.7.2 — Fix: placeholder e texto terciário

Se confirmado que `#6d7a76` falha em algum contexto, localizar em `components.redesign.css` a regra de placeholder:

```css
/* ANTES (Sprint 3.3 existente) */
[data-redesign='true'] input::placeholder,
[data-redesign='true'] textarea::placeholder {
  color: var(--color-outline);
  opacity: var(--opacity-muted-text);
}
```

Substituir por:
```css
/* DEPOIS — usa on-surface-variant com opacity para aparência de placeholder */
[data-redesign='true'] input::placeholder,
[data-redesign='true'] textarea::placeholder {
  /* on-surface-variant (#3e4946) com opacity fornece contraste adequado
     enquanto visualmente distingue placeholder de valor preenchido */
  color: var(--color-on-surface-variant);
  opacity: 0.55; /* Suficiente para 4.5:1 com a cor escolhida */
}
```

**Verificação:** `#3e4946` a 55% de opacity sobre `#f2f4f5`:
- Cor efetiva ≈ `#8c9390` — verificar se ratio é ≥ 4.5:1 contra `#f2f4f5`
- Se não atingir 4.5:1, reduzir opacity para `0.65` ou remover opacity completamente

### 15.7.3 — Texto tertiary (`.text-tertiary` / `--color-outline`)

Verificar contextos onde `--color-outline` (#6d7a76) é usado como cor de corpo de texto (não apenas placeholder):

```bash
grep -rn "color: var(--color-outline\|color: var(--text-tertiary" \
  src/views/redesign/*.jsx \
  src/features/*/components/redesign/*.jsx \
  2>/dev/null | head -20
```

Para cada caso onde texto pequeno (<18pt, não bold) usa `--color-outline`:
- Se ratio < 4.5:1: mudar para `--color-on-surface-variant` (#3e4946)
- Se é texto informativo/metadata em tamanho grande (≥18pt ou ≥14pt bold): pode manter (AA para large text = 3:1)

---

## Sprint 15.8 — Auditoria Final: Focus Ring em Todos os Interativos

### 15.8.1 — Verificar focus-visible globalmente

**Arquivo:** `src/shared/styles/components.redesign.css`

Confirmar que o focus ring sanctuary está aplicado em TODOS os elementos interativos:

```bash
grep -n "focus-visible" src/shared/styles/components.redesign.css
```

Espera-se ver regras para: `.btn:focus-visible`, `input:focus-visible`, `select:focus-visible`, `textarea:focus-visible`.

**Adicionar se faltarem:**
```css
/* Sprint 15.8 — Focus ring universal */
[data-redesign='true'] *:focus-visible {
  outline: 2px solid var(--color-primary, #006a5e);
  outline-offset: 2px;
}

/* Excluir elementos que têm focus styling próprio */
[data-redesign='true'] input:focus-visible,
[data-redesign='true'] textarea:focus-visible,
[data-redesign='true'] select:focus-visible {
  /* inputs já têm border-color: var(--color-primary) no focus */
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 106, 94, 0.2);
}
```

### 15.8.2 — Verificar cards clicáveis

Views como `StockRedesign`, `TreatmentsRedesign`, `HealthHistoryRedesign` têm cards com `onClick`. Verificar se têm `tabIndex` e `onKeyDown`:

```bash
grep -rn "onClick.*card\|card.*onClick" src/views/redesign/*.jsx | head -15
grep -rn "onClick" src/features/*/components/redesign/*.jsx | grep -v "button\|btn\|Button" | head -20
```

Para qualquer `<div>` ou `<article>` com `onClick` que NÃO seja dentro de um `<button>`:
```jsx
// Se não pode ser convertido para <button> (ex: card com múltiplos elementos interativos internos):
<div
  onClick={handleClick}
  role="button"   // ← adicionar
  tabIndex={0}    // ← adicionar
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } }}  // ← adicionar
>
```

---

## Sprint 15.9 — Heading Hierarchy Audit

### 15.9.1 — Verificar hierarquia de headings por view

Executar para cada view redesenhada:

```bash
grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/DashboardRedesign.jsx
grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/MedicinesRedesign.jsx
grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/TreatmentsRedesign.jsx
grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/StockRedesign.jsx
grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/HealthHistoryRedesign.jsx
grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/ProfileRedesign.jsx
grep -n "<h1\|<h2\|<h3\|<h4" src/views/redesign/SettingsRedesign.jsx
```

**Regra WCAG 1.3.1 — Heading hierarchy:**
- Exatamente UM `<h1>` por page (título da view)
- Seções usam `<h2>`
- Subsections usam `<h3>`
- Sem pular níveis (`<h1>` → `<h3>` sem `<h2>` intermediário é inválido)

**Issues conhecidos do DashboardRedesign:**
- Tem `<h1>` para saudação (`Olá, {userName}`) — **correto**
- Verificar se seções abaixo (PriorityDoseCard, CronogramaPeriodo) usam `<h2>` ou `<h3>` para seus títulos internos

**Para cada violação encontrada:** Corrigir o nível do heading para respeitar a hierarquia. Esta é uma mudança no JSX apenas — sem impacto visual já que o CSS de headings usa classes (`title-lg`, etc.) e não os elementos HTML diretamente.

### 15.9.2 — Verificar que Consultation não tem `<h1>` dentro de Modal

`ConsultationRedesign.jsx` pode ser aberta de forma modal ou como view. Verificar que quando aberta como view tem `<h1>` e quando em modal não conflita com o `<h1>` da view pai.

```bash
grep -n "<h1\|<h2\|<h3" src/features/consultation/components/redesign/ConsultationViewRedesign.jsx
```

---

## Resumo de Arquivos Modificados / Criados

| Ação | Arquivo | Sprint |
|------|---------|--------|
| **CREATE** | `src/shared/hooks/useFocusTrap.js` | 15.2.1 |
| **EDIT** | `src/App.jsx` | 15.1.1 |
| **EDIT** | `src/shared/styles/index.css` | 15.1.3 |
| **EDIT** | `src/shared/components/ui/Modal.jsx` | 15.2.3 |
| **EDIT** | `src/features/dashboard/components/DailyDoseModal.jsx` | 15.2.2 |
| **EDIT** | `src/features/dashboard/components/RingGaugeRedesign.jsx` | 15.3.1 |
| **EDIT** | `src/features/dashboard/components/SparklineAdesao.jsx` | 15.3.2 |
| **EDIT** | `src/features/dashboard/components/SwipeRegisterItem.jsx` | 15.3.3 |
| **EDIT** | `src/shared/components/ui/Calendar.jsx` | 15.4 |
| **EDIT** | `src/features/medications/components/MedicineForm.jsx` | 15.5.2 |
| **EDIT** | `src/features/protocols/components/ProtocolForm.jsx` | 15.5.3 |
| **EDIT** | `src/features/stock/components/StockForm.jsx` | 15.5.4 |
| **EDIT** | `src/shared/styles/components.redesign.css` | 15.6.1, 15.7.2, 15.8.1 |

**Total:** 1 arquivo criado + 12 arquivos editados.

**Arquivos auditados (sem mudança garantida, mas verificar):**
- Todos em `src/views/redesign/*.jsx` — heading hierarchy (S15.9)
- Todos os `.jsx` com `onClick` em `<div>` — cards clicáveis (S15.8.2)
- `src/features/*/components/redesign/*.css` — touch targets (S15.6.2)

---

## Ordem de Execução Recomendada

```
S15.1 (App.jsx: skip link, main id, reduced motion, ViewSkeleton)
  → S15.2 (useFocusTrap + Modal ARIA) ← depende de S15.1 (import paths)
  → S15.3 (window.matchMedia fixes) [paralelo a S15.2]
  → S15.4 (Calendar ARIA) [paralelo a S15.2 e S15.3]
  → S15.5 (Forms aria-describedby) [paralelo a tudo acima]
  → S15.6 (Touch targets) [paralelo]
  → S15.7 (Color contrast) [paralelo]
  → S15.8 (Focus ring audit) [deve ser depois de S15.1]
  → S15.9 (Heading hierarchy audit) [independente, pode ser em paralelo]
```

**Sprints independentes entre si:** 15.3, 15.4, 15.5, 15.6, 15.7, 15.9
**Dependência crítica:** S15.2 deve vir após S15.2.1 (criar hook antes de usar no Modal)

---

## Checklist de Validação Pré-Merge

### Automática
- [ ] `npm run validate:agent` passa (0 erros)
- [ ] Build de produção: `npm run build` sem erros
- [ ] Nenhum console error em browser com `?redesign=1`

### Lighthouse (executar no Chrome DevTools com `?redesign=1`)
- [ ] Accessibility score ≥ 95
- [ ] Performance score não caiu mais que 5 pontos vs. linha de base pré-W15
- [ ] Best Practices ≥ 90

### Screen Reader (VoiceOver macOS ou NVDA Windows)
- [ ] Navegar para Dashboard via Tab: skip link aparece e funciona
- [ ] Abrir Modal (qualquer): foco vai para primeiro elemento dentro, Esc fecha e restaura foco
- [ ] Navegar BottomNav via Tab: `aria-current="page"` é anunciado
- [ ] Navegar Calendar via Tab: dias são anunciados como "15 de abril, com registros"
- [ ] Enviar MedicineForm com campo vazio: erro é anunciado pelo screen reader

### Teclado (sem mouse)
- [ ] Skip link visível ao primeiro Tab na página
- [ ] Todos os botões, inputs, selects, cards clicáveis acessíveis via Tab
- [ ] Modal fecha com Escape; foco retorna ao botão que a abriu
- [ ] Calendar: dias navegáveis com Tab; Enter/Espaço seleciona

### Reduced Motion
- [ ] Com `prefers-reduced-motion: reduce` (System Preferences > Accessibility > Reduce Motion):
  - [ ] Page transitions em App.jsx: sem animação (opacity instantâneo)
  - [ ] RingGaugeRedesign: sem animação de preenchimento do arco
  - [ ] Confetti (W14): não aparece ou aparece sem movimento
  - [ ] Modal open/close: sem scale animation (apenas aparece/desaparece)

### Touch Targets
- [ ] Abrir DevTools > Device Toolbar > 320px viewport
- [ ] Todos os botões e targets interativos ≥ 44px de altura
- [ ] BottomNav items ≥ 56px ✅ (confirmar que não regrediu)
- [ ] Calendar day cells: verificar tamanho mínimo em 320px

### Color Contrast
- [ ] Usar DevTools > Elements > Accessibility Tab ou extensão axe-core para verificar
- [ ] Texto de formulário (labels, valores) ≥ 4.5:1 em todos os campos
- [ ] Placeholder text ≥ 4.5:1 (verificar especialmente após S15.7)
- [ ] Badge text em todos os variants ≥ 4.5:1
- [ ] White text em `--gradient-primary` background ≥ 4.5:1

---

## Critério de Conclusão Wave 15

- [ ] **Lighthouse Accessibility score ≥ 95** (com `?redesign=1` ativo)
- [ ] Semantic HTML correto em todas as views redesenhadas
- [ ] ARIA labels em todos os widgets de dados (RingGauge, Calendar, Progress bars)
- [ ] Focus ring visível em TODOS os elementos interativos
- [ ] Modal com focus trap funcional + `role="dialog"` + `aria-modal`
- [ ] Skip-to-content link funcional
- [ ] Touch targets ≥ 44px (botões primários ≥ 56px)
- [ ] `prefers-reduced-motion` respeitado — ZERO `window.matchMedia` em componentes redesign
- [ ] `aria-describedby` em todos os form fields com possível erro
- [ ] Calendar acessível via teclado com ARIA grid pattern
- [ ] Keyboard navigation completa: Tab circula por todos os interativos, Enter/Espaço ativa, Esc fecha dialogs

---

## Riscos e Mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Calendar.jsx: estrutura do JSX mais complexa do que o assumido; nomes de variáveis diferentes | Alta | Médio | **Ler o arquivo completo antes de editar.** As changes de ARIA são aditivas — adicionar atributos ao JSX existente sem reestruturar |
| `Modal.jsx` + focus trap: callers passam children com estrutura complexa que quebra o focus trap | Média | Médio | O `useFocusTrap` é permissivo — funciona para qualquer filho focável. Se `setTimeout(100)` não for suficiente para animações lentas, aumentar para `150` |
| `DailyDoseModal.jsx`: após remover a função local `useFocusTrap` e importar a shared, o destructuring com `containerRef: modalRef` pode quebrar se outros usos de `modalRef` existirem | Baixa | Alto | Verificar todos os usos de `modalRef` no arquivo antes de remover. Alternativa: manter nome `containerRef` e atualizar os usos de `modalRef` em todo o arquivo |
| Forms: padrão de error state varia por form (`errors.name`? `fieldErrors?.name`? `nameError`?) | Alta | Médio | **Grep obrigatório antes de editar cada form.** Adaptar o padrão 15.5.1 ao naming real do componente |
| `SparklineAdesao.jsx` usa `useReducedMotion` em múltiplos lugares | Baixa | Baixo | Adicionar o hook uma vez no topo do componente e usar a variável em todos os locais |
| Color contrast S15.7: opacity calculada pode não atingir 4.5:1 na prática | Média | Baixo | Verificar com DevTools antes de commitar. Se necessário, usar `--color-on-surface-variant` diretamente sem opacity |
| Heading hierarchy: algumas views redesenhadas podem usar `<h2>` para título da view (não `<h1>`) por terem sido criadas sem contexto de heading level | Média | Baixo | Corrigir para `<h1>` — é CSS-safe pois os estilos usam classes, não o elemento HTML |
| `btn-sm` 40px → 44px: pode causar leve shift de layout em views que usam btn-sm em espaços compactos | Baixa | Baixo | Verificar visualmente após mudança. 4px a mais raramente quebra layouts |

---

## Nota sobre W16 (próxima e última wave)

W15 é a **última wave de conteúdo**. Após merge de W15:
- **W16 (Rollout Promotion & Legacy Cleanup)** remove o feature flag, faz merge de tokens, remove views legacy e renomeia componentes `*Redesign` para seus nomes definitivos
- W15 **não deve remover código legacy** — essa é responsabilidade de W16
- A presença de `useFocusTrap` em `DailyDoseModal.jsx` como local function (removida em W15.2.2) e importada de shared é a abordagem correta; W16 não precisa reverter isso
- O `useFocusTrap.js` criado em W15 permanece em `@shared/hooks/` e é promovido junto com os outros shared hooks em W16

---

*Spec autorizada por: Arquitetura Meus Remédios v3.3+*
*Modelos alvo: claude-sonnet-4-6 (execução recomendada — ARIA requer reasoning mais profundo), claude-haiku-4-5 (aceitável para sprints mecânicos: S15.3, S15.6)*
