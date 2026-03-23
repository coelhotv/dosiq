# Wave 0 — Foundation: Design Tokens

**Status:** Pronto para execucao
**Dependencias:** Infraestrutura de rollout gradual (RedesignContext + tokens.redesign.css) DEVE existir
**Branch:** `claude/gradual-redesign-rollout-VBlvB`
**Estimativa:** 5 sprints sequenciais
**Risco:** BAIXO — tokens novos ficam isolados em arquivo scoped. App atual nao e afetada.

---

## 🚩 ABORDAGEM DE ROLLOUT GRADUAL (LEIA ANTES DE EXECUTAR)

> **Esta wave NAO modifica os arquivos de tokens existentes** (`colors.css`, `shadows.css`, `borders.css`, `themes/`).
> Todos os tokens novos vao para `src/shared/styles/tokens.redesign.css`, scoped sob `[data-redesign="true"]`.
> Ver estrategia completa em `plans/redesign/EXEC_SPEC_GRADUAL_ROLLOUT.md`.

**Motivo:** O redesign e desenvolvido e validado por tras de um feature flag antes do lancamento para todos os usuarios. Com o scoping CSS, somente usuarios com `?redesign=1` na URL (ou toggle ativado em Configuracoes) verao os tokens novos. Usuarios regulares continuam vendo o design atual, sem nenhuma alteracao.

**Estrutura do arquivo alvo:**

```css
/* src/shared/styles/tokens.redesign.css */

[data-redesign="true"] {
  /* Sprint 0.1: tokens de cor */
  --color-primary: #006a5e;
  /* ... */

  /* Sprint 0.2: tokens de sombra */
  --shadow-ambient: 0 24px 24px rgba(25, 28, 29, 0.04);
  /* ... */

  /* Sprint 0.3: tokens de borda/radius */
  --radius-card: var(--radius-2xl);
  /* ... */
}

/* Sprint 0.4: classes utilitarias scoped */
[data-redesign="true"] .card-sanctuary { ... }
[data-redesign="true"] .surface { ... }
```

**Pre-requisito:** O arquivo `tokens.redesign.css` ja deve existir e ja deve estar importado em `index.css` (criado pela infraestrutura de rollout gradual). Se nao existir, criar um arquivo vazio com o comentario de cabecalho e o bloco `[data-redesign="true"] {}` antes de comecar os sprints.

---

> **IMPORTANTE para o agente executor:** Esta wave adiciona tokens do Santuario Terapeutico ao arquivo scoped `tokens.redesign.css`. O objetivo e que, ao ativar `?redesign=1`, toda a paleta visual mude para o novo design system — sem impacto para usuarios sem o flag. Os arquivos de tokens atuais (`colors.css`, `shadows.css`, `borders.css`, `themes/light.css`, `themes/dark.css`) **NAO devem ser modificados nesta wave**.

---

## Contexto Visual

O projeto atual usa uma paleta neon/cyberpunk:
- Primary: Rosa `#ec4899`
- Secondary: Cyan `#06b6d4`
- Glows neon, glassmorphism pesado, sombras em 5 camadas

O redesign migra para "Santuario Terapeutico":
- Primary: Verde Saude `#006a5e`
- Secondary: Azul Clinico `#005db6`
- Sombras ambient (luz natural), superficies tonais Material 3, sem bordas ("No-Line Rule")

**Referencia visual:** Ver `plans/redesign/references/design-system.png` para a paleta de cores alvo.

---

## Sprint 0.1 — Adicionar tokens de cores ao bloco scoped

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar todos os tokens de cor do Santuario Terapeutico em `tokens.redesign.css`, scoped em `[data-redesign="true"]`.

### Arquivo alvo
`src/shared/styles/tokens.redesign.css` ← ADICIONAR ao bloco `[data-redesign="true"]`

