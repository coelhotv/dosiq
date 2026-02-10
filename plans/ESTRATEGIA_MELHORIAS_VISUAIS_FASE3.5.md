# Estratégia de Melhorias Visuais - Fase 3.5

## Contexto

O refactoring da arquitetura CSS implementado na Fase 3 introduziu um sistema robusto de tokens baseados em CSS Custom Properties. No entanto, a experiência do usuário foi negativamente impactada, resultando em uma interface excessivamente quadrada, monótona e com pouca hierarquia visual.

Este documento propõe uma estratégia para reintroduzir interesse visual — variando border-radius, utilizando profundidade e sombras, refinando espaçamento e contraste — mantendo estritamente a arquitetura de tokens existente.

---

## Priorização das Melhorias

### 🔴 P0 - CRÍTICO (Impacto Imediato)

#### 1. Variação de Border-Radius por Tipo de Componente

**Problema Atual:**
Todos os componentes usam `var(--radius-lg)` (0.5rem), criando uniformidade excessiva.

**Solução Proposta:**
Criar tokens específicos para diferentes tipos de componentes, permitindo variação intencional de border-radius.

```css
/* Adicionar em src/styles/tokens/borders.css */

/* ============================================
   COMPONENT-SPECIFIC BORDER RADIUS
   ============================================ */
:root {
  /* Hero / Featured Cards - Mais arredondados */
  --radius-hero: 1.5rem;        /* 24px */
  --radius-card-xl: 1.25rem;     /* 20px */
  
  /* Standard Cards - Moderadamente arredondados */
  --radius-card-lg: 1rem;        /* 16px */
  --radius-card-md: 0.75rem;     /* 12px */
  
  /* Small Elements - Levemente arredondados */
  --radius-card-sm: 0.5rem;     /* 8px */
  --radius-pill: 9999px;         /* Pill shape */
  
  /* Inputs / Form Elements - Consistentes */
  --radius-input: 0.5rem;       /* 8px */
  --radius-button: 0.5rem;      /* 8px */
  
  /* Circular Elements */
  --radius-circle: 50%;
  --radius-avatar: 50%;
}
```

**Aplicação por Componente:**

```text
┌───────────────────────────────────────────────────────────┐
│ MAPEAMENTO DE BORDER-RADIUS POR COMPONENTE                │
├───────────────────────────────────────────────────────────┤
│ Componente              │ Token Usado          │ Valor    │
├───────────────────────────────────────────────────────────┤
│ Health Score Card       │ --radius-card-xl     │ 20px     │
│ Smart Alerts            │ --radius-card-md     │ 12px     │
│ Treatment Accordion     │ --radius-card-lg     │ 16px     │
│ Insight Cards           │ --radius-card-lg     │ 16px     │
│ Quick Actions           │ --radius-card-sm     │ 8px      │
│ Swipe Items             │ --radius-card-sm     │ 8px      │
│ Buttons                 │ --radius-button      │ 8px      │
│ Inputs                  │ --radius-input       │ 8px      │
│ Badges / Pills          │ --radius-pill        │ 9999px   │
│ Avatars                 │ --radius-avatar      │ 50%      │
└───────────────────────────────────────────────────────────┘
```

**Exemplo de Implementação - SmartAlerts.css:**

```css
/* Antes */
.smart-alert {
  border-radius: var(--radius-lg);  /* 0.5rem - muito pequeno */
}

/* Depois */
.smart-alert {
  border-radius: var(--radius-card-md);  /* 12px - mais equilibrado */
}

.smart-alert--critical {
  border-radius: var(--radius-card-md);
  border-left: 4px solid var(--neon-pink);
  box-shadow: 0 0 15px rgba(255, 62, 62, 0.1);
}
```

**Exemplo de Implementação - HealthScoreCard.css:**

```css
/* Antes */
.health-score-card {
  border-radius: var(--radius-lg);  /* 0.5rem */
}

/* Depois */
.health-score-card {
  border-radius: var(--radius-card-xl);  /* 20px - mais destacado */
}
```

---

#### 2. Sistema de Sombras em Camadas (Layered Shadows)

**Problema Atual:**
Sombras são sutis demais e não criam profundidade suficiente. Componentes parecem "achatados".

**Solução Proposta:**
Implementar sombras em camadas com diferentes intensidades para criar hierarquia visual clara.

