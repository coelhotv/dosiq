# Plano de Recuperação Visual - Design Uplift Plan

**Data:** 2026-02-10  
**Objetivo:** Restaurar padrões visuais, hierarquia e usabilidade da interface  
**Baseado em:** `docs/CSS_ARCHITECTURE.md`, análise de screenshots

---

## 1. Visão Geral da Estratégia

### Objetivos Primários
1. **Restaurar hierarquia visual** com diferenciação clara entre componentes
2. **Otimizar densidade de informação** para mobile-first
3. **Corrigir escala de botões** para proporções usáveis
4. **Padronizar espaçamentos** com tokens consistentes
5. **Reestabelecer diferenciação visual** entre cards de diferentes propósitos

### Princípios Guiadores
- **Mobile-first**: Otimizar para telas pequenas primeiro
- **Densidade progressiva**: Mais arquivamento em cards secundários
- **Hierarquia de elevação**: Cards hero > Cards primários > Cards secundários > List items
- **Consistência matemática**: Usar escala de 8px como base

---

## 2. Correções no Sistema de Spacing

### 2.1 Fixar Referências Circulares ❌➡️✅

**Arquivo:** `src/styles/tokens/spacing.css`

**Problema atual:**
```css
--spacing-xs: var(--space-1);
--space-1: var(--spacing-xs);  /* CIRCULAR! */
```

**Correção:**
```css
/* Base scale - valores absolutos */
--space-0: 0;
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;    /* 20px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */

/* Named aliases - referenciam base scale */
--spacing-xs: var(--space-1);    /* 4px */
--spacing-sm: var(--space-2);    /* 8px */
--spacing-md: var(--space-3);    /* 12px - MOBILE FRIENDLY */
--spacing-lg: var(--space-4);    /* 16px */
--spacing-xl: var(--space-5);    /* 20px */
--spacing-2xl: var(--space-6);   /* 24px */
```

### 2.2 Novos Tokens de Espaçamento Hierárquico

```css
/* ============================================
   HIERARCHICAL SPACING - V2
   ============================================ */
:root {
  /* Seções - Reduzidos para mobile */
  --spacing-section-hero: var(--space-6);       /* 24px */
  --spacing-section-major: var(--space-4);      /* 16px */
  --spacing-section-minor: var(--space-3);      /* 12px */
  --spacing-section-tight: var(--space-2);      /* 8px */
  
  /* Componentes - Mais compactos */
  --spacing-component-loose: var(--space-4);    /* 16px */
  --spacing-component-normal: var(--space-3);   /* 12px */
  --spacing-component-compact: var(--space-2);  /* 8px */
  --spacing-component-tight: var(--space-1);    /* 4px */
  
  /* Listas - Compactação máxima */
  --spacing-list-loose: var(--space-3);         /* 12px */
  --spacing-list-normal: var(--space-2);        /* 8px */
  --spacing-list-compact: var(--space-1);       /* 4px */
  
  /* Elementos relacionados */
  --spacing-related: var(--space-1);            /* 4px */
  --spacing-related-tight: 2px;                 /* 2px */
}
```

### 2.3 Tokens de Container

```css
:root {
  /* Padding de container mobile */
  --container-padding-x: var(--space-3);        /* 12px */
  --container-padding-y: var(--space-3);        /* 12px */
  
  /* Gap padrão entre cards */
  --cards-gap: var(--space-2);                  /* 8px */
  
  /* Max-width mobile */
  --container-max-mobile: 100%;
  --container-max-tablet: 720px;
  --container-max-desktop: 1024px;
}
```

---

## 3. Correções no Sistema de Botões

### 3.1 Escala de Botões Corrigida 📐

**Arquivo:** `src/components/ui/Button.css`

**Problema atual:**
```css
.btn-lg {
  padding: var(--space-4) var(--space-8);  /* 32px 128px - GIGANTE! */
}
```

