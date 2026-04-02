# Wave 3 — Component Library: Primitives

**Status:** Pronto para execucao
**Dependencias:** Waves 0, 1 e 2 DEVEM estar completas (tokens scoped, typography scoped, layout.redesign.css)
**Branch:** `feature/redesign/wave-3-component-primitives`
**Estimativa:** 6 sprints sequenciais
**Risco:** BAIXO (com abordagem scoped) — CSS de redesign vai em arquivo separado, sem tocar Button.css ou Card.css.

---

## 🚩 ABORDAGEM DE ROLLOUT GRADUAL (LEIA ANTES DE EXECUTAR)

> **Esta wave NAO modifica `Button.css`, `Card.css` nem qualquer outro CSS de componente existente.**
> Todos os estilos de redesign vao para `src/shared/styles/components.redesign.css`, scoped com `[data-redesign="true"] .btn { }`.
> Ver estrategia completa em `plans/redesign/EXEC_SPEC_GRADUAL_ROLLOUT.md`.

**Motivo:** Com a abordagem scoped, quando o flag estiver desativado, os componentes mostram o visual atual. Quando ativado (`?redesign=1`), as regras scoped em `components.redesign.css` tem especificidade maior que as regras de `Button.css` e sobrescrevem o visual — sem duplicar o componente JSX.

**Arquivo a criar:**
```
src/shared/styles/components.redesign.css
```

Estrutura das regras:
```css
/* CORRETO — scoped */
[data-redesign="true"] .btn { ... }
[data-redesign="true"] .btn-primary { ... }
[data-redesign="true"] .card { ... }

/* ERRADO — nao fazer */
.btn { ... }  /* global, afeta todos os usuarios */
```

**Importar** em `src/shared/styles/index.css` apos o `layout.redesign.css`.

**Regra cardinal (imutavel):** A API de props dos componentes JSX **NUNCA muda**. Se voce alterar a assinatura de `Button.jsx` ou `Card.jsx`, DEZENAS de arquivos vao quebrar. Apenas o CSS e a aparencia mudam.

---

> **IMPORTANTE para o agente executor:** Esta wave redesenha os componentes UI primitivos (Button, Card, inputs, badges, progress bars, listas) para o estilo "Santuario Terapeutico". O arquivo alvo de TODOS os sprints e `components.redesign.css` — nao os arquivos CSS dos componentes. A regra cardinal: **API de props identica, apenas CSS muda, e somente quando o flag esta ativo**.

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

## Sprint 3.1 — Button redesign (scoped em components.redesign.css)

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar estilos de Button do Santuario em `components.redesign.css`, scoped com `[data-redesign="true"]`. NAO alterar `Button.css` nem `Button.jsx`.

### Arquivos alvo
1. **CRIAR** `src/shared/styles/components.redesign.css` — arquivo novo com estilos scoped
2. **EDITAR** `src/shared/styles/index.css` — adicionar import do novo arquivo
3. `src/shared/components/ui/Button.css` — **NAO ALTERAR** (estilos atuais preservados)
4. `src/shared/components/ui/Button.jsx` — **NAO ALTERAR** (API identica)

### O que o agente DEVE fazer

1. **Ler** `src/shared/components/ui/Button.jsx` para confirmar a API:
   - Props: `children`, `variant` (default 'primary'), `size` (default 'md'), `onClick`, `disabled`, `type`, `className`
   - Classes geradas: `btn btn-{variant} btn-{size} {className}`
   - Variantes: `primary`, `secondary`, `outline`, `ghost`, `danger`
   - Tamanhos: `sm`, `md`, `lg`

2. **Ler** `src/shared/components/ui/Button.css` para entender o CSS atual (context — nao modificar).

3. **Buscar** os usos de Button no codebase para garantir que nenhuma variante esta faltando:
   ```bash
   grep -rn "variant=" src/ --include="*.jsx" | grep -i "button\|btn" | head -30
   ```

4. **Criar** `src/shared/styles/components.redesign.css` com o conteudo abaixo.
5. **Editar** `src/shared/styles/index.css` para adicionar `@import './components.redesign.css';` apos o layout.redesign.

### Conteudo EXATO de `components.redesign.css` (Sprint 3.1 — apenas Button)

