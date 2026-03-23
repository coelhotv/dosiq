# Wave 0 — Foundation: Design Tokens

**Status:** Pronto para execucao
**Dependencias:** Nenhuma (esta e a primeira wave)
**Branch:** `feature/redesign/wave-0-design-tokens`
**Estimativa:** 5 sprints sequenciais
**Risco:** ALTO — esta wave muda a base visual de TODA a aplicacao. Componentes ficarao visualmente "quebrados" ate Waves 2-3.

> **IMPORTANTE para o agente executor:** Esta wave substitui TODOS os design tokens de cor, sombra, borda e gradiente do projeto. O objetivo e trocar a fundacao visual de "Neon/Glass Cyberpunk" para "Santuario Terapeutico". Apos esta wave, a app vai compilar e rodar sem erros, mas componentes existentes podem ter cores estranhas — isso e ESPERADO e sera corrigido nas waves seguintes.

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

## Sprint 0.1 — Reescrever tokens de cores

**Skill:** `/deliver-sprint`
**Escopo:** Reescrever completamente o arquivo de tokens de cores.

### Arquivo alvo
`src/shared/styles/tokens/colors.css`

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/tokens/colors.css` por completo para entender todas as variaveis CSS existentes.
2. **Ler o arquivo** `src/shared/styles/themes/light.css` para entender quais variaveis sao referenciadas no tema claro.
3. **Ler o arquivo** `src/shared/styles/themes/dark.css` para entender quais variaveis sao referenciadas no tema escuro.
4. **Buscar no codebase** todas as referencias a variaveis `--neon-*`, `--glow-*`, `--glass-*` para mapear o impacto:
   ```bash
   grep -r "\-\-neon-\|--glow-\|--glass-" src/ --include="*.css" --include="*.jsx" -l
   ```
5. **Reescrever** `src/shared/styles/tokens/colors.css` com o conteudo EXATO abaixo.
6. **NAO alterar** nenhum outro arquivo neste sprint.

### Conteudo EXATO do novo `colors.css`

```css
/* ============================================
   DESIGN TOKENS — CORES
   Sistema: Santuario Terapeutico
   Paleta: Verde Saude (Primary) + Azul Clinico (Secondary)
   Baseado em Material 3 Tonal Architecture
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

# 2. Verificar que nao restam variaveis neon no arquivo
grep -c "neon\|glow" src/shared/styles/tokens/colors.css
# Resultado esperado: 0

# 3. Verificar que a nova primary esta definida
grep "#006a5e" src/shared/styles/tokens/colors.css
# Resultado esperado: pelo menos 1 match

# 4. Verificar que a rosa antiga nao existe
grep "#ec4899" src/shared/styles/tokens/colors.css
# Resultado esperado: 0
```

### Commit
```
feat(tokens): substituir paleta neon/glass por Santuario Terapeutico

- Primary: #ec4899 (rosa) → #006a5e (verde saude)
- Secondary: #06b6d4 (cyan) → #005db6 (azul clinico)
- Remover todas as variaveis --neon-* e --glow-*
- Adicionar surface hierarchy Material 3
- Adicionar backward compat aliases
- Dark theme como placeholder para Phase 6
```

---

## Sprint 0.2 — Reescrever tokens de sombras

**Skill:** `/deliver-sprint`
**Escopo:** Substituir sistema de 5 camadas de sombra + glows por ambient shadow system.

### Arquivo alvo
`src/shared/styles/tokens/shadows.css`

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/tokens/shadows.css` para entender todas as sombras existentes.
2. **Buscar no codebase** referencias a `--shadow-layer-`, `--glow-`, `--shadow-neon` para mapear impacto:
   ```bash
   grep -r "\-\-shadow-layer\|--glow-\|--shadow-neon" src/ --include="*.css" --include="*.jsx" -l
   ```
3. **Reescrever** `src/shared/styles/tokens/shadows.css` com o conteudo EXATO abaixo.
4. **NAO alterar** nenhum outro arquivo neste sprint.

### Conteudo EXATO do novo `shadows.css`

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
# 1. Verificar que glows foram removidos
grep -c "glow\|neon\|layer" src/shared/styles/tokens/shadows.css
# Resultado esperado: 0

# 2. Verificar que ambient shadow esta definida
grep "shadow-ambient" src/shared/styles/tokens/shadows.css
# Resultado esperado: pelo menos 1 match

# 3. App compila sem erros
npm run dev
```

### Commit
```
feat(tokens): substituir sombras neon por ambient shadow system

- Remover shadow-layer-1 ate shadow-layer-5
- Remover todos os glows (cyan, pink, magenta, etc.)
- Adicionar: ambient, editorial, primary, error, floating
- Manter backward compat aliases (shadow-sm/md/lg/xl)
```

---

## Sprint 0.3 — Atualizar tokens de borders

**Skill:** `/deliver-sprint`
**Escopo:** Atualizar border-radius para minimo 0.75rem. Remover radii xs/sm para componentes UI.

### Arquivo alvo
`src/shared/styles/tokens/borders.css`

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/tokens/borders.css` por completo.
2. **Buscar** no codebase quais componentes usam `--radius-sm`, `--radius-xs`, `--radius-card`, `--radius-button`:
   ```bash
   grep -r "\-\-radius-" src/ --include="*.css" -l
   ```
3. **Editar** `src/shared/styles/tokens/borders.css` — NAO reescrever do zero, apenas ATUALIZAR as variaveis de radius.
4. **Manter** as variaveis de border-width e focus-ring inalteradas.
5. **NAO alterar** nenhum outro arquivo neste sprint.

### Alteracoes EXATAS no `borders.css`

**REMOVER** (se existirem):
- `--radius-xs` (era ~0.125rem)
- `--radius-sm` (era ~0.25rem) — redirecionar para `--radius-md`

**ATUALIZAR** as seguintes variaveis (buscar cada uma e trocar o valor):

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

**ADICIONAR** (se nao existirem) as variaveis component-specific:

```css
/* Component-specific radius */
--radius-card: var(--radius-2xl);         /* 2rem / 32px */
--radius-card-sm: var(--radius-lg);       /* 1rem / 16px */
--radius-button: var(--radius-xl);        /* 1.25rem / 20px */
--radius-input: var(--radius-xl);         /* 1.25rem / 20px */
--radius-badge: var(--radius-full);       /* circular */
--radius-progress: var(--radius-full);    /* circular */
--radius-icon-container: var(--radius-full); /* circular */
--radius-nav-item: var(--radius-lg);      /* 1rem / 16px */
```

**MANTER** (nao alterar):
- `--focus-ring-width: 2px;`
- `--focus-ring-offset: 2px;`
- **Atualizar** `--focus-ring-color` para `var(--color-primary)` se estiver hardcoded com a cor rosa antiga.

### Validacao pos-sprint

```bash
# 1. Verificar que nao ha radius abaixo de 0.75rem para UI
grep "0.25rem\|0.125rem\|0.375rem\|0.5rem" src/shared/styles/tokens/borders.css
# Resultado esperado: 0 (exceto --radius-none que e 0)

