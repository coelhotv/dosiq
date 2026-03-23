# Wave 1 — Typography & Icon System

**Status:** Pronto para execucao
**Dependencias:** Wave 0 (tokens.redesign.css com bloco `[data-redesign="true"]`) DEVE estar completa
**Branch:** `claude/gradual-redesign-rollout-VBlvB`
**Estimativa:** 3 sprints sequenciais
**Risco:** BAIXO — tipografia scoped, sem impacto em usuarios sem o flag. Lucide e install aditivo.

---

## 🚩 ABORDAGEM DE ROLLOUT GRADUAL (LEIA ANTES DE EXECUTAR)

> **Esta wave NAO modifica `typography.css` nem adiciona `<link>` globais em `index.html`.**
> Tokens tipograficos vao para `tokens.redesign.css` (bloco `[data-redesign="true"]`).
> Fontes Google sao carregadas via CSS `@import` dentro do bloco scoped — apenas usuarios com o flag ativo as carregam.
> Ver estrategia completa em `plans/redesign/EXEC_SPEC_GRADUAL_ROLLOUT.md`.

**Motivo:** `<link>` de fonte no `<head>` e global e afeta todos os usuarios (mesmo sem o flag). Usando CSS `@import` dentro de `[data-redesign="true"] { }`, o browser so carrega Public Sans + Lexend quando o data-attribute estiver presente.

**Excecao — lucide-react:** A instalacao via `npm install lucide-react` e segura e global. O pacote so impacta o bundle se importado no codigo — como sera usado apenas em componentes do redesign (W3+), nao ha impacto em producao enquanto nao for usado.

---

> **IMPORTANTE para o agente executor:** Esta wave adiciona tokens tipograficos do Santuario Terapeutico ao arquivo scoped `tokens.redesign.css`. O objetivo e que, ao ativar `?redesign=1`, a tipografia mude para Public Sans (headlines) + Lexend (body) — sem impacto para usuarios sem o flag. O arquivo `typography.css` atual **NAO deve ser modificado nesta wave**. **REGRA CRITICA: Nunca usar peso de fonte abaixo de 400** — pacientes idosos nao conseguem ler fontes finas.

---

## Contexto Visual

**Referencia visual:** Ver `plans/redesign/references/design-system.png`:
- Headings (Aa grande no topo): Public Sans bold, tracking tight — "Clinical Authority"
- Body text (Aa menor): Lexend regular — projetada para reduzir ruido cognitivo
- Labels: Lexend medium, uppercase, tracking wider

**Referencia de iconografia:** Ver `plans/redesign/references/iconografia_meus_remedios.png`:
- Icones: Material Symbols Outlined, peso 400, fill 0, cor primaria `#008577`
- Tamanhos padrao em grid: 24px base, com area de toque minima de 48px
- REGRA: Icone SEMPRE acompanhado de label de texto (nunca icone sozinho)

**Referencia de uso nas telas (ver screenshots em `plans/redesign/references/`):**
- `simple-hoje-mobile.png`: "Ola, Dona Maria" em headline, doses em body regular
- `complex-hoje-desktop.png`: "Painel de Controle" em headline, "ADESAO DIARIA" em label uppercase
- `simple-tratamentos-mobile.png`: "Losartana" em title semibold, "50mg • 1 comprimido" em body regular

---

## Sprint 1.1 — Adicionar tokens de tipografia ao bloco scoped

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar tokens tipograficos do Santuario (fontes, type scale, pesos) em `tokens.redesign.css`. Carregar fontes Google via CSS `@import` scoped. NAO modificar `typography.css` nem `index.html`.

### Arquivos alvo
`src/shared/styles/tokens.redesign.css` ← ADICIONAR ao bloco `[data-redesign="true"]`

> **NAO ALTERAR:** `src/shared/styles/tokens/typography.css` (arquivo atual intacto)
> **NAO ALTERAR:** `index.html` (sem `<link>` globais de fonte)