```css
/* ============================================
   COMPONENTS REDESIGN — Santuario Terapeutico
   SCOPE: [data-redesign="true"] — sem impacto em usuarios sem o flag

   Principios de Button:
   - Touch targets minimo 56px (acessibilidade motora)
   - Primary e gradient verde 135° com shadow ambient
   - Hover: scale(1.02) sutil. Active: scale(0.98) — "Tactile Press"
   - NUNCA glow neon. Shadow e ambient/primary apenas.
   - Font: Lexend (--font-body) bold
   - Radius: xl (1.25rem)
   ============================================ */

/* ============================================
   BUTTON BASE — todos os botoes
   ============================================ */
[data-redesign="true"] .btn {
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

[data-redesign="true"] .btn:disabled {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

[data-redesign="true"] .btn:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-primary);
  outline-offset: var(--focus-ring-offset);
}

/* ============================================
   SIZES — Touch-first scale
   ============================================ */
[data-redesign="true"] .btn-sm {
  padding: 0.5rem 1rem;
  font-size: var(--text-title-sm);
  min-height: 40px;
}

[data-redesign="true"] .btn-md {
  padding: 0.75rem 1.5rem;
  font-size: var(--text-body-lg);
  min-height: 48px;
}

[data-redesign="true"] .btn-lg {
  padding: 1rem 2rem;
  font-size: var(--text-title-lg);
  min-height: 56px;
  max-width: 100%;
}

/* ============================================
   VARIANT: PRIMARY — Gradient verde, CTA principal
   ============================================ */
[data-redesign="true"] .btn-primary {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-primary);
  min-height: 56px;
}

[data-redesign="true"] .btn-primary.btn-lg {
  min-height: 64px;
  font-size: var(--text-title-lg);
  padding: 1rem 2rem;
}

[data-redesign="true"] .btn-primary:hover:not(:disabled) {
  transform: scale(1.02);
}

[data-redesign="true"] .btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

/* ============================================
   VARIANT: SECONDARY — Outlined, acao secundaria
   ============================================ */
[data-redesign="true"] .btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1.5px solid var(--color-outline-variant);
  font-weight: var(--font-weight-semibold);
}

[data-redesign="true"] .btn-secondary:hover:not(:disabled) {
  background: var(--state-hover);
  border-color: var(--color-primary);
}

[data-redesign="true"] .btn-secondary:active:not(:disabled) {
  background: var(--state-active);
  transform: scale(0.98);
}

[data-redesign="true"] .btn-outline {
  background: transparent;
  color: var(--color-primary);
  border: 1.5px solid var(--color-outline-variant);
  font-weight: var(--font-weight-semibold);
}

[data-redesign="true"] .btn-outline:hover:not(:disabled) {
  background: var(--state-hover);
  border-color: var(--color-primary);
}

[data-redesign="true"] .btn-outline:active:not(:disabled) {
  background: var(--state-active);
  transform: scale(0.98);
}

[data-redesign="true"] .btn-ghost {
  background: transparent;
  color: var(--color-on-surface-variant);
  font-weight: var(--font-weight-medium);
}

[data-redesign="true"] .btn-ghost:hover:not(:disabled) {
  background: var(--state-hover);
  color: var(--color-on-surface);
}

[data-redesign="true"] .btn-ghost:active:not(:disabled) {
  background: var(--state-active);
  transform: scale(0.98);
}

[data-redesign="true"] .btn-danger {
  background: var(--color-error);
  color: #ffffff;
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-error);
}

[data-redesign="true"] .btn-danger:hover:not(:disabled) {
  background: #a51515;
  transform: scale(1.02);
}

[data-redesign="true"] .btn-danger:active:not(:disabled) {
  transform: scale(0.98);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que Button.jsx NAO foi alterado
git diff src/shared/components/ui/Button.jsx
# Resultado esperado: nenhuma mudanca

# 2. Verificar que Button.css NAO foi alterado
git diff src/shared/components/ui/Button.css
# Resultado esperado: nenhuma mudanca

# 3. Verificar que components.redesign.css foi criado com estilos scoped
grep "\[data-redesign.*btn-primary" src/shared/styles/components.redesign.css
# Resultado esperado: pelo menos 1 match

# 4. Verificar que components.redesign.css esta importado em index.css
grep "components.redesign" src/shared/styles/index.css
# Resultado esperado: 1 match

# 5. App compila sem erros
npm run dev

# 6. Smoke test: sem flag → botao primary tem visual atual (rosa/cyan)
# Com ?redesign=1 → botao primary tem gradiente verde com sombra ambient
```

