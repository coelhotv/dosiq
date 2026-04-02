# Wave 14 — Shared Components & Chatbot
## Spec de Execução — Meus Remédios Redesign

**Versão:** 1.0
**Data:** 2026-04-01
**Status:** ⏳ PENDENTE
**Branch alvo:** `feature/redesign/wave-14/shared-components-chatbot`
**PR base:** `main`
**Referência:** `MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md`, seção 19

---

## Contexto e Objetivos

Wave 14 é a penúltima wave de conteúdo do redesign. Com W0–W13, todas as **views e flows** principais foram redesenhados. W14 é o **"sweep global"**: componentes compartilhados que aparecem dentro das views já redesenhadas mas ainda carregam visual neon quando `isRedesignEnabled = true`.

**Objetivo central:** Eliminar **100% dos pixels neon** visíveis quando o feature flag está ativo. Ao final de W14, um usuário redesign não deve ver nenhum spinner neon, nenhum alerta com emoji, nenhum calendário com `rgba(0, 240, 255, ...)`.

**Escopo técnico:**
- Componentes shared em `src/shared/components/ui/`
- Componentes PWA (`InstallPrompt`)
- Chatbot drawer (`ChatWindow`)
- Gamification (`BadgeDisplay`, `MilestoneCelebration`, `ConfettiAnimation`)
- View administrativa (`DLQAdmin`)
- Promoção de `ConfirmDialog` para shared (preparação para ChatWindow)

---

## Pré-requisitos (verificar antes de iniciar)

- [ ] W11 (Forms & Modals) mergeada → Modal.jsx redesenhado existe
- [ ] W12 (Medicines & Consultation) mergeada → `ConfirmDialog.jsx` existe em `src/features/medications/components/`
- [ ] W13 (Landing/Auth/Onboarding) mergeada → onboarding usa sanctuary theme
- [ ] Design tokens `tokens.redesign.css` disponíveis (W0 ✅)
- [ ] `components.redesign.css` disponível com W3 foundation (Button, Card, Badge, Progress) ✅

---

## Decisões de Arquitetura

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Onde vai o CSS das primitivas? | `src/shared/styles/components.redesign.css` | Padrão estabelecido em W3 — um arquivo central para overrides de primitivas |
| ChatWindow usa CSS Modules? | Sim, mantém `.module.css` | CSS Modules não aceita seletores `[data-redesign]` de classe global — usar `:global([data-redesign='true']) .className` |
| ConfirmDialog: permanecer em medications ou mover? | **Mover para `@shared/components/ui/`** | ChatWindow precisa de confirm sanctuary. Mover evita dependência cruzada features |
| Calendar: novo arquivo ou `components.redesign.css`? | `components.redesign.css` (nova seção W14.3) | Consistência com o padrão W3 |
| DLQAdmin: criar `DLQAdminRedesign.jsx`? | **Não — redesign direto no CSS** | View admin-only; só admin usa; criar variante seria overhead sem valor |
| AlertList: alterar emoji icons globalmente? | **Sim** — Lucide é melhor globalmente | Lucide é mais consistente que emojis; não é regressão para usuários legacy |
| OfflineBanner: redesign no CSS de quem? | `OfflineBanner.css` (arquivo próprio, scoped redesign) | Componente tem CSS próprio já; adicionar override nele |
| ThemeToggle: novo sprint? | Não — audit rápido, incluído em S14.1 | Nenhum change necessário se TokenRedesign já sobrescreve `--accent-primary` |
| FloatingActionButton legacy: tocar? | **Não** — componente já substituído em App.jsx pelo FAB inline | Não há regressão; arquivo pode coexistir |

---

## Tokens do Design System (referência rápida W14)

```
/* Backgrounds */
--color-surface-container-lowest: #ffffff
--color-surface-container-low:    #f2f4f5
--color-surface-container:        #eceeef
--color-surface:                  #f8fafb

/* Primary */
--color-primary:          #006a5e
--color-primary-container:#008577
--color-primary-fixed:    #90f4e3
--color-on-primary:       #ffffff
--gradient-primary:       linear-gradient(135deg, #006a5e, #008577)

/* Secondary */
--color-secondary:        #005db6

/* Error */
--color-error:            #ba1a1a
--color-error-bg:         #ffdad6

/* Warning */
--color-warning:          #f59e0b
--color-warning-bg:       rgba(245, 158, 11, 0.08)

/* Text */
--color-on-surface:         #191c1d
--color-on-surface-variant: #3e4946

/* Borders */
--color-outline-variant: #c9ded8
--color-outline:         #6d7a76

/* Shadows */
--shadow-ambient:   0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)
--shadow-editorial: 0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)
--shadow-error:     0 4px 12px rgba(186, 26, 26, 0.2)

/* Radii */
--radius-card:    1rem
--radius-card-sm: 0.75rem
--radius-button:  0.75rem

/* Typography */
--text-title-lg: var(--font-size-xl)
--text-title-sm: var(--font-size-sm)
--text-body-lg:  var(--font-size-base)
--text-label-md: var(--font-size-sm)
--font-display:  var(--font-family-heading)
```

---

## Sprint 14.0 — Preparação: ConfirmDialog → `@shared/components/ui/`

**Contexto:** `ConfirmDialog.jsx` foi criado em W12 dentro de `src/features/medications/components/`. ChatWindow (S14.5) precisa do mesmo componente. Antes de S14.5, mover ConfirmDialog para shared.

**Regra:** Não alterar a API do componente (props) — apenas relocar os arquivos e atualizar imports.

### 14.0.1 — Mover arquivos

```bash
# Copiar (não delete original ainda — faça o diff para garantir)
cp src/features/medications/components/ConfirmDialog.jsx \
   src/shared/components/ui/ConfirmDialog.jsx

cp src/features/medications/components/ConfirmDialog.css \
   src/shared/components/ui/ConfirmDialog.css
```

### 14.0.2 — Atualizar import no `ConfirmDialog.jsx` moved copy

Arquivo: `src/shared/components/ui/ConfirmDialog.jsx`

- **Verificar:** O import do CSS deve apontar para `'./ConfirmDialog.css'` (sem mudança de caminho pois está no mesmo diretório)
- **Verificar:** Se usa `Modal` do shared, o path deve ser `'./Modal'` (já estava correto provavelmente — confirmar)

### 14.0.3 — Atualizar `MedicinesRedesign.jsx`

Arquivo: `src/views/redesign/MedicinesRedesign.jsx`

Trocar:
```jsx
import ConfirmDialog from '@medications/components/ConfirmDialog'
```
Por:
```jsx
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
```

### 14.0.4 — Remover arquivos originais de medications

```bash
rm src/features/medications/components/ConfirmDialog.jsx
rm src/features/medications/components/ConfirmDialog.css
```

