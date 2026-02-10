Criei o documento de estratégia de melhorias visuais em [`plans/ESTRATEGIA_MELHORIAS_VISUAIS_FASE3.5.md`](plans/ESTRATEGIA_MELHORIAS_VISUAIS_FASE3.5.md).

## Resumo da Estratégia

O documento propõe melhorias visuais priorizadas para reintroduzir interesse visual mantendo estritamente a arquitetura de tokens CSS existente:

### 🔴 P0 - CRÍTICO (Impacto Imediato)

1. **Variação de Border-Radius por Tipo de Componente**
   - Criar tokens específicos: `--radius-hero` (24px), `--radius-card-xl` (20px), `--radius-card-lg` (16px), `--radius-card-md` (12px), `--radius-card-sm` (8px)
   - Mapeamento completo por componente (Health Score, Smart Alerts, Treatment Accordion, etc.)

2. **Sistema de Sombras em Camadas (Layered Shadows)**
   - 5 níveis de sombras: `--shadow-layer-1` a `--shadow-layer-5`
   - Sombras específicas por componente: `--shadow-card`, `--shadow-hero`, `--shadow-alert-critical`
   - Dark mode overrides com sombras mais intensas

3. **Espaçamento Hierárquico (Spacing Hierarchy)**
   - Tokens para seções: `--spacing-section-hero`, `--spacing-section-major`, `--spacing-section-minor`
   - Tokens para componentes: `--spacing-component-loose`, `--spacing-component-normal`, `--spacing-component-compact`
   - Tokens para listas: `--spacing-list-loose`, `--spacing-list-normal`, `--spacing-list-compact`

### 🟡 P1 - ALTO (Impacto Significativo)

4. **Gradientes e Glassmorphism Refinados**
   - 4 níveis de glassmorphism: light, padrão, intenso, hero
   - Gradientes contextuais: `--gradient-insight`, `--gradient-hero`, `--gradient-alert-critical`

5. **Contraste e Legibilidade Aprimorados**
   - Refinamento de cores de texto: `--text-primary-dark`, `--text-secondary-dark`
   - Melhor contraste para leitura em ambos os temas

6. **Micro-interações Visuais**
   - Transições específicas: `--transition-hover`, `--transition-focus`, `--transition-active`
   - Scale effects e glow transitions

### 🟢 P2 - MÉDIO (Impacto Moderado)

7. **Bordas com Variação de Espessura**
   - Tokens: `--border-width-subtle`, `--border-width-default`, `--border-width-prominent`, `--border-width-hero`

8. **Glow Effects Contextuais**
   - Glow para hover, focus, active, critical e success

## Conteúdo do Documento

O documento inclui:
- **Exemplos de código CSS** completos para cada melhoria
- **Visualizações ASCII** mostrando hierarquia visual e mapeamento de componentes
- **Exemplos de implementação** para SmartAlerts, HealthScoreCard e InsightCard
- **Guia de implementação** passo a passo com priorização
- **Checklist de validação** para visual, técnico e acessibilidade

## Próximos Passos

Para implementar esta estratégia, recomendo:
1. Criar uma nova branch Git: `feat/fase3.5-melhorias-visuais`
2. Implementar melhorias P0 primeiro (border-radius, sombras, espaçamento)
3. Validar em ambiente de desenvolvimento
4. Implementar melhorias P1 e P2 incrementalmente
5. Testar em ambos os temas (claro/escuro)
6. Validar acessibilidade WCAG AA

O documento está em português e segue o formato Markdown compatível com o restante da documentação do projeto.