**Correção:**
```css
/* ============================================
   BUTTON SIZES - Mobile-First Scale
   ============================================ */

/* Small - Ações secundárias, ícones */
.btn-sm {
  padding: var(--space-1) var(--space-3);     /* 4px 12px */
  font-size: var(--font-size-xs);              /* 12px */
  min-height: 28px;
}

/* Medium - Ação padrão */
.btn-md {
  padding: var(--space-2) var(--space-4);     /* 8px 16px */
  font-size: var(--font-size-sm);              /* 14px */
  min-height: 36px;
}

/* Large - CTA principal (mas não exagerado) */
.btn-lg {
  padding: var(--space-3) var(--space-5);     /* 12px 20px */
  font-size: var(--font-size-base);            /* 16px */
  min-height: 44px;                            /* Touch target mínimo */
  max-width: 100%;                             /* Não ultrapassar container */
}

/* Full width - Usar com moderação */
.btn-full {
  width: 100%;
  max-width: 400px;                            /* Limite em telas grandes */
  margin: 0 auto;                              /* Centralizar */
}
```

### 3.2 Variantes de Botão Hierárquicas

```css
/* ============================================
   BUTTON VARIANTS - Visual Hierarchy
   ============================================ */

/* Primary - CTA Principal */
.btn-primary {
  background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
  color: #000;                                  /* Contraste em fundo claro */
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 240, 255, 0.3);
}

/* Secondary - Ação importante mas não principal */
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  font-weight: 500;
}

/* Tertiary - Ação complementar */
.btn-tertiary {
  background: transparent;
  color: var(--neon-cyan);
  border: 1px solid var(--neon-cyan);
  font-weight: 500;
}

/* Ghost - Ação sutil */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  font-weight: 400;
}
```

### 3.3 Estados de Hover/Active Otimizados

```css
/* Micro-interações sutis - Não exagerar no scale */
.btn:hover:not(:disabled) {
  transform: translateY(-1px);                  /* 1px é suficiente */
  transition: transform var(--duration-150) var(--ease-out);
}

.btn:active:not(:disabled) {
  transform: translateY(0) scale(0.98);         /* Feedback sutil */
  transition: transform var(--duration-100) var(--ease-in);
}
```

---

## 4. Hierarquia de Cards (Glassmorphism Graduado)

### 4.1 Níveis de Glassmorphism 🪟

**Arquivo:** `src/components/dashboard/HealthScoreCard.css`, `TreatmentAccordion.css`, `SmartAlerts.css`

**Princípio:** Nem todo card precisa de glassmorphism "hero". Usar intensidade proporcional à importância.

```css
/* ============================================
   CARD HIERARCHY - Glassmorphism Levels
   ============================================ */

/* Level 0: Flat - Informação secundária */
.card-flat {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-component-compact);
}

/* Level 1: Subtle - Cards padrão */
.card-subtle {
  background: var(--bg-glass);
  backdrop-filter: blur(4px);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--spacing-component-normal);
}

/* Level 2: Elevated - Cards importantes */
.card-elevated {
  background: var(--glass-bg);
  backdrop-filter: blur(8px);
  border: 1.5px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--spacing-component-loose);
  box-shadow: var(--shadow-card);
}

/* Level 3: Hero - Apenas destaque principal */
.card-hero {
  background: var(--gradient-hero);
  backdrop-filter: blur(12px);
  border: 2px solid var(--glass-border-hero);
  border-radius: var(--radius-card-xl);
  padding: var(--spacing-component-loose);
  box-shadow: var(--shadow-hero);
}
```

### 4.2 Aplicação por Componente

| Componente | Nível | Justificativa |
|------------|-------|---------------|
| HealthScoreCard | Level 3 (Hero) | Principal elemento da dashboard |
| TreatmentAccordion | Level 2 (Elevated) | Conteúdo importante, mas secundário |
| SmartAlerts | Level 1 (Subtle) | Alertas temporários, não competir com conteúdo |
| Inventory Items | Level 0 (Flat) | Lista de itens, densidade é prioridade |
| Protocol Cards | Level 1 (Subtle) | Cards de conteúdo padrão |