> **NAO ALTERAR:** `src/shared/styles/tokens/colors.css` (arquivo atual intacto)

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/tokens/colors.css` por completo para entender todas as variaveis CSS existentes (context apenas — nao modificar).
2. **Ler** `src/shared/styles/tokens.redesign.css` para ver o estado atual do arquivo scoped.
3. **Buscar no codebase** todas as referencias a variaveis `--neon-*`, `--glow-*`, `--glass-*` para entender o impacto futuro (context apenas):
   ```bash
   grep -r "\-\-neon-\|--glow-\|--glass-" src/ --include="*.css" --include="*.jsx" -l
   ```
4. **Adicionar** o conteudo abaixo DENTRO do bloco `[data-redesign="true"] { }` em `tokens.redesign.css`.
5. **NAO alterar** nenhum outro arquivo neste sprint.

### Conteudo a ADICIONAR dentro de `[data-redesign="true"] { }` em `tokens.redesign.css`

```css
/* ============================================
   DESIGN TOKENS — CORES
   Sistema: Santuario Terapeutico
   Paleta: Verde Saude (Primary) + Azul Clinico (Secondary)
   Baseado em Material 3 Tonal Architecture
   SCOPE: [data-redesign="true"] — nao afeta usuarios sem o flag
   ============================================ */

/* ============================================
   BRAND COLORS — Verde Saude (Primary)
   ============================================ */
:root {
  --color-primary: #006a5e;
  --color-primary-container: #008577;
  --color-primary-fixed: #90f4e3;
  --color-on-primary: #ffffff;
  --color-on-primary-fixed-variant: #005047;

  /* Backward compat aliases — componentes antigos usam estes nomes */
  --brand-primary: var(--color-primary);
  --color-primary-light: var(--color-primary-container);
  --color-primary-dark: #005047;
  --color-primary-bg: rgba(0, 106, 94, 0.05);
  --color-primary-hover: #005047;
}

/* ============================================
   BRAND COLORS — Azul Clinico (Secondary)
   ============================================ */
:root {
  --color-secondary: #005db6;
  --color-secondary-container: #63a1ff;
  --color-secondary-fixed: #d6e3ff;
  --color-on-secondary-fixed: #001b3d;

  /* Backward compat aliases */
  --brand-secondary: var(--color-secondary);
  --color-secondary-light: var(--color-secondary-container);
  --color-secondary-dark: #004490;
  --color-secondary-bg: rgba(0, 93, 182, 0.05);
}

/* ============================================
   TERTIARY — Warm Highlights (destaques, "Novo!", alertas amenos)
   ============================================ */
:root {
  --color-tertiary: #7b5700;
  --color-tertiary-container: #9b6e00;
  --color-tertiary-fixed: #ffdea8;
  --color-on-tertiary-fixed: #271900;
}

/* ============================================
   SURFACE HIERARCHY (Material 3 — Tonal Architecture)
   Profundidade por tom de background, NAO por bordas.
   Level 0 (base) = surface
   Level 1 (secoes sutis) = surface-container-low
   Level 2 (cards ativos) = surface-container-lowest (#ffffff)
   ============================================ */
:root {
  --color-surface: #f8fafb;
  --color-surface-container: #eceeef;
  --color-surface-container-low: #f2f4f5;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-high: #e6e8e9;
  --color-surface-container-highest: #e1e3e4;
}

/* ============================================
   TEXT & OUTLINE
   REGRA: Nunca usar #000000 puro. Usar --color-on-surface (#191c1d).
   ============================================ */
:root {
  --color-on-surface: #191c1d;
  --color-on-surface-variant: #3e4946;
  --color-outline: #6d7a76;
  --color-outline-variant: #bdc9c5;
  /* Ghost border — usar APENAS quando necessario para acessibilidade */
  --color-outline-ghost: rgba(25, 28, 29, 0.15);
}

/* ============================================
   SEMANTIC COLORS — Status
   ============================================ */
:root {
  --color-success: #22c55e;
  --color-success-light: #4ade80;
  --color-success-bg: #ecfdf5;

  --color-warning: #f59e0b;
  --color-warning-light: #fbbf24;
  --color-warning-bg: #fffbeb;

  --color-error: #ba1a1a;
  --color-error-light: #ff897d;
  --color-error-bg: #ffdad6;
  --color-error-container: #ffdad6;
  --color-on-error-container: #93000a;

  --color-info: #3b82f6;
  --color-info-light: #60a5fa;
  --color-info-bg: #eff6ff;
}

/* ============================================
   BACKGROUND COLORS (backward compat)
   Componentes antigos referenciam estes nomes.
   ============================================ */
