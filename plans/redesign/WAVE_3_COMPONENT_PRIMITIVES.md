# Wave 3 — Component Library: Primitives

**Status:** Pronto para execucao
**Dependencias:** Waves 0, 1 e 2 DEVEM estar completas (tokens, typography, layout)
**Branch:** `feature/redesign/wave-3-component-primitives`
**Estimativa:** 6 sprints sequenciais
**Risco:** ALTO — estes componentes (Button, Card) sao usados em TODA a aplicacao. Qualquer mudanca de API (props) quebra multiplas views. A estrategia e: **mudar APENAS o visual (CSS), NUNCA a API (props/JSX)**.

> **IMPORTANTE para o agente executor:** Esta wave redesenha os componentes UI primitivos (Button, Card, inputs, badges, progress bars, listas) para o estilo "Santuario Terapeutico". A regra cardinal e: **MANTER a mesma API de props**. Os componentes devem aceitar exatamente os mesmos props que aceitam hoje. Apenas o CSS e a aparencia mudam. Se voce alterar a assinatura de um componente, DEZENAS de arquivos vao quebrar.

---

## Contexto Visual

**Antes (Neon/Glass):**
- Botoes: gradiente cyan→blue com glow neon, min-height 28-44px, radius pequeno
- Cards: glassmorphism (backdrop-blur), border 1px solid, hover translateY(-4px)
- Inputs: padrao do browser com borda fina
- Sem sistema de badges

**Depois (Santuario Terapeutico):**
- Botoes: gradiente verde 135°, min-height 56-64px, radius xl (1.25rem), shadow ambient
- Cards: sem border ("No-Line Rule"), bg branco, radius 2rem, shadow ambient sutil
- Inputs: bg tonal (surface-container-low), sem borda default, foco com borda verde
- Badges com dot colorido + label

**Referencia visual — Botoes:**
- `plans/redesign/references/simple-hoje-mobile.png`: botao "Tomar Agora" — gradiente verde, texto branco, altura ~64px, radius grande, largura quase full-width
- `plans/redesign/references/complex-hoje-desktop.png`: botao "Confirmar Agora" — mesmo estilo, dentro de card azul
- `plans/redesign/references/simple-estoque-mobile.png`: botao "Comprar agora" — gradiente vermelho (variante error) para urgencia

**Referencia visual — Cards:**
- `plans/redesign/references/simple-hoje-desktop.png`: cards brancos sem borda, sombra muito sutil, radius grande (~2rem)
- `plans/redesign/references/complex-estoque-desktop.png`: grid de cards de estoque — cada um com bg branco, sem borda, numero grande de "dias restantes"
- `plans/redesign/references/simple-tratamentos-desktop.png`: cards de tratamento com info densa mas visual limpo

**Referencia visual — Badges (no topo dos cards):**
- `plans/redesign/references/complex-estoque-desktop.png`: badges "URGENTE" (vermelho), "ATENCAO" (amarelo), "SEGURO" (verde) no canto superior dos cards
- `plans/redesign/references/simple-tratamentos-mobile.png`: badge "CONTINUO" (verde), "ESTOQUE BAIXO" (vermelho) inline

---

## Sprint 3.1 — Button redesign

**Skill:** `/deliver-sprint`
**Escopo:** Reescrever Button.css para o estilo Santuario Terapeutico. NAO alterar Button.jsx.

### Arquivos alvo
1. `src/shared/components/ui/Button.css` — REESCREVER completamente
2. `src/shared/components/ui/Button.jsx` — **NAO ALTERAR** (manter API identica)

### O que o agente DEVE fazer

1. **Ler** `src/shared/components/ui/Button.jsx` (23 linhas) para confirmar a API:
   - Props: `children`, `variant` (default 'primary'), `size` (default 'md'), `onClick`, `disabled`, `type`, `className`
   - Classes geradas: `btn btn-{variant} btn-{size} {className}`
   - Variantes usadas no codebase: `primary`, `secondary`, `outline`, `ghost`, `danger`
   - Tamanhos usados: `sm`, `md`, `lg`

