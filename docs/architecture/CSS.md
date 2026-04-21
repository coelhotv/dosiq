# Arquitetura CSS - Dosiq

**Versão:** 1.1
**Data:** 2026-02-10
**Status:** Ativo

---

## Visão Geral

Este documento descreve a arquitetura CSS do projeto Dosiq, incluindo tokens de design, estrutura de arquivos, convenções de nomenclatura e estratégias de implementação.

## Estrutura de Arquivos
src/
├── styles/
│   ├── tokens/
│   │   ├── colors.css        # Tokens de cores (brand, semânticas, estado)
│   │   ├── typography.css    # Tokens de tipografia (fontes, tamanhos, pesos)
│   │   ├── spacing.css       # Tokens de espaçamento e breakpoints
│   │   ├── borders.css       # Tokens de bordas e bordas-radius
│   │   ├── shadows.css       # Tokens de sombras e efeitos glow
│   │   ├── transitions.css   # Tokens de transições e animações
│   │   └── z-index.css      # Tokens de z-index (camadas)
│   ├── themes/
│   │   ├── light.css        # Overrides para tema claro
│   │   └── dark.css         # Overrides para tema escuro
│   └── index.css            # Entry point (imports + base styles)
└── views/
    └── Dashboard.module.css  # CSS Modules pilot
```

## Tokens de Design

### Cores

#### Cores de Marca (Brand)
```css
--color-primary: #ec4899;
--color-primary-light: #f472b6;
--color-primary-dark: #db2777;
--color-primary-bg: #fdf2f8;

--color-secondary: #06b6d4;
--color-secondary-light: #22d3ee;
--color-secondary-dark: #0891b2;
```

#### Cores Semânticas
```css
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-info: #3b82f6;
```

#### Cores de Score de Saúde
```css
--score-critical: #ef4444;
--score-low: #f97316;
--score-medium: #eab308;
--score-good: #22c55e;
--score-excellent: #06b6d4;
```

### Tipografia

#### Fontes
```css
--font-primary: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'SF Mono', Monaco, Consolas, monospace;
```

#### Tamanhos
```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
--text-4xl: 2.25rem;
```

#### Pesos
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Espaçamento

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;
```

### Breakpoints Responsivos

```css
--breakpoint-xs: 320px;   /* Mobile pequeno */
--breakpoint-sm: 640px;   /* Mobile grande / Tablet pequeno */
--breakpoint-md: 768px;   /* Tablet */
--breakpoint-lg: 1024px;  /* Desktop */
--breakpoint-xl: 1280px;  /* Desktop grande */
--breakpoint-2xl: 1536px; /* Tela extra grande */
```

### Z-Index Scale

```css
--z-dropdown: 100;
--z-sticky: 200;
--z-modal: 500;
--z-tooltip: 700;
--z-toast: 800;
```

## Convenções de Nomenclatura

### Padrão Adoptado: BEM-like com CSS Custom Properties

```css
/* Bloco */
.card { }

/* Elemento */
.card__header { }
.card__body { }
.card__footer { }

/* Modificador */
.card--featured { }
.card__button--primary { }
```

### Prefixos de Variáveis CSS

| Prefixo | Categoria | Exemplo |
|---------|-----------|---------|
| `--color-*` | Cores | `--color-primary`, `--color-success` |
| `--text-*` | Texto | `--text-primary`, `--text-lg` |
| `--bg-*` | Fundo | `--bg-primary`, `--bg-card` |
| `--border-*` | Bordas | `--border-default`, `--radius-lg` |
| `--shadow-*` | Sombras | `--shadow-md`, `--glow-cyan` |
| `--spacing-*` | Espaçamento | `--spacing-md`, `--space-4` |
| `--font-*` | Tipografia | `--font-size-base`, `--font-weight-bold` |
| `--z-*` | Camadas | `--z-modal`, `--z-dropdown` |
| `--transition-*` | Transições | `--transition-fast`, `--ease-in-out` |
| `--breakpoint-*` | Breakpoints | `--breakpoint-md`, `--breakpoint-lg` |
| `--score-*` | Score de saúde | `--score-critical`, `--score-good` |

