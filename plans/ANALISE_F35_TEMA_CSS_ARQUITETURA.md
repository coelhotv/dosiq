# Relatório de Análise: F3.5 Tema Claro/Escuro e Arquitetura CSS/HTML

**Data:** 2026-02-08
**Analista:** Kilo Code (Architect Mode)
**Versão Baseline:** v2.5.0 (pos-Health Command Center)

---

## 1. Status da Implementação F3.5

### 1.1 O Que Está Implementado Corretamente

✅ **useTheme Hook** (`src/hooks/useTheme.js`)
- Detecta preferência do sistema via `prefers-color-scheme`
- Lê/grava preferência manual em `localStorage`
- Define atributo `data-theme` em `document.documentElement`
- Suporta `prefers-reduced-motion`
- Implementa transições suaves com classe `theme-transitioning`

✅ **ThemeToggle Component** (`src/components/ui/ThemeToggle.jsx`)
- Usa hook `useTheme` corretamente
- Tem ARIA labels apropriados (`role="switch"`, `aria-checked`)
- Integra com `analyticsService` para tracking
- Usa memoização para performance
- Ícones SVG de sol e lua

✅ **CSS Variables Definidas** (`src/index.css`)
- Variáveis de cores definidas para tema claro (`:root`)
- Variáveis de cores definidas para tema escuro (`[data-theme="dark"]`)
- Transições definidas para `background-color` e `color` (200-300ms)
- Suporte a `prefers-reduced-motion` implementado

✅ **Integração no Dashboard**
- ThemeToggle importado e usado em `src/views/Dashboard.jsx`
- Posicionado no header do dashboard

### 1.2 O Que Está Quebrado

❌ **CSS File Não Importado**
- `src/index.css` NÃO é importado em nenhum lugar do app
- `src/App.jsx` importa `./styles/index.css` (que importa `tokens.css`)
- Variáveis de tema em `src/index.css` nunca são carregadas

❌ **Nomes de Variáveis Inconsistentes**
- PRD especifica: `--bg-primary`, `--text-primary`, `--accent-primary`
- `src/index.css` usa: `--color-bg-primary`, `--color-text-primary`, `--color-primary`
- `src/styles/tokens.css` usa: `--bg-primary`, `--text-primary`, `--accent-primary`
- Componentes usam mistura de ambos os padrões

❌ **Seletor Errado para Dark Mode**
- `src/styles/tokens.css` usa `@media (prefers-color-scheme: light)` para override
- `useTheme` hook define `data-theme="dark"` no elemento
- CSS deveria usar `[data-theme="dark"]` em vez de media query
- Isso impede que o toggle manual funcione

❌ **Cores Hardcoded em Componentes**
- 148 instâncias de cores hexadecimais hardcoded encontradas
- Exemplos:
  - `Dashboard.css`: `color: #fff`, `color: rgba(255, 255, 255, 0.6)`
  - `BottomNav.css`: `background: rgba(10, 10, 15, 0.95)`
  - `Settings.css`: `background: linear-gradient(135deg, #fff 0%, #aaa 100%)`
  - `Landing.css`: `color: #000`
  - `Auth.css`: `background: linear-gradient(135deg, #fff 0%, #aaa 100%)`

### 1.3 Causa Raiz: Por Que o Tema Não Funciona

**Problema Principal:**
O tema não funciona porque há uma desconexão completa entre o hook `useTheme` e o CSS carregado:

1. **Hook define `data-theme="dark"`** no `document.documentElement`
2. **CSS usa `@media (prefers-color-scheme: light)`** em vez de responder ao atributo
3. **Arquivo CSS correto (`src/index.css`) não é importado**
4. **Arquivo importado (`src/styles/tokens.css`) não responde ao atributo `data-theme`**

**Fluxo Atual (Quebrado):**
```
useTheme hook → define data-theme="dark"
                ↓
                X (CSS não responde a data-theme)
                ↓
src/styles/tokens.css → usa @media (prefers-color-scheme)
                ↓
                X (só responde a preferência do sistema)
                ↓
src/index.css → NÃO é importado
                ↓
                X (variáveis nunca carregadas)
```