### O que o agente DEVE fazer

1. **Ler o arquivo atual** `src/shared/styles/tokens/typography.css` por completo (context apenas — nao modificar).
2. **Buscar** no codebase quais componentes usam `--font-primary`, `--font-family`, `--heading-font-family` (context):
   ```bash
   grep -rn "\-\-font-primary\|--font-family\|--heading-font-family" src/ --include="*.css" -l
   ```
3. **Buscar** quais componentes usam pesos abaixo de 400 (para mapear impacto futuro):
   ```bash
   grep -rn "font-weight:\s*[123]00\|font-weight-thin\|font-weight-light\|font-weight-extralight" src/ --include="*.css" --include="*.jsx" -l
   ```
4. **Adicionar** o conteudo abaixo ao bloco `[data-redesign="true"] { }` em `tokens.redesign.css`, apos os tokens de border (Sprint 0.3).
5. **Adicionar** tambem o `@import` das fontes Google no INICIO de `tokens.redesign.css` (ANTES do bloco `[data-redesign="true"]`).
6. **NAO alterar** nenhum outro arquivo neste sprint.

### Conteudo a ADICIONAR em `tokens.redesign.css`

**Parte A — `@import` de fontes (ANTES do bloco `[data-redesign="true"]`):**

```css
/* Fontes carregadas via CSS @import — so ativam quando [data-redesign="true"] esta presente */
@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Lexend:wght@400;500;600;700&display=swap');
```

**Parte B — Tokens tipograficos (DENTRO do bloco `[data-redesign="true"] { }`):**