```css
/* Adicionar em src/styles/tokens/shadows.css */

/* ============================================
   LAYERED SHADOWS - Para profundidade visual
   ============================================ */
:root {
  /* Camada 1: Base - Sutil */
  --shadow-layer-1: 
    0 1px 2px rgba(0, 0, 0, 0.05),
    0 1px 3px rgba(0, 0, 0, 0.03);
  
  /* Camada 2: Elevação - Moderada */
  --shadow-layer-2: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.02);
  
  /* Camada 3: Destaque - Pronunciada */
  --shadow-layer-3: 
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05),
    0 0 0 1px rgba(0, 0, 0, 0.03);
  
  /* Camada 4: Flutuante - Intensa */
  --shadow-layer-4: 
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  
  /* Camada 5: Hero - Máxima profundidade */
  --shadow-layer-5: 
    0 25px 50px -12px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(0, 0, 0, 0.05);
}

/* ============================================
   COMPONENT-SPECIFIC SHADOWS
   ============================================ */
:root {
  /* Cards padrão */
  --shadow-card: var(--shadow-layer-2);
  --shadow-card-hover: var(--shadow-layer-3);
  
  /* Hero / Featured */
  --shadow-hero: var(--shadow-layer-4);
  --shadow-hero-hover: var(--shadow-layer-5);
  
  /* Alerts */
  --shadow-alert: var(--shadow-layer-2);
  --shadow-alert-critical: 
    0 0 15px rgba(255, 62, 62, 0.15),
    var(--shadow-layer-2);
  
  /* Buttons */
  --shadow-button: var(--shadow-layer-1);
  --shadow-button-hover: var(--shadow-layer-2);
  --shadow-button-active: var(--shadow-inner);
  
  /* Floating elements */
  --shadow-float: var(--shadow-layer-3);
  --shadow-float-hover: var(--shadow-layer-4);
}

/* ============================================
   DARK MODE SHADOWS
   ============================================ */
[data-theme="dark"] {
  --shadow-layer-1: 
    0 1px 2px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(0, 0, 0, 0.2);
  
  --shadow-layer-2: 
    0 4px 6px -1px rgba(0, 0, 0, 0.5),
    0 2px 4px -1px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.02);
  
  --shadow-layer-3: 
    0 10px 15px -3px rgba(0, 0, 0, 0.5),
    0 4px 6px -2px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.03);
  
  --shadow-layer-4: 
    0 20px 25px -5px rgba(0, 0, 0, 0.5),
    0 10px 10px -5px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.04);
  
  --shadow-layer-5: 
    0 25px 50px -12px rgba(0, 0, 0, 0.6),
    0 0 0 1px rgba(255, 255, 255, 0.05);
  
  --shadow-alert-critical: 
    0 0 20px rgba(255, 62, 62, 0.25),
    var(--shadow-layer-2);
}
```

**Visualização ASCII - Hierarquia de Sombras:**

```text
┌─────────────────────────────────────────────────────────┐
│ HIERARQUIA VISUAL DE SOMBRAS                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Camada 1 (Base)                                        │
│  ┌─────────────┐                                        │
│  │  Componente │  ← Sutil, quase imperceptível          │
│  └─────────────┘                                        │
│                                                         │
│  Camada 2 (Elevação)                                    │
│  ┌─────────────┐                                        │
│  │  Componente │  ← Moderada, define separação          │
│  └─────────────┘                                        │
│                                                         │
│  Camada 3 (Destaque)                                    │
│  ┌─────────────┐                                        │
│  │  Componente │  ← Pronunciada, chama atenção          │
│  └─────────────┘                                        │
│                                                         │
│  Camada 4 (Flutuante)                                   │
│  ┌─────────────┐                                        │
│  │  Componente │  ← Intensa, parece flutuar             │
│  └─────────────┘                                        │
│                                                         │
│  Camada 5 (Hero)                                        │
│  ┌─────────────┐                                        │
│  │  Componente │  ← Máxima, elemento principal          │
│  └─────────────┘                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Exemplo de Implementação - Dashboard.module.css:**

```css
/* Hero Section - Destaque máximo */
.heroSection {
  border-radius: var(--radius-hero);
  box-shadow: var(--shadow-hero);
  transition: box-shadow var(--transition-normal);
}

.heroSection:hover {
  box-shadow: var(--shadow-hero-hover);
}

/* Cards padrão - Elevação moderada */
.card {
  border-radius: var(--radius-card-lg);
  box-shadow: var(--shadow-card);
  transition: box-shadow var(--transition-normal);
}

.card:hover {
  box-shadow: var(--shadow-card-hover);
}

