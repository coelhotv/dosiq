# Wave 13 — Landing, Auth & Onboarding Redesign

**Status:** ✅ ENTREGUE (2026-03-31, PR #441)
**Data de criação:** 2026-03-30
**Data de conclusão:** 2026-03-31
**Dependências:** W0-W11 ✅ (W12 pode estar em paralelo — sem dependência direta)
**Risco:** MÉDIO-ALTO — Landing e Auth são pre-autenticação: afetam 100% dos usuários sem proteção de feature flag. Onboarding é a jornada de ativação do novo usuário.
**Estimativa:** ~4 sprints, ~400 linhas CSS modificado + ~300 linhas JSX modificado/novo

---

## Por que esta wave existe

Esta wave fecha o redesign da jornada pré-autenticação: o ponto de entrada do produto. A landing page, a tela de login/cadastro e o wizard de onboarding são exatamente as superfícies que um novo usuário vê **antes** de qualquer outra tela. Se essas telas estiverem no visual antigo, a primeira impressão do produto está comprometida.

### Situação atual:

| Superfície | Visual atual | Problema |
|-----------|-------------|---------|
| **Landing (variant `control`)** | Neon/glass com gradient cyan-magenta | Usado por 0% dos usuários ativos (A/B: `new` venceu) |
| **Landing (variant `new`)** | Moderno, editorial, mas com azuis Tailwind | A/B vencedor: pronto para promoção, mas cores azuis (não Santuário) |
| **Auth** | `glass-card`, neon cyan, fundo escuro | 100% neon — primeiro formulário que novo usuário vê |
| **OnboardingWizard** | `--color-primary` com fallback `#3b82f6` (azul) | Indicadores de progresso e active state em azul |
| **WelcomeStep** | Benefit icons com bg/text azul (`#dbeafe`, `#3b82f6`) | Azuis Tailwind em vez de Verde Saúde |
| **TelegramIntegrationStep** | `var(--neon-cyan)` em notification title | Neon residual; azul Telegram (OK — brand) |

### Decisão estratégica confirmada pelo produto:
> **A variante `new` da landing venceu o A/B test e torna-se a versão definitiva.** O único ajuste necessário é trocar os tons de azul pelo Verde Terapêutico do design system.

---

## Arquitetura da Wave

### Regra fundamental: Mudanças DIRETAS (sem feature flag)

**Landing, Auth e Onboarding são superfícies pré-autenticação.** Não faz sentido protegilas com `isRedesignEnabled` porque:
- O usuário não está logado para ter o flag configurado
- Onboarding é acionado para novos usuários ainda sem configuração de redesign

**Consequência:** As modificações desta wave são aplicadas diretamente nos arquivos existentes — sem criar variantes paralelas (`XxxRedesign.jsx`), sem branching `isRedesignEnabled`.

---

## Referência de Tokens (Verde Terapêutico)

Os tokens abaixo estão definidos em `tokens.redesign.css` e são usados em **todas** as mudanças desta wave:

```css
/* Cor primária — Verde Saúde */
var(--color-primary)                  → #006a5e
var(--color-primary-container)        → #9cf1e1  (verde claro)
var(--color-on-primary)               → #ffffff

/* Superfícies */
var(--color-surface)                  → #f8fafa
var(--color-surface-container-lowest) → #ffffff
var(--color-surface-container-low)    → #f2f4f5
var(--color-surface-container)        → #eceeef
var(--color-surface-container-high)   → #e6e8e9

/* Texto */
var(--color-on-surface)               → #191c1d
var(--color-on-surface-variant)       → #3f484a

/* Semantic */
var(--color-error)                    → #ba1a1a
var(--color-success, #10b981)         → #10b981 (mantém)
var(--color-warning, #b45309)         → #b45309

/* Tipografia */
var(--font-heading)                   → 'Public Sans', sans-serif
var(--font-body)                      → 'Lexend', sans-serif
var(--text-display-md)                → 2.25rem
var(--text-headline-md)               → 1.75rem
var(--text-title-lg)                  → 1.125rem
var(--text-body-lg)                   → 1rem
var(--text-body-md)                   → 0.875rem
var(--text-label-md)                  → 0.8125rem
```

### Mapeamento Azul Tailwind → Verde Terapêutico (Landing)

Esta tabela é a referência canônica para toda substituição de cor na Wave 13:

| Variável/Cor azul antiga | Substituto Verde | Uso |
|--------------------------|-----------------|-----|
| `--lp-blue-50: #eff6ff` | `#e6f4f1` | Fundos muito claros |
| `--lp-blue-100: #dbeafe` | `#ccebe5` | Fundos claros, badge bg |
| `--lp-blue-200: #bfdbfe` | `#99d7cc` | Borders leves |
| `--lp-blue-500: #3b82f6` | `#008577` | Ícones, destaques médios |
| `--lp-blue-600: #2563eb` | `#006a5e` | Verde Saúde principal |
| `--lp-blue-700: #1d4ed8` | `#004d45` | Verde Saúde escuro (hover) |
| `--lp-sky-500: #0ea5e9` | `#008577` | Variante teal |
| `rgba(37, 99, 235, 0.1)` | `rgba(0, 106, 94, 0.1)` | Glows sutis |
| `rgba(59, 130, 246, 0.2)` | `rgba(0, 106, 94, 0.2)` | Shadows/rings |
| `rgba(191, 219, 254, 0.9)` | `rgba(156, 241, 225, 0.4)` | Box shadow da CTA |
| `#dbeafe` (copy inline) | `#ccebe5` | Texto inline blue-100 |
| `#bfdbfe` (copy inline) | `#99d7cc` | Texto inline blue-200 |
| `#60a5fa` (lp-text-blue-light) | `#4db8aa` | Texto claro em dark bg |
| `#93c5fd` (lp-pill--dark text) | `#67d5c7` | Pill text em dark section |
| `1e40af` (info-card title) | `#003d35` | Dark green title |
| `color: var(--lp-blue-600)` em info-card | `color: #006a5e` | Info card text |

**Nota especial:** O `--lp-emerald-*` e o Telegram blue (`#0088cc`) **NÃO são alterados** — o emerald já é verde e o Telegram é cor de marca obrigatória.

---

## Sprint 13.1 — Promoção da Landing: A/B → Definitivo + Verde Saúde

**Prioridade:** 1ª
**Arquivos modificados:**
- `src/views/Landing.jsx`
- `src/views/LandingPrototype.css`

**Arquivos a remover (imports do Landing.jsx):**
- `import './Landing.css'` — removido (era usado apenas por LandingControl)

**NÃO remover agora:**
- `src/views/Landing.css` — deixar o arquivo existir; será deletado em W16 (Cleanup). Apenas remover o import.

### 13.1.1 — Landing.jsx: Simplificação do A/B Test

**Transformação:** Remover toda infraestrutura de A/B test. `Landing` passa a renderizar `LandingVariantNew` diretamente.

**Funções/componentes a REMOVER do arquivo:**
1. `resolveLandingVariant()` — função de detecção do variant
2. `buildVariantHref()` — função de URL manipulation
3. `LandingDevSwitcher` — componente de dev switcher
4. `LandingControl` — componente da variante control (inteiro, incluindo JSX)
5. `import { useRef }` — era usado apenas por LandingControl (verificar se não usado em mais lugares)
6. `import { useTheme }` — era usado apenas por LandingControl para forçar dark mode (verificar)
7. `import { useMemo }` — era usado para `useMemo(() => resolveLandingVariant(), [])` (verificar)
8. `import './Landing.css'` — era o CSS do LandingControl

**Imports a MANTER:**
- `import React from 'react'` — necessário para JSX
- `import './LandingPrototype.css'` — CSS do variant new (o que fica)
- Todos os ícones SVG (PrototypeIcon, HeartPulseIcon, ZapIcon, etc.) — são usados em LandingVariantNew
- `LandingVariantNew` — fica (pode ser renomeado para `LandingContent` ou mantido)

**Resultado de Landing.jsx após simplificação:**

```jsx
import React from 'react'
import './LandingPrototype.css'

// [Todos os ícones SVG: PrototypeIcon, HeartPulseIcon, ZapIcon, ArrowRightIcon,
//  DatabaseIcon, LockIcon, BellIcon, PackageIcon, CalendarIcon, ShieldCheckIcon,
//  MessageCircleIcon, FileTextIcon, ActivityIcon, SmartphoneIcon, ClockIcon,
//  CircleIcon, DownloadIcon, CircleCheckIcon — todos mantidos sem alteração]

function LandingVariantNew({ isAuthenticated, onOpenAuth, onContinue }) {
  // [JSX completo — SEM nenhuma alteração]
}

export default function Landing({
  isAuthenticated = false,
  onOpenAuth = () => {},
  onContinue = () => {},
}) {
  return (
    <LandingVariantNew
      isAuthenticated={isAuthenticated}
      onOpenAuth={onOpenAuth}
      onContinue={onContinue}
    />
  )
}
```

**REGRA ABSOLUTA:** NÃO alterar o JSX de `LandingVariantNew`. Não adicionar nada, não remover nada, não reorganizar nada. O HTML/JSX é o vencedor do A/B test — apenas as cores mudam, e isso via CSS.

### 13.1.2 — LandingPrototype.css: Verde Terapêutico

**Estratégia:** Substituir variáveis `--lp-blue-*` por `--lp-green-*`, depois atualizar todas as referências no arquivo.

**Passo 1: Atualizar o bloco de variáveis CSS no topo do arquivo (`.landing-prototype-root`):**

```css
/* ANTES */
.landing-prototype-root {
  --lp-blue-50: #eff6ff;
  --lp-blue-100: #dbeafe;
  --lp-blue-200: #bfdbfe;
  --lp-blue-500: #3b82f6;
  --lp-blue-600: #2563eb;
  --lp-blue-700: #1d4ed8;
  /* ...sky-500 etc... */
}

/* DEPOIS — substituir o bloco COMPLETO */
.landing-prototype-root {
  /* === VERDE TERAPÊUTICO (substituiu azuis Tailwind) === */
  --lp-green-50: #e6f4f1;
  --lp-green-100: #ccebe5;
  --lp-green-200: #99d7cc;
  --lp-green-500: #008577;
  --lp-green-600: #006a5e;
  --lp-green-700: #004d45;

  /* === MANTIDOS (eram emerald, slate, etc.) === */
  --lp-emerald-50: #ecfdf5;
  --lp-emerald-100: #d1fae5;
  --lp-emerald-600: #059669;
  --lp-emerald-700: #047857;
  --lp-orange-100: #ffedd5;
  --lp-orange-700: #c2410c;
  --lp-purple-100: #f3e8ff;
  --lp-purple-700: #7e22ce;
  --lp-red-500: #ef4444;
  --lp-red-600: #dc2626;
  --lp-sky-500: #008577;        /* sky → teal terapêutico */
  --lp-slate-50: #f8fafc;
  --lp-slate-100: #f1f5f9;
  --lp-slate-200: #e2e8f0;
  --lp-slate-300: #cbd5e1;
  --lp-slate-400: #94a3b8;
  --lp-slate-500: #64748b;
  --lp-slate-600: #475569;
  --lp-slate-700: #334155;
  --lp-slate-800: #1e293b;
  --lp-slate-900: #0f172a;
  --lp-white: #fff;
  color: var(--lp-slate-900);
}
```

**Passo 2: Substituições em todo o arquivo (busca e replace):**

Execute estas substituições em ordem (da mais específica para a mais genérica):

| Busca | Substitui por |
|-------|--------------|
| `var(--lp-blue-50)` | `var(--lp-green-50)` |
| `var(--lp-blue-100)` | `var(--lp-green-100)` |
| `var(--lp-blue-200)` | `var(--lp-green-200)` |
| `var(--lp-blue-500)` | `var(--lp-green-500)` |
| `var(--lp-blue-600)` | `var(--lp-green-600)` |
| `var(--lp-blue-700)` | `var(--lp-green-700)` |
| `rgba(37, 99, 235, 0.1)` | `rgba(0, 106, 94, 0.1)` |
| `rgba(59, 130, 246, 0.2)` | `rgba(0, 106, 94, 0.2)` |
| `rgba(191, 219, 254, 0.95)` | `rgba(156, 241, 225, 0.4)` |
| `rgba(191, 219, 254, 0.9)` | `rgba(156, 241, 225, 0.35)` |
| `rgba(191, 219, 254, 0.98)` | `rgba(156, 241, 225, 0.45)` |
| `#dbeafe` | `#ccebe5` |
| `#bfdbfe` | `#99d7cc` |
| `#60a5fa` | `#4db8aa` |
| `#93c5fd` | `#67d5c7` |
| `1e40af` | `003d35` |
| `color: var(--lp-blue-600)` (em `.lp-info-card__text`) | `color: #006a5e` |

**Passo 3: Atualizar tipografia em `.lp-page`:**

```css
/* ANTES */
.lp-page {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  /* ... */
}

/* DEPOIS */
.lp-page {
  font-family: var(--font-body, 'Lexend', ui-sans-serif, system-ui, sans-serif);
  /* ... */
}
```

**Passo 4: Renomear classe `.lp-hero__orb--blue` (apenas no CSS):**

A classe no JSX continua como `lp-hero__orb--blue` — NÃO modificar o JSX. Apenas mudar o seletor no CSS para refletir a nova cor (ou simplesmente deixar o nome mas atualizar a `background` color, o que já acontece via substituição acima de `rgba(239, 246, 255, 0.5)` → não tem essa cor no verde... Na verdade `.lp-hero__orb--blue` usa `background: rgba(239, 246, 255, 0.5)` que é `#eff6ff` (blue-50 level). Após substituição das vars, isso fica verde.

Na verdade, o CSS é:
```css
.lp-hero__orb--blue {
  top: -96px;
  right: -96px;
  background: rgba(239, 246, 255, 0.5);  /* blue-50 */
}
```

Adicionar esta substituição:

| Busca | Substitui por |
|-------|--------------|
| `background: rgba(239, 246, 255, 0.5)` | `background: rgba(230, 244, 241, 0.5)` |

**Passo 5: Atualizar a tipografia do heading `.lp-hero h1` e seções:**

```css
/* ANTES */
.lp-hero h1,
.lp-section h2,
.lp-section--dark h2,
.lp-final-cta h2 {
  /* ... */
  color: var(--lp-slate-900);
}

/* DEPOIS — adicionar font-family */
.lp-hero h1,
.lp-section h2,
.lp-section--dark h2,
.lp-final-cta h2 {
  /* ... */
  color: var(--lp-slate-900);
  font-family: var(--font-heading, 'Public Sans', ui-sans-serif, sans-serif);
}
```

**Verificação visual esperada após Sprint 13.1:**
- Header: brand mark verde (`#006a5e`) em vez de azul
- Botão "Instalar App" / "Começar Agora": verde gradient em vez de azul
- Hero h1: `no seu bolso.` em verde em vez de azul
- Final CTA section: fundo verde (`#006a5e`) em vez de azul
- Prova social icons: verde em vez de azul
- Info card: fundo verde claro em vez de azul claro
- Todos os badges `lp-badge--blue`: verde em vez de azul

### Checklist Sprint 13.1

- [ ] `Landing.jsx`: funções removidas (`resolveLandingVariant`, `buildVariantHref`, `LandingDevSwitcher`)
- [ ] `Landing.jsx`: componente `LandingControl` completamente removido
- [ ] `Landing.jsx`: `import './Landing.css'` removido
- [ ] `Landing.jsx`: imports React limpos (sem `useMemo`, `useRef`, `useTheme` se não usados)
- [ ] `Landing.jsx`: default export renderiza `LandingVariantNew` diretamente
- [ ] `Landing.jsx`: JSX de `LandingVariantNew` **SEM nenhuma alteração**
- [ ] `LandingPrototype.css`: bloco de variáveis atualizado (`--lp-blue-*` → `--lp-green-*`)
- [ ] `LandingPrototype.css`: todas as 13 substituições da tabela aplicadas
- [ ] `LandingPrototype.css`: tipografia `.lp-page` usa `var(--font-body)`
- [ ] `LandingPrototype.css`: headings usam `var(--font-heading)`
- [ ] Visual: header brand mark está verde (não azul) no browser
- [ ] Visual: botão CTA principal está verde (não azul)
- [ ] Visual: seção final CTA tem fundo verde
- [ ] Visual: `?landingVariant=new` e sem param renderizam identicamente (A/B removido)
- [ ] ESLint 0 errors
- [ ] `npm run validate:agent` passa

---

## Sprint 13.2 — Auth Redesign

**Prioridade:** 2ª (pode rodar em paralelo com 13.1)
**Arquivos modificados:**
- `src/views/Auth.css` — reescrita completa
- `src/views/Auth.jsx` — remover `glass-card` do className

### 13.2.1 — Auth.jsx: Remover glass-card

**Localizar e modificar:**

```jsx
// ANTES (linha ~36 em Auth.jsx)
<div className="auth-card glass-card">

// DEPOIS
<div className="auth-card">
```

**Isso é a única mudança JSX.** Nenhuma outra alteração em Auth.jsx.

**Por quê:** `.glass-card` é uma classe do tema neon que adiciona `backdrop-filter: blur(...)`, `background: rgba(18,18,18,...)`, `border: 1px solid rgba(255,255,255,0.1)`. Com o redesign, Auth.css passa a definir esses estilos diretamente na `.auth-card`, sem depender de `.glass-card`.

### 13.2.2 — Auth.css: Reescrita Completa

**Design da tela:**
```
┌───── viewport ────────────────────────────────┐
│                                               │
│  Background: var(--color-surface-container-low) │
│  (verde muito claro, não branco puro)          │
│                                               │
│         ┌────────────────────────┐            │
│         │   [logo 80×80]         │            │
│         │   Bem-vindo de volta   │  ← heading │
│         │   Acesse sua agenda    │  ← subtitle│
│         │                       │            │
│         │  Email                │            │
│         │  [input sanctuary]    │            │
│         │                       │            │
│         │  Senha                │            │
│         │  [input sanctuary]    │            │
│         │                       │            │
│         │  [error/message]      │            │
│         │                       │            │
│         │  [  Entrar  ]         │  ← btn-primary │
│         │                       │            │
│         │  Não tem conta?       │            │
│         │  Cadastre-se          │  ← link verde   │
│         └────────────────────────┘            │
└───────────────────────────────────────────────┘
```

**CSS Completo (`Auth.css`):**

```css
/* ============================================
   Auth — Santuário Terapêutico
   ============================================ */

.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--color-surface-container-low, #f2f4f5);
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 2.5rem;
  background: var(--color-surface-container-lowest, #ffffff);
  border-radius: var(--radius-xl, 1rem);
  box-shadow: 0 4px 24px rgba(25, 28, 29, 0.06);
}

/* Header */
.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.logo-container {
  margin-bottom: 1.5rem;
}

.auth-logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  box-shadow: 0 4px 16px rgba(0, 106, 94, 0.15);
}

.auth-header h1 {
  font-family: var(--font-heading, 'Public Sans', sans-serif);
  font-size: var(--text-headline-md, 1.75rem);
  font-weight: 700;
  color: var(--color-on-surface, #191c1d);
  margin-bottom: 0.375rem;
  line-height: 1.2;
}

.auth-subtitle {
  font-family: var(--font-body, 'Lexend', sans-serif);
  color: var(--color-on-surface-variant, #3f484a);
  font-size: var(--text-body-md, 0.875rem);
}

/* Form */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-md, 0.875rem);
  font-weight: 500;
  color: var(--color-on-surface, #191c1d);
}

.auth-input {
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-lg, 1rem);
  background: var(--color-surface-container-low, #f2f4f5);
  border: 2px solid transparent;
  border-radius: var(--radius-input, 1rem);
  padding: 0.875rem 1rem;
  color: var(--color-on-surface, #191c1d);
  min-height: 56px;
  transition: border-color 0.2s ease, background 0.2s ease;
  outline: none;
  width: 100%;
}

.auth-input::placeholder {
  color: var(--color-on-surface-variant, #3f484a);
  opacity: 0.6;
}

.auth-input:hover {
  background: var(--color-surface-container, #eceeef);
}

.auth-input:focus {
  border-color: var(--color-primary, #006a5e);
  background: var(--color-surface-container-lowest, #ffffff);
}

/* Feedback */
.auth-error {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: rgba(186, 26, 26, 0.06);
  border-left: 4px solid var(--color-error, #ba1a1a);
  border-radius: var(--radius-md, 0.5rem);
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-md, 0.875rem);
  color: var(--color-error, #ba1a1a);
  line-height: 1.4;
}

.auth-message {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: rgba(16, 185, 129, 0.08);
  border-left: 4px solid var(--color-success, #10b981);
  border-radius: var(--radius-md, 0.5rem);
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-md, 0.875rem);
  color: #065f46;
  line-height: 1.4;
}

/* Submit Button */
.auth-submit-btn {
  margin-top: 0.5rem;
  width: 100%;
  min-height: 56px;
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-lg, 1rem);
  font-weight: 600;
  background: linear-gradient(135deg, var(--color-primary, #006a5e), #008577);
  color: var(--color-on-primary, #ffffff);
  border: none;
  border-radius: var(--radius-full, 999px);
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
  box-shadow: 0 2px 12px rgba(0, 106, 94, 0.2);
}

.auth-submit-btn:hover:not(:disabled) {
  box-shadow: 0 6px 20px rgba(0, 106, 94, 0.3);
  transform: translateY(-1px);
}

.auth-submit-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.auth-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Footer */
.auth-footer {
  margin-top: 1.5rem;
  text-align: center;
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-md, 0.875rem);
  color: var(--color-on-surface-variant, #3f484a);
}

.toggle-auth-btn {
  background: none;
  border: none;
  color: var(--color-primary, #006a5e);
  font-family: var(--font-body, 'Lexend', sans-serif);
  font-size: var(--text-body-md, 0.875rem);
  font-weight: 600;
  cursor: pointer;
  margin-left: 0.375rem;
  padding: 0;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.2s ease;
}

.toggle-auth-btn:hover {
  text-decoration-color: var(--color-primary, #006a5e);
}

/* Mobile */
@media (max-width: 480px) {
  .auth-card {
    padding: 2rem 1.5rem;
    box-shadow: none;
    background: transparent;
  }

  .auth-container {
    background: var(--color-surface-container-lowest, #ffffff);
    padding: 1.5rem 1rem;
  }
}
```

**Tokens que DESAPARECEM com esta reescrita:**
- `rgba(0, 240, 255, ...)` — neon cyan (toda a referência)
- `.glass-card` — classe neon
- `var(--accent-primary)` — neon cyan token
- `var(--accent-secondary)` — neon gradient
- `background: rgba(255,255,255,0.05)` — glass dark
- `border: 1px solid rgba(255,255,255,0.1)` — glass border
- `background: rgba(18,18,18,0.8)` — dark glass bg

### Checklist Sprint 13.2

- [ ] `Auth.jsx`: classe `glass-card` removida do `auth-card` div (única mudança JSX)
- [ ] `Auth.css`: reescrita completa — zero referências a neon/glass/cyan
- [ ] `.auth-input`: min-height 56px, border 2px transparent → primary on focus
- [ ] `.auth-submit-btn`: Verde Saúde gradient, border-radius full, min-height 56px
- [ ] `.auth-error`: left border vermelha, bg muito claro
- [ ] `.auth-message`: left border verde, bg muito claro
- [ ] `.toggle-auth-btn`: cor primária verde, sem underline por padrão
- [ ] Mobile: card sem shadow, bg transparente
- [ ] Testar: login com email/senha corretos → sucesso
- [ ] Testar: login com credenciais erradas → erro exibido com estilo sanctuary
- [ ] Testar: signup → mensagem de confirmação exibida
- [ ] Testar: toggle login/cadastro funciona
- [ ] Visual: zero elementos com cyan, zero elementos com dark glass background
- [ ] ESLint 0 errors

---

## Sprint 13.3 — Onboarding Wizard Shell + WelcomeStep

**Prioridade:** 3ª
**Arquivos modificados:**
- `src/shared/components/onboarding/OnboardingWizard.css`
- `src/shared/components/onboarding/WelcomeStep.css`

### Contexto crítico

O `OnboardingWizard` é um modal sobreposto à app, mostrado para novos usuários **logo após o primeiro login**. Neste momento, o design system Santuário JÁ está ativo (o usuário acabou de autenticar e `DashboardProvider` + `RedesignProvider` estão no root). O modal renderiza sobre a interface Santuário.

**IMPORTANTE:** Os forms dentro do onboarding (MedicineForm, ProtocolForm, StockForm) já herdam o redesign via `[data-redesign="true"]` quando o usuário tem `isRedesignEnabled=true`. Mas como novos usuários não têm o flag configurado, os forms ficam no visual antigo. Esta wave **não** resolve esse problema — ele será tratado em W15 (Accessibility & Polish) ou como parte da estratégia de rollout.

Esta sprint foca nos elementos visuais do **shell** do wizard que têm cores hardcoded azuis.

### 13.3.1 — OnboardingWizard.css: Falback azul → verde

**Todas as ocorrências a substituir:**

```css
/* OCORRÊNCIA 1 — Step ativo (linha ~95-100) */
/* ANTES */
.progress-step.active .step-number {
  background: var(--color-primary, #3b82f6);
  color: white;
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
}

/* DEPOIS */
.progress-step.active .step-number {
  background: var(--color-primary, #006a5e);
  color: white;
  transform: scale(1.1);
  box-shadow: 0 0 0 4px rgba(0, 106, 94, 0.2);
}

/* OCORRÊNCIA 2 — Step name ativo (linha ~115-118) */
/* ANTES */
.progress-step.active .step-name {
  color: var(--color-primary, #3b82f6);
  font-weight: 600;
}

/* DEPOIS */
.progress-step.active .step-name {
  color: var(--color-primary, #006a5e);
  font-weight: 600;
}
```

**Verificação:** Percorrer o arquivo inteiro procurando por `#3b82f6`, `#60a5fa`, `rgba(59, 130, 246`, `rgba(37, 99, 235` — substituir cada ocorrência pelo verde equivalente usando a tabela de mapeamento.

**O restante do OnboardingWizard.css está OK** — usa `var(--color-*)` tokens sem fallbacks azuis, ou usa `var(--color-success, #10b981)` para completed steps (verde OK).

### 13.3.2 — WelcomeStep.css: Blue → Verde Saúde

**Substituições a fazer:**

```css
/* OCORRÊNCIA 1 — benefit-icon background e color (linhas ~67-72) */
/* ANTES */
.benefit-icon {
  background: var(--color-primary-light, #dbeafe);
  color: var(--color-primary, #3b82f6);
  /* ... */
}

/* DEPOIS */
.benefit-icon {
  background: var(--color-secondary-fixed, #ccebe5);
  color: var(--color-primary, #006a5e);
  /* ... */
}

/* OCORRÊNCIA 2 — welcome-note gradient (linhas ~95-102) */
/* ANTES */
.welcome-note {
  background: linear-gradient(
    135deg,
    var(--color-primary-light, #dbeafe) 0%,
    var(--color-primary-lighter, #eff6ff) 100%
  );
  border-left: 4px solid var(--color-primary, #3b82f6);
}

/* DEPOIS */
.welcome-note {
  background: linear-gradient(
    135deg,
    #ccebe5 0%,
    #e6f4f1 100%
  );
  border-left: 4px solid var(--color-primary, #006a5e);
}

/* OCORRÊNCIA 3 — dark mode note background (linha ~181) */
/* ANTES */
.welcome-note {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
}

/* DEPOIS */
.welcome-note {
  background: linear-gradient(135deg, rgba(0, 106, 94, 0.15) 0%, rgba(0, 106, 94, 0.08) 100%);
}
```

**O restante de WelcomeStep.css está OK** — o ring animation e os demais estilos não têm cores azuis.

### Checklist Sprint 13.3

- [ ] `OnboardingWizard.css`: `.progress-step.active .step-number` usa green fallback
- [ ] `OnboardingWizard.css`: `.progress-step.active .step-name` usa green fallback
- [ ] `OnboardingWizard.css`: zero ocorrências de `#3b82f6` no arquivo
- [ ] `WelcomeStep.css`: `.benefit-icon` usa `var(--color-secondary-fixed, #ccebe5)` como background
- [ ] `WelcomeStep.css`: `.benefit-icon` usa `var(--color-primary, #006a5e)` como color
- [ ] `WelcomeStep.css`: `.welcome-note` usa green gradient e green left border
- [ ] `WelcomeStep.css`: dark mode section usa `rgba(0, 106, 94, ...)` em vez de azul
- [ ] Testar: abrir onboarding → indicadores de progresso estão verdes
- [ ] Testar: step completado → check verde (success, OK)
- [ ] Testar: WelcomeStep → benefit icons com fundo verde claro
- [ ] ESLint 0 errors

---

## Sprint 13.4 — Onboarding Steps: Limpeza de Cores Residuais

**Prioridade:** 4ª (pode rodar em paralelo com 13.3)
**Arquivos modificados:**
- `src/shared/components/onboarding/TelegramIntegrationStep.css`
- `src/shared/components/onboarding/FirstMedicineStep.css`
- `src/shared/components/onboarding/FirstProtocolStep.css`
- `src/shared/components/onboarding/StockStep.css`

### 13.4.1 — TelegramIntegrationStep.css

Este é o arquivo com mais atenção necessária. Há **dois tipos de cor** que coexistem:
1. **Azul Telegram** (`#0088cc`, `#00aaff`) — cor da marca Telegram, **DEVE SER MANTIDA**
2. **Neon residual** (`var(--neon-cyan)`, `#3b82f6`) — tokens do tema antigo, **DEVE SER REMOVIDA**

**Substituições obrigatórias:**

```css
/* OCORRÊNCIA 1 — benefit-icon-small color (linha ~48) */
/* ANTES */
.benefit-icon-small {
  background: linear-gradient(135deg, rgba(0, 136, 204, 0.15) 0%, rgba(0, 170, 255, 0.1) 100%);
  color: var(--neon-cyan);   /* ← NEON RESIDUAL */
  /* ... */
}

/* DEPOIS */
.benefit-icon-small {
  background: rgba(0, 136, 204, 0.12);   /* Telegram blue tint — OK, é brand */
  color: #0088cc;   /* Telegram brand color — OK */
  /* ... */
}

/* OCORRÊNCIA 2 — notification-title color (linha ~148) */
/* ANTES */
.notification-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--neon-cyan);   /* ← NEON RESIDUAL */
  margin-bottom: 2px;
}

/* DEPOIS */
.notification-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #0088cc;   /* Telegram brand color — OK */
  margin-bottom: 2px;
}

/* OCORRÊNCIA 3 — telegram-instructions strong (linha ~286) */
/* ANTES */
.telegram-instructions strong {
  color: var(--color-primary, #3b82f6);   /* ← fallback azul */
  font-weight: 600;
}

/* DEPOIS */
.telegram-instructions strong {
  color: var(--color-primary, #006a5e);   /* ← fallback verde */
  font-weight: 600;
}
```

**O que NÃO alterar em TelegramIntegrationStep.css:**
- `.telegram-icon`: gradient `#0088cc → #00aaff` — mantém (brand)
- `.notification-icon`: gradient `#0088cc → #00aaff` — mantém (brand)
- `.btn-connect-telegram`: gradient `#0088cc → #00aaff` — mantém (brand)
- `.bot-link`: gradient `#0088cc → #00aaff` — mantém (brand)
- `.btn-connect-telegram:hover` box-shadow com `rgba(0, 136, 204, 0.4)` — mantém (brand)
- `.bot-link:hover` box-shadow com `rgba(0, 136, 204, 0.4)` — mantém (brand)
- `.phone-mockup` dark gradient — é a tela de um "celular" na ilustração, não interfere
- `.phone-screen` dark gradient — mesmo motivo

**Verificação final:** Procurar por `var(--neon` no arquivo — deve resultar em ZERO ocorrências.

### 13.4.2 — FirstMedicineStep.css

Verificar o arquivo em busca de:
- Qualquer `var(--neon-*)` → substituir pelo equivalente sanctuary
- Qualquer `#3b82f6` ou `#2563eb` → substituir por `#006a5e`
- Qualquer `rgba(59, 130, 246, ...)` → substituir por `rgba(0, 106, 94, ...)`

**O arquivo tem apenas 80 linhas e é principalmente estrutural** (header, icon, title, description). Provavelmente não há cores problemáticas além de possíveis fallbacks. Verificar e corrigir o que encontrar.

**Exemplo do que deve mudar se houver:**
```css
/* Se encontrar */
.step-icon {
  background: var(--color-primary-light, #dbeafe);  /* ← azul */
  color: var(--color-primary, #3b82f6);              /* ← azul */
}

/* Corrigir para */
.step-icon {
  background: var(--color-secondary-fixed, #ccebe5); /* ← verde */
  color: var(--color-primary, #006a5e);               /* ← verde */
}
```

### 13.4.3 — FirstProtocolStep.css

Mesma estratégia do 13.4.2. O arquivo tem ~107 linhas. Verificar e corrigir:
- `var(--neon-*)` → equivalente sanctuary
- `#3b82f6`, `#2563eb` → `#006a5e`
- `rgba(59, 130, 246, ...)` → `rgba(0, 106, 94, ...)`

**Atenção especial:** FirstProtocolStep.css pode ter um estado de erro (quando nenhum medicamento foi cadastrado). Verificar se há `var(--neon-cyan)` ou cores azuis no error state.

### 13.4.4 — StockStep.css

O `StockStep` tem uma barra de preview de estoque (`.stock-preview-bar` ou similar). Verificar:
- Barra de preenchimento: se usa azul → mudar para verde
- Se tem algum `var(--neon-*)` → remover
- Qualquer cor azul hardcoded → verde

**Exemplo específico para a barra de estoque** (se existir):
```css
/* Se encontrar */
.stock-fill {
  background: linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta));
}

/* Corrigir para */
.stock-fill {
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-container));
}
```

### Checklist Sprint 13.4

- [ ] `TelegramIntegrationStep.css`: zero `var(--neon-cyan)` — buscar e confirmar
- [ ] `TelegramIntegrationStep.css`: `.benefit-icon-small` usa `#0088cc` (Telegram brand OK)
- [ ] `TelegramIntegrationStep.css`: `.notification-title` usa `#0088cc` (Telegram brand OK)
- [ ] `TelegramIntegrationStep.css`: `.telegram-instructions strong` usa fallback verde
- [ ] `TelegramIntegrationStep.css`: botões Telegram (#0088cc→#00aaff) NÃO foram alterados
- [ ] `FirstMedicineStep.css`: zero `var(--neon-*)` e zero `#3b82f6`
- [ ] `FirstProtocolStep.css`: zero `var(--neon-*)` e zero `#3b82f6`
- [ ] `StockStep.css`: zero `var(--neon-*)` e zero `#3b82f6`
- [ ] Testar: percorrer os 5 steps do onboarding — visual sem elementos neon
- [ ] Testar: Step Telegram → botões permanecem azuis Telegram (brand)
- [ ] Testar: FirstMedicineStep → formulário abre corretamente
- [ ] Testar: StockStep → barra de preview visual
- [ ] `npm run validate:agent` passa

---

## Resumo de Arquivos

### Arquivos MODIFICADOS (10 total)

| Arquivo | Sprint | Tipo de mudança | Risco |
|---------|--------|-----------------|-------|
| `src/views/Landing.jsx` | 13.1 | Remoção A/B test, simplificação | MÉDIO — arquivo com 11k tokens |
| `src/views/LandingPrototype.css` | 13.1 | Substituição de variáveis CSS (blue→green) | BAIXO — busca/replace |
| `src/views/Auth.jsx` | 13.2 | Remover `glass-card` de 1 className | MUITO BAIXO |
| `src/views/Auth.css` | 13.2 | Reescrita completa | BAIXO — isolado em 148 linhas |
| `src/shared/components/onboarding/OnboardingWizard.css` | 13.3 | 2 ocorrências de blue fallback | MUITO BAIXO |
| `src/shared/components/onboarding/WelcomeStep.css` | 13.3 | 3 substituições de cor | MUITO BAIXO |
| `src/shared/components/onboarding/TelegramIntegrationStep.css` | 13.4 | 3 substituições (neon→brand) | BAIXO |
| `src/shared/components/onboarding/FirstMedicineStep.css` | 13.4 | Verificar e corrigir | MUITO BAIXO |
| `src/shared/components/onboarding/FirstProtocolStep.css` | 13.4 | Verificar e corrigir | MUITO BAIXO |
| `src/shared/components/onboarding/StockStep.css` | 13.4 | Verificar e corrigir | MUITO BAIXO |

### Arquivos CRIADOS: NENHUM

### Arquivos a ter import REMOVIDO (mas NÃO deletados — W16)

| Arquivo | Import removido | Motivo |
|---------|----------------|--------|
| `src/views/Landing.jsx` | `import './Landing.css'` | LandingControl removido; arquivo existirá até W16 |

### Arquivos NUNCA TOCADOS

- `src/App.jsx` — nenhuma mudança de routing (Landing/Auth não usam feature flag)
- `src/shared/components/onboarding/OnboardingWizard.jsx` — lógica intacta
- `src/shared/components/onboarding/WelcomeStep.jsx` — apenas CSS
- `src/shared/components/onboarding/FirstMedicineStep.jsx` — apenas CSS
- `src/shared/components/onboarding/FirstProtocolStep.jsx` — apenas CSS
- `src/shared/components/onboarding/StockStep.jsx` — apenas CSS
- `src/shared/components/onboarding/TelegramIntegrationStep.jsx` — apenas CSS
- `src/views/Auth.jsx` — exceto 1 className change
- `src/views/Landing.css` — deixar existir (cleanup em W16)
- Qualquer service, hook, schema, ou componente de feature

---

## Ordem de Execução

```
Sprint 13.1 (Landing: promoção + verde)   Sprint 13.2 (Auth: reescrita)
        ↓                                          ↓
Sprint 13.3 (Onboarding shell)            Sprint 13.4 (Steps: limpeza)
        ↓
[Merge → main]
```

**Sprints 13.1 e 13.2 são completamente independentes** — podem rodar em paralelo.
**Sprints 13.3 e 13.4 são completamente independentes** — podem rodar em paralelo.

---

## Riscos e Mitigações

| Risco | Prob. | Impacto | Mitigação |
|-------|-------|---------|-----------|
| Landing.jsx tem 11k tokens — agente pode truncar ao ler | MÉDIO | ALTO | Ler em partes (`offset`/`limit`). Remover LandingControl requer leitura precisa das linhas. Identificar linha exata de início e fim da função antes de deletar. |
| `LandingControl` usa `useRef` e `useTheme` — se LandingVariantNew também os usar, remover causaria bug | BAIXO | ALTO | **VERIFICAR** se `useRef` e `useTheme` são usados em `LandingVariantNew` antes de remover os imports. Se usados, manter. |
| Substituição de cor em LandingPrototype.css deixa cor residual | BAIXO | MÉDIO | Após todas as substituições, fazer busca por `blue-`, `#3b82`, `#2563`, `rgba(59, 130` — deve resultar em zero matches (exceto no bloco de variáveis se mantiver nomes antigos para compatibilidade). |
| Auth.css usa `.glass-card` indiretamente via `auth-card.glass-card` | BAIXO | BAIXO | Removida a classe do JSX, `glass-card` não afeta mais `.auth-card`. |
| Telegram brand blue confundido com "azul para remover" | MÉDIO | BAIXO | A regra é clara: `#0088cc` e `#00aaff` são Telegram brand — MANTER. Só remover `var(--neon-*)` e `#3b82f6`. |
| Onboarding não herda `[data-redesign="true"]` para novos usuários | ALTO | MÉDIO | Fora do escopo desta wave. Os forms (MedicineForm etc.) dentro do onboarding ficam com visual old para novos usuários. Será endereçado em W15 como parte da estratégia de rollout. |

---

## Critérios de Conclusão Wave 13

- [ ] Landing page renderiza apenas a variante new (A/B removido)
- [ ] Landing: zero elementos com cores azuis Tailwind visíveis
- [ ] Landing: CTAs, header, brand mark e final CTA em Verde Saúde
- [ ] Auth: zero elementos com neon cyan visíveis
- [ ] Auth: formulário com visual sanctuary (surface-container-low, 56px inputs, green focus)
- [ ] Onboarding: progress indicator em verde (step ativo)
- [ ] Onboarding: benefit icons do WelcomeStep em verde
- [ ] TelegramIntegrationStep: zero `var(--neon-cyan)`, Telegram blue preservado
- [ ] `npm run validate:agent` passa
- [ ] ESLint 0 errors em todos os arquivos modificados
