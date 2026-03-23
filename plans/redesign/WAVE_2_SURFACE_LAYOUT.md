# Wave 2 — Surface & Layout System

**Status:** Pronto para execucao
**Dependencias:** Wave 0 (tokens) + Wave 1 (typography) DEVEM estar completas
**Branch:** `feature/redesign/wave-2-surface-layout`
**Estimativa:** 3 sprints sequenciais
**Risco:** MEDIO — layout grid e CSS puro, sem logica React. O sidebar offset e o ponto mais delicado.

> **IMPORTANTE para o agente executor:** Esta wave estabelece o sistema de superficies (Material 3 "No-Line Rule") e o layout responsivo (mobile single-column + desktop grid com sidebar). O principio fundamental e: **profundidade por tom de background, NAO por bordas**. Ao inves de `border: 1px solid`, usamos diferenca de cor entre superficies aninhadas para criar hierarquia visual.

---

## Contexto Visual

**"No-Line Rule"** — Regra fundamental do design system:
- PROIBIDO usar `1px solid borders` para separar conteudo
- Bordas visuais sao criadas por diferenca de tom entre camadas de superficie
- Exemplo: um card `#ffffff` sobre um fundo `#f2f4f5` cria separacao visual sem nenhuma borda

**Hierarquia de superficies (do mais fundo ao mais acima):**
```
Level 0 (base):         --color-surface           #f8fafb   ← background da app
Level 1 (secoes sutis): --color-surface-container-low  #f2f4f5   ← secoes, sidebars
Level 2 (cards ativos): --color-surface-container-lowest #ffffff  ← cards interativos
```

**Referencia visual — Layout desktop com sidebar:**
- `plans/redesign/references/simple-hoje-desktop.png`: sidebar esquerda `#f2f4f5` com nav items, area principal branca
- `plans/redesign/references/complex-hoje-desktop.png`: sidebar + grid 2 colunas no conteudo
- `plans/redesign/references/complex-estoque-desktop.png`: sidebar + grid 3 colunas de cards

**Referencia visual — Layout mobile:**
- `plans/redesign/references/simple-hoje-mobile.png`: coluna unica, padding 1rem, sem sidebar
- `plans/redesign/references/simple-estoque-mobile.png`: coluna unica com cards empilhados
- `plans/redesign/references/complex-hoje-mobile.png`: coluna unica com secoes colapsaveis