/* Smart Alerts - Sombras específicas */
.smart-alert {
  border-radius: var(--radius-card-md);
  box-shadow: var(--shadow-alert);
}

.smart-alert--critical {
  box-shadow: var(--shadow-alert-critical);
}
```

---

#### 3. Espaçamento Hierárquico (Spacing Hierarchy)

**Problema Atual:**
Espaçamento é consistente mas não cria hierarquia visual clara. Seções não se destacam suficientemente.

**Solução Proposta:**
Criar tokens de espaçamento específicos para diferentes níveis de hierarquia.

```css
/* Adicionar em src/styles/tokens/spacing.css */

/* ============================================
   HIERARCHICAL SPACING
   ============================================ */
:root {
  /* Espaçamento entre seções principais */
  --spacing-section-hero: var(--space-8);      /* 32px */
  --spacing-section-major: var(--space-6);     /* 24px */
  --spacing-section-minor: var(--space-4);     /* 16px */
  --spacing-section-tight: var(--space-3);      /* 12px */
  
  /* Espaçamento interno de componentes */
  --spacing-component-loose: var(--space-6);    /* 24px */
  --spacing-component-normal: var(--space-4);   /* 16px */
  --spacing-component-compact: var(--space-3);  /* 12px */
  --spacing-component-tight: var(--space-2);    /* 8px */
  
  /* Espaçamento entre itens de lista */
  --spacing-list-loose: var(--space-4);         /* 16px */
  --spacing-list-normal: var(--space-3);        /* 12px */
  --spacing-list-compact: var(--space-2);       /* 8px */
  
  /* Espaçamento de elementos relacionados */
  --spacing-related: var(--space-2);            /* 8px */
  --spacing-related-tight: var(--space-1);      /* 4px */
}
```

**Visualização ASCII - Hierarquia de Espaçamento:**

```text
┌─────────────────────────────────────────────────────────────┐
│ DASHBOARD - HIERARQUIA DE ESPAÇAMENTO                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [HEADER]                                                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ HERO SECTION (Health Score)                          │   │
│  │ Espaçamento interno: --spacing-component-loose       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ↓ --spacing-section-major (24px)                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ SMART ALERTS                                         │   │
│  │ Espaçamento entre alerts: --spacing-list-normal      │   │
│  │                                                      │   │
│  │ ┌─────────────────────────────────────────────────┐  │   │
│  │ │ Alert 1 (Critical)                              │  │   │
│  │ │ Espaçamento interno: --spacing-component-compact│  |   │
│  │ └─────────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │ ↓ --spacing-list-normal (12px)                       │   │
│  │                                                      │   │
│  │ ┌─────────────────────────────────────────────────┐  │   │
│  │ │ Alert 2 (Warning)                               │  │   │
│  │ └─────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ↓ --spacing-section-major (24px)                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ TREATMENT PLANS                                      │   │
│  │ Espaçamento entre cards: --spacing-list-loose        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Exemplo de Implementação - Dashboard.module.css:**

```css
/* Antes */
.container {
  gap: var(--space-6);  /* Uniforme para tudo */
}

.section {
  gap: var(--space-4);  /* Uniforme para tudo */
}

/* Depois */
.container {
  gap: var(--spacing-section-major);  /* 24px entre seções principais */
}

.section {
  gap: var(--spacing-component-normal);  /* 16px dentro de seções */
}

/* Hero Section - Mais espaçoso */
.heroSection {
  padding: var(--spacing-component-loose);  /* 24px */
}

/* Smart Alerts - Mais compacto */
.smart-alerts {
  gap: var(--spacing-list-normal);  /* 12px entre alerts */
}

.smart-alert {
  padding: var(--spacing-component-compact);  /* 12px interno */
}

/* Treatment Cards - Moderado */
.plansList {
  gap: var(--spacing-list-loose);  /* 16px entre cards */
}
```

---

### 🟡 P1 - ALTO (Impacto Significativo)

#### 4. Gradientes e Glassmorphism Refinados

**Problema Atual:**
Glassmorphism é aplicado uniformemente sem variação de intensidade.

**Solução Proposta:**
Criar tokens para diferentes níveis de glassmorphism e gradientes.