# 2. Verificar que radius-card existe
grep "radius-card" src/shared/styles/tokens/borders.css
# Resultado esperado: pelo menos 2 matches (definicao + uso)

# 3. App compila sem erros
npm run dev
```

### Commit
```
feat(tokens): atualizar border-radius para minimo 0.75rem

- Minimo 0.75rem para todos os componentes UI
- radius-card: 2rem (Sanctuary cards)
- radius-button/input: 1.25rem
- Adicionar component-specific radius tokens
- Manter backward compat (--radius-sm agora aponta para 0.75rem)
```

---

## Sprint 0.4 — Atualizar index.css (classes utilitarias)

**Skill:** `/deliver-sprint`
**Escopo:** Remover classes neon/glow, adicionar classes sanctuary, atualizar background global.

### Arquivo alvo
`src/shared/styles/index.css`

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/index.css` por completo para entender todas as classes utilitarias.
2. **Buscar** no codebase quais componentes usam classes `.glow-*`, `.gradient-text`, `.glass-card`:
   ```bash
   grep -rn "glow-\|gradient-text\|glass-card\|neon-" src/ --include="*.jsx" --include="*.css" -l
   ```
3. **Editar** `src/shared/styles/index.css` fazendo as seguintes alteracoes:

### Alteracoes EXATAS

**A) REMOVER** as seguintes classes (buscar e deletar o bloco CSS inteiro):
- `.glow-cyan` e qualquer variante `.glow-*`
- `.gradient-text` (era gradiente neon pink→cyan)
- `.neon-*` classes (todas)
- Qualquer classe que use `--neon-*` ou `--glow-*` como valor