**Medidas-chave observadas nos mocks:**
- Sidebar desktop: largura 256px (16rem), background `surface-container-low` (#f2f4f5)
- Content area desktop: `margin-left: 16rem`, max-width 80rem (1280px), centered
- Mobile padding: 1rem lateral
- Desktop padding: 2rem lateral
- Gap entre cards/secoes: 1.5rem (mobile), 2rem (desktop)

---

## Sprint 2.1 — Surface utilities e atualizacao de classes

**Skill:** `/deliver-sprint`
**Escopo:** Garantir que as classes de superficie e o card-sanctuary estao funcionais. Atualizar CSS global.

### Arquivo alvo
`src/shared/styles/index.css`

### O que o agente DEVE fazer

1. **Ler** `src/shared/styles/index.css` por completo.
2. **Verificar** que as classes adicionadas no Sprint 0.4 (Wave 0) existem:
   ```bash
   grep "card-sanctuary\|surface-container\|btn-primary-gradient" src/shared/styles/index.css
   ```
   Se NAO existirem (Sprint 0.4 nao foi executado corretamente), ADICIONÁ-LAS conforme descrito no Sprint 0.4 da Wave 0.
3. **Adicionar** ao index.css as seguintes classes utilitarias ADICIONAIS (apos as classes surface que ja devem existir):

### Classes a ADICIONAR no `index.css`

```css
/* ============================================
   TONAL SEPARATION — alternativa a borders
   Usar para listas, rows, e divisoes visuais.
   ============================================ */

/* Alternancia tonal para listas (par/impar) */
.list-tonal > *:nth-child(even) {
  background-color: var(--color-surface-container-low);
}

.list-tonal > *:nth-child(odd) {
  background-color: var(--color-surface);
}

/* Separacao por espaco (alternativa a dividers) */
.space-y-3 > * + * { margin-top: 1rem; }
.space-y-4 > * + * { margin-top: 1.4rem; }
.space-y-6 > * + * { margin-top: 1.5rem; }
.space-y-8 > * + * { margin-top: 2rem; }
.space-y-10 > * + * { margin-top: 2.5rem; }
.space-y-12 > * + * { margin-top: 3rem; }

/* ============================================
   ALERT CARDS — variantes com borda esquerda
   Usados para alertas de estoque, erros, avisos.
   ============================================ */

.card-alert-critical {
  background-color: var(--color-error-bg);
  border-radius: var(--radius-card-sm);
  padding: 1.25rem;
  border: none;
  border-left: 4px solid var(--color-error);
}

.card-alert-warning {
  background-color: var(--color-warning-bg);
  border-radius: var(--radius-card-sm);
  padding: 1.25rem;
  border: none;
  border-left: 4px solid var(--color-warning);
}

.card-alert-info {
  background-color: var(--color-info-bg);
  border-radius: var(--radius-card-sm);
  padding: 1.25rem;
  border: none;
  border-left: 4px solid var(--color-info);
}

.card-alert-success {
  background-color: var(--color-success-bg);
  border-radius: var(--radius-card-sm);
  padding: 1.25rem;
  border: none;
  border-left: 4px solid var(--color-success);
}

/* ============================================
   GRADIENT CARD — usado para CTAs hero e prioridade maxima
   ============================================ */
.card-gradient {
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  border-radius: var(--radius-card);
  padding: 2rem;
  box-shadow: var(--shadow-primary);
  border: none;
}

/* ============================================
   SECTION CARD — usado para secoes internas (sem shadow)
   ============================================ */
.card-section {
  background-color: var(--color-surface-container-low);
  border-radius: var(--radius-card-sm);
  padding: 1.5rem;
  border: none;
  box-shadow: none;
}

/* ============================================
   ICON CONTAINER — circulo para leading icons em listas
   ============================================ */
.icon-container {
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

.icon-container-sm {
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

/* ============================================
   STATUS DOT — indicador de status em listas
   ============================================ */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-dot-success { background-color: var(--color-success); }
.status-dot-warning { background-color: var(--color-warning); }
.status-dot-error { background-color: var(--color-error); }
.status-dot-info { background-color: var(--color-info); }
.status-dot-neutral { background-color: var(--color-outline); }
```

### Validacao pos-sprint

```bash
# 1. Verificar que as novas classes existem
grep -c "card-alert-critical\|card-gradient\|card-section\|icon-container\|status-dot" src/shared/styles/index.css
# Resultado esperado: >= 5

# 2. Verificar que NAO tem border: 1px solid nas novas classes
grep "border: 1px solid" src/shared/styles/index.css
# Resultado esperado: NAO deve ter (ou ter apenas em classes legacy)

# 3. App compila sem erros
npm run dev
```

### Commit
```
feat(styles): adicionar sistema tonal de superficies e card variants

- Adicionar list-tonal para alternancia par/impar
- Adicionar card-alert-* (critical, warning, info, success)
- Adicionar card-gradient para CTAs hero
- Adicionar card-section para secoes internas
- Adicionar icon-container e status-dot utilities
- Seguir "No-Line Rule": sem borders, separacao por tom
```

---

## Sprint 2.2 — Criar layout.css (Grid System responsivo)

**Skill:** `/deliver-sprint`
**Escopo:** Criar novo arquivo de layout com grid system responsivo e importa-lo no index.css.

### Arquivos alvo
1. **CRIAR** `src/shared/styles/layout.css` (arquivo NOVO)
2. **EDITAR** `src/shared/styles/index.css` (adicionar import)

### O que o agente DEVE fazer

1. **Verificar** que `src/shared/styles/layout.css` NAO existe:
   ```bash
   ls src/shared/styles/layout.css 2>/dev/null || echo "Nao existe, pode criar"
   ```
2. **Ler** `src/shared/styles/index.css` para entender a estrutura de imports.
3. **Criar** o arquivo `src/shared/styles/layout.css` com o conteudo EXATO abaixo.
4. **Editar** `src/shared/styles/index.css` para adicionar o import do novo arquivo.

### Conteudo EXATO do novo `layout.css`

```css
/* ============================================
   RESPONSIVE GRID LAYOUT — Santuario Terapeutico

   Breakpoints:
   - Mobile: < 768px — coluna unica, padding 1rem
   - Tablet: 768px-1023px — 2 colunas, padding 1.5rem
   - Desktop: >= 1024px — 2-3 colunas, sidebar 256px, padding 2rem

   Max-width: 80rem (1280px) para manter legibilidade.
   ============================================ */

/* ============================================
   PAGE CONTAINER — wrapper principal de conteudo
   ============================================ */
.page-container {
  width: 100%;
  max-width: 80rem; /* 1280px */
  margin: 0 auto;
  padding: 1rem;
}

@media (min-width: 768px) {
  .page-container {
    padding: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .page-container {
    padding: 2rem;
  }
}

/* ============================================
   MAIN WITH SIDEBAR — offset para sidebar fixa
   Usado no <main> quando o usuario esta autenticado.
   ============================================ */
@media (min-width: 768px) {
  .main-with-sidebar {
    margin-left: 16rem; /* 256px sidebar width */
  }
}

/* ============================================
   APP MAIN — container do conteudo principal
   ============================================ */
.app-main {
  min-height: 100vh;
  min-height: 100dvh; /* dynamic viewport height para mobile */
  position: relative;
  padding-bottom: 5rem; /* 80px — espaco para BottomNav no mobile */
}

@media (min-width: 768px) {
  .app-main {
    padding-bottom: 0; /* sem BottomNav no desktop — sidebar substitui */
  }
}

/* ============================================
   GRID PATTERNS — mobile-first, expandem em desktop
   ============================================ */

/* Base: sempre coluna unica no mobile */
.grid-1 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

/* 2 colunas em tablet+ */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .grid-2 {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 3 colunas em desktop */
.grid-3 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .grid-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* 12 colunas em desktop (para layouts complexos) */
.grid-12 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .grid-12 {
    grid-template-columns: repeat(12, 1fr);
  }
}

/* ============================================
   DASHBOARD LAYOUT
   Mobile: coluna unica
   Desktop: esquerda (ring + prioridade) 1fr + direita (cronograma) 2fr

   Referencia: plans/redesign/references/simple-hoje-desktop.png
   - Coluna esquerda: ring gauge de adesao + card prioridade maxima
   - Coluna direita: cronograma do dia + alertas
   ============================================ */
.grid-dashboard {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 1024px) {
  .grid-dashboard {
    grid-template-columns: 1fr 2fr;
    gap: 2rem;
  }
}

/* ============================================
   TRATAMENTOS LAYOUT
   Mobile: coluna unica (cards empilhados)
   Desktop: grid tabular

   Referencia: plans/redesign/references/complex-tratamentos-desktop.png
   - Lista tabular com colunas: nome, dose, frequencia, status
   ============================================ */
.grid-treatments {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .grid-treatments {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }
}

/* ============================================
   ESTOQUE LAYOUT
   Mobile: coluna unica
   Desktop: grid 3 colunas de cards

   Referencia: plans/redesign/references/complex-estoque-desktop.png
   - Cards com dias restantes, barra de progresso, status badge
   ============================================ */
.grid-stock {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 768px) {
  .grid-stock {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .grid-stock {
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
}

/* ============================================
   PAGE HEADER — header padrao de pagina
   Usado em todas as views como container do titulo + acoes.
   ============================================ */
.page-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 768px) {
  .page-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
}

.page-title {
  font-family: var(--font-display);
  font-size: var(--text-headline-md);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
  letter-spacing: var(--tracking-tight);
  color: var(--color-on-surface);
}

.page-subtitle {
  font-family: var(--font-body);
  font-size: var(--text-body-lg);
  font-weight: var(--font-weight-regular);
  color: var(--color-on-surface-variant);
}

/* ============================================
   SECTION HEADER — header de secao dentro de uma pagina
   ============================================ */
.section-header {
  font-family: var(--font-body);
  font-size: var(--text-label-md);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-widest);
  color: var(--color-outline);
  margin-bottom: 1rem;
}

/* ============================================
   RESPONSIVE HELPERS
   ============================================ */

/* Esconder em mobile, mostrar em desktop */
.desktop-only {
  display: none;
}

@media (min-width: 768px) {
  .desktop-only {
    display: block;
  }
}

/* Esconder em desktop, mostrar em mobile */
.mobile-only {
  display: block;
}

@media (min-width: 768px) {
  .mobile-only {
    display: none;
  }
}

/* ============================================
   SAFE AREA — para dispositivos com notch
   ============================================ */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.safe-area-top {
  padding-top: env(safe-area-inset-top, 0);
}
```

### Adicionar import no `index.css`

Editar `src/shared/styles/index.css` para adicionar o import do layout.css. Adicionar APOS os imports existentes de tokens:

```css
@import './layout.css';
```

**ATENCAO:** Verificar como os outros imports estao feitos no index.css (pode ser `@import url('./...')` ou `@import './...'`). Usar o MESMO formato.

### Validacao pos-sprint

```bash
# 1. Verificar que layout.css existe
ls src/shared/styles/layout.css
# Resultado esperado: arquivo existe

# 2. Verificar que esta importado no index.css
grep "layout" src/shared/styles/index.css
# Resultado esperado: pelo menos 1 match

# 3. Verificar que os grids estao definidos
grep "grid-dashboard\|grid-stock\|grid-treatments" src/shared/styles/layout.css
# Resultado esperado: pelo menos 3 matches

# 4. Verificar que main-with-sidebar esta definido
grep "main-with-sidebar" src/shared/styles/layout.css
# Resultado esperado: pelo menos 1 match

# 5. App compila sem erros
npm run dev
```

### Commit
```
feat(layout): criar grid system responsivo para redesign

- Criar layout.css com grid system mobile-first
- Grid patterns: 1/2/3/12 colunas, dashboard, treatments, stock
- Page container: max-width 80rem, padding responsivo
- Sidebar offset: margin-left 16rem em desktop
- Page header/title/subtitle utilities
- Responsive helpers: desktop-only, mobile-only
- Safe area support para dispositivos com notch
```

---

## Sprint 2.3 — Verificar integracao e testar responsividade

**Skill:** `/deliver-sprint`
**Escopo:** Verificar que todos os tokens, tipografia e layout estao integrados. Fazer smoke test visual.

### O que o agente DEVE fazer

1. **Verificar a cadeia de imports** no index.css:
   ```bash
   grep "@import" src/shared/styles/index.css
   ```
   Deve incluir: tokens (colors, typography, borders, shadows, spacing, transitions, z-index), themes (light, dark), animations, e layout.

2. **Verificar que o main.jsx importa o index.css:**
   ```bash
   grep "index.css\|shared/styles" src/main.jsx
   ```

3. **Executar build completo** para garantir que nao ha erros:
   ```bash
   npm run build
   ```
   Se houver erros, corrigi-los neste sprint.

4. **Executar lint** se disponivel:
   ```bash
   npm run lint 2>/dev/null || echo "Lint nao configurado"
   ```

5. **Verificar que NENHUMA referencia neon/glow sobreviveu em QUALQUER arquivo CSS:**
   ```bash
   grep -rn "neon\|#ec4899\|#06b6d4\|#ff006e\|#00e5ff" src/shared/styles/ --include="*.css"
   ```
   Se encontrar matches, CORRIGIR substituindo pelos novos tokens.

6. **Verificar que variaveis criticas resolvem corretamente:**
   Criar um arquivo temporario de teste e apagar depois:
   ```bash
   # Verificar que nao ha variaveis indefinidas nos novos arquivos
   grep "var(--" src/shared/styles/layout.css | grep -oP "var\(--[a-z-]+" | sort -u
   # Cada variavel listada deve existir em algum token file
   ```

7. **Se todos os checks passarem**, NAO alterar nenhum arquivo. Apenas registrar o resultado.

### Validacao pos-sprint

```bash
# 1. Build deve passar
npm run build
# Resultado esperado: sucesso

# 2. Zero referencias neon em styles
grep -rc "neon\|#ec4899\|#06b6d4" src/shared/styles/ --include="*.css" | grep -v ":0$"
# Resultado esperado: nenhuma linha (todas sao :0)

# 3. Variaveis criticas existem
grep "color-primary" src/shared/styles/tokens/colors.css | head -1
# Resultado esperado: --color-primary: #006a5e

grep "font-display" src/shared/styles/tokens/typography.css | head -1
# Resultado esperado: --font-display: "Public Sans"...

grep "shadow-ambient" src/shared/styles/tokens/shadows.css | head -1
# Resultado esperado: --shadow-ambient: 0 24px 24px...

grep "radius-card" src/shared/styles/tokens/borders.css | head -1
# Resultado esperado: --radius-card: var(--radius-2xl)

# 4. Layout existe e esta importado
grep "layout" src/shared/styles/index.css
# Resultado esperado: import presente
```

### Commit
```
chore(redesign): validar integracao tokens + typography + layout (Wave 0-2)

- Verificar cadeia de imports completa
- Confirmar zero referencias neon/glow residuais
- Build passa sem erros
- Todas as variaveis criticas resolvem corretamente
```

---

## Criterio de Conclusao da Wave 2

Apos os 3 sprints, validar:

- [ ] Page backgrounds sao `#f8fafb` (off-white, verificar via DevTools)
- [ ] Cards `.card-sanctuary` nao tem borders (apenas tonal shift + ambient shadow)
- [ ] Grid responsivo funciona em 320px, 768px e 1280px (testar redimensionando o browser)
- [ ] Classe `.page-container` limita conteudo a max-width 80rem
- [ ] Classe `.main-with-sidebar` aplica margin-left 16rem em >= 768px
- [ ] Classe `.grid-dashboard` cria 2 colunas em >= 1024px
- [ ] Classe `.grid-stock` cria 3 colunas em >= 1024px
- [ ] `npm run build` passa sem erros
- [ ] Zero referencias neon/glow em `src/shared/styles/`
- [ ] `layout.css` existe e esta importado no `index.css`

## Ordem de Execucao

```
Sprint 2.1 (surface utilities no index.css)
  ↓
Sprint 2.2 (criar layout.css + import)
  ↓
Sprint 2.3 (verificacao e integracao)
```

**TODOS os sprints sao sequenciais.**