:root {
  --bg-primary: var(--color-surface);
  --bg-secondary: var(--color-surface-container-low);
  --bg-tertiary: var(--color-surface-container);
  --bg-card: var(--color-surface-container-lowest);
  --bg-overlay: rgba(25, 28, 29, 0.5);
  --bg-glass: rgba(248, 250, 251, 0.80);

  --color-bg-primary: var(--bg-primary);
  --color-bg-secondary: var(--bg-secondary);
  --color-bg-tertiary: var(--bg-tertiary);
  --color-bg-card: var(--bg-card);
}

/* ============================================
   TEXT COLORS (backward compat)
   ============================================ */
:root {
  --text-primary: var(--color-on-surface);
  --text-secondary: var(--color-on-surface-variant);
  --text-tertiary: var(--color-outline);
  --text-inverse: #ffffff;
  --text-link: var(--color-primary);

  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-inverse: var(--text-inverse);
  --color-text-link: var(--text-link);
}

/* ============================================
   BORDER COLORS (backward compat)
   ============================================ */
:root {
  --border-light: var(--color-surface-container-low);
  --border-default: var(--color-outline-variant);
  --border-dark: var(--color-outline);
  --border: var(--border-default);
  --border-color: var(--border);

  --color-border-light: var(--border-light);
  --color-border-default: var(--border-default);
  --color-border-dark: var(--border-dark);
}

/* ============================================
   HEALTH SCORE COLORS
   ============================================ */
:root {
  --score-critical: var(--color-error);
  --score-low: #f97316;
  --score-medium: #eab308;
  --score-good: var(--color-success);
  --score-excellent: var(--color-primary);
}

/* ============================================
   STATE COLORS (interaction feedback)
   Baseados no verde primary, nao mais no rosa.
   ============================================ */
:root {
  --state-hover: rgba(0, 106, 94, 0.08);
  --state-active: rgba(0, 106, 94, 0.15);
  --state-focus: rgba(0, 106, 94, 0.20);
  --state-disabled: rgba(25, 28, 29, 0.10);
  --state-loading: rgba(0, 106, 94, 0.5);
}

/* ============================================
   TOGGLE & THEME COLORS
   ============================================ */
:root {
  --color-toggle-track: var(--color-surface-container-high);
  --color-toggle-track-dark: #374151;
  --color-sun: #f59e0b;
  --color-moon: #93c5fd;
}

/* ============================================
   GLASSMORPHISM — SOMENTE para elementos flutuantes
   (nav bar, FAB, modals, overlays)
   NAO usar em cards normais.
   ============================================ */
:root {
  --glass-bg: rgba(248, 250, 251, 0.80);
  --glass-blur: blur(12px);
  --glass-border: var(--color-outline-ghost);
}

/* ============================================
   GRADIENT — SOMENTE para acoes primarias (CTAs)
   NAO usar para decoracao.
   ============================================ */