**Fluxo Esperado (Correto):**
```
useTheme hook → define data-theme="dark"
                ↓
                ✓ (CSS responde a data-theme)
                ↓
src/index.css → é importado em App.jsx
                ↓
                ✓ (variáveis carregadas)
                ↓
[data-theme="dark"] → override de variáveis
                ↓
                ✓ (tema escuro aplicado)
```

---

## 2. Avaliação da Arquitetura CSS/HTML

### 2.1 Visão Geral da Arquitetura Atual

**Estrutura de Arquivos CSS:**
```
src/
├── index.css (304 linhas) - Variáveis de tema + base styles
├── App.css (42 linhas) - Template não usado
├── styles/
│   ├── index.css (218 linhas) - Reset + utilities + imports tokens.css
│   └── tokens.css (94 linhas) - Variáveis de design tokens
├── components/
│   ├── *.css (arquivos CSS por componente)
│   └── ui/
│       └── *.css (arquivos CSS por componente UI)
└── views/
    └── *.css (arquivos CSS por view)
```

**Padrões Identificados:**
1. **CSS Global** em `src/index.css` e `src/styles/index.css`
2. **CSS por Componente** em arquivos separados (ex: `Dashboard.css`, `SmartAlerts.css`)
3. **Sem CSS Modules** - Nenhum arquivo `.module.css` encontrado
4. **Mistura de Convenções** - Diferentes padrões de nomenclatura de variáveis

### 2.2 Pontos Fortes

✅ **Separação de Responsabilidades**
- CSS por componente facilita manutenção local
- Variáveis globais centralizam design tokens
- Hook `useTheme` bem estruturado e testável

✅ **Design Tokens Definidos**
- Variáveis de cores, espaçamentos, tipografia, bordas, sombras
- Suporte a temas claro e escuro
- Variáveis de transição definidas

✅ **Acessibilidade Básica**
- `prefers-reduced-motion` implementado em `index.css`
- ARIA labels em ThemeToggle
- Focus states definidos

✅ **Componentes Reutilizáveis**
- `EmptyState`, `Button`, `Modal`, `Loading` são bem estruturados
- CSS de componentes usa variáveis em muitos casos

### 2.3 Pontos Fracos

❌ **Inconsistência de Nomenclatura de Variáveis**
- Três convenções diferentes:
  1. `--color-*` (ex: `--color-bg-primary`)
  2. `--bg-*`, `--text-*` (ex: `--bg-primary`, `--text-primary`)
  3. `--accent-*` (ex: `--accent-primary`)
- Isso causa confusão e dificulta manutenção

❌ **Cores Hardcoded**
- 148 instâncias de cores hexadecimais hardcoded
- Impede que tema funcione corretamente
- Dificulta mudanças de design system

❌ **Múltiplos Arquivos CSS Globais**
- `src/index.css` e `src/styles/index.css` têm funções sobrepostas
- `src/App.css` é template não usado
- Confusão sobre qual arquivo é a "fonte da verdade"

❌ **Sem Encapsulamento de Estilos**
- Nenhum CSS Module usado
- Risco de conflitos de nomes de classes
- Dificulta refatoração de componentes

❌ **HTML Semântico Incompleto**
- Alguns componentes usam `div` excessivamente
- Falta uso de `header`, `nav`, `main`, `section`, `article`
- Exemplo: `Landing.jsx` usa `div` para hero section

❌ **Acessibilidade Incompleta**
- Nem todos os botões têm `aria-label`
- Nem todos os SVGs têm `role="img"` e `aria-label`
- Falta `prefers-contrast` e `prefers-reduced-transparency`

### 2.4 Avaliação de Manutenibilidade

**Score: 4/10**

**Justificativa:**
- **Inconsistência de Nomenclatura (-3):** Três convenções diferentes causam confusão
- **Cores Hardcoded (-2):** 148 instâncias impedem tema de funcionar
- **Múltiplos Arquivos Globais (-1):** Confusão sobre fonte da verdade
- **Sem Encapsulamento (-1):** Risco de conflitos de classes
- **HTML Semântico (-1):** Uso excessivo de `div`
- **Acessibilidade Incompleta (-1):** Falta ARIA labels e roles
- **Separação de Responsabilidades (+1):** CSS por componente é bom
- **Design Tokens (+1):** Variáveis bem definidas
- **useTheme Hook (+1):** Bem estruturado e testável