2. **Ler** `src/shared/components/ui/Button.css` (142 linhas) para entender o CSS atual.

3. **Buscar** TODOS os usos de Button no codebase para garantir compatibilidade:
   ```bash
   grep -rn "variant=" src/ --include="*.jsx" | grep -i "button\|btn" | head -30
   ```
   Variantes encontradas no codebase: `primary`, `secondary`, `outline`, `ghost`, `danger`

4. **REESCREVER** `Button.css` com o conteudo EXATO abaixo. **NAO ALTERAR** `Button.jsx`.

### Conteudo EXATO do novo `Button.css`

```css
/* ============================================
   BUTTON — Santuario Terapeutico

   Principios:
   - Touch targets minimo 56px (acessibilidade motora)
   - Primary e gradient verde 135° com shadow ambient
   - Hover: scale(1.02) sutil. Active: scale(0.98) — "Tactile Press"
   - NUNCA glow neon. Shadow e ambient/primary apenas.
   - Font: Lexend (--font-body) bold
   - Radius: xl (1.25rem)

   API de props (Button.jsx — NAO ALTERAR):
   - variant: primary | secondary | outline | ghost | danger
   - size: sm | md | lg
   ============================================ */

/* ============================================
   BASE — todos os botoes
   ============================================ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-weight: var(--font-weight-bold);
  border: none;
  border-radius: var(--radius-button);
  cursor: pointer;
  transition: all 200ms ease-out;
  position: relative;
  overflow: hidden;
  text-decoration: none;
  line-height: 1;
}

.btn:disabled {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-primary);
  outline-offset: var(--focus-ring-offset);
}

/* ============================================
   SIZES — Touch-first scale
   Min 56px para acessibilidade, primary actions 64px
   ============================================ */
.btn-sm {
  padding: 0.5rem 1rem;
  font-size: var(--text-title-sm);
  min-height: 40px;
}

.btn-md {
  padding: 0.75rem 1.5rem;
  font-size: var(--text-body-lg);
  min-height: 48px;
}

.btn-lg {
  padding: 1rem 2rem;
  font-size: var(--text-title-lg);
  min-height: 56px;
  max-width: 100%;
}

/* ============================================
   VARIANT: PRIMARY — Gradient verde, CTA principal
   O botao mais importante da tela. 64px height.
   ============================================ */
.btn-primary {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-primary);
  min-height: 56px;
}

/* Primary Large (usado em CTAs hero como "Tomar Agora") */
.btn-primary.btn-lg {
  min-height: 64px;
  font-size: var(--text-title-lg);
  padding: 1rem 2rem;
}

.btn-primary:hover:not(:disabled) {
  transform: scale(1.02);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

/* ============================================
   VARIANT: SECONDARY — Outlined, acao secundaria
   Borda sutil, sem preenchimento.
   ============================================ */
.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1.5px solid var(--color-outline-variant);
  font-weight: var(--font-weight-semibold);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--state-hover);
  border-color: var(--color-primary);
}

.btn-secondary:active:not(:disabled) {
  background: var(--state-active);
  transform: scale(0.98);
}

/* ============================================
   VARIANT: OUTLINE — Igual a secondary (backward compat)
   Alguns componentes usam "outline" ao inves de "secondary".
   ============================================ */
.btn-outline {
  background: transparent;
  color: var(--color-primary);
  border: 1.5px solid var(--color-outline-variant);
  font-weight: var(--font-weight-semibold);
}

.btn-outline:hover:not(:disabled) {
  background: var(--state-hover);
  border-color: var(--color-primary);
}

.btn-outline:active:not(:disabled) {
  background: var(--state-active);
  transform: scale(0.98);
}

/* ============================================
   VARIANT: GHOST — Transparente, acao terciaria
   Sem borda, sem background. Hover mostra tonal.
   ============================================ */
.btn-ghost {
  background: transparent;
  color: var(--color-on-surface-variant);
  font-weight: var(--font-weight-medium);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--state-hover);
  color: var(--color-on-surface);
}

.btn-ghost:active:not(:disabled) {
  background: var(--state-active);
  transform: scale(0.98);
}

/* ============================================
   VARIANT: DANGER — Acao destrutiva/critica
   Gradiente vermelho, shadow error.
   ============================================ */
.btn-danger {
  background: var(--color-error);
  color: #ffffff;
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-error);
}

.btn-danger:hover:not(:disabled) {
  background: #a51515;
  transform: scale(1.02);
}

.btn-danger:active:not(:disabled) {
  transform: scale(0.98);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que Button.jsx NAO foi alterado
git diff src/shared/components/ui/Button.jsx
# Resultado esperado: nenhuma mudanca

# 2. Verificar que nao ha referencia neon no Button.css
grep -c "neon\|glow\|cyan\|magenta\|#ff00\|#00e5\|#00f0" src/shared/components/ui/Button.css
# Resultado esperado: 0

# 3. Verificar que gradient-primary esta sendo usado
grep "gradient-primary" src/shared/components/ui/Button.css
# Resultado esperado: pelo menos 1 match

# 4. Verificar que min-height >= 40px para todos os sizes
grep "min-height" src/shared/components/ui/Button.css
# Resultado esperado: 40px, 48px, 56px, 64px

# 5. App compila sem erros
npm run dev

# 6. Abrir no browser: botao primary deve ser gradiente verde com sombra
```