:root {
  --gradient-primary: linear-gradient(135deg, #006a5e, #008577);
  --gradient-primary-shadow: 0 8px 24px rgba(0, 106, 94, 0.20);
}

/* ============================================
   OPACITY VALUES
   ============================================ */
:root {
  --opacity-disabled: 0.5;
  --opacity-hover: 0.8;
  --opacity-focus: 1;
  --opacity-overlay: 0.9;
  --opacity-backdrop: 0.75;
  --opacity-muted-text: 0.40;
}

/* ============================================
   DARK THEME — PLACEHOLDER (Phase 6)
   Mantém estrutura para nao quebrar ThemeToggle,
   mas NAO e funcional nesta fase do redesign.
   ============================================ */
[data-theme='dark'] {
  /* TODO Phase 6: Implementar dark mode para Santuario Terapeutico
     Dark surface baseline: #0f1117 (nao preto puro)
     Primary pode precisar de ajuste de luminosidade para AA em fundo escuro
     Glass: inverter para rgba(15,17,23,0.80) */
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d24;
  --bg-tertiary: #252830;
  --bg-card: #1a1d24;
  --text-primary: #f0f2f4;
  --text-secondary: #a0a4ab;
  --text-tertiary: #6b7280;
}
```

### Variaveis que DEVEM ser REMOVIDAS (nao devem existir no novo arquivo)

As seguintes variaveis existem no arquivo atual e NAO devem estar no novo arquivo:
- `--color-primary: #ec4899` (rosa) — substituida por `#006a5e`
- `--color-secondary: #06b6d4` (cyan) — substituida por `#005db6`
- `--neon-*` (TODAS as variaveis neon: cyan, pink, magenta, green, etc.)
- `--glow-*` (TODAS: glow-cyan, glow-pink, glow-magenta, etc.)
- `--glow-hover-*`, `--glow-focus-*`, `--glow-active-*`
- `--glass-light`, `--glass-default`, `--glass-heavy`, `--glass-hero` (substituidos por `--glass-bg` unico)

### Validacao pos-sprint

```bash
# 1. App deve compilar sem erros CSS
npm run dev
# (verificar que nao ha erros no console)

# 2. Verificar que os tokens novos estao em tokens.redesign.css (scoped)
grep "#006a5e" src/shared/styles/tokens.redesign.css
# Resultado esperado: pelo menos 1 match

# 3. Verificar que o arquivo atual NAO foi alterado (rosa antiga deve ainda existir la)
grep "#ec4899" src/shared/styles/tokens/colors.css
# Resultado esperado: pelo menos 1 match (o arquivo atual permanece intacto)

# 4. Smoke test: com ?redesign=1, primary deve ser #006a5e; sem o flag, deve ser #ec4899
# (verificar via DevTools → Computed → --color-primary)
```

### Commit
```
feat(tokens): adicionar paleta Santuario Terapeutico em tokens.redesign.css (scoped)

- Tokens de cor em [data-redesign="true"] — sem impacto em usuarios atuais
- Primary: #006a5e (verde saude), Secondary: #005db6 (azul clinico)
- Surface hierarchy Material 3 (surface, surface-container-low/lowest)
- Backward compat aliases (brand-primary, text-primary, etc.)
- colors.css atual intacto (nao modificado)
```

---

## Sprint 0.2 — Adicionar tokens de sombras ao bloco scoped

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar ambient shadow system ao bloco `[data-redesign="true"]` em `tokens.redesign.css`.

### Arquivo alvo
`src/shared/styles/tokens.redesign.css` ← ADICIONAR ao bloco `[data-redesign="true"]`

> **NAO ALTERAR:** `src/shared/styles/tokens/shadows.css` (arquivo atual intacto)

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/tokens/shadows.css` para entender as sombras existentes (context apenas — nao modificar).
2. **Buscar no codebase** referencias a `--shadow-layer-`, `--glow-`, `--shadow-neon` para entender impacto futuro (context):
   ```bash
   grep -r "\-\-shadow-layer\|--glow-\|--shadow-neon" src/ --include="*.css" --include="*.jsx" -l
   ```
3. **Adicionar** o conteudo abaixo ao bloco `[data-redesign="true"] { }` em `tokens.redesign.css`, apos os tokens de cor (Sprint 0.1).
4. **NAO alterar** nenhum outro arquivo neste sprint.

### Conteudo a ADICIONAR dentro de `[data-redesign="true"] { }` em `tokens.redesign.css`

```css
/* ============================================
   AMBIENT SHADOW SYSTEM — Santuario Terapeutico

   Filosofia: Luz natural, nao digital.
   Profundidade principal e via tom de superficie (tonal shift),
   nao via sombra. Sombras sao sutis e ambient.

   REMOVIDOS: shadow-layer-1 ate shadow-layer-5, todos os glows.
   ============================================ */

:root {
  /* Shadow unica padrao — simula luz ambient natural */
  --shadow-ambient: 0 24px 24px rgba(25, 28, 29, 0.04);

  /* Editorial shadow — para cards e containers com leve elevacao */
  --shadow-editorial: 0 4px 24px -4px rgba(25, 28, 29, 0.04);

  /* Primary CTA shadow — verde para botoes de acao primaria */
  --shadow-primary: 0 8px 24px rgba(0, 106, 94, 0.20);

  /* Error CTA shadow — vermelho para botoes de acao critica */
  --shadow-error: 0 8px 24px rgba(186, 26, 26, 0.20);

  /* Floating elements — FAB, modals, popovers, tooltips */
  --shadow-floating: 0 16px 48px rgba(25, 28, 29, 0.12);

  /* None — reset explicito */
  --shadow-none: none;

  /* ============================================
     BACKWARD COMPAT ALIASES
     Componentes existentes usam --shadow-sm/md/lg/xl.
     Estes aliases fazem a ponte ate a migracao completa.
     ============================================ */
  --shadow-sm: var(--shadow-editorial);
  --shadow-md: var(--shadow-ambient);
  --shadow-lg: var(--shadow-floating);
  --shadow-xl: var(--shadow-floating);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que shadow-ambient foi adicionado ao arquivo scoped
grep "shadow-ambient" src/shared/styles/tokens.redesign.css
# Resultado esperado: pelo menos 1 match

# 2. Verificar que shadows.css atual NAO foi modificado
grep "shadow-layer-1" src/shared/styles/tokens/shadows.css
# Resultado esperado: ainda existe (arquivo intacto)

# 3. App compila sem erros
npm run dev
```

### Commit
```
feat(tokens): adicionar ambient shadow system em tokens.redesign.css (scoped)

- shadow-ambient, shadow-editorial, shadow-primary, shadow-floating em [data-redesign="true"]
- Backward compat aliases (shadow-sm/md/lg/xl) tambem scoped
- shadows.css atual intacto (nao modificado)
```

---

## Sprint 0.3 — Adicionar tokens de borders ao bloco scoped

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar border-radius do Santuario (minimo 0.75rem) ao bloco `[data-redesign="true"]` em `tokens.redesign.css`.

### Arquivo alvo
`src/shared/styles/tokens.redesign.css` ← ADICIONAR ao bloco `[data-redesign="true"]`

> **NAO ALTERAR:** `src/shared/styles/tokens/borders.css` (arquivo atual intacto)

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/tokens/borders.css` por completo (context apenas — nao modificar).
2. **Buscar** no codebase quais componentes usam `--radius-sm`, `--radius-xs`, `--radius-card`, `--radius-button` (para entender impacto futuro):
   ```bash
   grep -r "\-\-radius-" src/ --include="*.css" -l
   ```
3. **Adicionar** o conteudo abaixo ao bloco `[data-redesign="true"] { }` em `tokens.redesign.css`, apos os tokens de sombra (Sprint 0.2).
4. **NAO alterar** nenhum outro arquivo neste sprint.

### Conteudo a ADICIONAR dentro de `[data-redesign="true"] { }` em `tokens.redesign.css`

Os tokens abaixo sobrescrevem os valores do `borders.css` atual apenas quando o flag esta ativo.
**Minimo 0.75rem** para todos os componentes UI (legibilidade para idosos + Santuario visual).

```css
  /* Border Radius — Minimo 0.75rem para UI components */
  --radius-none: 0;
--radius-sm: 0.75rem;        /* ERA ~0.25rem, agora mesmo valor que md (backward compat) */
--radius-md: 0.75rem;        /* 12px — MINIMO para UI */
--radius-lg: 1rem;           /* 16px — Standard cards */
--radius-xl: 1.25rem;        /* 20px — Buttons, inputs */
--radius-2xl: 2rem;          /* 32px — Sanctuary cards */
--radius-3xl: 2.5rem;        /* 40px — Hero cards */
--radius-full: 9999px;       /* Circular */
```

  /* Component-specific radius */
  --radius-card: var(--radius-2xl);         /* 2rem / 32px */
--radius-card-sm: var(--radius-lg);       /* 1rem / 16px */
--radius-button: var(--radius-xl);        /* 1.25rem / 20px */
--radius-input: var(--radius-xl);         /* 1.25rem / 20px */
--radius-badge: var(--radius-full);       /* circular */
--radius-progress: var(--radius-full);    /* circular */
--radius-icon-container: var(--radius-full); /* circular */
  --radius-nav-item: var(--radius-lg);      /* 1rem / 16px */

  /* Focus ring — atualizado para verde primary */
  --focus-ring-color: var(--color-primary);
```

### Validacao pos-sprint

```bash
# 1. Verificar que radius-card foi adicionado ao arquivo scoped
grep "radius-card" src/shared/styles/tokens.redesign.css
# Resultado esperado: pelo menos 1 match

# 2. Verificar que borders.css atual NAO foi modificado
grep "radius-card" src/shared/styles/tokens/borders.css
# Resultado esperado: 0 (nao existia la antes)

# 3. App compila sem erros
npm run dev
```

### Commit
```
feat(tokens): adicionar border-radius Santuario em tokens.redesign.css (scoped)

- Radius minimo 0.75rem para UI components em [data-redesign="true"]
- radius-card: 2rem, radius-button/input: 1.25rem
- Component-specific tokens (card, button, input, badge, nav-item)
- borders.css atual intacto (nao modificado)
```

---

## Sprint 0.4 — Adicionar classes utilitarias scoped em tokens.redesign.css

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar classes sanctuary (card-sanctuary, surface utilities, glass) em `tokens.redesign.css`, scoped em `[data-redesign="true"]`. NAO remover classes existentes do `index.css`.

### Arquivo alvo
`src/shared/styles/tokens.redesign.css` ← ADICIONAR secao de classes utilitarias scoped

> **NAO ALTERAR:** `src/shared/styles/index.css` (arquivo atual intacto — classes neon/glow permanecem para usuarios sem o flag)

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/index.css` por completo (context apenas — nao modificar).
2. **Buscar** no codebase quais componentes usam classes `.glow-*`, `.gradient-text`, `.glass-card` (para entender o impacto futuro):
   ```bash
   grep -rn "glow-\|gradient-text\|glass-card\|neon-" src/ --include="*.jsx" --include="*.css" -l
   ```
3. **Adicionar** ao final de `tokens.redesign.css` (FORA do bloco `[data-redesign="true"] { }`, como regras CSS separadas com seletor proprio) o conteudo abaixo:

### Classes a ADICIONAR em `tokens.redesign.css` (scoped por seletor, nao por variavel)

**A) Glass card atualizado — apenas para elementos flutuantes:**

```css
```css
[data-redesign="true"] .glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}
```

**B) Background global scoped:**

```css
[data-redesign="true"] body {
  background-color: var(--color-surface);  /* #f8fafb off-white, nao #ffffff */
  color: var(--color-on-surface);          /* #191c1d, nunca #000000 */
}
```

**C) Novas classes utilitarias scoped:**

```css
```css
/* ============================================
   SURFACE TONAL SYSTEM — "No-Line Rule"
   Scoped: apenas usuarios com data-redesign="true" veem estas classes ativas.
   ============================================ */

[data-redesign="true"] .surface { background-color: var(--color-surface); }
[data-redesign="true"] .surface-container { background-color: var(--color-surface-container); }
[data-redesign="true"] .surface-container-low { background-color: var(--color-surface-container-low); }
[data-redesign="true"] .surface-container-lowest { background-color: var(--color-surface-container-lowest); }
[data-redesign="true"] .surface-container-high { background-color: var(--color-surface-container-high); }

/* Sanctuary Card — container principal do redesign */
[data-redesign="true"] .card-sanctuary {
  background-color: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  padding: 2rem;
  box-shadow: var(--shadow-ambient);
  border: none; /* NO-LINE RULE */
  transition: all 300ms ease-out;
}

[data-redesign="true"] .card-sanctuary:hover {
  box-shadow: var(--shadow-editorial);
}

/* Glassmorphism atualizado — floating elements only */
[data-redesign="true"] .glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

/* Primary gradient button utility */
[data-redesign="true"] .btn-primary-gradient {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  box-shadow: var(--gradient-primary-shadow);
  border-radius: var(--radius-button);
  border: none;
  min-height: 64px;
  padding: 0 2rem;
  font-family: var(--font-body, system-ui);
  font-weight: 700;
  font-size: 1.125rem;
  cursor: pointer;
  transition: all 200ms ease-out;
}

[data-redesign="true"] .btn-primary-gradient:hover {
  transform: scale(1.02);
}

[data-redesign="true"] .btn-primary-gradient:active {
  transform: scale(0.98);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que card-sanctuary existe em tokens.redesign.css (scoped)
grep "card-sanctuary" src/shared/styles/tokens.redesign.css
# Resultado esperado: pelo menos 2 matches (com [data-redesign="true"])

# 2. Verificar que index.css NAO foi modificado (classes neon ainda la)
grep "glow-\|neon-" src/shared/styles/index.css
# Resultado esperado: ainda existem (arquivo intacto)

# 3. Verificar que as classes utilitarias estao scoped
grep "\[data-redesign" src/shared/styles/tokens.redesign.css
# Resultado esperado: varios matches (todas as classes scoped corretamente)

# 4. App compila sem erros
npm run dev
```