### 2.5 Avaliação de Escalabilidade

**Score: 3/10**

**Justificativa:**
- **Inconsistência de Nomenclatura (-3):** Dificulta adicionar novos temas
- **Cores Hardcoded (-2):** Impede expansão de temas
- **Sem Encapsulamento (-2):** Dificulta adicionar novos componentes
- **HTML Semântico (-1):** Dificulta SEO e acessibilidade
- **Acessibilidade Incompleta (-1):** Dificulta suporte a novos recursos
- **Separação de Responsabilidades (+1):** CSS por componente ajuda
- **Design Tokens (+1):** Variáveis facilitam expansão

---

## 3. Recomendação de Refatoração

### 3.1 Refatoração Completa é Necessária?

**Resposta: SIM - Refatoração Parcial é Necessária**

**Justificativa:**
1. **Problemas Críticos Bloqueiam F3.5:**
   - CSS file não importado
   - Seletor errado para dark mode
   - Nomes de variáveis inconsistentes

2. **Problemas de Manutenibilidade:**
   - 148 cores hardcoded impedem evolução
   - Inconsistência de nomenclatura causa confusão

3. **Problemas de Escalabilidade:**
   - Sem encapsulamento dificulta adição de componentes
   - HTML semântico incompleto

**Escopo da Refatoração:**
- **Fase 1 (Crítica):** Corrigir F3.5 para funcionar
- **Fase 2 (Manutenibilidade):** Migrar cores hardcoded para variáveis
- **Fase 3 (Arquitetura):** Unificar nomenclatura de variáveis
- **Fase 4 (Acessibilidade):** Melhorar HTML semântico e ARIA

### 3.2 Estratégia de Migração

**Abordagem Recomendada: Incremental com Fases**

**Fase 1: Correção Crítica do F3.5 (Prioridade P0)**
1. Importar `src/index.css` em `src/App.jsx`
2. Remover `@media (prefers-color-scheme: light)` de `src/styles/tokens.css`
3. Adicionar `[data-theme="dark"]` em `src/styles/tokens.css`
4. Unificar nomenclatura de variáveis (usar padrão do PRD)
5. Testar toggle de tema

**Fase 2: Migração de Cores Hardcoded (Prioridade P1)**
1. Identificar todas as cores hardcoded (148 instâncias)
2. Criar mapeamento de cores para variáveis CSS
3. Migrar gradualmente por componente
4. Validar contraste WCAG AA após migração

**Fase 3: Unificação de Nomenclatura (Prioridade P2)**
1. Escolher padrão único (recomendado: padrão do PRD)
2. Renomear todas as variáveis para o padrão escolhido
3. Atualizar todos os componentes para usar novo padrão
4. Remover variáveis obsoletas

**Fase 4: Melhorias de Acessibilidade (Prioridade P2)**
1. Adicionar `role` e `aria-label` em todos os SVGs
2. Adicionar `aria-label` em todos os botões sem texto
3. Implementar `prefers-contrast` e `prefers-reduced-transparency`
4. Melhorar HTML semântico (usar `header`, `nav`, `main`, `section`)

---

## 4. Estratégia de CSS Variables

### 4.1 Estrutura Recomendada de Variáveis