### 14.0.5 — Verificar build

```bash
npm run build -- --mode development 2>&1 | grep -i "error\|ConfirmDialog"
```

Não deve haver erros de import. Se houver, rastrear com:
```bash
grep -r "ConfirmDialog" src/ --include="*.jsx" --include="*.js"
```

---

## Sprint 14.1 — Core Primitives: EmptyState + Auditoria

**Contexto:** Button (W3.1), Card (W3.2), Badge (W3.4) já possuem redesign CSS em `components.redesign.css`. EmptyState ainda não tem. ThemeToggle só precisa de audit.

### 14.1.1 — Verificar completude de Button, Card, Badge

Execute e confirme que não há regressão visual nos 3 componentes:
```bash
grep -n "btn-primary\|btn-secondary\|btn-danger\|btn-ghost\|btn-outline\|\.card\|\.badge" \
  src/shared/styles/components.redesign.css | head -30
```

Espera-se ver regras para: `btn-primary`, `btn-secondary`, `btn-outline`, `btn-ghost`, `btn-danger`, `btn-sm`, `btn-md`, `btn-lg`, `card-default`, `card-gradient`, `card-alert-critical`, `card-alert-warning`, `badge`, `badge-success`, `badge-warning`, `badge-error`, `badge-info`, `badge-neutral`.

Se algum estiver faltando, adicionar conforme tokens acima. Se todos existirem, prosseguir sem alterações.

### 14.1.2 — ThemeToggle audit

Verificar `src/shared/components/ui/ThemeToggle.jsx`:
```bash
grep -n "neon\|accent-primary\|rgb(0, 240" src/shared/components/ui/ThemeToggle.css 2>/dev/null || echo "NO CSS FILE"
```

Se o arquivo não usar variáveis neon hardcoded (apenas `--color-primary`, `--text-primary`, etc.), nenhuma mudança é necessária, pois `tokens.redesign.css` já sobrescreve `--color-primary` para `#006a5e` quando redesign está ativo.

Se encontrar `var(--neon-cyan)` ou similares, adicionar override em `components.redesign.css`:
```css
/* Sprint 14.1 — ThemeToggle */
[data-redesign='true'] .theme-toggle-btn {
  color: var(--color-on-surface-variant);
}
[data-redesign='true'] .theme-toggle-btn:hover {
  background: var(--state-hover);
  color: var(--color-on-surface);
}
[data-redesign='true'] .theme-toggle-btn.active {
  color: var(--color-primary);
}
```

### 14.1.3 — EmptyState redesign CSS

Adicionar ao final de `src/shared/styles/components.redesign.css`:

```css
/* ============================================
   SPRINT 14.1 — EMPTYSTATE REDESIGN
   ============================================ */

[data-redesign='true'] .empty-state {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-ambient);
  border: none;
  padding: 2rem;
  text-align: center;
  transition: box-shadow 300ms ease-out;
}

[data-redesign='true'] .empty-state:hover {
  box-shadow: var(--shadow-editorial);
}

[data-redesign='true'] .empty-state__illustration {
  margin-bottom: 1.5rem;
}

[data-redesign='true'] .empty-state__illustration svg {
  /* Garantir que --color-primary nos SVGs inline usa a cor sanctuary */
  /* Não é necessário override — os tokens já sobrescrevem automaticamente */
  max-width: 160px;
  height: auto;
}

[data-redesign='true'] .empty-state__title {
  font-family: var(--font-display);
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  margin: 0 0 0.5rem 0;
}

[data-redesign='true'] .empty-state__description {
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
}

[data-redesign='true'] .empty-state__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-bold);
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-button);
  cursor: pointer;
  min-height: 48px;
  transition: all 200ms ease-out;
  box-shadow: var(--shadow-primary);
}

[data-redesign='true'] .empty-state__cta:hover {
  transform: scale(1.02);
}

[data-redesign='true'] .empty-state__cta:active {
  transform: scale(0.98);
}
```

---

## Sprint 14.2 — Feedback Components: Loading, AlertList, OfflineBanner

### 14.2.1 — Loading.jsx — adicionar variante skeleton

**Arquivo:** `src/shared/components/ui/Loading.jsx`

Substituir o conteúdo completo por:

```jsx
import './Loading.css'

/**
 * Loading — indicador de carregamento (spinner ou skeleton).
 *
 * @param {'md'|'sm'|'lg'} size - Tamanho do spinner
 * @param {string} text - Texto exibido abaixo do spinner
 * @param {'spinner'|'skeleton'} variant - 'skeleton' para lazy-loaded content
 * @param {number} lines - Número de linhas skeleton (default 3, só para variant='skeleton')
 */
export default function Loading({
  size = 'md',
  text = 'Carregando...',
  variant = 'spinner',
  lines = 3,
}) {
  if (variant === 'skeleton') {
    return (
      <div className="loading-skeleton" aria-busy="true" aria-label="Carregando conteúdo">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="loading-container">
      <div className={`loading-spinner loading-${size}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  )
}
```

**Nota:** A API original (`size`, `text`) permanece totalmente compatível. `variant` é novo prop opcional.

### 14.2.2 — Loading.css — redesign override + skeleton CSS

Adicionar ao final de `src/shared/components/ui/Loading.css`:

```css
/* Redesign overrides — sanctuary theme */
[data-redesign='true'] .spinner-ring:nth-child(1) {
  border-top-color: var(--color-primary);
}

[data-redesign='true'] .spinner-ring:nth-child(2) {
  border-top-color: var(--color-primary-fixed);
}

[data-redesign='true'] .spinner-ring:nth-child(3) {
  border-top-color: color-mix(in srgb, var(--color-primary) 60%, white);
}

[data-redesign='true'] .loading-text {
  color: var(--color-on-surface-variant);
}

/* Skeleton variant — shimmer lines para lazy content */
.loading-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  width: 100%;
}