```css
/* ============================================
   TYPOGRAPHY TOKENS — Santuario Terapeutico

   Pareamento tipografico:
   - Public Sans: Headlines e displays — "Autoridade Clinica"
   - Lexend: Body text e UI — "Hiperlegibilidade"

   Lexend foi projetada para reduzir ruido cognitivo,
   ideal para pacientes idosos.

   REGRA: Nunca peso abaixo de 400 (legibilidade para idosos).
   ============================================ */

/* ============================================
   FONT FAMILIES
   ============================================ */
:root {
  /* Display & Headlines — "Clinical Authority" */
  --font-display: "Public Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;

  /* Body & UI Text — "Hyper-legibility" */
  --font-body: "Lexend", ui-sans-serif, system-ui, -apple-system, sans-serif;

  /* Mono */
  --font-mono: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;

  /* System fallback aliases — backward compat */
  --font-family: var(--font-body);
  --font-primary: var(--font-body);
  --font-family-mono: var(--font-mono);
  --heading-font-family: var(--font-display);
}

/* ============================================
   TYPE SCALE — Editorial Health Journal

   Escala semantica nomeada por funcao, nao por tamanho.
   Mantemos a escala numerica (text-xs a text-5xl) para backward compat.
   ============================================ */
:root {
  /* Display — grandes numeros, milestones, hero text */
  --text-display-md: clamp(2rem, 4vw, 3rem);

  /* Headlines — Public Sans, titulos de secao */
  --text-headline-md: 1.75rem;

  /* Titles — Lexend, nomes de medicamentos, labels primarios */
  --text-title-lg: 1.125rem;
  --text-title-sm: 0.875rem;

  /* Body — Lexend, texto de leitura, instrucoes */
  --text-body-lg: 1rem;

  /* Labels — Lexend, pequenos indicadores, chips, nav labels */
  --text-label-md: 0.75rem;
  --text-label-sm: 0.625rem;

  /* Backward compat size scale (manter para componentes existentes) */
  --text-xs: 0.625rem;
  --text-2xs: 0.625rem;
  --text-sm: 0.75rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.75rem;
  --text-4xl: 2rem;
  --text-5xl: 3rem;

  /* Aliases size compat */
  --font-size-xs: var(--text-xs);
  --font-size-sm: var(--text-sm);
  --font-size-base: var(--text-base);
  --font-size-lg: var(--text-lg);
  --font-size-xl: var(--text-xl);
  --font-size-2xl: var(--text-2xl);
  --font-size-3xl: var(--text-3xl);
}

/* ============================================
   FONT WEIGHTS
   REGRA CRITICA: Minimo 400 para legibilidade de idosos.
   Pesos 100, 200, 300 sao PROIBIDOS.
   ============================================ */
:root {
  --font-weight-regular: 400;   /* Body, descricoes, instrucoes */
  --font-weight-medium: 500;    /* Labels, section headers, UI controls */
  --font-weight-semibold: 600;  /* Nomes de medicamentos, caminhos primarios */
  --font-weight-bold: 700;      /* Headlines, displays, % do ring gauge */

  /* Backward compat aliases — todos apontam para >= 400 */
  --font-weight-normal: var(--font-weight-regular);
  --font-weight-thin: var(--font-weight-regular);       /* 100 → 400 (upgrade) */
  --font-weight-extralight: var(--font-weight-regular);  /* 200 → 400 (upgrade) */
  --font-weight-light: var(--font-weight-regular);       /* 300 → 400 (upgrade) */
  --font-weight-extrabold: var(--font-weight-bold);      /* 800 → 700 */
  --font-weight-black: var(--font-weight-bold);          /* 900 → 700 */
}

/* ============================================
   LINE HEIGHTS
   ============================================ */
:root {
  --line-height-none: 1;
  --line-height-tight: 1.1;     /* Headlines, displays */
  --line-height-snug: 1.25;     /* Titles, cards */
  --line-height-normal: 1.5;    /* Body text padrao */
  --line-height-relaxed: 1.6;   /* Texto longo, descricoes */
  --line-height-loose: 2;       /* Espacamento generoso */
}

/* ============================================
   LETTER SPACING
   ============================================ */
:root {
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;   /* Headlines */
  --tracking-normal: 0;         /* Body */
  --tracking-wide: 0.025em;     /* Buttons */
  --tracking-wider: 0.05em;     /* Labels uppercase */
  --tracking-widest: 0.1em;     /* Nav labels, badges */
}

/* ============================================
   TEXT DEFAULTS (backward compat)
   ============================================ */
:root {
  --text-color-primary: var(--text-primary);
  --text-color-secondary: var(--text-secondary);
  --text-color-tertiary: var(--text-tertiary);
  --text-color-inverse: var(--text-inverse);
  --text-color-link: var(--text-link);

  --text-decoration-none: none;
  --text-decoration-underline: underline;
}

/* ============================================
   HEADING DEFAULTS
   Headings usam Public Sans (--font-display).
   ============================================ */
:root {
  --heading-font-weight: var(--font-weight-bold);
  --heading-line-height: var(--line-height-tight);
  --heading-letter-spacing: var(--tracking-tight);

  /* H1 — Page titles, hero */
  --text-h1: var(--text-4xl);
  --heading-1-size: var(--text-4xl);
  --heading-1-weight: var(--font-weight-bold);

  /* H2 — Section titles */
  --text-h2: var(--text-3xl);
  --heading-2-size: var(--text-3xl);
  --heading-2-weight: var(--font-weight-bold);

  /* H3 — Sub-sections */
  --text-h3: var(--text-2xl);
  --heading-3-size: var(--text-2xl);
  --heading-3-weight: var(--font-weight-semibold);

  /* H4 */
  --text-h4: var(--text-xl);
  --heading-4-size: var(--text-xl);
  --heading-4-weight: var(--font-weight-semibold);

  /* H5 */
  --text-h5: var(--text-lg);
  --heading-5-size: var(--text-lg);
  --heading-5-weight: var(--font-weight-medium);

  /* H6 */
  --text-h6: var(--text-base);
  --heading-6-size: var(--text-base);
  --heading-6-weight: var(--font-weight-medium);
}

/* ============================================
   MAX LINE WIDTH — readability
   Limitar largura maxima do texto para 65 caracteres
   para manter legibilidade em telas largas.
   ============================================ */
:root {
    --max-line-width: 65ch;
```