### Commit
```
feat(Button): adicionar estilos Santuario em components.redesign.css (scoped)

- [data-redesign="true"] .btn-primary: gradiente verde 135° com shadow ambient
- Touch targets: min 40px (sm) a 64px (primary lg) scoped
- Hover/Active: Tactile Press scoped
- Button.css e Button.jsx intactos (sem alteracao)
- Criar components.redesign.css e importar em index.css
```

---

## Sprint 3.2 — Card redesign (scoped em components.redesign.css)

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar estilos de Card do Santuario em `components.redesign.css` (scoped). Atualizar `Card.jsx` minimamente para suportar prop `variant` (backward compat — prop opcional com default).

### Arquivos alvo
1. `src/shared/styles/components.redesign.css` — ADICIONAR estilos de Card scoped
2. `src/shared/components/ui/Card.jsx` — ATUALIZAR minimamente (adicionar prop `variant` opcional)
3. `src/shared/components/ui/Card.css` — **NAO ALTERAR** (estilos atuais preservados)

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

4. **Verificar e remover a regra `.card-gradient` de `tokens.redesign.css`** — IMPORTANTE:
   ```bash
   grep -n "card-gradient" src/shared/styles/tokens.redesign.css
   # Se encontrar, REMOVER o bloco [data-redesign="true"] .card-gradient { } de tokens.redesign.css.
   # Motivo: Sprint 0.4 (Wave 0) adicionou um .card-gradient utilitário com padding/radius hardcoded.
   # Este sprint define a versão completa e correta em components.redesign.css.
   # Ter ambas as definições com a mesma especificidade causa conflito de padding/border-radius
   # quando o Card component usa variant="gradient" (que aplica .card + .card-gradient simultaneamente).
   # A versão em components.redesign.css é a canônica — a de tokens.redesign.css deve ser removida.
   ```

5. **Atualizar** `Card.jsx` para aceitar prop `variant` (backward compat — prop opcional, default `'default'`).

5. **Adicionar** estilos de Card scoped em `components.redesign.css` (NAO reescrever `Card.css`).

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

### Conteudo a ADICIONAR em `components.redesign.css` (Card — scoped)

```css
/* ============================================
   CARD — Santuario Terapeutico (scoped)
   Principios: NO-LINE RULE, tonal shift, ambient shadow.
   ============================================ */

[data-redesign="true"] .card {
  border-radius: var(--radius-card);
  padding: 1.25rem;
  border: none; /* NO-LINE RULE */
  transition: all 300ms ease-out;
}

@media (min-width: 768px) {
  [data-redesign="true"] .card {
    padding: 2rem;
  }
}

[data-redesign="true"] .card-default {
  background-color: var(--color-surface-container-lowest);
  box-shadow: var(--shadow-ambient);
}

[data-redesign="true"] .card-default.card-hover:hover {
  box-shadow: var(--shadow-editorial);
}

[data-redesign="true"] .card-gradient {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-primary);
}

[data-redesign="true"] .card-gradient.card-hover:hover {
  transform: scale(1.01);
}

[data-redesign="true"] .card-alert-critical {
  background-color: var(--color-error-bg);
  border-left: 4px solid var(--color-error);
  border-radius: var(--radius-card-sm);
}

[data-redesign="true"] .card-alert-warning {
  background-color: var(--color-warning-bg);
  border-left: 4px solid var(--color-warning);
  border-radius: var(--radius-card-sm);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que Card.jsx tem a prop variant (backward compat)
grep "variant" src/shared/components/ui/Card.jsx
# Resultado esperado: pelo menos 2 matches (prop + className)

# 2. Verificar que Card.css NAO foi alterado
git diff src/shared/components/ui/Card.css
# Resultado esperado: nenhuma mudanca

# 3. Verificar que card-default esta em components.redesign.css (scoped)
grep "\[data-redesign.*card-default" src/shared/styles/components.redesign.css
# Resultado esperado: pelo menos 1 match

# 4. App compila sem erros
npm run dev

# 5. Smoke test: sem flag → cards com visual atual
# Com ?redesign=1 → cards sem borders, shadow ambient, radius 2rem
```