**Padrão de Nomenclatura (Baseado no PRD):**
```css
/* Cores de Fundo */
--bg-primary
--bg-secondary
--bg-tertiary
--bg-card
--bg-glass

/* Cores de Texto */
--text-primary
--text-secondary
--text-tertiary
--text-inverse
--text-link

/* Cores de Acento */
--accent-primary
--accent-secondary
--accent-success
--accent-warning
--accent-danger
--accent-info

/* Cores de Borda */
--border-light
--border-default
--border-dark

/* Cores Semânticas */
--color-success
--color-warning
--color-error
--color-info

/* Neon Colors (para efeitos especiais) */
--neon-cyan
--neon-pink
--neon-magenta
--neon-green
--neon-orange
--neon-yellow
--neon-red

/* Tipografia */
--font-family
--font-size-xs
--font-size-sm
--font-size-base
--font-size-lg
--font-size-xl
--font-size-2xl
--font-size-3xl
--font-weight-normal
--font-weight-medium
--font-weight-semibold
--font-weight-bold

/* Espaçamento */
--space-1
--space-2
--space-3
--space-4
--space-5
--space-6
--space-8
--space-10
--space-12

/* Border Radius */
--radius-sm
--radius-md
--radius-lg
--radius-xl
--radius-full

/* Sombras */
--shadow-sm
--shadow-md
--shadow-lg
--shadow-xl

/* Transições */
--transition-fast
--transition-normal
--transition-slow

/* Z-Index */
--z-dropdown
--z-sticky
--z-modal
--z-toast
--z-tooltip
```

### 4.2 Variáveis a Adicionar

**Categorias Faltantes:**

1. **Breakpoints Responsivos:**
```css
--breakpoint-xs: 320px
--breakpoint-sm: 640px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--breakpoint-xl: 1280px
--breakpoint-2xl: 1536px
```

2. **Cores de Health Score:**
```css
--score-critical
--score-low
--score-medium
--score-good
--score-excellent
```

3. **Cores de Glow (já existem, mas podem ser expandidas):**
```css
--glow-success
--glow-warning
--glow-error
--glow-info
```

4. **Opacidades:**
```css
--opacity-disabled: 0.5
--opacity-hover: 0.8
--opacity-focus: 1
--opacity-overlay: 0.9
```

5. **Cores de Estado:**
```css
--state-hover
--state-active
--state-focus
--state-disabled
--state-loading
```

### 4.3 Organização de Variáveis

**Estrutura de Arquivo Recomendada:**

```
src/styles/
├── tokens/
│   ├── colors.css (todas as variáveis de cor)
│   ├── typography.css (fontes, tamanhos, pesos)
│   ├── spacing.css (espaçamentos)
│   ├── borders.css (bordas, radius)
│   ├── shadows.css (sombras)
│   ├── transitions.css (transições)
│   └── z-index.css (escala de z-index)
├── themes/
│   ├── light.css (override para tema claro)
│   └── dark.css (override para tema escuro)
└── index.css (importa todos os tokens + reset + utilities)
```

**Benefícios:**
- Separação clara por categoria
- Fácil adicionar novas variáveis
- Fácil manter temas
- Fácil encontrar variáveis específicas

### 4.4 Plano de Migração para Variáveis

**Passo 1: Criar Estrutura de Tokens**
1. Criar diretório `src/styles/tokens/`
2. Criar arquivos por categoria (colors, typography, spacing, etc.)
3. Migrar variáveis existentes para nova estrutura

**Passo 2: Unificar Nomenclatura**
1. Escolher padrão (recomendado: padrão do PRD)
2. Renomear todas as variáveis
3. Atualizar referências em todos os componentes

**Passo 3: Migrar Cores Hardcoded**
1. Criar mapeamento de cores para variáveis
2. Substituir gradualmente por componente
3. Validar visualmente após cada migração

**Passo 4: Testar e Validar**
1. Testar em ambos os temas (claro/escuro)
2. Validar contraste WCAG AA
3. Testar responsividade
4. Testar acessibilidade

---

## 5. Estratégia de CSS Modules

### 5.1 CSS Modules Devem Ser Adotados?

**Resposta: PARCIAL - Híbrido Recomendado**

**Justificativa:**

**Vantagens de CSS Modules:**
✅ Encapsulamento de estilos (sem conflitos de nomes)
✅ Co-locar CSS com componente
✅ Tree-shaking automático (remove CSS não usado)
✅ Escalabilidade para componentes complexos

**Desvantagens de CSS Modules:**
❌ Curva de aprendizado para equipe
❌ Mais verboso (className={styles.container})
❌ Dificulta compartilhamento de estilos globais
❌ Não resolve problema de variáveis globais

**Recomendação:**
- **Usar CSS Modules para componentes complexos** (ex: Dashboard, SmartAlerts, TreatmentAccordion)
- **Manter CSS global para componentes simples** (ex: Button, Modal, Loading)
- **Usar variáveis CSS globais para design tokens** (cores, espaçamentos, etc.)