### Commit
```
feat(Button): redesenhar para Santuario Terapeutico

- Primary: gradiente verde 135° com shadow ambient
- Touch targets: min 40px (sm) a 64px (primary lg)
- Hover: scale(1.02), Active: scale(0.98) — Tactile Press
- Remover todos os glows neon e gradientes cyan/magenta
- Manter API identica (props nao mudam)
- Focus-visible: outline verde ao inves de cyan
```

---

## Sprint 3.2 — Card redesign

**Skill:** `/deliver-sprint`
**Escopo:** Reescrever Card.css para estilo Sanctuary. Atualizar minimamente Card.jsx para suportar variante.

### Arquivos alvo
1. `src/shared/components/ui/Card.css` — REESCREVER completamente
2. `src/shared/components/ui/Card.jsx` — ATUALIZAR minimamente (adicionar prop `variant`)

### O que o agente DEVE fazer

1. **Ler** `src/shared/components/ui/Card.jsx` (10 linhas):
   - Props atuais: `children`, `className`, `onClick`, `hover` (default true)
   - Classe base: `card`
   - Hover class: `card-hover`

2. **Ler** `src/shared/components/ui/Card.css` (22 linhas).

3. **Buscar** TODOS os usos de Card no codebase:
   ```bash
   grep -rn "import Card" src/ --include="*.jsx" | head -20
   grep -rn "<Card" src/ --include="*.jsx" | head -30
   ```

4. **Atualizar** `Card.jsx` para aceitar prop `variant` (com backward compat total).

5. **REESCREVER** `Card.css` com o conteudo abaixo.

### Conteudo ATUALIZADO do `Card.jsx`