### Commit
```
feat(Card): adicionar estilos Sanctuary em components.redesign.css (scoped)

- [data-redesign="true"] .card: no borders, radius 2rem, ambient shadow
- Variantes scoped: default, gradient, alert-critical, alert-warning
- Card.jsx: adicionar prop variant opcional (backward compat)
- Card.css intacto (sem alteracao)
```

---

## Sprint 3.3 — Inputs e Form Elements (scoped em components.redesign.css)

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar estilos de input/form scoped em `components.redesign.css`. NAO modificar `index.css` com estilos globais.

### Arquivo alvo
`src/shared/styles/components.redesign.css` ← ADICIONAR estilos de form scoped

> **NAO ALTERAR:** `src/shared/styles/index.css`

### O que o agente DEVE fazer

1. **Buscar** onde inputs sao estilizados atualmente (context):
   ```bash
   grep -rn "input\[type\|textarea\|select" src/shared/styles/ --include="*.css"
   grep -rn "\.form-input\|\.form-group\|\.input-" src/ --include="*.css" -l
   ```

2. **Buscar** estilos inline de input em componentes (context):
   ```bash
   grep -rn "className.*input\|style.*input" src/ --include="*.jsx" | head -20
   ```

3. **Adicionar** em `components.redesign.css` os estilos de input scoped:

### CSS a ADICIONAR em `components.redesign.css`

```css
/* ============================================
   FORM ELEMENTS — Santuario Terapeutico
   SCOPE: [data-redesign="true"] — sem impacto em usuarios sem o flag

   Principios:
   - Background tonal (surface-container-low) ao inves de branco
   - Sem border em estado normal (tonal shift e suficiente)
   - Focus: 2px solid primary (verde)
   - Height minimo 56px (touch target acessivel)
   - Font: Lexend regular, body-lg
   - Radius: xl (1.25rem)
   - Placeholder: outline color, 40% opacity
   ============================================ */

[data-redesign="true"] input[type="text"],
[data-redesign="true"] input[type="email"],
[data-redesign="true"] input[type="password"],
[data-redesign="true"] input[type="number"],
[data-redesign="true"] input[type="tel"],
[data-redesign="true"] input[type="url"],
[data-redesign="true"] input[type="search"],
[data-redesign="true"] input[type="date"],
[data-redesign="true"] input[type="time"],
[data-redesign="true"] input[type="datetime-local"],
[data-redesign="true"] textarea,
[data-redesign="true"] select {
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

[data-redesign="true"] input::placeholder,
[data-redesign="true"] textarea::placeholder {
  color: var(--color-outline);
  opacity: var(--opacity-muted-text);
}

[data-redesign="true"] input:focus,
[data-redesign="true"] textarea:focus,
[data-redesign="true"] select:focus {
  border-color: var(--color-primary);
  background-color: var(--color-surface-container-lowest);
}

[data-redesign="true"] input:disabled,
[data-redesign="true"] textarea:disabled,
[data-redesign="true"] select:disabled {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
  background-color: var(--color-surface-container-high);
}

/* Search input com icone */
[data-redesign="true"] .search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

[data-redesign="true"] .search-input-wrapper input {
  padding-left: 3rem;
}

[data-redesign="true"] .search-input-wrapper .search-icon {
  position: absolute;
  left: 1rem;
  color: var(--color-outline);
  pointer-events: none;
}

/* Form label */
[data-redesign="true"] .form-label {
  display: block;
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  margin-bottom: 0.5rem;
}

/* Form group spacing */
[data-redesign="true"] .form-group {
  margin-bottom: 1.5rem;
}

/* Error state */
[data-redesign="true"] .input-error,
[data-redesign="true"] input.input-error,
[data-redesign="true"] textarea.input-error,
[data-redesign="true"] select.input-error {
  border-color: var(--color-error);
}

[data-redesign="true"] .input-error-message {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  color: var(--color-error);
  margin-top: 0.25rem;
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que os estilos de input existem com seletor scoped correto
grep "\[data-redesign.*input\[type" src/shared/styles/components.redesign.css | head -5
# Resultado esperado: pelo menos 5 matches (todos com [data-redesign="true"] prefix)

# Verificar que NAO ha seletor input sem scoping
grep -E "^input\[|^textarea|^select\b" src/shared/styles/components.redesign.css
# Resultado esperado: 0 matches (todos os seletores devem comecar com [data-redesign])

# 2. Verificar min-height de 56px
grep "min-height: 56px" src/shared/styles/components.redesign.css
# Resultado esperado: pelo menos 1 match

# 3. Verificar que radius-input esta sendo usado
grep "radius-input" src/shared/styles/components.redesign.css
# Resultado esperado: pelo menos 1 match

# 4. Verificar que index.css NAO foi modificado (integridade)
git diff src/shared/styles/index.css
# Resultado esperado: nenhuma mudanca (apenas o @import de components.redesign.css que foi adicionado no sprint 3.1)

# 5. App compila sem erros
npm run dev
```