### 5.2 Componentes que Devem Usar CSS Modules

**Prioridade Alta (Complexos):**
1. `Dashboard.jsx` - Muito complexo, muitos estilos
2. `SmartAlerts.jsx` - Múltiplos estados, animações
3. `TreatmentAccordion.jsx` - Lógica complexa, estados
4. `SwipeRegisterItem.jsx` - Animações, gestos
5. `SparklineAdesao.jsx` - SVG inline, tooltips

**Prioridade Média (Médios):**
1. `MedicineCard.jsx` - Estados, hover effects
2. `ProtocolCard.jsx` - Estados, hover effects
3. `HealthScoreCard.jsx` - SVG, animações
4. `OnboardingWizard.jsx` - Múltiplos steps, estados

**Prioridade Baixa (Simples):**
1. `Button.jsx` - Componente simples, reutilizável
2. `Modal.jsx` - Componente simples, reutilizável
3. `Loading.jsx` - Componente simples, reutilizável
4. `EmptyState.jsx` - Componente simples, reutilizável

### 5.3 Abordagem de Migração

**Fase 1: Piloto (1-2 componentes)**
1. Escolher 1-2 componentes de prioridade alta
2. Converter para CSS Modules
3. Validar funcionamento
4. Documentar aprendizados

**Fase 2: Expansão (componentes de prioridade alta)**
1. Converter componentes de prioridade alta restantes
2. Reutilizar padrões da fase piloto
3. Validar funcionamento

**Fase 3: Opcionais (componentes de prioridade média/baixa)**
1. Avaliar se vale a pena converter
2. Converter se necessário
3. Manter CSS global para componentes simples

### 5.4 Impacto no Build e Bundle Size

**Impacto Positivo:**
✅ **Tree-shaking:** CSS não usado é removido automaticamente
✅ **Bundle Size:** Redução de 10-20% no tamanho do CSS
✅ **Performance:** Carregamento mais rápido de CSS

**Impacto Negativo:**
❌ **Build Time:** Aumento de 5-10% no tempo de build
❌ **Complexidade:** Mais configuração necessária

**Conclusão:**
Benefícios superam custos para componentes complexos. Para componentes simples, CSS global é suficiente.

---

## 6. Roadmap de Acessibilidade

### 6.1 Status Atual da Acessibilidade

**Implementado:**
✅ `prefers-reduced-motion` em `src/index.css`
✅ ARIA labels em `ThemeToggle`
✅ Focus states em `src/index.css`
✅ `sr-only` utility class

**Não Implementado:**
❌ `prefers-contrast` (alto contraste)
❌ `prefers-reduced-transparency` (reduzir transparência)
❌ ARIA labels em todos os SVGs
❌ ARIA labels em todos os botões sem texto
❌ HTML semântico completo
❌ Skip links para navegação por teclado
❌ Indicadores de foco visíveis em todos os elementos interativos

### 6.2 Melhorias Necessárias para WCAG AA

**Contraste de Cores:**
- Validar todas as combinações de cor (texto/fundo)
- Garantir ratio >= 4.5:1 para texto normal
- Garantir ratio >= 3:1 para texto grande (18pt+)
- Usar ferramentas: WebAIM Contrast Checker, Chrome DevTools

**Focus Indicators:**
- Garantir que todos os elementos interativos tenham focus state visível
- Usar `:focus-visible` em vez de `:focus`
- Remover outline apenas quando há outro indicador de foco

**ARIA Labels:**
- Adicionar `aria-label` em todos os botões sem texto
- Adicionar `role="img"` e `aria-label` em todos os SVGs
- Adicionar `aria-live` para regiões dinâmicas (alerts, toasts)
- Adicionar `aria-expanded` para elementos expansíveis (accordions, dropdowns)

**HTML Semântico:**
- Usar `<header>` para cabeçalhos
- Usar `<nav>` para navegação
- Usar `<main>` para conteúdo principal
- Usar `<section>` para seções de conteúdo
- Usar `<article>` para conteúdo independente
- Usar `<aside>` para conteúdo relacionado
- Usar `<footer>` para rodapés