```jsx
import './Card.css'

export default function Card({ children, className = '', onClick, hover = true, variant = 'default' }) {
  return (
    <div
      className={`card card-${variant} ${hover ? 'card-hover' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
```

**NOTA:** A unica mudanca e adicionar `variant = 'default'` e `card-${variant}` na className. Todos os usos existentes continuam funcionando porque o default e `'default'`.

### Conteudo EXATO do novo `Card.css`

```css
/* ============================================
   CARD — Santuario Terapeutico

   Principios:
   - NO-LINE RULE: Sem borders. Profundidade via tonal shift + shadow.
   - Background: surface-container-lowest (#ffffff) sobre surface (#f8fafb)
   - Shadow: ambient (sutil, luz natural)
   - Radius: 2rem (32px) — generoso, "acolhedor"
   - Padding: 2rem (desktop), 1.25rem (mobile)
   - Hover: shadow editorial (sutil elevacao, nao translateY agressivo)

   Variantes:
   - default: card padrao (branco, shadow ambient)
   - section: card interno (surface-container-low, sem shadow)
   - gradient: card CTA (gradient verde, texto branco)
   - alert-critical: card de alerta critico (bg error, borda esquerda)
   - alert-warning: card de alerta aviso (bg warning, borda esquerda)
   ============================================ */

/* ============================================
   BASE — todos os cards
   ============================================ */
.card {
  border-radius: var(--radius-card);
  padding: 1.25rem;
  border: none; /* NO-LINE RULE */
  transition: all 300ms ease-out;
}

@media (min-width: 768px) {
  .card {
    padding: 2rem;
  }
}

/* ============================================
   VARIANT: DEFAULT — Card padrao Sanctuary
   ============================================ */
.card-default {
  background-color: var(--color-surface-container-lowest);
  box-shadow: var(--shadow-ambient);
}

/* Hover — elevacao sutil, NAO translateY agressivo */
.card-default.card-hover:hover {
  box-shadow: var(--shadow-editorial);
}

/* ============================================
   VARIANT: SECTION — Card interno sem shadow
   Para secoes dentro de outros containers.
   ============================================ */
.card-section {
  background-color: var(--color-surface-container-low);
  box-shadow: none;
  border-radius: var(--radius-card-sm);
}

/* ============================================
   VARIANT: GRADIENT — Card CTA hero
   ============================================ */
.card-gradient {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-primary);
}

.card-gradient.card-hover:hover {
  transform: scale(1.01);
}

/* ============================================
   VARIANT: ALERT-CRITICAL — Alerta critico
   ============================================ */
.card-alert-critical {
  background-color: var(--color-error-bg);
  border-left: 4px solid var(--color-error);
  border-radius: var(--radius-card-sm);
}

/* ============================================
   VARIANT: ALERT-WARNING — Alerta aviso
   ============================================ */
.card-alert-warning {
  background-color: var(--color-warning-bg);
  border-left: 4px solid var(--color-warning);
  border-radius: var(--radius-card-sm);
}

/* ============================================
   CLICKABLE CARD — cursor pointer quando tem onClick
   ============================================ */