> **Nota:** O `@import` de fontes deve ser adicionado no INICIO de `tokens.redesign.css`, antes do bloco `[data-redesign="true"] { }`. Desta forma o browser so baixa as fontes quando o CSS e carregado — que acontece para todos os usuarios — mas as fontes so sao APLICADAS quando o data-attribute esta presente (pois os tokens `--font-display` e `--font-body` so sobrescrevem dentro do bloco scoped).

> **NAO adicionar** `<link>` de fonte em `index.html`. O `@import` dentro do CSS e suficiente para o rollout gradual.

### Validacao pos-sprint

```bash
# 1. Verificar que @import de fontes esta em tokens.redesign.css
grep "fonts.googleapis" src/shared/styles/tokens.redesign.css
# Resultado esperado: 1 match (antes do bloco [data-redesign="true"])

# 2. Verificar que font-display esta scoped
grep "font-display" src/shared/styles/tokens.redesign.css
# Resultado esperado: pelo menos 1 match dentro do bloco [data-redesign="true"]

# 3. Verificar que typography.css atual NAO foi modificado
grep "Public Sans\|Lexend" src/shared/styles/tokens/typography.css
# Resultado esperado: 0 (arquivo atual nao tem essas fontes)

# 4. Verificar que index.html NAO foi modificado
grep "fonts.googleapis" index.html
# Resultado esperado: 0 (sem link global de fonte)

# 5. App compila sem erros
npm run dev

# 6. Smoke test: com ?redesign=1, inspecionar h1 → deve mostrar "Public Sans" no font-family
# Sem o flag → deve mostrar "system-ui" (ou fonte atual)
```

### Commit
```
feat(typography): adicionar Public Sans + Lexend em tokens.redesign.css (scoped)

- @import Google Fonts no inicio de tokens.redesign.css
- font-display, font-body scoped em [data-redesign="true"]
- Type scale semantica (display, headline, title, body, label) scoped
- Backward compat aliases (font-primary, text-xs ate text-5xl) scoped
- typography.css atual intacto, index.html sem alteracao
```

---

## Sprint 1.2 — Instalar e configurar Lucide React

**Skill:** `/deliver-sprint`
**Escopo:** Instalar lucide-react. Criar guia de uso. NAO alterar componentes existentes ainda.

### O que o agente DEVE fazer

1. **Verificar** que o projeto tem `package.json` na raiz e que `lucide-react` NAO esta ja instalado:
   ```bash
   grep "lucide-react" package.json
   ```
2. **Instalar** a dependencia:
   ```bash
   npm install lucide-react
   ```
3. **Verificar** que a instalacao foi bem-sucedida:
   ```bash
   grep "lucide-react" package.json
   ```
4. **Verificar** que o import funciona criando um teste rapido (e apagando depois):
   ```bash
   node -e "const { Calendar } = require('lucide-react'); console.log('OK:', typeof Calendar)"
   ```
   Nota: se der erro por ESM, nao se preocupar — Vite resolve os imports.
5. **NAO alterar nenhum componente** neste sprint. A migracao de icones sera feita nas waves seguintes.

### Mapeamento de icones para referencia futura

Este mapeamento sera usado nas waves seguintes. O agente DEVE conhecer esta tabela:

| Uso na app | Icone Lucide | Import |
|------------|-------------|--------|
| Hoje (Dashboard) | `Calendar` | `import { Calendar } from 'lucide-react'` |
| Tratamentos | `Pill` | `import { Pill } from 'lucide-react'` |
| Estoque | `Package` | `import { Package } from 'lucide-react'` |
| Perfil | `User` | `import { User } from 'lucide-react'` |
| Saude & Portabilidade | `HeartPulse` | `import { HeartPulse } from 'lucide-react'` |
| Adicionar | `Plus` | `import { Plus } from 'lucide-react'` |
| Registrar dose | `CheckCircle2` | `import { CheckCircle2 } from 'lucide-react'` |
| Comprar | `ShoppingCart` | `import { ShoppingCart } from 'lucide-react'` |
| Alerta | `AlertTriangle` | `import { AlertTriangle } from 'lucide-react'` |
| Estoque Baixo | `AlertCircle` | `import { AlertCircle } from 'lucide-react'` |
| Relogio/Horario | `Clock` | `import { Clock } from 'lucide-react'` |
| Filtrar | `Filter` | `import { Filter } from 'lucide-react'` |
| Buscar | `Search` | `import { Search } from 'lucide-react'` |
| Configuracoes | `Settings` | `import { Settings } from 'lucide-react'` |
| Sair | `LogOut` | `import { LogOut } from 'lucide-react'` |
| Info/Detalhes | `Info` | `import { Info } from 'lucide-react'` |
| Chevron | `ChevronRight` | `import { ChevronRight } from 'lucide-react'` |
| Notificacoes | `Bell` | `import { Bell } from 'lucide-react'` |
| Sol (manha) | `Sun` | `import { Sun } from 'lucide-react'` |
| Lua (noite) | `Moon` | `import { Moon } from 'lucide-react'` |
| Editar | `Pencil` | `import { Pencil } from 'lucide-react'` |
| Excluir | `Trash2` | `import { Trash2 } from 'lucide-react'` |

**Tamanhos padrao:**
- 28px — primary nav (BottomNav, Sidebar)
- 24px — base (cards, headers)
- 20px — dense lists, secondary actions
- 16px — inline com texto

**REGRA ABSOLUTA:** Icone NUNCA aparece sozinho sem label de texto. Sempre acompanhar com `<span>` de texto.

### Validacao pos-sprint

```bash
# 1. Verificar que lucide-react esta no package.json
grep "lucide-react" package.json
# Resultado esperado: 1 match com versao

# 2. Verificar que node_modules contem o pacote
ls node_modules/lucide-react/package.json
# Resultado esperado: arquivo existe

# 3. App compila sem erros
npm run dev

# 4. Build funciona (verificar que lucide-react nao quebra o bundle)
npm run build
```

### Commit
```
chore(deps): instalar lucide-react para icon system do redesign

- lucide-react sera usado para substituir SVG paths inline
- Icones sempre acompanhados de label (regra de acessibilidade)
- Tamanhos padrao: 28px nav, 24px base, 20px dense, 16px inline
```

---

## Sprint 1.3 — Adicionar regras tipograficas globais scoped

**Skill:** `/deliver-sprint`
**Escopo:** Adicionar regras de tipografia global (body, h1-h6) scoped em `[data-redesign="true"]` no arquivo `tokens.redesign.css`. NAO modificar `index.css` globalmente.

### Arquivo alvo
`src/shared/styles/tokens.redesign.css` ← ADICIONAR regras tipograficas scoped (APOS as classes utilitarias do Sprint 0.4)

> **NAO ALTERAR:** `src/shared/styles/index.css`

### O que o agente DEVE fazer

1. **Ler** `src/shared/styles/index.css` por completo (context — verificar se ja existe `body { font-family: ... }` para nao criar conflito).
2. **Buscar** no codebase onde `font-family` e hardcoded:
   ```bash
   grep -rn "font-family:" src/ --include="*.css" | grep -v "var(" | grep -v "node_modules"
   ```
3. **Adicionar** ao final de `tokens.redesign.css` as seguintes regras scoped.
4. **NAO alterar** `index.css` nem qualquer outro arquivo.

### Conteudo a ADICIONAR ao final de `tokens.redesign.css`

