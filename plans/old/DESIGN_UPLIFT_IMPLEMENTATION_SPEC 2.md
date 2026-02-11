# Especificação de Implementação - Design Uplift

**Baseado nas escolhas do usuário:**
1. ✅ Referência: `mobile.jpg` (design original otimizado)
2. ✅ Glassmorphism: Manter com intensidade reduzida
3. ✅ Correção: Implementação completa
4. ✅ Densidade: Máxima (similar ao mobile.jpg original)
5. ✅ Botão "+ Registro Manual": Fixed no bottom acima da navegação

---

## Resumo das Decisões

### Estilo Visual Alvo
- **Referência primária:** [`mobile.jpg`](public/mobile.jpg)
- **Características:** Interface compacta, densidade alta, hierarquia visual clara
- **Glassmorphism:** Presente mas sutil (não dominante)
- **Prioridade:** Informação primeiro, decoração segundo

### Arquivos a Modificar

| Arquivo | Prioridade | Mudanças Principais |
|---------|------------|---------------------|
| `src/styles/tokens/spacing.css` | P0 - Crítico | Fixar referências circulares, reduzir valores |
| `src/components/ui/Button.css` | P0 - Crítico | Reduzir padding, limitar max-width |
| `src/views/Dashboard.css` | P0 - Crítico | Hardcoded→tokens, reduzir gaps/padding |
| `src/components/dashboard/HealthScoreCard.css` | P1 - Alta | Reduzir tamanho, padding, intensidade glass |
| `src/components/dashboard/TreatmentAccordion.css` | P1 - Alta | Reduzir padding, intensidade glass |
| `src/components/dashboard/SmartAlerts.css` | P1 - Alta | Reduzir padding, tornar mais compacto |
| `src/styles/tokens/transitions.css` | P2 - Média | Reduzir valores de scale |
| `src/styles/tokens/borders.css` | P2 - Média | Simplificar radius |
| `src/views/Dashboard.jsx` | P1 - Alta | Posicionar botão registro manual |

---

## Especificações Técnicas por Componente

### 1. Spacing Tokens (spacing.css)

```css
/* CORREÇÃO CRÍTICA - Remover circularidade */
--space-1: 0.25rem;     /* 4px - Valor absoluto */
--space-2: 0.5rem;      /* 8px */
--space-3: 0.75rem;     /* 12px */
--space-4: 1rem;        /* 16px */

/* Aliases - usar valores absolutos, não referências circulares */
--spacing-xs: 0.25rem;
--spacing-sm: 0.5rem;
--spacing-md: 0.75rem;   /* MOBILE: era 16px, agora 12px */
--spacing-lg: 1rem;

/* Hierárquicos - REDUZIDOS */
--spacing-section-major: 1rem;      /* era 24px */
--spacing-component-normal: 0.75rem; /* era 16px */
--spacing-list-normal: 0.5rem;       /* era 12px */
```

### 2. Botões (Button.css)

```css
/* Tamanhos - REDUZIDOS para mobile.jpg */
.btn-sm {
  padding: 4px 12px;      /* 0.25rem 0.75rem */
  font-size: 12px;
  min-height: 28px;
}

.btn-md {
  padding: 8px 16px;      /* 0.5rem 1rem */
  font-size: 14px;
  min-height: 36px;
}

.btn-lg {
  padding: 12px 24px;     /* 0.75rem 1.5rem - era 32px/128px! */
  font-size: 16px;
  min-height: 44px;
  max-width: 100%;
}

/* Scale reduzido - menos intrusivo */
--scale-hover: 1.02;     /* era 1.05+ */
--scale-active: 0.98;    /* era 0.95 */
```

### 3. Dashboard Container (Dashboard.css)

```css
.dashboard-container-v2 {
  padding: 12px;          /* 0.75rem - era 24px */
  max-width: 100%;
}

.top-cards-grid {
  gap: 8px;               /* 0.5rem - era 16px */
  margin-bottom: 12px;    /* era 24px */
}

.info-card {
  padding: 12px;          /* era 20px */
  height: auto;
  min-height: 70px;       /* era 120px */
}

.highlight-value {
  font-size: 20px;        /* era 28px */
}
```