**Navegação por Teclado:**
- Garantir que todos os elementos interativos sejam acessíveis por teclado
- Implementar skip links para pular navegação
- Garantir ordem lógica de tab
- Implementar atalhos de teclado quando apropriado

### 6.3 Suporte a `prefers-*` Media Queries

**`prefers-reduced-motion` (Já Implementado):**
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**`prefers-contrast` (Não Implementado):**
```css
@media (prefers-contrast: more) {
  :root {
    --bg-primary: #ffffff;
    --text-primary: #000000;
    --border-default: #000000;
  }
}

@media (prefers-contrast: less) {
  :root {
    --bg-primary: #f5f5f7;
    --text-primary: #1a1a2e;
    --border-default: #e5e7eb;
  }
}
```

**`prefers-reduced-transparency` (Não Implementado):**
```css
@media (prefers-reduced-transparency: reduce) {
  :root {
    --bg-glass: rgba(255, 255, 255, 1);
    --bg-overlay: rgba(0, 0, 0, 1);
  }
}
```

**`prefers-color-scheme` (Já Implementado):**
```css
@media (prefers-color-scheme: dark) {
  :root {
    /* Variáveis de tema escuro */
  }
}
```

### 6.4 Integração com Features Futuras

**PWA (Fase 4):**
- Garantir que tema funcione em installed PWA
- Persistir tema em localStorage para PWA offline
- Suportar tema do sistema em PWA

**Navegação Avançada (Fase 4):**
- Garantir que tema funcione em todas as views
- Manter consistência visual em navegação

**Exportação de Dados (Fase 5):**
- Garantir que tema seja aplicado em views de exportação
- Manter consistência visual

---

## 7. Plano de Implementação Detalhado

### 7.1 Plano para Corrigir F3.5 (Prioridade P0)

**Passo 1: Importar CSS Correto**
```javascript
// src/App.jsx
import './styles/index.css'  // ← Já existe
import './index.css'        // ← ADICIONAR ESTE
```

**Passo 2: Corrigir Seletor de Dark Mode**
```css
/* src/styles/tokens.css */
/* REMOVER: */
@media (prefers-color-scheme: light) {
  :root {
    /* ... */
  }
}

/* ADICIONAR: */
[data-theme="dark"] {
  --bg-primary: #050505;
  --bg-secondary: #121212;
  --bg-tertiary: #1E1E1E;
  --text-primary: #ffffff;
  --text-secondary: #b4b4c8;
  --text-tertiary: #7a7a8c;
  /* ... */
}
```

**Passo 3: Unificar Nomenclatura de Variáveis**
```css
/* Escolher padrão do PRD: */
--bg-primary (em vez de --color-bg-primary)
--text-primary (em vez de --color-text-primary)
--accent-primary (em vez de --color-primary)

/* Atualizar src/index.css para usar padrão do PRD */
```

**Passo 4: Migrar Cores Hardcoded Críticas**
```css
/* Dashboard.css - Exemplos */
.dashboard-container-v2 {
  color: var(--text-primary);  /* em vez de #fff */
}

.bottom-nav-container {
  background: var(--bg-glass);  /* em vez de rgba(10, 10, 15, 0.95) */
}
```

**Passo 5: Testar Toggle de Tema**
1. Abrir app
2. Clicar em ThemeToggle
3. Verificar se tema muda
4. Verificar se transição é suave
5. Verificar se localStorage é atualizado
6. Recarregar página e verificar se tema é persistido

**Estimativa de Esforço:** 2-3 horas

### 7.2 Plano para Melhorias de Arquitetura CSS (Prioridade P1)

**Fase 1: Criar Estrutura de Tokens**
1. Criar diretório `src/styles/tokens/`
2. Criar arquivos:
   - `colors.css`
   - `typography.css`
   - `spacing.css`
   - `borders.css`
   - `shadows.css`
   - `transitions.css`
   - `z-index.css`
3. Migrar variáveis existentes para nova estrutura
4. Atualizar `src/styles/index.css` para importar tokens

**Fase 2: Migrar Cores Hardcoded**
1. Criar mapeamento de cores para variáveis
2. Substituir gradualmente por componente (prioridade: Dashboard, BottomNav, Settings)
3. Validar visualmente após cada migração
4. Testar em ambos os temas