```css
/* Adicionar em src/styles/tokens/colors.css */

/* ============================================
   GLASSMORPHISM LEVELS
   ============================================ */
:root {
  /* Glass leve - Para elementos secundários */
  --glass-bg-light: rgba(255, 255, 255, 0.03);
  --glass-border-light: rgba(255, 255, 255, 0.05);
  --glass-blur-light: blur(8px);
  
  /* Glass padrão - Para cards comuns */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: blur(12px);
  
  /* Glass intenso - Para elementos destacados */
  --glass-bg-heavy: rgba(255, 255, 255, 0.08);
  --glass-border-heavy: rgba(255, 255, 255, 0.15);
  --glass-blur-heavy: blur(16px);
  
  /* Glass hero - Para seções principais */
  --glass-bg-hero: rgba(255, 255, 255, 0.1);
  --glass-border-hero: rgba(255, 255, 255, 0.2);
  --glass-blur-hero: blur(20px);
}

/* ============================================
   GRADIENT BACKGROUNDS
   ============================================ */
:root {
  /* Gradiente sutil - Para cards de insight */
  --gradient-insight: linear-gradient(
    135deg,
    rgba(6, 182, 212, 0.1) 0%,
    rgba(176, 0, 255, 0.1) 100%
  );
  
  /* Gradiente hero - Para seções principais */
  --gradient-hero: linear-gradient(
    135deg,
    rgba(236, 72, 153, 0.15) 0%,
    rgba(6, 182, 212, 0.15) 100%
  );
  
  /* Gradiente alert - Para alertas críticos */
  --gradient-alert-critical: linear-gradient(
    135deg,
    rgba(239, 68, 68, 0.1) 0%,
    rgba(239, 68, 68, 0.05) 100%
  );
  
  /* Gradiente success - Para elementos positivos */
  --gradient-success: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.1) 0%,
    rgba(16, 185, 129, 0.05) 100%
  );
}

/* ============================================
   DARK MODE GLASSMORPHISM
   ============================================ */
[data-theme="dark"] {
  --glass-bg-light: rgba(255, 255, 255, 0.02);
  --glass-border-light: rgba(255, 255, 255, 0.03);
  
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  
  --glass-bg-heavy: rgba(255, 255, 255, 0.08);
  --glass-border-heavy: rgba(255, 255, 255, 0.15);
  
  --glass-bg-hero: rgba(255, 255, 255, 0.1);
  --glass-border-hero: rgba(255, 255, 255, 0.2);
  
  --gradient-insight: linear-gradient(
    135deg,
    rgba(34, 211, 238, 0.15) 0%,
    rgba(232, 121, 249, 0.15) 100%
  );
  
  --gradient-hero: linear-gradient(
    135deg,
    rgba(244, 114, 182, 0.2) 0%,
    rgba(34, 211, 238, 0.2) 100%
  );
}
```

**Exemplo de Implementação - Insight Cards:**

```css
/* Criar novo componente: InsightCard.css */
.insight-card {
  background: var(--gradient-insight);
  border: 1px solid var(--glass-border-heavy);
  border-radius: var(--radius-card-lg);
  padding: var(--spacing-component-compact);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-card);
  transition: all var(--transition-normal);
}

.insight-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
  border-color: var(--neon-cyan);
}
```

**Exemplo de Implementação - Hero Section:**

```css
/* Dashboard.module.css */
.heroSection {
  background: var(--gradient-hero);
  border: 1px solid var(--glass-border-hero);
  border-radius: var(--radius-hero);
  padding: var(--spacing-component-loose);
  backdrop-filter: var(--glass-blur-hero);
  box-shadow: var(--shadow-hero);
}
```

---

#### 5. Contraste e Legibilidade Aprimorados

**Problema Atual:**
Contraste entre elementos secundários e fundo é insuficiente, dificultando a leitura.

**Solução Proposta:**
Refinar tokens de cor de texto e fundo para melhorar legibilidade.

```css
/* Adicionar em src/styles/tokens/colors.css */

/* ============================================
   TEXT COLORS - Refinados para legibilidade
   ============================================ */
:root {
  /* Texto primário - Alto contraste */
  --text-primary: #111827;
  --text-primary-dark: #000000;
  
  /* Texto secundário - Contraste médio */
  --text-secondary: #4b5563;
  --text-secondary-dark: #374151;
  
  /* Texto terciário - Baixo contraste (apenas para decorativo) */
  --text-tertiary: #9ca3af;
  --text-tertiary-dark: #6b7280;
  
  /* Texto em fundos coloridos */
  --text-on-primary: #ffffff;
  --text-on-secondary: #ffffff;
  --text-on-success: #ffffff;
  --text-on-warning: #000000;
  --text-on-error: #ffffff;
}

/* ============================================
   DARK MODE TEXT COLORS
   ============================================ */
[data-theme="dark"] {
  --text-primary: #f9fafb;
  --text-primary-dark: #ffffff;
  
  --text-secondary: #d1d5db;
  --text-secondary-dark: #e5e7eb;
  
  --text-tertiary: #9ca3af;
  --text-tertiary-dark: #6b7280;
}
```