.skeleton-line {
  height: 1rem;
  background: linear-gradient(
    90deg,
    var(--color-surface-container, #eceeef) 25%,
    var(--color-surface-container-low, #f2f4f5) 50%,
    var(--color-surface-container, #eceeef) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 0.5rem;
}

.skeleton-line:first-child {
  height: 1.5rem;
  width: 40% !important;
}

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Respeitar prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
    background: var(--color-surface-container, #eceeef);
  }
}
```

**Nota:** O skeleton usa apenas tokens sanctuary (`--color-surface-container`, `--color-surface-container-low`). No modo neon, estas variáveis não existem ou têm fallback para cinza neutro — comportamento gracioso.

### 14.2.3 — AlertList.jsx — substituir emoji por Lucide icons

**Arquivo:** `src/shared/components/ui/AlertList.jsx`

**Mudança 1:** Adicionar imports Lucide no topo do arquivo (após `import { useState }`):

```jsx
import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
```

**Mudança 2:** Substituir a linha do ícone de severity (linha ~73 atual):

Trocar:
```jsx
<div className="alert-list__item-icon">
  {alert.severity === 'critical' ? '⚠️' : alert.severity === 'warning' ? '⚡' : 'ℹ️'}
</div>
```

Por:
```jsx
<div className="alert-list__item-icon" aria-hidden="true">
  {alert.severity === 'critical' && <AlertTriangle size={16} />}
  {alert.severity === 'warning'  && <AlertCircle size={16} />}
  {alert.severity === 'info'     && <Info size={16} />}
  {!['critical', 'warning', 'info'].includes(alert.severity) && <Info size={16} />}
</div>
```

**Mudança 3:** Para o `emptyIcon` (prop) — NÃO alterar, permanece como emoji configurável pelos callers.

### 14.2.4 — AlertList.css — redesign override

Adicionar ao final de `src/shared/components/ui/AlertList.css`:

```css
/* ============================================
   AlertList — Redesign (Sanctuary)
   ============================================ */

[data-redesign='true'] .alert-list--stock {
  background: var(--color-surface-container-lowest);
  border: none;
  box-shadow: var(--shadow-ambient);
  border-radius: var(--radius-card);
}

[data-redesign='true'] .alert-list--stock.alert-list--empty {
  border: none;
}

[data-redesign='true'] .alert-list__header {
  border-bottom: none;
  background: transparent;
  padding: 1.25rem 1.25rem 0.5rem;
}

[data-redesign='true'] .alert-list__title {
  font-family: var(--font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

[data-redesign='true'] .alert-list__badge {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 999px;
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-bold);
  padding: 0.125rem 0.5rem;
  min-width: 1.25rem;
  text-align: center;
}

[data-redesign='true'] .alert-list__item {
  border-radius: var(--radius-card-sm);
  margin: 0.25rem 0.75rem;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border: none;
}

[data-redesign='true'] .alert-list__item--critical {
  background: var(--color-error-bg);
  color: var(--color-error);
}

[data-redesign='true'] .alert-list__item--warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

[data-redesign='true'] .alert-list__item--info {
  background: rgba(0, 106, 94, 0.05);
  color: var(--color-primary);
}

[data-redesign='true'] .alert-list__item-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-top: 0.125rem;
}

[data-redesign='true'] .alert-list__item-title {
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-semibold);
  color: inherit;
  margin: 0 0 0.25rem 0;
}

[data-redesign='true'] .alert-list__item-message {
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0;
  line-height: 1.5;
}

[data-redesign='true'] .alert-list__btn--primary {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-button);
  padding: 0.375rem 0.875rem;
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all 200ms ease-out;
  min-height: 36px;
}

[data-redesign='true'] .alert-list__btn--primary:hover {
  transform: scale(1.02);
}

[data-redesign='true'] .alert-list__btn--secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1.5px solid var(--color-outline-variant);
  border-radius: var(--radius-button);
  padding: 0.375rem 0.875rem;
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all 200ms ease-out;
  min-height: 36px;
}

[data-redesign='true'] .alert-list__expand-btn {
  margin: 0.5rem 0.75rem 0.75rem;
  padding: 0.5rem;
  background: transparent;
  border: none;
  color: var(--color-primary);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  text-align: center;
  display: block;
  width: calc(100% - 1.5rem);
  border-radius: var(--radius-card-sm);
  transition: background 200ms ease-out;
}

[data-redesign='true'] .alert-list__expand-btn:hover {
  background: var(--state-hover);
}

[data-redesign='true'] .alert-list__empty {
  padding: 2rem;
  text-align: center;
}