**B) ATUALIZAR** a classe `.glass-card` (se existir) para usar novos tokens:

```css
/* Glassmorphism — SOMENTE para elementos flutuantes */
.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}
```

**C) ATUALIZAR** o seletor `body` (se definido neste arquivo) para usar o novo background:

```css
body {
  background-color: var(--color-surface);  /* #f8fafb off-white, nao #ffffff */
  color: var(--color-on-surface);          /* #191c1d, nunca #000000 */
}
```

**D) ADICIONAR** as seguintes novas classes utilitarias ao FINAL do arquivo:

```css
/* ============================================
   SURFACE TONAL SYSTEM — "No-Line Rule"
   Profundidade por tom de background, NAO por bordas.
   ============================================ */

.surface { background-color: var(--color-surface); }
.surface-container { background-color: var(--color-surface-container); }
.surface-container-low { background-color: var(--color-surface-container-low); }
.surface-container-lowest { background-color: var(--color-surface-container-lowest); }
.surface-container-high { background-color: var(--color-surface-container-high); }

/* Sanctuary Card — container principal do redesign */
.card-sanctuary {
  background-color: var(--color-surface-container-lowest);
  border-radius: var(--radius-card);
  padding: 2rem;
  box-shadow: var(--shadow-ambient);
  border: none; /* NO-LINE RULE */
  transition: all 300ms ease-out;
}

.card-sanctuary:hover {
  box-shadow: var(--shadow-editorial);
}

/* Glassmorphism atualizado — floating elements only */
.glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
}

/* Primary gradient button utility */
.btn-primary-gradient {
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

.btn-primary-gradient:hover {
  transform: scale(1.02);
}

.btn-primary-gradient:active {
  transform: scale(0.98);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que nao restam classes glow/neon
grep -c "glow-\|neon-\|gradient-text" src/shared/styles/index.css
# Resultado esperado: 0

# 2. Verificar que card-sanctuary existe
grep "card-sanctuary" src/shared/styles/index.css
# Resultado esperado: pelo menos 2 matches

# 3. Verificar que surface utilities existem
grep "surface-container" src/shared/styles/index.css
# Resultado esperado: pelo menos 5 matches

# 4. App compila sem erros
npm run dev
```

### Commit
```
feat(styles): remover classes neon e adicionar sistema tonal sanctuary

- Remover todas as classes .glow-* e .neon-*
- Remover .gradient-text (neon)
- Adicionar .surface-container-* utilities (Material 3)
- Adicionar .card-sanctuary e .btn-primary-gradient
- Atualizar .glass-card para novos tokens
- Body background: #f8fafb (off-white)
```

---

## Sprint 0.5 — Limpar arquivos de tema

**Skill:** `/deliver-sprint`
**Escopo:** Atualizar light.css e dark.css para refletir novo token system. Limpar tokens.css.

### Arquivos alvo
1. `src/shared/styles/themes/light.css`
2. `src/shared/styles/themes/dark.css`
3. `src/shared/styles/tokens.css` (se existir — contem overrides de dark theme)

### O que o agente DEVE fazer

1. **Ler** `src/shared/styles/themes/light.css` por completo.
2. **Ler** `src/shared/styles/themes/dark.css` por completo.
3. **Ler** `src/shared/styles/tokens.css` por completo.
4. **Buscar** no codebase por `data-theme` para entender como o toggle funciona:
   ```bash
   grep -rn "data-theme" src/ --include="*.jsx" --include="*.css" -l
   ```

### Alteracoes para `themes/light.css`

Atualizar para que as variaveis do tema claro apontem para os novos tokens:

```css
/* ============================================
   LIGHT THEME — Santuario Terapeutico (Default)
   Este e o tema padrao. As variaveis canonicas estao em tokens/colors.css.
   Este arquivo existe para overrides especificos do tema claro.
   ============================================ */
:root {
  /* Backgrounds */
  --bg-primary: var(--color-surface);                    /* #f8fafb */
  --bg-secondary: var(--color-surface-container-low);    /* #f2f4f5 */
  --bg-tertiary: var(--color-surface-container);         /* #eceeef */
  --bg-card: var(--color-surface-container-lowest);      /* #ffffff */

  /* Text */
  --text-primary: var(--color-on-surface);               /* #191c1d */
  --text-secondary: var(--color-on-surface-variant);     /* #3e4946 */
  --text-tertiary: var(--color-outline);                 /* #6d7a76 */

  /* Borders */
  --border-light: var(--color-surface-container-low);
  --border-default: var(--color-outline-variant);
  --border-dark: var(--color-outline);
}
```