### 4.3 Correção de HealthScoreCard

**Problema:** Card muito grande, padding excessivo

**Correção:**
```css
.health-score-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-component-compact);    /* 8px */
  padding: var(--spacing-component-normal);  /* 12px */
  /* ... glassmorphism level 3 ... */
  min-width: unset;                          /* Remover constraint */
  max-height: 120px;                         /* Limitar altura */
}

.health-score-card__chart {
  width: 64px;                               /* Reduzir de 80px */
  height: 64px;
}

.health-score-card__value {
  font-size: var(--font-size-xl);            /* 20px */
}
```

---

## 5. Correções de Layout no Dashboard

### 5.1 Container Principal

**Arquivo:** `src/views/Dashboard.css`

**Correção:**
```css
.dashboard-container-v2 {
  padding: var(--container-padding-y) var(--container-padding-x);  /* 12px */
  max-width: var(--container-max-mobile);
  margin: 0 auto;
  color: var(--text-primary);
  font-family: var(--font-family);
}

@media (min-width: 768px) {
  .dashboard-container-v2 {
    max-width: var(--container-max-tablet);
    padding: var(--space-4);
  }
}
```

### 5.2 Grid de Cards Superior

```css
.top-cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--cards-gap);                        /* 8px */
  margin-bottom: var(--spacing-section-minor);  /* 12px */
}

.info-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);              /* 12px */
  padding: var(--spacing-component-compact);    /* 8px */
  height: auto;                                 /* Remover altura fixa */
  min-height: 80px;
}

.card-label {
  font-size: 10px;                              /* Manter pequeno */
  letter-spacing: 0.5px;                        /* Reduzir */
}

.highlight-value {
  font-size: var(--font-size-xl);               /* 20px - reduzir de 28px */
}
```

### 5.3 Seção de Tratamento

```css
.treatment-section {
  margin-bottom: var(--spacing-section-major);  /* 16px */
}

.treatment-title {
  font-size: var(--font-size-xs);               /* 12px */
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-list-normal);    /* 8px */
}

/* Lista de tratamentos mais compacta */
.treatment-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-list-normal);              /* 8px */
}
```

### 5.4 Botão de Registro Manual

```css
.manual-register-btn {
  position: fixed;                              /* Ou sticky */
  bottom: calc(var(--bottom-nav-height) + var(--space-3));  /* Acima da nav */
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-sticky);
  
  /* Estilo */
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--neon-cyan), var(--neon-blue));
  color: #000;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 240, 255, 0.3);
}
```

---

## 6. Sistema de Tipografia Refinado

### 6.1 Escala Tipográfica Mobile-First

```css
/* ============================================
   TYPOGRAPHY SCALE - Mobile Hierarchy
   ============================================ */

/* Títulos de página/seção */
.text-page-title {
  font-size: var(--font-size-2xl);    /* 24px */
  font-weight: 700;
  line-height: 1.2;
}

/* Títulos de cards */
.text-card-title {
  font-size: var(--font-size-base);   /* 16px */
  font-weight: 600;
  line-height: 1.3;
}

/* Labels de seção (uppercase) */
.text-section-label {
  font-size: var(--font-size-xs);     /* 12px */
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* Corpo de texto */
.text-body {
  font-size: var(--font-size-sm);     /* 14px */
  font-weight: 400;
  line-height: 1.5;
}

/* Texto pequeno/captions */
.text-caption {
  font-size: var(--font-size-xs);     /* 12px */
  font-weight: 400;
  color: var(--text-secondary);
}

/* Meta informações (monospace opcional) */
.text-meta {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}
```

### 6.2 Hierarquia de Cores de Texto