[data-redesign='true'] .alert-list__empty-icon {
  display: block;
  font-size: 2rem;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

[data-redesign='true'] .alert-list__empty-message {
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0;
}
```

### 14.2.5 — OfflineBanner.jsx — adicionar ícone WifiOff

**Arquivo:** `src/shared/components/ui/OfflineBanner.jsx`

Adicionar import Lucide após `import { useSyncExternalStore }`:

```jsx
import { WifiOff } from 'lucide-react'
```

Substituir o JSX do banner:

Trocar:
```jsx
<div className="offline-banner" role="alert" aria-live="polite">
  Sem conexão — exibindo dados salvos
</div>
```

Por:
```jsx
<div className="offline-banner" role="alert" aria-live="polite">
  <WifiOff size={14} aria-hidden="true" />
  <span>Sem conexão — exibindo dados salvos</span>
</div>
```

### 14.2.6 — OfflineBanner.css — redesign override

Substituir o conteúdo completo de `src/shared/components/ui/OfflineBanner.css` por:

```css
.offline-banner {
  position: fixed;
  bottom: 64px; /* acima do BottomNav */
  left: 0;
  right: 0;
  background: var(--color-warning, #f59e0b);
  color: var(--color-gray-900, #111827);
  text-align: center;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  z-index: var(--z-toast);
  contain: layout style;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

/* Redesign override — sanctuary error-container */
[data-redesign='true'] .offline-banner {
  background: var(--color-error-bg, #ffdad6);
  color: var(--color-error, #ba1a1a);
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-medium);
  border-top: 1px solid var(--color-error, #ba1a1a);
  bottom: 72px; /* ligeiramente mais alto para dar breathing room */
}
```

---

## Sprint 14.3 — Calendar Dual-Theme

### 14.3.1 — Calendar.jsx — Lucide navigation arrows

**Arquivo:** `src/shared/components/ui/Calendar.jsx`

**Mudança 1:** Adicionar imports Lucide no início do arquivo (após `import { useState, useEffect }`):

```jsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
```

**Mudança 2:** Localizar os botões de navegação do calendário. Eles usam texto `◀` / `▶` ou `<` / `>`. Substituir pelo ícone Lucide:

Localizar (procurar o pattern `handlePreviousMonth`/`handleNextMonth` buttons):
```jsx
<button onClick={handlePreviousMonth} ...>◀</button>
```
ou variante com `aria-label="Mês anterior"`.

Substituir o conteúdo do botão para:
```jsx
<button
  onClick={handlePreviousMonth}
  className="calendar-nav-btn"
  aria-label="Mês anterior"
  type="button"
>
  <ChevronLeft size={20} aria-hidden="true" />
</button>
```

E para próximo mês:
```jsx
<button
  onClick={handleNextMonth}
  className="calendar-nav-btn"
  aria-label="Próximo mês"
  type="button"
>
  <ChevronRight size={20} aria-hidden="true" />
</button>
```

**ATENÇÃO:** Para localizar exatamente onde estão os botões de navegação no Calendar.jsx, ler o arquivo completo antes de editar. A lógica de navegação existe após a linha 80 (uso do `useEffect`). Os botões estão dentro do render, na seção de `calendar-controls`.

### 14.3.2 — Calendar redesign CSS em `components.redesign.css`

Adicionar ao final de `src/shared/styles/components.redesign.css`:

```css
/* ============================================
   SPRINT 14.3 — CALENDAR DUAL-THEME
   ============================================ */

/* Widget container */
[data-redesign='true'] .calendar-widget {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-ambient);
  padding: 1.25rem;
  /* Remove rgba(0,0,0,0.2) do dark mode */
}

/* Controles de navegação */
[data-redesign='true'] .calendar-controls button,
[data-redesign='true'] .calendar-nav-btn {
  background: transparent;
  border: none;
  color: var(--color-on-surface-variant);
  width: 40px;
  height: 40px;
  border-radius: var(--radius-card-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 200ms ease-out;
}

[data-redesign='true'] .calendar-controls button:hover,
[data-redesign='true'] .calendar-nav-btn:hover {
  background: var(--state-hover);
  color: var(--color-on-surface);
}

/* Mês atual */
[data-redesign='true'] .current-month {
  font-family: var(--font-display);
  font-weight: var(--font-weight-semibold);
  font-size: var(--text-body-lg);
  color: var(--color-on-surface);
  /* Remove --accent-primary (neon) */
}

/* Nomes dos dias da semana */
[data-redesign='true'] .calendar-weekdays {
  color: var(--color-on-surface-variant);
}

/* Célula de dia genérica */
[data-redesign='true'] .calendar-day {
  background: transparent;
  color: var(--color-on-surface);
  border-radius: var(--radius-card-sm);
  /* Remove rgba(255,255,255,0.03) */
}

[data-redesign='true'] .calendar-day:not(.empty):hover {
  background: var(--state-hover);
  transform: none;
  /* Remove scale neon */
}

/* Hoje */
[data-redesign='true'] .calendar-day.today {
  background: rgba(0, 106, 94, 0.08);
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
  /* Remove rgba(0,240,255,...) neon */
}

/* Dia selecionado */
[data-redesign='true'] .calendar-day.selected {
  background: var(--color-primary) !important;
  color: var(--color-on-primary) !important;
  box-shadow: none !important;
  /* Remove neon glow */
}

[data-redesign='true'] .calendar-day.selected .log-dot {
  background: var(--color-on-primary);
  box-shadow: none;
}

/* Dia com registro */
[data-redesign='true'] .calendar-day.has-log {
  background: rgba(0, 106, 94, 0.08);
  box-shadow: none;
  /* Remove rgba(0,255,136,...) neon green */
}

/* Indicador de log (ponto) */
[data-redesign='true'] .log-dot {
  background: var(--color-primary);
  box-shadow: none;
  /* Remove neon glow */
}

/* Número do dia */
[data-redesign='true'] .day-number {
  color: var(--color-on-surface);
  font-weight: var(--font-weight-medium);
}

/* Month picker dropdown */
[data-redesign='true'] .month-picker {
  background: var(--color-surface-container-low);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface);
  border-radius: var(--radius-button);
  font-weight: var(--font-weight-semibold);
  font-family: var(--font-body);
  padding: 0.375rem 0.75rem;
  cursor: pointer;
  transition: border-color 200ms ease-out;
}

[data-redesign='true'] .month-picker:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-container-low);
}

/* Loading skeleton do calendário */
[data-redesign='true'] .skeleton-day {
  background: linear-gradient(
    90deg,
    var(--color-surface-container) 25%,
    var(--color-surface-container-low) 50%,
    var(--color-surface-container) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: var(--radius-card-sm);
}
```

### 14.3.3 — Remover overrides de Calendar em HealthHistoryRedesign.css

**Arquivo:** `src/views/redesign/HealthHistoryRedesign.css`

Após o Calendar nativo ter redesign support (14.3.2), os overrides `.hhr-wrapper .calendar-day--*` tornam-se redundantes.

**IMPORTANTE:** Antes de remover, verificar se os class modifiers (`calendar-day--full`, `calendar-day--taken`, `calendar-day--partial`, `calendar-day--missed`, `calendar-day--empty`, `calendar-day--selected`, `calendar-day--today`) são aplicados pelo `HealthHistoryRedesign` ou pelo `Calendar.jsx` base.

```bash
grep -n "calendar-day--" src/views/redesign/HealthHistoryRedesign.css
grep -n "calendar-day--" src/shared/components/ui/Calendar.jsx
```

- Se `Calendar.jsx` aplica as classes `calendar-day--full` etc. (não apenas `has-log`, `today`, `selected`), então os overrides em `HealthHistoryRedesign.css` cobrem classes que o CSS em 14.3.2 não cobre → **manter os overrides `.hhr-wrapper` e adaptar as cores** para usar tokens sanctuary em vez de `!important` com cores hardcoded.
- Se `Calendar.jsx` NÃO aplica essas classes (apenas `has-log`, `today`, `selected`), os overrides `.hhr-wrapper` podem ser removidos com segurança.

**Ação prescrita (mais segura):** Manter os overrides `.hhr-wrapper` porém substituir as cores hardcoded por tokens:

```css
/* Manter estrutura, trocar cores hardcoded por tokens */
.hhr-wrapper .calendar-day--full,
.hhr-wrapper .calendar-day--taken {
  background: var(--color-primary) !important;
  color: var(--color-on-primary) !important;
  box-shadow: none !important;
}

.hhr-wrapper .calendar-day--partial {
  background: rgba(0, 106, 94, 0.15) !important;
  color: var(--color-primary) !important;
  box-shadow: none !important;
}

.hhr-wrapper .calendar-day--missed,
.hhr-wrapper .calendar-day--empty {
  background: var(--color-error-bg, #ffdad6) !important;
  color: var(--color-error, #ba1a1a) !important;
  box-shadow: none !important;
}

.hhr-wrapper .calendar-day--selected {
  outline: 2px solid var(--color-primary) !important;
  outline-offset: 2px !important;
  box-shadow: none !important;
}

.hhr-wrapper .calendar-day--today {
  border: 2px solid var(--color-primary) !important;
  box-shadow: none !important;
}
```

O arquivo `HealthHistoryRedesign.css` já usa tokens (`var(--color-primary)`, `var(--color-error)`) nas linhas 19-51 — verificar se as mudanças acima já estão lá. Se sim, nada a fazer.

---

## Sprint 14.4 — PWA InstallPrompt

### 14.4.1 — InstallPrompt.jsx — substituir emoji por ícone Lucide

**Arquivo:** `src/shared/components/pwa/InstallPrompt.jsx`

**Mudança 1:** Adicionar import no início (junto com os outros imports):
```jsx
import { Download } from 'lucide-react'
```

**Mudança 2:** Localizar o ícone do app (o `<span role="img">💊</span>`):
```jsx
<div className="install-prompt__icon">
  <span role="img" aria-label="Ícone do app">
    💊
  </span>
</div>
```

Substituir por:
```jsx
<div className="install-prompt__icon" aria-hidden="true">
  <Download size={24} />
</div>
```

**Mudança 3:** Nos botões de fechar (`✕`), substituir por Lucide:
```jsx
import { X } from 'lucide-react'
```

Trocar todos os `✕` por `<X size={16} aria-hidden="true" />`.

**ATENÇÃO:** Há 2 botões com `✕`: o dismiss do banner e o close do modal de instruções. Substituir ambos.

### 14.4.2 — InstallPrompt.css — redesign override

Verificar se existe `src/shared/components/pwa/InstallPrompt.css`. Se sim, adicionar ao final:

```css
/* Redesign overrides — Sanctuary */
[data-redesign='true'] .install-prompt {
  background: var(--color-surface-container-lowest);
  box-shadow: var(--shadow-editorial);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  /* mantém position fixed bottom */
}

[data-redesign='true'] .install-prompt__icon {
  color: var(--color-primary);
  background: rgba(0, 106, 94, 0.08);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

[data-redesign='true'] .install-prompt__title {
  font-family: var(--font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  font-size: var(--text-body-lg);
  margin: 0 0 0.25rem 0;
}

[data-redesign='true'] .install-prompt__description {
  font-size: var(--text-label-md);
  color: var(--color-on-surface-variant);
  margin: 0;
}

[data-redesign='true'] .install-prompt__install-btn {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-button);
  font-weight: var(--font-weight-bold);
  font-size: var(--text-label-md);
  padding: 0.5rem 1rem;
  cursor: pointer;
  min-height: 40px;
  transition: all 200ms ease-out;
}

[data-redesign='true'] .install-prompt__install-btn:hover {
  transform: scale(1.02);
}

[data-redesign='true'] .install-prompt__dismiss-btn {
  background: transparent;
  border: none;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: background 200ms ease-out;
}

[data-redesign='true'] .install-prompt__dismiss-btn:hover {
  background: var(--state-hover);
}

/* Modal de instruções */
[data-redesign='true'] .install-prompt__modal {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-editorial);
}

[data-redesign='true'] .install-prompt__modal-title {
  font-family: var(--font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
}

[data-redesign='true'] .install-prompt__step-number {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

[data-redesign='true'] .install-prompt__modal-btn {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-button);
  font-weight: var(--font-weight-bold);
  padding: 0.75rem 1.5rem;
  min-height: 48px;
  cursor: pointer;
  width: 100%;
  transition: all 200ms ease-out;
}

[data-redesign='true'] .install-prompt__modal-btn:hover {
  transform: scale(1.02);
}

[data-redesign='true'] .install-prompt__modal-overlay {
  background: rgba(25, 28, 29, 0.4);
}
```

Se não existir `InstallPrompt.css`, adicionar as regras acima também em `components.redesign.css` sob heading `SPRINT 14.4 — INSTALL PROMPT`.

---

## Sprint 14.5 — Chatbot: ChatWindow

### 14.5.1 — ChatWindow.module.css — corrigir cores (secondary → primary)

**Arquivo:** `src/features/chatbot/components/ChatWindow.module.css`

O arquivo já tem `[data-redesign='true']` overrides, mas usa `--color-secondary` (azul `#005db6`) onde deveria usar `--color-primary` (verde `#006a5e`). Corrigir as seguintes ocorrências:

**Mudança 1 — messageBubbleUser background:**
```css
/* ANTES */
[data-redesign='true'] .messageBubbleUser {
  background: var(--color-secondary, #005db6);
  color: white;
}

/* DEPOIS */
[data-redesign='true'] .messageBubbleUser {
  background: var(--color-primary, #006a5e);
  color: var(--color-on-primary, #ffffff);
}
```

**Mudança 2 — sendButton background:**
```css
/* ANTES */
[data-redesign='true'] .sendButton {
  background: var(--color-secondary, #005db6);
}

/* DEPOIS */
[data-redesign='true'] .sendButton {
  background: var(--color-primary, #006a5e);
}
```

**Mudança 3 — sendButton hover:**
Adicionar se não existir:
```css
[data-redesign='true'] .sendButton:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary, #006a5e) 85%, #000000);
}
```

**Mudança 4 — suggestionButton hover (trocar secondary por primary):**
```css
/* ANTES */
[data-redesign='true'] .suggestionButton:hover {
  border-color: var(--color-secondary, #005db6);
  color: var(--color-secondary, #005db6);
}

/* DEPOIS */
[data-redesign='true'] .suggestionButton:hover {
  border-color: var(--color-primary, #006a5e);
  color: var(--color-primary, #006a5e);
}
```

**Mudança 5 — drawer: adicionar top border radius:**
```css
/* ANTES */
[data-redesign='true'] .drawer {
  background: var(--color-surface-container-lowest, #ffffff);
}

/* DEPOIS */
[data-redesign='true'] .drawer {
  background: var(--color-surface-container-lowest, #ffffff);
  border-left: 1px solid var(--color-outline-variant, #c9ded8);
}
```

**Mudança 6 — thinkingBubble: substituir "Pensando..." por dots animation:**

Adicionar ao CSS (após o `.thinkingBubble` block existente):
```css
/* Dots loading animation no thinking bubble */
[data-redesign='true'] .thinkingBubble::after {
  content: '';
  display: inline-block;
  width: 1.5rem;
  height: 0.375rem;
  margin-left: 0.5rem;
  background: radial-gradient(
    circle,
    var(--color-primary, #006a5e) 30%,
    transparent 30%
  ) 0/0.5rem 0.375rem,
  radial-gradient(
    circle,
    var(--color-primary, #006a5e) 30%,
    transparent 30%
  ) 0.5rem/0.5rem 0.375rem,
  radial-gradient(
    circle,
    var(--color-primary, #006a5e) 30%,
    transparent 30%
  ) 1rem/0.5rem 0.375rem;
  background-repeat: no-repeat;
  animation: thinking-dots 1.2s infinite;
  vertical-align: middle;
}

@keyframes thinking-dots {
  0%, 20%   { background-position: 0 0, 0.5rem 0, 1rem 0; }
  40%       { background-position: 0 -0.25rem, 0.5rem 0, 1rem 0; }
  60%       { background-position: 0 0, 0.5rem -0.25rem, 1rem 0; }
  80%, 100% { background-position: 0 0, 0.5rem 0, 1rem -0.25rem; }
}
```

### 14.5.2 — ChatWindow.jsx — eliminar window.confirm()

**Arquivo:** `src/features/chatbot/components/ChatWindow.jsx`

**Contexto:** Linha 134 usa `confirm('Tem certeza...')` — bloqueante e visualmente neon-alien.

**Mudança 1:** Adicionar imports no topo (após o import de `useDashboard`):
```jsx
import ConfirmDialog from '@shared/components/ui/ConfirmDialog'
```

**Mudança 2:** Adicionar estado para controle do diálogo (dentro de `ChatWindow`, após o estado `messagesEndRef`):
```jsx
const [showClearConfirm, setShowClearConfirm] = useState(false)
```

**Mudança 3:** Substituir `handleClearHistory`:
```jsx
// ANTES
const handleClearHistory = () => {
  if (!confirm('Tem certeza que deseja limpar o histórico de conversa?')) return
  clearPersistedHistory()
  setMessages([createWelcomeMessage()])
}

// DEPOIS
const handleClearHistory = () => {
  setShowClearConfirm(true)
}

const handleConfirmClear = () => {
  clearPersistedHistory()
  setMessages([createWelcomeMessage()])
  setShowClearConfirm(false)
}

const handleCancelClear = () => {
  setShowClearConfirm(false)
}
```

**Mudança 4:** Adicionar `<ConfirmDialog>` no JSX, após o `</motion.div>` do drawer mas dentro do `<AnimatePresence>`:

```jsx
{/* Modal de confirmação — limpar histórico */}
{showClearConfirm && (
  <ConfirmDialog
    title="Limpar histórico"
    message="Tem certeza que deseja limpar todo o histórico de conversa? Esta ação não pode ser desfeita."
    confirmLabel="Limpar"
    cancelLabel="Cancelar"
    onConfirm={handleConfirmClear}
    onCancel={handleCancelClear}
    variant="danger"
  />
)}
```

**Mudança 5:** Verificar API de `ConfirmDialog.jsx` após move em S14.0. Confirmar que as props `title`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `variant` existem. Se alguma não existir, ler o componente e usar as props corretas.

```bash
grep -n "function ConfirmDialog\|export default\|props\." src/shared/components/ui/ConfirmDialog.jsx | head -20
```

---

## Sprint 14.6 — Gamification: BadgeDisplay, MilestoneCelebration, ConfettiAnimation

### 14.6.1 — BadgeDisplay.css — redesign override

Arquivo: `src/shared/components/gamification/BadgeDisplay.css`

Verificar se existe; se sim, adicionar no final. Se não existir (o componente importa CSS mas pode estar vazio ou não existir), criar com:

```css
/* BadgeDisplay — Legacy styles */
.badge-display {
  padding: 1rem;
}

.badge-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.75rem 0;
  color: var(--text-primary);
}

.badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 0.75rem;
}

.badge-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.75rem;
  text-align: center;
}

.badge-icon {
  font-size: 1.75rem;
  line-height: 1;
}

.badge-name {
  font-size: 0.65rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Redesign overrides — Sanctuary */
[data-redesign='true'] .badge-display {
  padding: 0;
}

[data-redesign='true'] .badge-title {
  font-family: var(--font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  font-size: var(--text-body-lg);
  margin-bottom: 1rem;
}

[data-redesign='true'] .badge-item {
  background: var(--color-surface-container-low);
  border-radius: var(--radius-card-sm);
  transition: box-shadow 200ms ease-out;
}

[data-redesign='true'] .badge-item:hover {
  box-shadow: var(--shadow-ambient);
}

[data-redesign='true'] .badge-name {
  font-size: var(--text-label-md);
  color: var(--color-on-surface-variant);
  font-weight: var(--font-weight-medium);
}
```

### 14.6.2 — MilestoneCelebration.css — redesign override

Arquivo: `src/shared/components/gamification/MilestoneCelebration.css`

Ler o arquivo atual para identificar classes principais, depois adicionar overrides no final:

```css
/* Redesign overrides — Sanctuary */
[data-redesign='true'] .milestone-backdrop {
  background: rgba(25, 28, 29, 0.4);
  backdrop-filter: blur(4px);
}

[data-redesign='true'] .milestone-modal {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-editorial);
  border: none;
  padding: 2rem;
  text-align: center;
  max-width: 360px;
  width: calc(100% - 2rem);
}

[data-redesign='true'] .milestone-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  filter: none; /* remover neon filters se houver */
}

[data-redesign='true'] .milestone-title {
  font-family: var(--font-display);
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-on-surface);
  margin: 0 0 0.5rem 0;
}

[data-redesign='true'] .milestone-description {
  font-size: var(--text-body-lg);
  color: var(--color-on-surface-variant);
  margin: 0 0 1.5rem 0;
  line-height: 1.6;
}

[data-redesign='true'] .milestone-button {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-button);
  font-weight: var(--font-weight-bold);
  font-size: var(--text-body-lg);
  padding: 0.75rem 2rem;
  min-height: 48px;
  cursor: pointer;
  width: 100%;
  transition: all 200ms ease-out;
}

[data-redesign='true'] .milestone-button:hover {
  transform: scale(1.02);
}
```

**ATENÇÃO:** Verificar se `MilestoneCelebration.jsx` usa `Modal` do W11 ou seu próprio `.milestone-modal`. Se usa o próprio, o CSS acima é suficiente. Se usa `Modal`, os estilos do Modal redesenhado (W11) já se aplicam.

### 14.6.3 — ConfettiAnimation.jsx — palette sanctuary

**Arquivo:** `src/shared/components/ui/animations/ConfettiAnimation.jsx`

O componente usa um array hardcoded de cores em hexadecimal. Substituir as cores:

**Mudança 1:** Definir as duas paletas como constantes no módulo (antes da função `ConfettiAnimation`):

```jsx
// Paleta neon legada (mantida para compatibilidade e referência)
const LEGACY_COLORS = ['#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#3b82f6']

// Paleta Santuário Terapêutico (W14)
export const SANCTUARY_COLORS = ['#006a5e', '#90f4e3', '#ffdea8', '#008577', '#f59e0b']
```

**Mudança 2:** Adicionar prop `colors` ao componente com default sanctuary:

```jsx
function ConfettiAnimation({
  trigger = false,
  onComplete,
  type = 'burst',
  colors = SANCTUARY_COLORS,  // Sanctuary é o novo default
}) {
```

**Mudança 3:** Dentro do `useEffect` que gera as partículas, substituir a linha que referencia o array hardcoded:

Localizar:
```jsx
color: ['#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#3b82f6'][colorIndex],
```

Substituir por:
```jsx
color: colors[colorIndex % colors.length],
```

**Nota:** A export `SANCTUARY_COLORS` permite que callers passem `colors={SANCTUARY_COLORS}` explicitamente, mas como o default agora é sanctuary, callers existentes (onboarding) não precisam mudar.

---

## Sprint 14.7 — DLQ Admin View

### 14.7.1 — DLQAdmin.css — redesign direto via scoped CSS

**Arquivo:** `src/views/admin/DLQAdmin.css`

**Contexto:** Não há variante separada. Redesign direto via `[data-redesign='true']` scope no CSS. Admin sempre terá redesign ativo (acessa o app normalmente, com flag habilitado para beta users).

Ler o arquivo completo para identificar todas as classes antes de adicionar overrides. Adicionar ao final:

```css
/* ============================================
   DLQAdmin — Redesign (Sanctuary)
   ============================================ */

[data-redesign='true'] .dlq-admin {
  padding: 1.5rem;
}

[data-redesign='true'] .dlq-admin__header h1 {
  font-family: var(--font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  font-size: var(--text-title-lg);
}

[data-redesign='true'] .dlq-admin__subtitle {
  color: var(--color-on-surface-variant);
  font-size: var(--text-label-md);
}

[data-redesign='true'] .dlq-admin__controls {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-ambient);
  border: none;
  /* Remove --surface-secondary (neon legacy) */
}

[data-redesign='true'] .dlq-admin__filter label {
  color: var(--color-on-surface-variant);
  font-size: var(--text-label-md);
}

[data-redesign='true'] .dlq-admin__filter select,
[data-redesign='true'] .dlq-admin__filter input {
  background: var(--color-surface-container-low);
  border: 1.5px solid var(--color-outline-variant);
  color: var(--color-on-surface);
  border-radius: var(--radius-button);
  padding: 0.375rem 0.75rem;
  font-family: var(--font-body);
}

[data-redesign='true'] .dlq-admin__filter select:focus,
[data-redesign='true'] .dlq-admin__filter input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  border-color: var(--color-primary);
}

/* Tabela */
[data-redesign='true'] .dlq-admin__table-wrapper {
  background: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-ambient);
  overflow: hidden;
  border: none;
}

[data-redesign='true'] .dlq-admin__table {
  border-collapse: collapse;
  width: 100%;
}

[data-redesign='true'] .dlq-admin__table thead th {
  background: var(--color-surface-container-low);
  color: var(--color-on-surface-variant);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-outline-variant);
  text-align: left;
}

[data-redesign='true'] .dlq-admin__table tbody tr:nth-child(even) {
  background: var(--color-surface-container-low);
}

[data-redesign='true'] .dlq-admin__table tbody tr:nth-child(odd) {
  background: var(--color-surface-container-lowest);
}

[data-redesign='true'] .dlq-admin__table tbody tr:hover {
  background: rgba(0, 106, 94, 0.04);
}

[data-redesign='true'] .dlq-admin__table td {
  padding: 0.75rem 1rem;
  color: var(--color-on-surface);
  font-size: var(--text-label-md);
  border-bottom: 1px solid var(--color-outline-variant);
}

/* Status badges — usa o Badge component já redesenhado (W3.4) */
/* As classes .badge .badge-* já são cobertas por components.redesign.css */

/* Action message */
[data-redesign='true'] .dlq-admin__action-message--success {
  background: rgba(0, 106, 94, 0.08);
  color: var(--color-primary);
  border-radius: var(--radius-card-sm);
  padding: 0.75rem 1rem;
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-medium);
  border: 1px solid rgba(0, 106, 94, 0.2);
}

[data-redesign='true'] .dlq-admin__action-message--error {
  background: var(--color-error-bg);
  color: var(--color-error);
  border-radius: var(--radius-card-sm);
  padding: 0.75rem 1rem;
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-medium);
  border: 1px solid rgba(186, 26, 26, 0.2);
}

/* Paginação */
[data-redesign='true'] .dlq-admin__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--color-on-surface-variant);
  font-size: var(--text-label-md);
}
```

### 14.7.2 — DLQAdmin.jsx — verificar classes CSS

Antes de adicionar o CSS em 14.7.1, verificar quais classes o componente realmente usa:

```bash
grep -n "className" src/views/admin/DLQAdmin.jsx | grep dlq-admin | head -30
```

Confirmar que as classes `.dlq-admin__table`, `.dlq-admin__table-wrapper`, etc. existem no JSX. Se os nomes divergirem, ajustar o CSS do override para usar os nomes corretos.

---

## Resumo de Arquivos Modificados/Movidos

| Ação | Arquivo | Sprint | Tipo de mudança |
|------|---------|--------|-----------------|
| MOVE | `src/features/medications/components/ConfirmDialog.jsx` → `src/shared/components/ui/ConfirmDialog.jsx` | 14.0 | Relocação |
| MOVE | `src/features/medications/components/ConfirmDialog.css` → `src/shared/components/ui/ConfirmDialog.css` | 14.0 | Relocação |
| EDIT | `src/views/redesign/MedicinesRedesign.jsx` | 14.0 | Import path update |
| EDIT | `src/shared/styles/components.redesign.css` | 14.1, 14.3 | Adição de seções EmptyState + Calendar |
| EDIT | `src/shared/components/ui/Loading.jsx` | 14.2 | Novo prop `variant` + skeleton JSX |
| EDIT | `src/shared/components/ui/Loading.css` | 14.2 | Redesign overrides + skeleton CSS |
| EDIT | `src/shared/components/ui/AlertList.jsx` | 14.2 | Lucide icons substituem emojis |
| EDIT | `src/shared/components/ui/AlertList.css` | 14.2 | Redesign overrides |
| EDIT | `src/shared/components/ui/OfflineBanner.jsx` | 14.2 | WifiOff icon |
| EDIT | `src/shared/components/ui/OfflineBanner.css` | 14.2 | Redesign overrides |
| EDIT | `src/shared/components/ui/Calendar.jsx` | 14.3 | ChevronLeft/Right icons |
| EDIT | `src/views/redesign/HealthHistoryRedesign.css` | 14.3 | Audit + fix calendario overrides |
| EDIT | `src/shared/components/pwa/InstallPrompt.jsx` | 14.4 | Download + X icons |
| EDIT | `src/shared/components/pwa/InstallPrompt.css` | 14.4 | Redesign overrides |
| EDIT | `src/features/chatbot/components/ChatWindow.module.css` | 14.5 | Fix primary colors + dots animation |
| EDIT | `src/features/chatbot/components/ChatWindow.jsx` | 14.5 | ConfirmDialog em vez de window.confirm() |
| EDIT | `src/shared/components/gamification/BadgeDisplay.css` | 14.6 | Redesign overrides (criar se não existir) |
| EDIT | `src/shared/components/gamification/MilestoneCelebration.css` | 14.6 | Redesign overrides |
| EDIT | `src/shared/components/ui/animations/ConfettiAnimation.jsx` | 14.6 | Sanctuary color palette + export |
| EDIT | `src/views/admin/DLQAdmin.css` | 14.7 | Redesign overrides |

**Total:** 18 arquivos (2 moves + 16 edits). 0 novos arquivos.

---

## Ordem de Execução Recomendada

```
S14.0 (ConfirmDialog move)
  → S14.1 (Primitives audit + EmptyState CSS)
  → S14.2 (Loading + AlertList + OfflineBanner) [pode ser paralelo a S14.1]
  → S14.3 (Calendar)
  → S14.4 (InstallPrompt) [pode ser paralelo a S14.3]
  → S14.5 (ChatWindow — depende de S14.0)
  → S14.6 (Gamification — paralelo a S14.5)
  → S14.7 (DLQAdmin — independente, pode ser paralelo a qualquer sprint)
```

**Sprints independentes entre si (sem dependência):** 14.1, 14.3, 14.4, 14.6, 14.7
**Dependência crítica:** 14.5 depende de 14.0 (ConfirmDialog em shared)

---

## Checklist de Validação Pré-Merge

### Funcionamento

- [ ] `npm run validate:agent` passa (0 erros, 0 warnings críticos)
- [ ] Build de produção completa sem erros: `npm run build`
- [ ] Nenhum erro de import quebrado (especialmente ConfirmDialog após move)

### Visual (com `?redesign=1` ativo)

- [ ] Loading spinner usa verde (`#006a5e`) nos 3 anéis, sem neon cyan/magenta
- [ ] AlertList mostra ícones Lucide (não emojis ⚠️⚡ℹ️) para itens de alerta
- [ ] OfflineBanner exibe WifiOff icon + background vermelho sanctuary quando offline
- [ ] Calendar não mostra `rgba(0,240,255,...)` em nenhum estado (today, selected, has-log)
- [ ] EmptyState tem background branco, sem borders, shadow sutil
- [ ] InstallPrompt banner tem visual sanctuary (sem neon)
- [ ] ChatWindow: bubbles do usuário são verdes (não azuis); send button verde
- [ ] ChatWindow: confirm de limpar histórico abre ConfirmDialog sanctuary (não `window.confirm()`)
- [ ] BadgeDisplay cards têm background `surface-container-low`
- [ ] MilestoneCelebration modal tem visual sanctuary
- [ ] ConfettiAnimation usa palette verde/amarela (`SANCTUARY_COLORS`)
- [ ] DLQAdmin tabela tem tonal rows (sem borders neon)

### Visual (sem redesign — usuários legacy)

- [ ] Loading ainda mostra spinner neon (cyan/magenta/purple) — sem regressão
- [ ] AlertList funciona normalmente (Lucide icons são neutros — sem impacto visual negativo)
- [ ] Calendar ainda funciona com visual neon original
- [ ] OfflineBanner ainda mostra warning amarela
- [ ] ChatWindow: cores azuis originais mantidas (`:root` sem `data-redesign`)
- [ ] InstallPrompt: banner original intacto

### Comportamento

- [ ] `Loading` com `variant="skeleton"` renderiza linhas shimmer corretamente
- [ ] `Loading` sem `variant` (default) ainda funciona como spinner
- [ ] `ConfettiAnimation` aceita prop `colors` sem quebrar; default é `SANCTUARY_COLORS`
- [ ] `ConfettiAnimation` LEGACY_COLORS pode ser passado se caller precisar
- [ ] Calendar navigation arrows (ChevronLeft/Right) funcionam igual a antes
- [ ] ChatWindow "Limpar histórico" abre ConfirmDialog, confirmar limpa, cancelar não limpa

### CSS Architecture

- [ ] ZERO seletores `rgba(0, 240, 255, ...)` visíveis em `[data-redesign='true']` contexts
- [ ] ZERO `var(--neon-cyan)`, `var(--neon-magenta)` em overrides de redesign
- [ ] Todos os novos overrides usam apenas tokens de `tokens.redesign.css`
- [ ] `components.redesign.css` tem headers de sprint para todas as novas seções

---

## Critério de Conclusão Wave 14

- [ ] Button, Card, Badge, EmptyState respondem a `[data-redesign="true"]`
- [ ] Loading, AlertList, OfflineBanner redesenhados
- [ ] Calendar tem tema sanctuary nativo (sem overrides hacky externos)
- [ ] InstallPrompt segue design system
- [ ] ChatWindow: cores corretas + sem window.confirm()
- [ ] Gamification components atualizados
- [ ] DLQAdmin redesenhado
- [ ] **ZERO componentes com visual neon visíveis quando redesign está ativo**

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| ConfirmDialog tem props diferentes das assumidas | Média | Alto | Ler `src/features/medications/components/ConfirmDialog.jsx` completo antes de usar em ChatWindow |
| Calendar.jsx não usa classes exatas assumidas no CSS | Média | Médio | Ler Calendar.jsx completo antes de adicionar overrides; ajustar selectors |
| `calendar-day--full/taken/partial` não existem como classes | Alta | Baixo | Esses modifiers são do HealthHistoryRedesign, não do Calendar base. CSS `[data-redesign] .calendar-day.has-log` cobre o caso base |
| ChatWindow CSS Modules: `[data-redesign='true']` não funciona como esperado | Baixa | Médio | O módulo já usa o padrão e funciona — W12 validou o mesmo pattern em `StockRedesign`. Se houver problema, trocar para `:global([data-redesign='true']) .drawer` |
| `BadgeDisplay.css` não existe | Alta | Baixo | Criar o arquivo conforme S14.6.1 — isso é normal; criar é trivial |
| Loading `variant="skeleton"` não é usado por nenhum caller | Média | Zero | Não é regressão; a adição é purely additive. Callers futuros podem adotar |
| ConfettiAnimation: trocar default de LEGACY para SANCTUARY quebra visual em onboarding | Baixa | Médio | Onboarding já foi redesenhado em W13 — sanctuary colors são o comportamento correto agora |
| DLQAdmin: classes CSS no JSX diferentes do mapeado | Alta | Baixo | Sempre fazer `grep -n "className" DLQAdmin.jsx` antes de adicionar overrides |

---

## Nota sobre W15 (próxima wave)

Após W14:
- **W15 (Accessibility)** faz auditoria WCAG AA em TODAS as views W0-W14
- Com Calendar agora em dual-theme sanctuary, atenção especial ao contraste de cor no calendário
- `color-mix()` usado em alguns overrides precisa verificação de suporte (browsers modernos OK; Safari 16.4+ OK)
- A skeleton animation usa `prefers-reduced-motion` — padrão correto para W15

---

*Spec autorizada por: Arquitetura Meus Remédios v3.3+*
*Modelos alvo: claude-haiku-4-5 (execução), claude-sonnet-4-6 (revisão)*
