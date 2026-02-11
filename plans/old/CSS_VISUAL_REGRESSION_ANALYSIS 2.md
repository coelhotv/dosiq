# Análise de Regressão Visual - CSS Architecture Refactor

**Data:** 2026-02-10  
**Status:** Análise Completa - Ação Requerida

---

## Resumo Executivo

O refactor da arquitetura CSS introduziu uma regressão visual severa que degrada significativamente a experiência do usuário. A interface atual apresenta problemas críticos de hierarquia visual, escala de componentes, espaçamento excessivo e perda de diferenciação entre elementos.

---

## Análise Comparativa Visual

### Estado Anterior (Referência)
**Screenshots base:** `mobile.jpg`, `desktop.jpg`, `plans/old/fullscroll-dashboard.JPG`

**Características positivas:**
- Cards compactos com densidade de informação adequada
- Hierarquia visual clara entre seções (Próxima Dose, Estoque, Tratamento)
- Botões proporcionais e bem posicionados
- Espaçamento intencional e consistente
- Diferenciação visual clara entre componentes primários/secundários
- Tipografia escalonada que guia o olhar do usuário

### Estado Anterior Intermediário (Aceitável)
**Screenshots:** `previous-dash-1st-scroll.png`, `previous-dash-treatment.png`, etc.

**Características:**
- Layout funcional com algumas inconsistências
- Componentes reconhecíveis e usáveis
- Tratamento visual consistente

### Estado Atual (Problemático) ⚠️
**Screenshots:** `new-dashboard-1st-scroll.png`, `new-button.png`

**Problemas críticos identificados:**

#### 1. Botões Excessivamente Grandes
- O botão "Registrar (4)" em `new-button.png` ocupa ~90% da largura com altura desproporcional
- Padding extremo cria aparência de "bloco" em vez de botão interativo
- Texto pequeno em container gigante = proporções quebradas

#### 2. Card HealthScore com Escala Inadequada
- Ocupa espaço vertical excessivo
- Padding interno muito grande reduz área útil
- Gradiente hero aplicado em contexto onde deveria ser mais sutil

#### 3. Perda de Hierarquia Visual
- Todos os cards têm aparência similar (glassmorphism indiscriminado)
- Sem distinção clara entre:
  - Cards de destaque (Health Score)
  - Cards de conteúdo (Próximas Doses)
  - Cards de ação (Alertas)
- Falta de variação de densidade visual

#### 4. Espaçamento Excessivo e Inconsistente
- Gaps entre elementos muito amplos
- Margens que quebram o fluxo visual
- Padding interno em cards desproporcional ao conteúdo

#### 5. Elementos Flutuantes Mal Posicionados
- Botão "+ REGISTRO MANUAL" aparece desconexo do layout
- Falta de ancora visual clara

#### 6. Monotonia Visual
- Todos os componentes usam glassmorphism com intensidade similar
- Ausência de variação de elevação/sombra
- Cores de fundo pouco diferenciadas

---

## Problemas Técnicos Encontrados no Código

### 1. Referência Circular em Spacing Tokens ❌
**Arquivo:** `src/styles/tokens/spacing.css` (linhas 50-65)

```css
--spacing-xs: var(--space-1);   /* refencia space-1 */
--space-1: var(--spacing-xs);   /* CIRCULAR - volta a referenciar spacing-xs! */
```

**Impacto:** Comportamento indefinido nas variáveis CSS, possivelmente causando valores inválidos ou inconsistências.

### 2. Valores Hardcoded em Dashboard.css ❌
**Arquivo:** `src/views/Dashboard.css` (múltiplas ocorrências)

```css
.dashboard-container-v2 {
  padding: 24px;  /* Deveria usar var(--spacing-md) */
}

.top-cards-grid {
  gap: 16px;      /* Deveria usar var(--spacing-sm) */
  margin-bottom: 24px;
}
```

**Impacto:** Inconsistência com o design system, dificuldade de manutenção.

### 3. Padding Excessivo em Botões ❌
**Arquivo:** `src/components/ui/Button.css` (linhas 39-42)

```css
.btn-lg {
  padding: var(--space-4) var(--space-8);  /* 2rem 8rem = 32px 128px */
  font-size: var(--font-size-lg);
}
```

**Impacto:** Botões gigantes em mobile, quebra de layout.

### 4. Glassmorphism Aplicado Indiscriminadamente
**Arquivos:** `HealthScoreCard.css`, `TreatmentAccordion.css`, `SmartAlerts.css`

Todos os componentes usam:
```css
backdrop-filter: var(--glass-blur-hero);
border: var(--border-width-hero) solid var(--glass-border-hero);
```

**Impacto:** Perda de hierarquia visual, aparência "flat" e uniforme.

---

## Comparação Detalhada: Antes vs Depois

### Densidade de Informação
| Aspecto | Anterior | Atual | Status |
|---------|----------|-------|--------|
| Info por viewport | Alta | Baixa | ❌ Regressão |
| Padding cards | 12-16px | 20-32px | ❌ Excesso |
| Gap entre elementos | 8-12px | 16-24px | ❌ Excesso |

### Hierarquia Visual
| Elemento | Anterior | Atual | Status |
|----------|----------|-------|--------|
| Health Score | Destaque moderado | Destaque excessivo | ⚠️ Ajustar |
| Próximas Doses | Compacto | Espaçado demais | ❌ Regressão |
| Botões CTA | Proporcionais | Excessivos | ❌ Regressão |
| Alertas | Diferenciados | Misturados | ❌ Regressão |

### Tipografia
| Elemento | Anterior | Atual | Status |
|----------|----------|-------|--------|
| Títulos seção | 12px uppercase | Variável | ⚠️ Inconsistente |
| Nomes remédios | 14-16px bold | 14px normal | ❌ Perda de peso |
| Meta informações | 11px cinza | 11-12px | ✅ Similar |

---

## Princípios de Design Comprometidos

1. **Hierarquia Visual**: A relação de importância entre elementos está confusa
2. **Densidade Informacional**: Informação útil por pixel de tela diminuiu
3. **Escala Proporcional**: Componentes não mantêm relações de escala harmoniosas
4. **Consistência Espacial**: Espaçamento irregular e excessivo
5. **Diferenciação**: Falta de contraste entre tipos de componentes

---

## Próximos Passos Recomendados

1. **Correção Imediata (P0)**: Fixar tokens de spacing e botões
2. **Refinamento Visual (P1)**: Aplicar hierarquia de glassmorphism
3. **Consistência (P2)**: Remover valores hardcoded
4. **Validação (P3)**: Testar em múltiplos dispositivos

---

*Análise realizada em 2026-02-10 - Aguardando direção para plano de correção.*