**Fase 3: Unificar Nomenclatura**
1. Renomear todas as variáveis para padrão do PRD
2. Atualizar referências em todos os componentes
3. Remover variáveis obsoletas
4. Validar que não há referências quebradas

**Fase 4: Melhorar HTML Semântico**
1. Adicionar `role` e `aria-label` em SVGs
2. Adicionar `aria-label` em botões sem texto
3. Substituir `div` por elementos semânticos onde apropriado
4. Adicionar skip links para navegação por teclado

**Estimativa de Esforço:** 8-12 horas

### 7.3 Plano para CSS Modules (Prioridade P2)

**Fase 1: Piloto**
1. Escolher `Dashboard.jsx` como piloto
2. Converter para CSS Modules:
   - Renomear `Dashboard.css` para `Dashboard.module.css`
   - Atualizar imports em `Dashboard.jsx`
   - Usar `styles.className` em vez de strings
3. Validar funcionamento
4. Documentar aprendizados

**Fase 2: Expansão**
1. Converter componentes de prioridade alta:
   - `SmartAlerts.jsx`
   - `TreatmentAccordion.jsx`
   - `SwipeRegisterItem.jsx`
   - `SparklineAdesao.jsx`
2. Reutilizar padrões da fase piloto
3. Validar funcionamento

**Fase 3: Avaliação**
1. Avaliar se vale a pena converter componentes de prioridade média/baixa
2. Manter CSS global para componentes simples
3. Documentar decisão

**Estimativa de Esforço:** 6-8 horas

### 7.4 Plano para Acessibilidade (Prioridade P2)

**Fase 1: Contraste WCAG AA**
1. Validar todas as combinações de cor
2. Ajustar cores que não atendem WCAG AA
3. Documentar cores válidas
4. Criar testes automatizados para contraste

**Fase 2: ARIA Labels**
1. Adicionar `aria-label` em todos os botões sem texto
2. Adicionar `role="img"` e `aria-label` em todos os SVGs
3. Adicionar `aria-live` para regiões dinâmicas
4. Adicionar `aria-expanded` para elementos expansíveis

**Fase 3: HTML Semântico**
1. Substituir `div` por elementos semânticos onde apropriado
2. Adicionar skip links para navegação por teclado
3. Garantir ordem lógica de tab
4. Implementar atalhos de teclado quando apropriado

**Fase 4: prefers-* Media Queries**
1. Implementar `prefers-contrast`
2. Implementar `prefers-reduced-transparency`
3. Testar com ferramentas de acessibilidade
4. Documentar suporte

**Estimativa de Esforço:** 6-8 horas

### 7.5 Ordem de Implementação

**Ordem Recomendada:**

1. **Fase 1 (Crítica - P0):** Corrigir F3.5
   - Importar CSS correto
   - Corrigir seletor de dark mode
   - Unificar nomenclatura
   - Migrar cores hardcoded críticas
   - **Tempo:** 2-3 horas

2. **Fase 2 (Manutenibilidade - P1):** Melhorias de Arquitetura CSS
   - Criar estrutura de tokens
   - Migrar cores hardcoded
   - Unificar nomenclatura
   - **Tempo:** 8-12 horas

3. **Fase 3 (Escalabilidade - P2):** CSS Modules
   - Piloto em Dashboard
   - Expansão para componentes complexos
   - **Tempo:** 6-8 horas

4. **Fase 4 (Acessibilidade - P2):** Melhorias de Acessibilidade
   - Contraste WCAG AA
   - ARIA labels
   - HTML semântico
   - prefers-* media queries
   - **Tempo:** 6-8 horas

**Tempo Total Estimado:** 22-31 horas

---

## 8. Resumo Executivo

### 8.1 Problemas Críticos (Bloqueiam F3.5)

1. **CSS File Não Importado** - `src/index.css` nunca é carregado
2. **Seletor Errado** - CSS usa `@media` em vez de `[data-theme]`
3. **Nomes Inconsistentes** - Três convenções diferentes de variáveis
4. **Cores Hardcoded** - 148 instâncias impedem tema de funcionar