**Exemplo de Implementação - SmartAlerts.css:**

```css
/* Antes */
.smart-alert__message {
  color: var(--text-secondary);  /* Pode ser muito claro */
}

/* Depois */
.smart-alert__message {
  color: var(--text-secondary-dark);  /* Mais escuro, melhor contraste */
}

.smart-alert__title {
  color: var(--text-primary-dark);  /* Máximo contraste */
}
```

---

#### 6. Micro-interações Visuais

**Problema Atual:**
Transições são básicas e não fornecem feedback visual satisfatório.

**Solução Proposta:**
Implementar micro-interações mais sofisticadas usando tokens existentes.

```css
/* Adicionar em src/styles/tokens/transitions.css */

/* ============================================
   MICRO-INTERACTION TRANSITIONS
   ============================================ */
:root {
  /* Hover suave */
  --transition-hover: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Focus visível */
  --transition-focus: all 0.15s ease-out;
  
  /* Active feedback */
  --transition-active: all 0.1s ease-in;
  
  /* Scale effect */
  --transition-scale: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  
  /* Glow effect */
  --transition-glow: box-shadow 0.3s ease-out;
}
```

**Exemplo de Implementação - Buttons:**

```css
.button {
  transition: var(--transition-hover);
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-button-hover);
}

.button:active {
  transform: translateY(0) scale(0.98);
  box-shadow: var(--shadow-button-active);
  transition: var(--transition-active);
}

.button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  transition: var(--transition-focus);
}
```

**Exemplo de Implementação - Cards:**

```css
.card {
  transition: var(--transition-hover);
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
  border-color: var(--neon-cyan);
}

.card:active {
  transform: translateY(-2px) scale(0.99);
  transition: var(--transition-active);
}
```

---

### 🟢 P2 - MÉDIO (Impacto Moderado)

#### 7. Bordas com Variação de Espessura

**Problema Atual:**
Todas as bordas têm 1px de espessura, sem variação visual.

**Solução Proposta:**
Usar diferentes espessuras de borda para criar hierarquia.

```css
/* Adicionar em src/styles/tokens/borders.css */

/* ============================================
   COMPONENT BORDER WIDTHS
   ============================================ */
:root {
  /* Bordas sutis - Para elementos secundários */
  --border-width-subtle: 1px;
  
  /* Bordas padrão - Para cards comuns */
  --border-width-default: 1px;
  
  /* Bordas destacadas - Para elementos importantes */
  --border-width-prominent: 2px;
  
  /* Bordas hero - Para seções principais */
  --border-width-hero: 2px;
}
```

**Exemplo de Implementação:**

```css
/* Elementos secundários */
.secondary-card {
  border: var(--border-width-subtle) solid var(--border-color);
}

/* Cards padrão */
.card {
  border: var(--border-width-default) solid var(--border-color);
}

/* Elementos destacados */
.featured-card {
  border: var(--border-width-prominent) solid var(--neon-cyan);
}

/* Hero section */
.heroSection {
  border: var(--border-width-hero) solid var(--glass-border-hero);
}
```

---

#### 8. Glow Effects Contextuais

**Problema Atual:**
Glow effects são aplicados uniformemente sem contexto.

**Solução Proposta:**
Usar glow effects apenas em elementos que precisam de destaque.

```css
/* Adicionar em src/styles/tokens/shadows.css */

/* ============================================
   CONTEXTUAL GLOW EFFECTS
   ============================================ */
:root {
  /* Glow para hover - Sutil */
  --glow-hover: 0 0 8px rgba(6, 182, 212, 0.3);
  
  /* Glow para focus - Visível */
  --glow-focus: 0 0 12px rgba(6, 182, 212, 0.5);
  
  /* Glow para active - Intenso */
  --glow-active: 0 0 16px rgba(6, 182, 212, 0.7);
  
  /* Glow para elementos críticos */
  --glow-critical: 0 0 20px rgba(239, 68, 68, 0.6);
  
  /* Glow para elementos de sucesso */
  --glow-success: 0 0 20px rgba(16, 185, 129, 0.6);
}
```