### 4. HealthScoreCard (HealthScoreCard.css)

```css
.health-score-card {
  padding: 12px;          /* era 16-24px */
  min-height: unset;
  max-height: 100px;      /* Limitar altura */
  backdrop-filter: blur(8px);  /* era 12px+ */
  border-width: 1px;      /* era 2.5px */
}

.health-score-card__chart {
  width: 56px;            /* era 80px */
  height: 56px;
}

.health-score-card__value {
  font-size: 20px;        /* manter */
}
```

### 5. TreatmentAccordion (TreatmentAccordion.css)

```css
.treatment-accordion {
  padding: 0;             /* Remover padding do container */
  margin-bottom: 8px;     /* era 16px */
  backdrop-filter: blur(4px);  /* Sutil */
  border-width: 1px;
}

.treatment-accordion__header {
  padding: 12px;          /* Compacto */
}

.treatment-accordion__title {
  font-size: 14px;        /* Base */
  font-weight: 600;
}

.treatment-accordion__batch-btn {
  padding: 4px 12px;      /* Pequeno */
  font-size: 10px;
}
```

### 6. SmartAlerts (SmartAlerts.css)

```css
.smart-alerts {
  gap: 8px;               /* era 12px */
  margin-bottom: 16px;    /* era 24px */
}

.smart-alert {
  padding: 12px;          /* era 12px+ */
  backdrop-filter: blur(4px);  /* Sutil */
}

.smart-alert__title {
  font-size: 14px;        /* era 16px */
}

.smart-alert__message {
  font-size: 12px;        /* manter */
}
```

### 7. Botão Registro Manual (Dashboard.jsx + CSS)

```css
.manual-register-fab {
  position: fixed;
  bottom: 80px;           /* Acima da bottom nav (~60px + gap) */
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  
  /* Estilo compacto */
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 9999px;
  background: linear-gradient(90deg, #00E5FF, #AA00FF);
  color: #000;
  box-shadow: 0 4px 12px rgba(0, 229, 255, 0.3);
  
  /* Touch target */
  min-height: 44px;
  min-width: 160px;
}
```

---

## Checklist de Validação Visual

### Comparação com mobile.jpg

| Elemento | mobile.jpg | Atual | Target |
|----------|------------|-------|--------|
| Cards topo (grid) | 2 cols compactos | 2 cols grandes | ✅ Similar mobile.jpg |
| HealthScore | Card médio (~100px) | Card grande (~180px) | Reduzir |
| Próxima Dose | Card compacto | Card espaçado | Densificar |
| Botão TOMAR | Botão pequeno inline | Botão destacado | Inline small |
| Espaçamento | 8-12px entre elementos | 16-24px | Reduzir |
| Info por tela | 6-8 cards | 3-4 cards | Densificar |

### Testes de Regressão

- [ ] Botão não ocupa largura total
- [ ] HealthScore tem altura < 120px
- [ ] Cards de tratamento são compactos
- [ ] Scroll da página mostra mais conteúdo
- [ ] Hierarquia visual é clara
- [ ] Touch targets ≥ 44px
- [ ] Contraste WCAG AA mantido

---

## Comandos de Build/Test

```bash
# Verificar lint
npm run lint

# Build para verificar erros
npm run build

# Testes críticos
npm run test:critical

# Preview local
npm run dev
```

---

## Notas de Implementação

1. **Preservar funcionalidade**: Alterações são apenas CSS, não mudar lógica
2. **Tokens**: Manter nomes dos tokens, apenas ajustar valores
3. **Responsivo**: Mobile-first, testar em 375px (iPhone)
4. **Acessibilidade**: Manter focus states, contrastes
5. **Performance**: Glassmorphism reduzido = melhor performance

---

*Especificação finalizada - Pronta para implementação.*