### 8.2 Avaliação de Arquitetura

**Manutenibilidade: 4/10**
- Inconsistência de nomenclatura causa confusão
- Cores hardcoded impedem evolução
- Múltiplos arquivos globais causam confusão

**Escalabilidade: 3/10**
- Dificulta adicionar novos temas
- Dificulta adicionar novos componentes
- Dificulta suporte a novos recursos

### 8.3 Recomendações Principais

1. **Corrigir F3.5 Imediatamente (P0)**
   - Importar `src/index.css` em `App.jsx`
   - Usar `[data-theme="dark"]` em vez de `@media`
   - Unificar nomenclatura de variáveis

2. **Migrar Cores Hardcoded (P1)**
   - Substituir 148 instâncias de cores hexadecimais
   - Usar variáveis CSS para todas as cores
   - Validar contraste WCAG AA

3. **Melhorar Arquitetura CSS (P1)**
   - Criar estrutura de tokens por categoria
   - Unificar nomenclatura de variáveis
   - Considerar CSS Modules para componentes complexos

4. **Melhorar Acessibilidade (P2)**
   - Adicionar ARIA labels em todos os elementos
   - Melhorar HTML semântico
   - Implementar `prefers-contrast` e `prefers-reduced-transparency`

### 8.4 Próximos Passos

1. **Agente Code Mode:**
   - Implementar correções críticas do F3.5
   - Migrar cores hardcoded
   - Unificar nomenclatura de variáveis
   - Melhorar arquitetura CSS
   - Melhorar acessibilidade

2. **Validação:**
   - Testar toggle de tema em ambos os modos
   - Validar contraste WCAG AA
   - Testar acessibilidade com ferramentas
   - Testar responsividade

3. **Documentação:**
   - Atualizar documentação de arquitetura
   - Documentar padrões de CSS
   - Criar guia de contribuição para CSS

---

## 9. Apêndice

### 9.1 Mapeamento de Cores Hardcoded

**Arquivos com Mais Cores Hardcoded:**
1. `Dashboard.css` - 30+ instâncias
2. `BottomNav.css` - 5+ instâncias
3. `Settings.css` - 10+ instâncias
4. `Landing.css` - 5+ instâncias
5. `Auth.css` - 5+ instâncias

**Padrões Identificados:**
- Cores de texto: `#fff`, `#000`, `rgba(255, 255, 255, 0.6)`
- Cores de fundo: `rgba(10, 10, 15, 0.95)`, `linear-gradient(...)`
- Cores de borda: `rgba(255, 255, 255, 0.1)`
- Cores de estado: `#32d74b` (success), `#ff3b30` (error)

### 9.2 Variáveis CSS Atuais vs. PRD

**PRD Especifica:**
```css
--bg-primary
--bg-secondary
--bg-card
--text-primary
--text-secondary
--accent-primary
--accent-success
--accent-warning
--accent-danger
--border
```

**Implementação Atual Usa:**
```css
--color-bg-primary
--color-bg-secondary
--color-bg-card
--color-text-primary
--color-text-secondary
--color-primary
--color-success
--color-warning
--color-error
--color-border-default
```

**Conflito:** Nomes diferentes para mesma funcionalidade

### 9.3 Checklist de Validação

**F3.5:**
- [ ] Tema segue preferência do sistema por padrão
- [ ] Usuário pode alternar manualmente via toggle
- [ ] Preferência manual persistida em localStorage
- [ ] Transição suave entre temas (sem flash)
- [ ] Contraste WCAG AA em ambos os temas (ratio >= 4.5:1)
- [ ] Todos os componentes existentes funcionam em ambos os temas
- [ ] HealthScoreCard SVG adapta cores ao tema

**Arquitetura CSS:**
- [ ] Variáveis CSS organizadas por categoria
- [ ] Nomenclatura consistente de variáveis
- [ ] Sem cores hardcoded
- [ ] CSS Modules para componentes complexos
- [ ] HTML semântico completo
- [ ] ARIA labels em todos os elementos
- [ ] Suporte a prefers-contrast
- [ ] Suporte a prefers-reduced-transparency

---

**Fim do Relatório**