### Alteracoes para `themes/dark.css`

Simplificar para placeholder (o dark mode NAO e funcional nesta fase):

```css
/* ============================================
   DARK THEME — PLACEHOLDER (Phase 6 Roadmap)

   O dark mode sera redesenhado na Phase 6.
   Este arquivo mantem a estrutura para nao quebrar o ThemeToggle,
   mas os valores sao minimais.

   TODO Phase 6:
   - Redesenhar surface tiers para fundo escuro
   - Primary pode precisar de ajuste de luminosidade para AA contrast
   - Glass: inverter para rgba(15,17,23,0.80)
   ============================================ */
[data-theme='dark'] {
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d24;
  --bg-tertiary: #252830;
  --bg-card: #1a1d24;
  --bg-glass: rgba(15, 17, 23, 0.80);
  --bg-overlay: rgba(0, 0, 0, 0.7);

  --text-primary: #f0f2f4;
  --text-secondary: #a0a4ab;
  --text-tertiary: #6b7280;
  --text-inverse: #191c1d;
  --text-link: var(--color-primary-fixed);

  --border-light: #252830;
  --border-default: #374151;
  --border-dark: #4b5563;

  --color-surface: #0f1117;
  --color-surface-container-low: #1a1d24;
  --color-surface-container-lowest: #252830;
  --color-surface-container: #1a1d24;
  --color-surface-container-high: #303340;
  --color-surface-container-highest: #3a3d4a;

  --color-on-surface: #f0f2f4;
  --color-on-surface-variant: #a0a4ab;
}
```

### Alteracoes para `tokens.css`

Se este arquivo contiver overrides de dark theme com variaveis neon (como `--neon-cyan`, cores vibrantes de neon), **remover** essas variaveis neon e manter apenas as variaveis de background/text/border do dark theme. Se o conteudo for redundante com `themes/dark.css`, considerar esvaziar o arquivo e manter apenas um comentario de redirecionamento.

### Validacao pos-sprint

```bash
# 1. Verificar que nao ha referencia neon nos temas
grep -c "neon\|glow\|ec4899\|06b6d4" src/shared/styles/themes/light.css src/shared/styles/themes/dark.css
# Resultado esperado: 0 para ambos

# 2. Verificar que data-theme='dark' ainda existe (nao quebrar toggle)
grep "data-theme" src/shared/styles/themes/dark.css
# Resultado esperado: pelo menos 1 match

# 3. App compila sem erros
npm run dev

# 4. Verificacao final: NENHUMA referencia neon em QUALQUER arquivo de tokens/themes
grep -r "neon\|glow\|ec4899\|06b6d4\|#ff006e\|#00e5ff" src/shared/styles/ --include="*.css"
# Resultado esperado: 0 matches
```

### Commit
```
feat(themes): atualizar temas para Santuario Terapeutico

- Light theme: apontar para novos tokens surface/text
- Dark theme: simplificar para placeholder (Phase 6)
- Remover todas as referencias neon dos arquivos de tema
- Manter estrutura data-theme='dark' para nao quebrar toggle
```

---

## Criterio de Conclusao da Wave 0

Apos os 5 sprints, validar:

- [ ] `npm run dev` roda sem erros de CSS
- [ ] Background da app e `#f8fafb` (off-white, NAO branco puro)
- [ ] Textos usam `#191c1d` (nunca `#000000` preto puro)
- [ ] Nenhuma referencia a `--neon-*` ou `--glow-*` em `src/shared/styles/`
- [ ] Nenhuma referencia a `#ec4899` (rosa) ou `#06b6d4` (cyan) em `src/shared/styles/`
- [ ] Variavel `--color-primary` resolve para `#006a5e` (verde saude)
- [ ] Variavel `--color-secondary` resolve para `#005db6` (azul clinico)
- [ ] Classes `.card-sanctuary`, `.btn-primary-gradient`, `.surface-container-*` existem
- [ ] Componentes existentes podem estar "feios" (cores quebradas) — isso e ESPERADO

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