**Exemplo de Implementação:**

```css
/* Hover glow */
.card:hover {
  box-shadow: var(--shadow-card-hover), var(--glow-hover);
}

/* Focus glow */
.button:focus-visible {
  box-shadow: var(--glow-focus);
}

/* Critical alert glow */
.smart-alert--critical {
  box-shadow: var(--shadow-alert-critical), var(--glow-critical);
}
```

---

## Exemplos Visuais Completos

### Exemplo 1: Smart Alert Refinado

```css
/* SmartAlerts.css - Versão Refinada */
.smart-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-component-compact);
  padding: var(--spacing-component-compact);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: var(--border-width-default) solid var(--border-color);
  border-left: 4px solid var(--alert-color);
  border-radius: var(--radius-card-md);
  box-shadow: var(--shadow-alert);
  transition: var(--transition-hover);
}

.smart-alert:hover {
  box-shadow: var(--shadow-card-hover), var(--glow-hover);
  transform: translateY(-2px);
}

.smart-alert--critical {
  --alert-color: var(--neon-pink);
  box-shadow: var(--shadow-alert-critical);
}

.smart-alert--warning {
  --alert-color: var(--accent-warning);
}

.smart-alert--info {
  --alert-color: var(--neon-cyan);
}

.smart-alert__icon {
  font-size: var(--font-size-xl);
  flex-shrink: 0;
}

.smart-alert__content {
  flex: 1;
  min-width: 0;
}

.smart-alert__title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-primary-dark);
  line-height: 1.3;
}

.smart-alert__message {
  margin: var(--spacing-related-tight) 0 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary-dark);
  line-height: 1.4;
}

.smart-alert__actions {
  display: flex;
  gap: var(--spacing-related);
  margin-top: var(--spacing-component-tight);
}

.smart-alert__btn {
  padding: var(--spacing-component-tight) var(--spacing-component-normal);
  border-radius: var(--radius-button);
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  transition: var(--transition-hover);
  border: none;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.smart-alert__btn--primary {
  background: var(--alert-color);
  color: var(--text-on-primary);
  box-shadow: var(--shadow-button);
}

.smart-alert__btn--primary:hover {
  box-shadow: var(--shadow-button-hover), var(--glow-hover);
  transform: translateY(-1px);
}

.smart-alert__btn--secondary {
  background: transparent;
  border: var(--border-width-default) solid var(--border-color);
  color: var(--text-primary);
}

.smart-alert__btn--secondary:hover {
  background: var(--glass-bg-light);
  border-color: var(--text-secondary);
}
```

**Visualização ASCII:**

```text
┌─────────────────────────────────────────────────────────┐
│ SMART ALERT - VERSÃO REFINADA                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ⚠️  Dose de Venlafaxina atrasada há 2h           │   │
│  │     Escitalopram 10mg (52 min atrás)             │   │
│  │                                                  │   │
│  │     [ADIAR]  [TOMAR AGORA]                       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Características:                                       │
│  • border-radius: 12px (--radius-card-md)               │
│  • box-shadow: Layered + Glow                           │
│  • padding: 12px (--spacing-component-compact)          │
│  • gap: 12px (--spacing-component-compact)              │
│  • border-left: 4px (cor do alerta)                     │
│  • backdrop-filter: blur(12px)                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Exemplo 2: Health Score Card Refinado

```css
/* HealthScoreCard.css - Versão Refinada */
.health-score-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-component-normal);
  padding: var(--spacing-component-normal);
  background: var(--gradient-hero);
  border: var(--border-width-hero) solid var(--glass-border-hero);
  border-radius: var(--radius-card-xl);
  backdrop-filter: var(--glass-blur-hero);
  box-shadow: var(--shadow-hero);
  min-width: 200px;
  transition: var(--transition-hover);
}

.health-score-card--clickable {
  cursor: pointer;
}

.health-score-card--clickable:hover {
  box-shadow: var(--shadow-hero-hover), var(--glow-hover);
  transform: translateY(-4px);
  border-color: var(--neon-cyan);
}

.health-score-card__chart {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.health-score-card__svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 0 5px rgba(0, 240, 255, 0.4));
}

.health-score-card__bg {
  fill: none;
  stroke: var(--bg-tertiary);
  stroke-width: 6;
}

.health-score-card__progress {
  fill: none;
  stroke: var(--neon-cyan);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset var(--transition-slow);
  filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.6));
}

.health-score-card__value {
  position: absolute;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--text-primary-dark);
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.6);
}

