# UX Builder — Design System e Tokens

## CSS Tokens disponiveis

O projeto usa CSS custom properties definidas em `src/shared/styles/tokens.css`
e `src/shared/styles/colors.css`. SEMPRE usar tokens, NUNCA valores hardcoded.

### Cores semanticas

```css
/* Usar estes — NUNCA hex direto */
var(--color-error)      /* Vermelho: critico, erro */
var(--color-warning)    /* Amarelo: alerta, atencao */
var(--color-success)    /* Verde: sucesso, ok */
var(--color-info)       /* Azul: informacao */
var(--color-border)     /* Cinza: bordas, divisores */
var(--text-primary)     /* Texto principal */
var(--text-secondary)   /* Texto secundario */
var(--bg-primary)       /* Fundo da pagina */
var(--bg-surface)       /* Fundo de cards/modais */
```

### Espacamento

```css
var(--space-1)  /* 4px */
var(--space-2)  /* 8px */
var(--space-3)  /* 12px */
var(--space-4)  /* 16px */
var(--space-5)  /* 20px */
var(--space-6)  /* 24px */
var(--space-8)  /* 32px */
```

### Tipografia

```css
var(--font-size-xs)    /* 11-12px: labels, badges */
var(--font-size-sm)    /* 13-14px: meta, secundario */
var(--font-size-base)  /* 15-16px: corpo */
var(--font-size-lg)    /* 18px: subtitulos */
var(--font-size-xl)    /* 24px: titulos de secao */
var(--font-size-2xl)   /* 32px: titulos de pagina */
```

### Outros tokens

```css
var(--radius-sm)       /* Borda arredondada pequena */
var(--radius-md)       /* Borda arredondada media */
var(--radius-full)     /* Totalmente circular */
var(--transition-fast) /* 100-150ms */
var(--transition-base) /* 200ms */
var(--transition-slow) /* 300-350ms */
```

## Framer Motion — Padroes do projeto

### Animacao de entrada

```jsx
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
```

### Stagger (listas)

```jsx
<motion.div variants={{ visible: { transition: { staggerChildren: 0.05 } } }}>
  {items.map(item => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
      }}
    />
  ))}
</motion.div>
```

### Spring (gauges, progress)

```jsx
<motion.circle
  initial={{ strokeDashoffset: circumference }}
  animate={{ strokeDashoffset: offset }}
  transition={{ type: "spring", stiffness: 60, damping: 15 }}
/>
```

### AnimatePresence (flip numbers)

```jsx
<AnimatePresence mode="wait">
  <motion.span
    key={value}
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: -20, opacity: 0 }}
    transition={{ duration: 0.2 }}
  >
    {value}
  </motion.span>
</AnimatePresence>
```

### prefers-reduced-motion (OBRIGATORIO)

```jsx
import { useReducedMotion } from 'framer-motion'

function Component() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      animate={{ scale: shouldReduceMotion ? 1 : [0, 1.3, 1] }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
    />
  )
}
```

Alternativa CSS:
```css
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: none;
    transition: none;
  }
}
```

## Acessibilidade — Checklist

Todo componente interativo DEVE ter:
- `aria-label` descritivo em portugues
- `role` semantico quando o HTML nao e suficiente (ex: `role="img"` em SVG)
- `tabindex="0"` se e clicavel mas nao e button/a/input
- Focus visible (usar `focus-visible` nao `focus`)
- Contraste minimo 4.5:1 para texto, 3:1 para elementos graficos

## Niveis de estoque (referencia)

```javascript
// Constantes usadas em StockBars, SmartAlerts, etc.
CRITICAL: < 7 dias   -> var(--color-error)    // #ef4444
LOW:      < 14 dias  -> var(--color-warning)  // #f59e0b
NORMAL:   < 30 dias  -> var(--color-success)  // #22c55e
HIGH:     >= 30 dias  -> var(--color-info)     // #3b82f6
```

## Convencoes CSS

### Nomenclatura BEM

```css
.ring-gauge { }                /* Bloco */
.ring-gauge__score { }         /* Elemento */
.ring-gauge--large { }         /* Modificador */
.ring-gauge__fill--critical { } /* Elemento + Modificador */
```

### Mobile-first

```css
/* Base: mobile (375px min) */
.component { padding: var(--space-3); }

/* Tablet+ */
@media (min-width: 768px) {
  .component { padding: var(--space-6); }
}
```