.card[onclick],
.card[role="button"] {
  cursor: pointer;
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que Card.jsx tem a prop variant
grep "variant" src/shared/components/ui/Card.jsx
# Resultado esperado: pelo menos 2 matches (prop + className)

# 2. Verificar que Card.css NAO tem border: 1px solid
grep "border: 1px" src/shared/components/ui/Card.css
# Resultado esperado: 0 matches

# 3. Verificar que NAO tem glassmorphism (backdrop-filter)
grep "backdrop-filter\|blur(" src/shared/components/ui/Card.css
# Resultado esperado: 0 matches

# 4. Verificar que radius-card esta sendo usado
grep "radius-card" src/shared/components/ui/Card.css
# Resultado esperado: pelo menos 1 match

# 5. App compila sem erros
npm run dev

# 6. Executar testes se existirem
npm run test:changed 2>/dev/null || echo "Sem testes alterados"
```

### Commit
```
feat(Card): redesenhar para Sanctuary style sem borders

- No-Line Rule: remover todas as borders
- Background: surface-container-lowest (#ffffff)
- Shadow: ambient (sutil, luz natural)
- Radius: 2rem (32px) — acolhedor
- Remover glassmorphism (backdrop-filter) — era heavy demais
- Adicionar variantes: section, gradient, alert-critical, alert-warning
- Hover: shadow editorial (sutil) ao inves de translateY(-4px)
```

---

## Sprint 3.3 — Inputs e Form Elements

**Skill:** `/deliver-sprint`
**Escopo:** Criar/atualizar estilos globais para inputs, selects e textareas.

### Arquivo alvo
`src/shared/styles/index.css`

### O que o agente DEVE fazer

1. **Buscar** onde inputs sao estilizados atualmente:
   ```bash
   grep -rn "input\[type\|textarea\|select" src/shared/styles/ --include="*.css"
   grep -rn "\.form-input\|\.form-group\|\.input-" src/ --include="*.css" -l
   ```

2. **Buscar** estilos inline de input em componentes:
   ```bash
   grep -rn "className.*input\|style.*input" src/ --include="*.jsx" | head -20
   ```

3. **Adicionar** no `src/shared/styles/index.css` os estilos globais de input (no final do arquivo, na secao de utility classes):

### CSS a ADICIONAR no `index.css`

```css
/* ============================================
   FORM ELEMENTS — Santuario Terapeutico

   Principios:
   - Background tonal (surface-container-low) ao inves de branco
   - Sem border em estado normal (tonal shift e suficiente)
   - Focus: 2px solid primary (verde)
   - Height minimo 56px (touch target acessivel)
   - Font: Lexend regular, body-lg
   - Radius: xl (1.25rem)
   - Placeholder: outline color, 40% opacity
   ============================================ */

input[type="text"],
input[type="email"],
input[type="password"],
input[type="number"],
input[type="tel"],
input[type="url"],
input[type="search"],
input[type="date"],
input[type="time"],
input[type="datetime-local"],
textarea,
select {
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-regular);
  color: var(--color-on-surface);
  background-color: var(--color-surface-container-low);
  border: 2px solid transparent;
  border-radius: var(--radius-input);
  padding: 0.875rem 1rem;
  min-height: 56px;
  width: 100%;
  outline: none;
  transition: border-color 200ms ease-out, background-color 200ms ease-out;
  box-sizing: border-box;
}

input::placeholder,
textarea::placeholder {
  color: var(--color-outline);
  opacity: var(--opacity-muted-text);
}

input:focus,
textarea:focus,
select:focus {
  border-color: var(--color-primary);
  background-color: var(--color-surface-container-lowest);
}

input:disabled,
textarea:disabled,
select:disabled {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
  background-color: var(--color-surface-container-high);
}

/* Search input com icone */
.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-input-wrapper input {
  padding-left: 3rem;
}

.search-input-wrapper .search-icon {
  position: absolute;
  left: 1rem;
  color: var(--color-outline);
  pointer-events: none;
}

/* Form label */
.form-label {
  display: block;
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  margin-bottom: 0.5rem;
}

/* Form group spacing */
.form-group {
  margin-bottom: 1.5rem;
}

/* Error state */
.input-error,
input.input-error,
textarea.input-error,
select.input-error {
  border-color: var(--color-error);
}

.input-error-message {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  color: var(--color-error);
  margin-top: 0.25rem;
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que os estilos de input existem
grep "input\[type" src/shared/styles/index.css | head -5
# Resultado esperado: pelo menos 5 matches

# 2. Verificar min-height de 56px
grep "min-height: 56px" src/shared/styles/index.css
# Resultado esperado: pelo menos 1 match

# 3. Verificar que radius-input esta sendo usado
grep "radius-input" src/shared/styles/index.css
# Resultado esperado: pelo menos 1 match

# 4. App compila sem erros
npm run dev
```

### Commit
```
feat(forms): estilizar inputs globais para Santuario Terapeutico

- Background tonal (surface-container-low) ao inves de branco
- Sem border em estado normal, focus: 2px solid verde
- Min-height 56px para acessibilidade de toque
- Lexend regular para texto de input
- Search input com posicionamento de icone
- Form labels e error states
```

---

## Sprint 3.4 — Badge component

**Skill:** `/deliver-sprint`
**Escopo:** Criar novo componente Badge para status labels.

### Arquivos alvo
1. **CRIAR** `src/shared/components/ui/Badge.jsx` (arquivo NOVO)
2. **CRIAR** `src/shared/components/ui/Badge.css` (arquivo NOVO)

### O que o agente DEVE fazer

1. **Verificar** que Badge NAO existe ainda:
   ```bash
   ls src/shared/components/ui/Badge.* 2>/dev/null || echo "Nao existe, pode criar"
   ```

2. **Criar** `src/shared/components/ui/Badge.jsx`:

```jsx
import './Badge.css'

/**
 * Badge — indicador de status com dot colorido + label.
 *
 * Variantes: critical, warning, success, info, neutral
 * Usado para: status de estoque, estado de protocolo, alertas inline.
 *
 * Referencia visual: plans/redesign/references/complex-estoque-desktop.png
 * — badges "URGENTE", "ATENCAO", "SEGURO" nos cards de estoque.
 */
export default function Badge({ children, variant = 'neutral', className = '' }) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      <span className="badge-dot" aria-hidden="true" />
      <span className="badge-label">{children}</span>
    </span>
  )
}
```

3. **Criar** `src/shared/components/ui/Badge.css`:

```css
/* ============================================
   BADGE — Santuario Terapeutico

   Formato: [dot] LABEL — dot colorido + texto uppercase
   Uso: status de estoque, protocolo, alertas inline

   Variantes:
   - critical: erro, estoque critico, urgente
   - warning: aviso, estoque baixo, atencao
   - success: ok, seguro, continuo
   - info: informativo, em andamento
   - neutral: padrao, sem enfase
   ============================================ */

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-badge);
  font-family: var(--font-body);
  font-size: var(--text-label-sm);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  line-height: 1;
  white-space: nowrap;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