### Commit
```
feat(styles): adicionar classes utilitarias sanctuary em tokens.redesign.css (scoped)

- .surface-container-* utilities em [data-redesign="true"]
- .card-sanctuary e .btn-primary-gradient scoped
- body background scoped: #f8fafb (off-white) apenas com flag ativo
- index.css atual intacto (classes neon preservadas para usuarios sem flag)
```

---

## Sprint 0.5 — Validar integracao e smoke test do flag

**Skill:** `/deliver-sprint`
**Escopo:** Verificar que todos os tokens scoped funcionam corretamente quando o flag e ativado. NAO modificar nenhum arquivo de tema (light.css, dark.css permanecem intactos).

### Arquivos alvo
Apenas leitura/verificacao — nenhum arquivo e modificado neste sprint.

### O que o agente DEVE fazer

1. **Ler** `src/shared/styles/tokens.redesign.css` por completo para verificar a estrutura.
2. **Verificar** que o arquivo esta importado em `index.css`:
   ```bash
   grep "tokens.redesign" src/shared/styles/index.css
   # Resultado esperado: pelo menos 1 match
   ```
3. **Verificar** que o bloco scoped esta correto:
   ```bash
   grep "\[data-redesign" src/shared/styles/tokens.redesign.css | wc -l
   # Resultado esperado: todos os tokens e classes estao scoped
   ```