.health-score-card__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-related);
  flex: 1;
}

.health-score-card__header {
  display: flex;
  align-items: center;
  gap: var(--spacing-related-tight);
}

.health-score-card__label {
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 600;
}

.health-score-card__trend {
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.health-score-card__trend--up {
  color: var(--neon-green);
}

.health-score-card__trend--down {
  color: var(--neon-pink);
}

.health-score-card__streak {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-related-tight);
}

.health-score-card__streak-value {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--neon-magenta);
  text-shadow: var(--glow-magenta);
}

.health-score-card__streak-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
```

**Visualização ASCII:**

```text
┌────────────────────────────────────────────────────────────┐
│ HEALTH SCORE CARD - VERSÃO REFINADA                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ╭────╮                                             │   │
│  │  │ 85 │  HEALTH SCORE                    ↑ 12%      │   │
│  │  │ ━━━│  Status: Excelente              🔥 12 dias  │   │
│  │  ╰────╯                                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                            │
│  Características:                                          │
│  • border-radius: 20px (--radius-card-xl)                  │
│  • box-shadow: Layer 4 (--shadow-hero)                     │
│  • background: Gradiente hero                              │
│  • backdrop-filter: blur(20px)                             │
│  • padding: 16px (--spacing-component-normal)              │
│  • gap: 16px (--spacing-component-normal)                  │
│  • SVG glow: drop-shadow(0 0 8px rgba(0,240,255,0.6))    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### Exemplo 3: Insight Card com Gradiente

```css
/* InsightCard.css - Novo Componente */
.insight-card {
  background: var(--gradient-insight);
  border: var(--border-width-prominent) solid var(--glass-border-heavy);
  border-radius: var(--radius-card-lg);
  padding: var(--spacing-component-compact);
  backdrop-filter: var(--glass-blur);
  box-shadow: var(--shadow-card);
  display: flex;
  gap: var(--spacing-component-compact);
  align-items: flex-start;
  transition: var(--transition-hover);
}

.insight-card:hover {
  box-shadow: var(--shadow-card-hover), var(--glow-hover);
  transform: translateY(-2px);
  border-color: var(--neon-cyan);
}

.insight-card__icon {
  font-size: var(--font-size-2xl);
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.4));
}

.insight-card__content {
  flex: 1;
  min-width: 0;
}

.insight-card__text {
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--text-primary-dark);
}

.insight-card__highlight {
  color: var(--neon-cyan);
  font-weight: 600;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}

.insight-card__action {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-related-tight);
  margin-top: var(--spacing-related);
  padding: var(--spacing-component-tight) var(--spacing-component-normal);
  background: var(--glass-bg-heavy);
  border: var(--border-width-default) solid var(--glass-border);
  border-radius: var(--radius-button);
  color: var(--text-primary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-hover);
}

.insight-card__action:hover {
  background: var(--neon-cyan);
  color: var(--text-on-primary);
  border-color: var(--neon-cyan);
  box-shadow: var(--shadow-button), var(--glow-hover);
}
```

**Visualização ASCII:**