/* Critical — erro, urgente */
.badge-critical {
  background-color: rgba(186, 26, 26, 0.10);
  color: var(--color-error);
}

.badge-critical .badge-dot {
  background-color: var(--color-error);
}

/* Warning — aviso, atencao */
.badge-warning {
  background-color: rgba(123, 87, 0, 0.10);
  color: var(--color-tertiary);
}

.badge-warning .badge-dot {
  background-color: var(--color-tertiary);
}

/* Success — ok, seguro, continuo */
.badge-success {
  background-color: rgba(0, 106, 94, 0.10);
  color: var(--color-primary);
}

.badge-success .badge-dot {
  background-color: var(--color-primary);
}

/* Info — informativo */
.badge-info {
  background-color: rgba(0, 93, 182, 0.10);
  color: var(--color-secondary);
}

.badge-info .badge-dot {
  background-color: var(--color-secondary);
}

/* Neutral — padrao */
.badge-neutral {
  background-color: var(--color-surface-container);
  color: var(--color-outline);
}

.badge-neutral .badge-dot {
  background-color: var(--color-outline);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que Badge existe
ls src/shared/components/ui/Badge.jsx src/shared/components/ui/Badge.css
# Resultado esperado: ambos existem

# 2. Verificar que exporta default
grep "export default" src/shared/components/ui/Badge.jsx
# Resultado esperado: 1 match

# 3. Verificar variantes no CSS
grep "badge-critical\|badge-warning\|badge-success\|badge-info\|badge-neutral" src/shared/components/ui/Badge.css | wc -l
# Resultado esperado: >= 5

# 4. App compila sem erros
npm run dev
```

### Commit
```
feat(Badge): criar componente Badge para status indicators

- Formato: dot colorido + label uppercase
- Variantes: critical, warning, success, info, neutral
- Referencia: badges de estoque (URGENTE, ATENCAO, SEGURO)
- Acessibilidade: dot e aria-hidden, texto legivel
```

---

## Sprint 3.5 — Progress Bar

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar estilos globais para barras de progresso (estoque, adesao).

### Arquivo alvo
`src/shared/styles/index.css`

### O que o agente DEVE fazer

1. **Buscar** como progress bars sao usadas atualmente:
   ```bash
   grep -rn "progress\|stock.*bar\|fill" src/ --include="*.css" | grep -v node_modules | head -20
   ```

2. **Adicionar** ao final do `src/shared/styles/index.css`:

### CSS a ADICIONAR

```css
/* ============================================
   PROGRESS BAR — Santuario Terapeutico

   Visual: 8px altura, full radius, cores semanticas.
   Transicao: width animada em 1000ms (Living Fill).

   Referencia: plans/redesign/references/complex-estoque-desktop.png
   — barras coloridas de estoque nos cards.

   Regra de cor por nivel de estoque:
   - >20%: secondary (azul) ou primary (verde)
   - <20%: error (vermelho) — "urgencia psicologica imediata"
   ============================================ */

.progress-bar {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-container-highest);
  overflow: hidden;
  width: 100%;
}