4. **Verificar** que os arquivos de tema NAO foram alterados:
   ```bash
   grep "#ec4899\|#006a5e" src/shared/styles/themes/light.css
   # Resultado esperado: nao encontrado (light.css continua com tokens originais)
   ```
5. **Executar build** para confirmar ausencia de erros:
   ```bash
   npm run build
   ```
6. **Buscar** no codebase por `data-theme` para confirmar que o toggle de tema existente nao conflita com o novo `data-redesign`:
   ```bash
   grep -rn "data-theme" src/ --include="*.jsx" --include="*.css" -l
   ```
   Se encontrar conflito (ex: um componente que aplica `data-theme` no mesmo elemento que `data-redesign`), documentar o conflito como comentario no topo de `tokens.redesign.css` para resolucao futura.

### Validacao pos-sprint

```bash
# 1. Build passa sem erros
npm run build

# 2. tokens.redesign.css importado em index.css
grep "tokens.redesign" src/shared/styles/index.css
# Resultado esperado: 1 match

# 3. light.css e dark.css intactos (nao modificados nesta wave)
git diff src/shared/styles/themes/
# Resultado esperado: nenhuma alteracao

# 4. Smoke test visual:
# - Abrir app sem flag → cores atuais (rosa #ec4899)
# - Adicionar ?redesign=1 → verde #006a5e em elementos primarios
# (verificar via DevTools → Computed → --color-primary)
```