```css
/* ============================================
   TYPOGRAPHY GLOBAL — Santuario Terapeutico
   Scoped: so aplica quando [data-redesign="true"] esta presente.
   REGRA: Nunca font-weight abaixo de 400.
   ============================================ */

[data-redesign="true"] body {
  font-family: var(--font-body);
  font-weight: var(--font-weight-regular);
  font-size: var(--text-body-lg);
  line-height: var(--line-height-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

[data-redesign="true"] h1,
[data-redesign="true"] h2,
[data-redesign="true"] h3,
[data-redesign="true"] h4,
[data-redesign="true"] h5,
[data-redesign="true"] h6 {
  font-family: var(--font-display);
  font-weight: var(--heading-font-weight);
  line-height: var(--heading-line-height);
  letter-spacing: var(--heading-letter-spacing);
}

[data-redesign="true"] h1 { font-size: var(--heading-1-size); font-weight: var(--heading-1-weight); }
[data-redesign="true"] h2 { font-size: var(--heading-2-size); font-weight: var(--heading-2-weight); }
[data-redesign="true"] h3 { font-size: var(--heading-3-size); font-weight: var(--heading-3-weight); }
[data-redesign="true"] h4 { font-size: var(--heading-4-size); font-weight: var(--heading-4-weight); }
[data-redesign="true"] h5 { font-size: var(--heading-5-size); font-weight: var(--heading-5-weight); }
[data-redesign="true"] h6 { font-size: var(--heading-6-size); font-weight: var(--heading-6-weight); }

/* Inputs e buttons tambem usam Lexend quando o redesign esta ativo */
[data-redesign="true"] input,
[data-redesign="true"] textarea,
[data-redesign="true"] select,
[data-redesign="true"] button {
  font-family: var(--font-body);
}
```

### Validacao pos-sprint

```bash
# 1. Verificar que as regras scoped estao em tokens.redesign.css
grep "\[data-redesign.*body\|data-redesign.*h1" src/shared/styles/tokens.redesign.css
# Resultado esperado: pelo menos 2 matches

# 2. Verificar que index.css NAO foi modificado
git diff src/shared/styles/index.css
# Resultado esperado: nenhuma alteracao

# 3. App compila sem erros
npm run dev

# 4. Smoke test: com ?redesign=1, inspecionar body → "Lexend" no font-family
# Sem o flag → fonte atual (system-ui ou o que existia antes)
```

### Commit
```
feat(typography): adicionar regras tipograficas globais scoped em tokens.redesign.css

- [data-redesign="true"] body: Lexend regular, antialiased
- [data-redesign="true"] h1-h6: Public Sans bold/semibold
- [data-redesign="true"] inputs/buttons: Lexend
- index.css atual intacto (sem alteracao global de fonte)
```

---

## Criterio de Conclusao da Wave 1

Apos os 3 sprints, validar:

- [ ] `npm run build` passa sem erros
- [ ] `tokens.redesign.css` contem `@import` das fontes Google (antes do bloco scoped)
- [ ] `tokens.redesign.css` contem tokens `--font-display`, `--font-body` dentro de `[data-redesign="true"]`
- [ ] `typography.css` atual **NAO foi modificado**
- [ ] `index.html` **NAO tem** `<link>` de fonte Google adicionado
- [ ] `lucide-react` instalado e importavel (`import { Calendar } from 'lucide-react'`)
- [ ] Smoke test **com `?redesign=1`**: headings renderizam em Public Sans bold
- [ ] Smoke test **com `?redesign=1`**: body text renderiza em Lexend regular
- [ ] Smoke test **sem flag**: tipografia atual intacta (sem regressao)

## Ordem de Execucao

```
Sprint 1.1 (typography.css + index.html)
  ↓
Sprint 1.2 (npm install lucide-react)
  ↓
Sprint 1.3 (index.css typography rules)
```

**TODOS os sprints sao sequenciais** — 1.3 depende das variaveis definidas em 1.1.