### Commit
```
feat(forms): adicionar estilos de input ao components.redesign.css

- Scoped sob [data-redesign="true"] — index.css intocado
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

> 🚩 **Rollout:** Badge é componente NOVO — não existe na UI atual. Mesmo sendo novo, o CSS vai em
> `components.redesign.css` (já criado no Sprint 3.1) com seletores `[data-redesign="true"] .badge {}`.
> Assim, mesmo que Badge seja importado em algum arquivo genérico no futuro, não renderizará estilos
> do redesign sem o flag ativo. `Badge.css` é omitido para evitar duplicação — os estilos vêm de
> `components.redesign.css` carregado globalmente.

### Arquivos alvo
1. **CRIAR** `src/shared/components/ui/Badge.jsx` (arquivo NOVO — sem import CSS próprio)
2. **ADICIONAR** estilos Badge ao final de `src/shared/styles/components.redesign.css` (já existe desde Sprint 3.1)

### O que o agente DEVE fazer

1. **Verificar** que Badge NAO existe ainda:
   ```bash
   ls src/shared/components/ui/Badge.* 2>/dev/null || echo "Nao existe, pode criar"
   ```

2. **Criar** `src/shared/components/ui/Badge.jsx`:

```jsx
/**
 * Badge — indicador de status com dot colorido + label.
 *
 * Variantes: critical, warning, success, info, neutral
 * Usado para: status de estoque, estado de protocolo, alertas inline.
 *
 * Referencia visual: plans/redesign/references/complex-estoque-desktop.png
 * — badges "URGENTE", "ATENCAO", "SEGURO" nos cards de estoque.
 *
 * NOTA: estilos em src/shared/styles/components.redesign.css
 * sob [data-redesign="true"] .badge {}
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

3. **Adicionar** ao final de `src/shared/styles/components.redesign.css` (NUNCA criar `Badge.css`):

```css
/* ============================================
   BADGE — Santuario Terapeutico
   Scoped sob [data-redesign="true"]

   Formato: [dot] LABEL — dot colorido + texto uppercase
   Uso: status de estoque, protocolo, alertas inline

   Variantes:
   - critical: erro, estoque critico, urgente
   - warning: aviso, estoque baixo, atencao
   - success: ok, seguro, continuo
   - info: informativo, em andamento
   - neutral: padrao, sem enfase
   ============================================ */