```css
/* Primário - Títulos, ações principais */
.text-primary { color: var(--text-primary); }

/* Secundário - Descrições, labels */
.text-secondary { color: var(--text-secondary); }

/* Terciário - Meta informações, timestamps */
.text-tertiary { color: var(--text-tertiary); }

/* Destaque - Ações, status positivos */
.text-accent { color: var(--neon-cyan); }

/* Alerta - Atenção necessária */
.text-warning { color: var(--neon-orange); }

/* Crítico - Erros, estoque zerado */
.text-critical { color: var(--neon-red); }
```

---

## 7. Checklist de Implementação

### Fase 1: Correções Críticas (P0) 🚨
- [ ] Fixar referências circulares em `spacing.css`
- [ ] Reduzir padding de botões (especialmente `.btn-lg`)
- [ ] Corrigir padding de container no Dashboard
- [ ] Limitar altura do HealthScoreCard

### Fase 2: Hierarquia Visual (P1) 🎨
- [ ] Implementar níveis de glassmorphism
- [ ] Aplicar hierarquia correta nos cards existentes
- [ ] Ajustar sombras para diferenciação de elevação
- [ ] Refinar tipografia com nova escala

### Fase 3: Consistência (P2) 🔧
- [ ] Substituir valores hardcoded por tokens
- [ ] Padronizar border-radius por categoria
- [ ] Unificar gaps e margins
- [ ] Revisar todos os componentes afetados

### Fase 4: Validação (P3) ✅
- [ ] Testar em dispositivos mobile (320px, 375px, 414px)
- [ ] Testar em tablets (768px)
- [ ] Testar em desktop (1024px+)
- [ ] Verificar contraste WCAG
- [ ] Validar touch targets (mínimo 44px)

---

## 8. Exemplos de Before/After

### Exemplo 1: Botão CTA

**Before (Problemático):**
```css
.btn-lg {
  padding: var(--space-4) var(--space-8);  /* 32px 128px */
  font-size: var(--font-size-lg);
}
/* Resultado: Botão gigante ocupando tela inteira */
```

**After (Corrigido):**
```css
.btn-lg {
  padding: var(--space-3) var(--space-5);  /* 12px 20px */
  font-size: var(--font-size-base);
  min-height: 44px;
  max-width: 400px;
}
/* Resultado: Botão proporcional e usável */
```

### Exemplo 2: Card de Tratamento

**Before (Problemático):**
```css
.treatment-accordion {
  padding: var(--space-4);                    /* 16px */
  backdrop-filter: var(--glass-blur-hero);    /* Muito intenso */
  border: var(--border-width-hero) solid...   /* 2.5px */
  margin-bottom: var(--spacing-list-loose);   /* 16px */
}
/* Resultado: Card grande, glassmorphism excessivo */
```

**After (Corrigido):**
```css
.treatment-accordion {
  padding: var(--spacing-component-normal);   /* 12px */
  backdrop-filter: blur(8px);                 /* Moderado */
  border: 1px solid var(--glass-border);      /* Sutil */
  margin-bottom: var(--spacing-list-normal);  /* 8px */
}
/* Resultado: Card compacto, hierarquia adequada */
```

---

## 9. Métricas de Sucesso

| Métrica | Antes | Depois | Target |
|---------|-------|--------|--------|
| Info cards por viewport | 3-4 | 5-6 | 5+ ✅ |
| Altura HealthScore card | ~180px | ~100px | <120px ✅ |
| Padding botão CTA mobile | 32px/128px | 12px/20px | <16px/32px ✅ |
| Gap entre cards | 16-24px | 8-12px | <12px ✅ |
| Contraste WCAG | Variável | AA | AA+ ✅ |

---

## 10. Notas de Implementação

1. **Não quebrar funcionalidade**: As alterações são puramente visuais
2. **Manter tokens existentes**: Apenas corrigir valores, não remover tokens
3. **Testar incrementalmente**: Aplicar uma seção por vez
4. **Documentar mudanças**: Atualizar CSS_ARCHITECTURE.md após implementação
5. **Validar com usuários**: Testar usabilidade após alterações

---

*Plano criado em 2026-02-10 - Aguardando aprovação para início da implementação.*