### Commit
```
chore(tokens): validar integracao Wave 0 — smoke test flag ativo vs inativo

- Build passa sem erros
- Tokens scoped funcionando: ?redesign=1 ativa paleta Santuario
- Arquivos de tema (light.css, dark.css) intactos
```

---

## Criterio de Conclusao da Wave 0

Apos os 5 sprints, validar:

- [ ] `npm run build` passa sem erros de CSS
- [ ] `tokens.redesign.css` existe e esta importado em `src/shared/styles/index.css`
- [ ] Todos os tokens estao dentro do bloco `[data-redesign="true"] { }` (nenhum em `:root` solto)
- [ ] Classes utilitarias (`.card-sanctuary`, `.surface-container-*`) usam seletor `[data-redesign="true"] .classe`
- [ ] Arquivos de tokens originais (`colors.css`, `shadows.css`, `borders.css`) **NAO foram modificados**
- [ ] Arquivos de tema (`light.css`, `dark.css`) **NAO foram modificados**
- [ ] Smoke test: **sem flag** → `--color-primary` resolve para `#ec4899` (rosa atual)
- [ ] Smoke test: **com `?redesign=1`** → `--color-primary` resolve para `#006a5e` (verde saude)
- [ ] Smoke test: **com `?redesign=1`** → background da app e `#f8fafb` (off-white)
- [ ] Smoke test: **com `?redesign=1`** → textos usam `#191c1d`

## Ordem de Execucao

```
Sprint 0.1 (colors.css)
  ↓
Sprint 0.2 (shadows.css)
  ↓
Sprint 0.3 (borders.css)
  ↓
Sprint 0.4 (index.css)
  ↓
Sprint 0.5 (themes)
```

**TODOS os sprints sao sequenciais** — cada um depende do anterior para backward compat aliases.