[data-redesign="true"] .badge {
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

[data-redesign="true"] .badge-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

/* Critical — erro, urgente */
[data-redesign="true"] .badge-critical {
  background-color: rgba(186, 26, 26, 0.10);
  color: var(--color-error);
}

[data-redesign="true"] .badge-critical .badge-dot {
  background-color: var(--color-error);
}

/* Warning — aviso, atencao */
[data-redesign="true"] .badge-warning {
  background-color: rgba(123, 87, 0, 0.10);
  color: var(--color-tertiary);
}

[data-redesign="true"] .badge-warning .badge-dot {
  background-color: var(--color-tertiary);
}

/* Success — ok, seguro, continuo */
[data-redesign="true"] .badge-success {
  background-color: rgba(0, 106, 94, 0.10);
  color: var(--color-primary);
}

[data-redesign="true"] .badge-success .badge-dot {
  background-color: var(--color-primary);
}

/* Info — informativo */
[data-redesign="true"] .badge-info {
  background-color: rgba(0, 93, 182, 0.10);
  color: var(--color-secondary);
}

[data-redesign="true"] .badge-info .badge-dot {
  background-color: var(--color-secondary);
}

/* Neutral — padrao */
[data-redesign="true"] .badge-neutral {
  background-color: var(--color-surface-container);
  color: var(--color-outline);
}

[data-redesign="true"] .badge-neutral .badge-dot {
  background-color: var(--color-outline);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que Badge.jsx existe (sem Badge.css — estilos em components.redesign.css)
ls src/shared/components/ui/Badge.jsx
# Resultado esperado: arquivo existe
ls src/shared/components/ui/Badge.css 2>/dev/null && echo "ERRO: Badge.css nao deveria existir"
# Resultado esperado: nenhuma saida (arquivo NAO deve existir)

# 2. Verificar que exporta default
grep "export default" src/shared/components/ui/Badge.jsx
# Resultado esperado: 1 match

# 3. Verificar que Badge NAO importa CSS proprio
grep "import.*Badge.css\|import.*\.css" src/shared/components/ui/Badge.jsx
# Resultado esperado: 0 matches

# 4. Verificar variantes no components.redesign.css com scoping correto
grep "\[data-redesign=\"true\"\].*badge" src/shared/styles/components.redesign.css | wc -l
# Resultado esperado: >= 10

# 5. App compila sem erros
npm run dev
```

### Commit
```
feat(Badge): criar componente Badge para status indicators

- CSS scoped em components.redesign.css sob [data-redesign="true"]
- Badge.jsx sem import CSS proprio — estilos vem do arquivo global de redesign
- Formato: dot colorido + label uppercase
- Variantes: critical, warning, success, info, neutral
- Referencia: badges de estoque (URGENTE, ATENCAO, SEGURO)
- Acessibilidade: dot e aria-hidden, texto legivel
```

---

## Sprint 3.5 — Progress Bar

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar estilos para barras de progresso (estoque, adesao).

> 🚩 **Rollout:** Estilos de progress bar vão em `components.redesign.css` (já criado no Sprint 3.1)
> com seletores `[data-redesign="true"] .progress-bar {}`. `index.css` **NÃO é modificado**.

### Arquivo alvo
`src/shared/styles/components.redesign.css` (ADICIONAR ao final — arquivo já existe desde Sprint 3.1)

### O que o agente DEVE fazer

1. **Buscar** como progress bars sao usadas atualmente:
   ```bash
   grep -rn "progress\|stock.*bar\|fill" src/ --include="*.css" | grep -v node_modules | head -20
   ```

2. **Adicionar** ao final do `src/shared/styles/components.redesign.css`:

### CSS a ADICIONAR

```css
/* ============================================
   PROGRESS BAR — Santuario Terapeutico
   Scoped sob [data-redesign="true"]

   Visual: 8px altura, full radius, cores semanticas.
   Transicao: width animada em 1000ms (Living Fill).

   Referencia: plans/redesign/references/complex-estoque-desktop.png
   — barras coloridas de estoque nos cards.

   Regra de cor por nivel de estoque:
   - >20%: secondary (azul) ou primary (verde)
   - <20%: error (vermelho) — "urgencia psicologica imediata"
   ============================================ */

[data-redesign="true"] .progress-bar {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-container-highest);
  overflow: hidden;
  width: 100%;
}

[data-redesign="true"] .progress-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1000ms ease-out;
  transform-origin: left;
}

/* Cores semanticas para o fill */
[data-redesign="true"] .progress-fill-primary { background-color: var(--color-primary); }
[data-redesign="true"] .progress-fill-secondary { background-color: var(--color-secondary); }
[data-redesign="true"] .progress-fill-success { background-color: var(--color-success); }
[data-redesign="true"] .progress-fill-warning { background-color: var(--color-warning); }
[data-redesign="true"] .progress-fill-error { background-color: var(--color-error); }
[data-redesign="true"] .progress-fill-info { background-color: var(--color-info); }

/* Progress bar com label ao lado */
[data-redesign="true"] .progress-with-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

[data-redesign="true"] .progress-with-label .progress-bar {
  flex: 1;
}