## Temas Claro/Escuro

### Implementação

O tema é controlado pelo atributo `data-theme` no elemento `html`:

```css
/* Tema Claro (padrão) */
:root {
  --bg-primary: #ffffff;
  --text-primary: #111827;
}

/* Tema Escuro */
[data-theme="dark"] {
  --bg-primary: #111827;
  --text-primary: #f9fafb;
}
```

### Hook useTheme

```javascript
import { useTheme } from './hooks/useTheme'

function MyComponent() {
  const { theme, toggleTheme, isDark } = useTheme()
  
  return (
    <button onClick={toggleTheme}>
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
```

## Estratégia CSS Modules

### Quando Usar CSS Modules

**Use CSS Modules para:**
- Componentes complexos com muitos estilos específicos
- Componentes que podem conflitar com estilos globais
- Componentes com lógica de estado visual complexa
- `Dashboard.jsx`, `SmartAlerts.jsx`, `TreatmentAccordion.jsx`, `HealthScoreCard.jsx`

**Mantenha CSS global para:**
- Componentes simples e reutilizáveis
- `Button.jsx`, `Modal.jsx`, `EmptyState.jsx`
- Estilos de reset e base
- Utilitários compartilhados

### Exemplo de CSS Module

```css
/* Dashboard.module.css */
.container {
  padding: var(--spacing-lg);
}

.header {
  display: flex;
  justify-content: space-between;
}

@media (prefers-color-scheme: dark) {
  .container {
    background: var(--bg-card);
  }
}
```

```javascript
// Dashboard.jsx
import styles from './Dashboard.module.css'

function Dashboard() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        {/* conteúdo */}
      </header>
    </div>
  )
}
```

## Acessibilidade

### prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### prefers-contrast

```css
@media (prefers-contrast: more) {
  :root {
    --border-default: #000;
    --text-secondary: #000;
  }

  [data-theme="dark"] {
    --border-default: #fff;
    --text-secondary: #fff;
  }
}
```

### prefers-reduced-transparency

```css
@media (prefers-reduced-transparency: reduce) {
  .glass-card {
    backdrop-filter: none;
    background: var(--bg-card);
  }
}
```

## Atualizações Recentes

### v1.2 - Component Consolidation Patterns (2026-02-11)

Adicionados padrões CSS para componentes consolidados na Fase 3.6.

#### AlertList Componente Base

Novo componente base em [`src/components/ui/AlertList.jsx`](src/components/ui/AlertList.jsx) com variantes visuais:

```css
/* Estrutura BEM-like do AlertList */
.alert-list {
  /* Container principal */
}

.alert-list--default { /* Variante padrão */ }
.alert-list--smart { /* Variante para smart alerts */ }
.alert-list--stock { /* Variante para stock alerts */ }
.alert-list--dose { /* Variante para dose alerts */ }

.alert-list__header {
  /* Header com título e badge de contagem */
}

.alert-list__title-group {
  /* Grupo de título + badge */
}

.alert-list__badge {
  /* Badge circular com contagem */
}

.alert-list__content {
  /* Container dos itens */
}

.alert-list__item {
  /* Item individual de alerta */
}

.alert-list__item--critical { /* Severidade crítica */ }
.alert-list__item--warning { /* Severidade atenção */ }
.alert-list__item--info { /* Severidade informativa */ }

.alert-list__item-icon {
  /* Ícone de severidade (⚠️ ⚡ ℹ️) */
}

.alert-list__item-content {
  /* Conteúdo: título + mensagem */
}

.alert-list__item-actions {
  /* Container de botões de ação */
}

.alert-list__btn {
  /* Botões de ação */
}

.alert-list__btn--primary { }
.alert-list__btn--secondary { }
.alert-list__btn--danger { }

.alert-list__expand-btn {
  /* Botão expandir/colapsar */
}

.alert-list--empty {
  /* Estado vazio customizável */
}

.alert-list__empty-icon { }
.alert-list__empty-message { }
```