```text
┌──────────────────────────────────────────────────────────┐
│ INSIGHT CARD - NOVO COMPONENTE                           │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │ 💡  Você tem 40% melhor adesão nos dias que       │   │
│  │     toma café antes do protocolo matinal.         │   │
│  │                                                   │   │
│  │     [Configurar Lembrete Extra →]                 │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  Características:                                        │
│  • border-radius: 16px (--radius-card-lg)                │
│  • background: Gradiente insight (cyan → purple)         │
│  • border: 2px (--border-width-prominent)                │
│  • backdrop-filter: blur(12px)                           │
│  • box-shadow: Layer 2 + Glow hover                      │
│  • padding: 12px (--spacing-component-compact)           │
│  • gap: 12px (--spacing-component-compact)               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Guia de Implementação

### Passo 1: Adicionar Novos Tokens

1. **Atualizar `src/styles/tokens/borders.css`:**
   - Adicionar tokens de border-radius específicos por componente
   - Adicionar tokens de border-width contextual

2. **Atualizar `src/styles/tokens/shadows.css`:**
   - Adicionar sistema de sombras em camadas (layered shadows)
   - Adicionar sombras específicas por componente
   - Adicionar glow effects contextuais

3. **Atualizar `src/styles/tokens/spacing.css`:**
   - Adicionar tokens de espaçamento hierárquico
   - Adicionar tokens de espaçamento por tipo de componente

4. **Atualizar `src/styles/tokens/colors.css`:**
   - Adicionar níveis de glassmorphism
   - Adicionar gradientes para diferentes contextos
   - Refinar cores de texto para melhor contraste

5. **Atualizar `src/styles/tokens/transitions.css`:**
   - Adicionar transições para micro-interações

### Passo 2: Atualizar Componentes Existentes

**Prioridade de Atualização:**

1. **SmartAlerts.css** (P0)
   - Atualizar border-radius para `--radius-card-md`
   - Atualizar box-shadow para `--shadow-alert`
   - Atualizar padding e gap para tokens hierárquicos
   - Adicionar glow effects para hover

2. **HealthScoreCard.css** (P0)
   - Atualizar border-radius para `--radius-card-xl`
   - Atualizar box-shadow para `--shadow-hero`
   - Adicionar gradiente hero
   - Refinar SVG glow effects

3. **Dashboard.module.css** (P0)
   - Atualizar espaçamentos para tokens hierárquicos
   - Atualizar sombras de cards
   - Adicionar hero section com gradiente

4. **TreatmentAccordion.css** (P1)
   - Atualizar border-radius para `--radius-card-lg`
   - Atualizar sombras para layered shadows
   - Adicionar micro-interações

5. **SwipeRegisterItem.css** (P1)
   - Atualizar border-radius para `--radius-card-sm`
   - Adicionar glow effects para swipe
   - Refinar transições

### Passo 3: Criar Novos Componentes

1. **InsightCard.css** (P1)
   - Criar componente com gradiente
   - Implementar glassmorphism refinado
   - Adicionar micro-interações

2. **QuickActions.css** (P2)
   - Atualizar border-radius para `--radius-card-sm`
   - Adicionar hover effects com glow
   - Refinar espaçamentos

### Passo 4: Validação

1. **Testar em diferentes temas:**
   - Verificar contraste em tema claro
   - Verificar contraste em tema escuro
   - Validar glow effects em ambos os temas

2. **Testar responsividade:**
   - Verificar border-radius em mobile
   - Validar sombras em diferentes tamanhos de tela
   - Testar espaçamentos em dispositivos móveis

3. **Testar acessibilidade:**
   - Validar contraste WCAG AA
   - Testar com `prefers-reduced-motion`
   - Verificar foco visível

4. **Testar performance:**
   - Verificar impacto de backdrop-filter
   - Validar performance de animações
   - Testar em dispositivos de baixo desempenho

---

## Checklist de Validação

### Validação Visual

- [ ] Border-radius varia adequadamente entre componentes
- [ ] Sombras criam hierarquia visual clara
- [ ] Espaçamentos diferenciam seções e elementos
- [ ] Gradientes são sutis e não distraem
- [ ] Glassmorphism é aplicado de forma contextual
- [ ] Glow effects são usados apenas onde necessário
- [ ] Contraste de texto é adequado em ambos os temas

### Validação Técnica

- [ ] Todos os novos tokens estão definidos
- [ ] Tokens são usados consistentemente
- [ ] Dark mode overrides estão implementados
- [ ] Transições são suaves e performáticas
- [ ] Não há valores hardcoded (todos usam tokens)
- [ ] CSS Modules são usados para componentes complexos

### Validação de Acessibilidade

- [ ] Contraste WCAG AA é atendido
- [ ] Focus states são visíveis
- [ ] `prefers-reduced-motion` é respeitado
- [ ] `prefers-contrast` é suportado
- [ ] Texto é legível em ambos os temas

---

## Conclusão

Esta estratégia propõe melhorias visuais significativas mantendo estritamente a arquitetura de tokens baseada em CSS Custom Properties. As melhorias são priorizadas por impacto, permitindo implementação incremental:

1. **P0 (Crítico):** Variação de border-radius, sombras em camadas, espaçamento hierárquico
2. **P1 (Alto):** Gradientes e glassmorphism refinados, contraste aprimorado, micro-interações
3. **P2 (Médio):** Bordas com variação de espessura, glow effects contextuais

A implementação desta estratégia resultará em uma interface mais visualmente interessante, com melhor hierarquia e scanability, sem comprometer a arquitetura CSS existente.

---

## Referências

- Documento de UX: `plans/old/new-dashboard-ux.md` (Seção 6)
- Mockup HTML: `plans/old/mockup_temp.html`
- Arquitetura CSS: `docs/CSS_ARCHITECTURE.md`
- Tokens existentes: `src/styles/tokens/`