[data-redesign="true"] .progress-label {
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
# 1. Verificar que progress-bar existe no arquivo correto (scoped)
grep "progress-bar" src/shared/styles/components.redesign.css | head -3
# Resultado esperado: pelo menos 3 matches

# 2. Verificar que seletores sao scoped
grep "\[data-redesign=\"true\"\].*progress" src/shared/styles/components.redesign.css | wc -l
# Resultado esperado: >= 8

# 3. Verificar que index.css NAO foi modificado
git diff src/shared/styles/index.css
# Resultado esperado: nenhuma mudanca

# 4. App compila sem erros
npm run dev
```

### Commit
```
feat(progress): adicionar progress bar system ao components.redesign.css

- Scoped sob [data-redesign="true"] — index.css intocado
- Barras 8px full radius com cores semanticas
- Transicao animada 1000ms (Living Fill pattern)
- Progress-with-label layout para % inline
- Cores: primary, secondary, success, warning, error, info
```

---

## Sprint 3.6 — List Items (No Dividers)

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar estilos para listas sem divisores (separacao por espaco + tonal).

> 🚩 **Rollout:** Estilos de list item vão em `components.redesign.css` (já criado no Sprint 3.1)
> com seletores `[data-redesign="true"] .list-item {}`. `index.css` **NÃO é modificado**.

### Arquivo alvo
`src/shared/styles/components.redesign.css` (ADICIONAR ao final — arquivo já existe desde Sprint 3.1)

### O que o agente DEVE fazer

1. **Buscar** como listas sao estilizadas atualmente:
   ```bash
   grep -rn "list-item\|list-group\|divider" src/ --include="*.css" | head -15
   ```

2. **Adicionar** ao final do `src/shared/styles/components.redesign.css`:

### CSS a ADICIONAR

```css
/* ============================================
   LIST ITEMS — Santuario Terapeutico (No Dividers)
   Scoped sob [data-redesign="true"]

   Principio: PROIBIDO usar hr, border-bottom, ou linhas divisoras.
   Separacao visual por:
   1. Espacamento (margin/gap) entre items
   2. Alternancia tonal (par/impar backgrounds)
   3. Leading icon em circulo colorido

   Referencia visual:
   - plans/redesign/references/simple-hoje-mobile.png: lista de doses do cronograma
   - plans/redesign/references/complex-tratamentos-mobile.png: lista de medicamentos
   ============================================ */

[data-redesign="true"] .list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-lg);
  transition: background 200ms ease-out;
  border: none; /* NO-LINE RULE */
}

[data-redesign="true"] .list-item:hover {
  background: var(--color-surface-container-low);
}

/* Active/selected state */
[data-redesign="true"] .list-item.active {
  background: var(--color-surface-container-low);
}