.progress-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1000ms ease-out;
  transform-origin: left;
}

/* Cores semanticas para o fill */
.progress-fill-primary { background-color: var(--color-primary); }
.progress-fill-secondary { background-color: var(--color-secondary); }
.progress-fill-success { background-color: var(--color-success); }
.progress-fill-warning { background-color: var(--color-warning); }
.progress-fill-error { background-color: var(--color-error); }
.progress-fill-info { background-color: var(--color-info); }

/* Progress bar com label ao lado */
.progress-with-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-with-label .progress-bar {
  flex: 1;
}

.progress-label {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface-variant);
  white-space: nowrap;
  min-width: 3ch; /* espaco para "100%" */
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que progress-bar existe
grep "progress-bar" src/shared/styles/index.css | head -3
# Resultado esperado: pelo menos 3 matches

# 2. Verificar cores semanticas
grep "progress-fill-" src/shared/styles/index.css | wc -l
# Resultado esperado: >= 6

# 3. App compila sem erros
npm run dev
```

### Commit
```
feat(styles): adicionar progress bar system para estoque e adesao

- Barras 8px full radius com cores semanticas
- Transicao animada 1000ms (Living Fill pattern)
- Progress-with-label layout para % inline
- Cores: primary, secondary, success, warning, error, info
```

---

## Sprint 3.6 — List Items (No Dividers)

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar estilos globais para listas sem divisores (separacao por espaco + tonal).

### Arquivo alvo
`src/shared/styles/index.css`

### O que o agente DEVE fazer

1. **Buscar** como listas sao estilizadas atualmente:
   ```bash
   grep -rn "list-item\|list-group\|divider" src/ --include="*.css" | head -15
   ```

2. **Adicionar** ao final do `src/shared/styles/index.css`:

### CSS a ADICIONAR

```css
/* ============================================
   LIST ITEMS — Santuario Terapeutico (No Dividers)

   Principio: PROIBIDO usar hr, border-bottom, ou linhas divisoras.
   Separacao visual por:
   1. Espacamento (margin/gap) entre items
   2. Alternancia tonal (par/impar backgrounds)
   3. Leading icon em circulo colorido

   Referencia visual:
   - plans/redesign/references/simple-hoje-mobile.png: lista de doses do cronograma
   - plans/redesign/references/complex-tratamentos-mobile.png: lista de medicamentos
   ============================================ */

.list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg);
  transition: background 200ms ease-out;
  border: none; /* NO-LINE RULE */
}

.list-item:hover {
  background: var(--color-surface-container-low);
}

/* Active/selected state */
.list-item.active {
  background: var(--color-surface-container-low);
}

/* Leading icon container (circulo colorido) */
.list-item-icon {
  width: 3rem;      /* 48px */
  height: 3rem;
  border-radius: var(--radius-full);
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

.list-item-icon-sm {
  width: 2.5rem;    /* 40px */
  height: 2.5rem;
  border-radius: var(--radius-full);
  background: var(--color-secondary-fixed);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}

/* Content area (ocupa espaco restante) */
.list-item-content {
  flex: 1;
  min-width: 0; /* permite text-overflow funcionar */
}

.list-item-title {
  font-family: var(--font-body);
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  line-height: var(--line-height-snug);
}

.list-item-subtitle {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-regular);
  color: var(--color-on-surface-variant);
  line-height: var(--line-height-normal);
}