**Padrão de Variantes:**
- Usar modificadores BEM (`--variante`) para estilos específicos
- Variantes herdam estilos base e adicionam customizações
- Tokens CSS para consistência entre variantes

#### Componentes Consolidados - CSS Strategy

**MedicineForm & ProtocolForm (Onboarding):**
```css
/* Wrapper específico para onboarding */
.medicine-form-wrapper--onboarding {
  /* Customizações visuais para fluxo de onboarding */
}

.protocol-form-simple {
  /* Modo simple do ProtocolForm */
}
```

**Calendar com Features Opcionais:**
```css
.calendar-widget {
  /* Base styles */
}

.calendar-widget--loading {
  /* Estado de loading */
}

.calendar-skeleton {
  /* Skeleton para lazy loading */
  animation: pulse 1.5s ease-in-out infinite;
}

.calendar-controls {
  /* Controles de navegação */
}

.calendar-controls__month-picker {
  /* Seletor de mês quando enableMonthPicker=true */
}
```

### v1.1 - Correção de Regressões Visuais (2026-02-10)

Após a refatoração da arquitetura CSS, foram identificadas e corrigidas regressões visuais:

#### Problemas Corrigidos
1. **Circular References em Tokens**: Resolvida referência circular em `spacing.css`
2. **Botões Sobredimensionados**: Corrigido padding excessivo em `.btn-lg` (128px → 20px)
3. **Header Redesign**: Layout grid lado a lado, username 30px
4. **HealthScoreCard**: Reduzido para 80px, gráfico 48px
5. **Sparkline**: Linha fina (1px), marcadores menores (2px)
6. **Botão FAB**: Magenta translúcido, centralizado, glassmorphism

#### Padrões Estabelecidos
- Glassmorphism hierárquico: hero (primary) → standard (secondary) → light (tertiary)
- Tokens de espaçamento: 8px base grid (--space-1 a --space-20)
- CSS Modules para componentes complexos (Dashboard, SmartAlerts, AlertList)
- CSS global para componentes simples (Button, Modal)

## Migration Guide

### Migração de Cores Hardcoded

**Antes:**
```css
.component {
  color: #ec4899;
  background: #ffffff;
}
```

**Depois:**
```css
.component {
  color: var(--color-primary);
  background: var(--bg-primary);
}
```

### Migração de Classes CSS para Modules

**Antes:**
```javascript
// Dashboard.jsx
import './Dashboard.css'

function Dashboard() {
  return <div className="dashboard-container">...</div>
}
```

**Depois:**
```javascript
// Dashboard.jsx
import styles from './Dashboard.module.css'

function Dashboard() {
  return <div className={styles.container}>...</div>
}
```

## Validação

### Checklist de CSS Válido

- [ ] Todas as cores usam variáveis CSS
- [ ] Espaçamentos usam tokens de espaçamento
- [ ] Breakpoints usam variáveis de breakpoint
- [ ] Tema escuro funciona com `[data-theme="dark"]`
- [ ] `prefers-reduced-motion` está implementado
- [ ] Contraste WCAG AA é mantido
- [ ] Sem cores hardcoded em componentes

### Lint

```bash
npm run lint
```

### Build

```bash
npm run build
```

## Recursos Adicionais

### Referências
- [MDN: CSS Custom Properties](https://developer.mozilla.org/pt-BR/docs/Web/CSS/Using_CSS_custom_properties)
- [BEM Naming](http://getbem.com/naming/)
- [WCAG 2.1 Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/pt-BR/docs/Web/CSS/@media/prefers-reduced-motion)

---

*Documento atualizado em 2026-02-12 - v2.8.0: Estrutura CSS mantida com features/shared*