/* Leading icon container (circulo colorido) */
[data-redesign="true"] .list-item-icon {
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

[data-redesign="true"] .list-item-icon-sm {
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
[data-redesign="true"] .list-item-content {
  flex: 1;
  min-width: 0; /* permite text-overflow funcionar */
}

[data-redesign="true"] .list-item-title {
  font-family: var(--font-body);
  font-size: var(--text-title-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-on-surface);
  line-height: var(--line-height-snug);
}

[data-redesign="true"] .list-item-subtitle {
  font-family: var(--font-body);
  font-size: var(--text-title-sm);
  font-weight: var(--font-weight-regular);
  color: var(--color-on-surface-variant);
  line-height: var(--line-height-normal);
}

/* Trailing content (hora, chevron, status) */
[data-redesign="true"] .list-item-trailing {
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
[data-redesign="true"] .list-item-done {
  opacity: 0.6;
}

[data-redesign="true"] .list-item-done .list-item-icon {
  background: var(--color-surface-container);
  color: var(--color-success);
}

/* Dose pending (nao tomado ainda) */
[data-redesign="true"] .list-item-pending .list-item-icon {
  background: var(--color-surface-container);
  color: var(--color-outline);
}

/* Dose current (proxima dose) */
[data-redesign="true"] .list-item-current {
  background: var(--color-surface-container-low);
}

[data-redesign="true"] .list-item-current .list-item-icon {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que list-item existe no arquivo correto (scoped)
grep "list-item" src/shared/styles/components.redesign.css | head -5
# Resultado esperado: pelo menos 5 matches

# 2. Verificar que seletores sao scoped
grep "\[data-redesign=\"true\"\].*list-item" src/shared/styles/components.redesign.css | wc -l
# Resultado esperado: >= 10

# 3. Verificar que NAO tem border-bottom ou hr nas novas classes
grep "border-bottom\|<hr" src/shared/styles/components.redesign.css | grep "list-item"
# Resultado esperado: 0 matches

# 3. App compila sem erros
npm run dev

# 4. Build funciona
npm run build
```

### Commit
```
feat(list): adicionar list item system ao components.redesign.css

- Scoped sob [data-redesign="true"] — index.css intocado
- No-Dividers: separacao por espacamento e tonal shift
- Leading icon em circulo colorido (secondary-fixed)
- Estados: done (opaco), pending, current (highlight)
- Trailing content para hora/status/chevron
```

---

## Criterio de Conclusao da Wave 3

Apos os 6 sprints, validar:

### Funcionalidade com flag ATIVO (`?redesign=1`)
- [ ] Button primary e gradiente verde com min-height 56-64px
- [ ] Button NAO tem glow neon em nenhum estado (hover, focus, active)
- [ ] Cards usam sanctuary style (NO borders, radius 2rem, ambient shadow)
- [ ] Cards NAO tem glassmorphism/backdrop-filter
- [ ] Inputs tem min-height 56px com radius xl e foco verde
- [ ] Badge component existe com 5 variantes (critical, warning, success, info, neutral)
- [ ] Progress bars tem 8px height, full radius, cores semanticas
- [ ] Listas NAO tem dividers (separacao por espaco + tonal)
- [ ] Todos os touch targets >= 40px (sm) ou 56px (default)

### Rollout e integridade
- [ ] App com flag INATIVO (sem `?redesign=1`) esta 100% identico ao estado anterior (smoke test)
- [ ] `Button.css` e `Button.jsx` nao foram modificados (apenas `components.redesign.css`)
- [ ] `Card.css` nao foi modificado (Card.jsx so ganhou prop `variant` opcional)
- [ ] `index.css` so ganhou `@import` de `components.redesign.css` — nenhuma outra mudanca
- [ ] `Badge.css` NAO existe — estilos de Badge estao em `components.redesign.css`
- [ ] Todos os seletores de redesign em `components.redesign.css` comecam com `[data-redesign="true"]`

### Build
- [ ] `npm run build` passa sem erros
- [ ] `npm run dev` roda sem warnings de CSS

## Ordem de Execucao

```
Sprint 3.1 (CRIAR components.redesign.css — Button scoped)
  ↓
Sprint 3.2 (ADICIONAR card styles em components.redesign.css)
  ↓
Sprint 3.3 (ADICIONAR input styles em components.redesign.css)
  ↓
Sprint 3.4 (CRIAR Badge.jsx + ADICIONAR badge styles em components.redesign.css)
  ↓
Sprint 3.5 (ADICIONAR progress bar styles em components.redesign.css)
  ↓
Sprint 3.6 (ADICIONAR list item styles em components.redesign.css)
```

**TODOS os sprints sao sequenciais** — Badge e novo mas depende dos tokens de cores (Wave 0).

## Notas para agentes executores

1. **NUNCA alterar a assinatura/props de Button.jsx** — dezenas de arquivos dependem da API atual.
2. **Card.jsx tem uma unica alteracao**: adicionar `variant` prop com default `'default'`. NADA MAIS.
3. **Badge.jsx e novo** — verificar que o path de import esta correto: `@shared/components/ui/Badge`. NAO criar Badge.css.
4. **Testar que inputs existentes nao quebram** — os estilos de input em `components.redesign.css` sao scoped sob `[data-redesign="true"]`, entao nao afetam inputs sem o flag. Mas ao testar COM o flag ativo, verificar que inputs de formularios existentes (LogForm, MedicineForm, etc.) ainda funcionam.
5. **Se houver erros de variavel CSS indefinida**, verificar que Waves 0-2 foram executadas corretamente. As variaveis usadas aqui (--gradient-primary, --shadow-primary, --radius-card, --font-body, etc.) SAO definidas nas waves anteriores.
6. **Arquivo central desta wave**: `src/shared/styles/components.redesign.css` — todos os 6 sprints contribuem para este unico arquivo (exceto Badge.jsx que e JSX puro).