/* Trailing content (hora, chevron, status) */
.list-item-trailing {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-outline);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Dose status indicators na lista */
.list-item-done {
  opacity: 0.6;
}

.list-item-done .list-item-icon {
  background: var(--color-surface-container);
  color: var(--color-success);
}

/* Dose pending (nao tomado ainda) */
.list-item-pending .list-item-icon {
  background: var(--color-surface-container);
  color: var(--color-outline);
}

/* Dose current (proxima dose) */
.list-item-current {
  background: var(--color-surface-container-low);
}

.list-item-current .list-item-icon {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que list-item existe
grep "list-item" src/shared/styles/index.css | head -5
# Resultado esperado: pelo menos 5 matches

# 2. Verificar que NAO tem border-bottom ou hr nas novas classes
grep "border-bottom\|<hr" src/shared/styles/index.css | grep "list-item"
# Resultado esperado: 0 matches

# 3. App compila sem erros
npm run dev

# 4. Build funciona
npm run build
```

### Commit
```
feat(styles): adicionar list item system sem divisores

- No-Dividers: separacao por espacamento e tonal shift
- Leading icon em circulo colorido (secondary-fixed)
- Estados: done (opaco), pending, current (highlight)
- Trailing content para hora/status/chevron
- Responsive: padding ajusta automaticamente
```

---

## Criterio de Conclusao da Wave 3

Apos os 6 sprints, validar:

- [ ] Button primary e gradiente verde com min-height 56-64px
- [ ] Button NAO tem glow neon em nenhum estado (hover, focus, active)
- [ ] Cards usam sanctuary style (NO borders, radius 2rem, ambient shadow)
- [ ] Cards NAO tem glassmorphism/backdrop-filter
- [ ] Inputs tem min-height 56px com radius xl e foco verde
- [ ] Badge component existe com 5 variantes (critical, warning, success, info, neutral)
- [ ] Progress bars tem 8px height, full radius, cores semanticas
- [ ] Listas NAO tem dividers (separacao por espaco + tonal)
- [ ] Todos os touch targets >= 40px (sm) ou 56px (default)
- [ ] `npm run build` passa sem erros
- [ ] `npm run dev` roda sem warnings de CSS

## Ordem de Execucao

```
Sprint 3.1 (Button.css)
  ↓
Sprint 3.2 (Card.jsx + Card.css)
  ↓
Sprint 3.3 (Input styles no index.css)
  ↓
Sprint 3.4 (Badge.jsx + Badge.css — NOVO)
  ↓
Sprint 3.5 (Progress bar no index.css)
  ↓
Sprint 3.6 (List items no index.css)
```

**TODOS os sprints sao sequenciais** — Badge e novo mas depende dos tokens de cores (Wave 0).

## Notas para agentes executores

1. **NUNCA alterar a assinatura/props de Button.jsx** — dezenas de arquivos dependem da API atual.
2. **Card.jsx tem uma unica alteracao**: adicionar `variant` prop com default `'default'`. NADA MAIS.
3. **Badge.jsx e novo** — verificar que o path de import esta correto: `@shared/components/ui/Badge`
4. **Testar que inputs existentes nao quebram** — os estilos globais de input podem conflitar com estilos de componentes especificos. Se encontrar conflitos, usar especificidade mais alta (`.form-input` ao inves de `input[type="text"]`).
5. **Se houver erros de variavel CSS indefinida**, verificar que Waves 0-2 foram executadas corretamente. As variaveis usadas aqui (--gradient-primary, --shadow-primary, --radius-card, --font-body, etc.) SAO definidas nas waves anteriores.
