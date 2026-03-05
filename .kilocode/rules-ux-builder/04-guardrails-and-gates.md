# UX Builder — Guardrails e Quality Gates

## Guardrails por Onda

### Onda 1 — Componentes Visuais (RISCO BAIXO)

**PERMITIDO:**
- Criar componentes novos isolados (RingGauge, StockBars, CostChart)
- Editar componentes existentes para adicionar funcionalidade (SparklineAdesao, Calendar)
- Criar CSS com tokens do design system
- Usar Framer Motion para animacoes

**PROIBIDO:**
- Importar DashboardProvider ou useDashboardContext
- Modificar Dashboard.jsx
- Modificar App.jsx ou BottomNav.jsx
- Criar hooks que acessam context
- Alterar routing ou navegacao

**REGRA:** Componentes da Onda 1 recebem TUDO via props. Sao componentes puros.

### Onda 2 — Logica e Hooks (RISCO MEDIO)

**PERMITIDO:**
- Criar hooks customizados (useDoseZones, useComplexityMode)
- Importar DashboardProvider/useDashboardContext nos hooks
- Editar Dashboard.jsx com mudancas MINIMAS (adicionar import + JSX)
- Integrar componentes da Onda 1 no Dashboard

**PROIBIDO:**
- Reescrever Dashboard.jsx (932 linhas) — apenas edits cirurgicos
- Modificar App.jsx ou BottomNav.jsx
- Alterar routing ou navegacao
- Remover funcionalidade existente do Dashboard

**REGRA:** Edits no Dashboard.jsx devem ser minimos: adicionar import + JSX call.
Se precisar de mais de 20 linhas de mudanca, reavaliar a abordagem.

### Onda 3 — Navegacao (RISCO ALTO)

**PERMITIDO:**
- Modificar BottomNav.jsx (5->4 tabs)
- Modificar App.jsx (routing)
- Criar views novas (Treatment.jsx, Profile.jsx)
- Migrar funcionalidade entre views

**PROIBIDO:**
- Fazer todas as mudancas de uma vez (steps atomicos!)
- Deletar views existentes antes de ter as novas prontas
- Quebrar a navegacao em qualquer momento do processo

**REGRA:** Primeiro ADICIONAR novas tabs/views, depois REMOVER as antigas.
Testar cada tab individualmente antes de integrar.

## Quality Gates

### Gate 1 (apos Onda 1)

Todos devem passar ANTES de iniciar Onda 2:

```
[ ] Cada componente novo renderiza corretamente com dados mock
[ ] npm run validate:agent passa sem erros
[ ] npm run build passa sem erros
[ ] Dashboard atual NAO foi modificado (sem regressao)
[ ] Todos os criterios de aceite de cada spec estao marcados
```

### Gate 2 (apos Onda 2)

Todos devem passar ANTES de iniciar Onda 3:

```
[ ] Hook useDoseZones() retorna zonas corretas para diferentes horarios
[ ] Hook useComplexityMode() retorna modo correto por quantidade de meds
[ ] Toggle hora/plano funciona com dados reais
[ ] Dashboard renderiza com os novos componentes integrados
[ ] Integracao com DashboardProvider validada
[ ] Testes unitarios cobrem edge cases temporais (vi.useFakeTimers)
[ ] npm run validate:agent passa
[ ] npm run build passa
```

### Gate 3 (apos Onda 3 — FINAL)

```
[ ] Navegacao 4 tabs funcional sem dead-ends
[ ] Todas as views existentes acessiveis pelo novo layout
[ ] Wizard de cadastro substitui window.confirm chain
[ ] Nenhuma funcionalidade perdida na reorganizacao
[ ] Medicamentos e Protocolos acessiveis via Perfil > Meu Tratamento
[ ] npm run validate:agent passa
[ ] npm run build passa
```

## Anti-patterns especificos de UX

| Anti-pattern | O que fazer em vez disso |
|-------------|-------------------------|
| Criar componente fora do path da spec | Usar o caminho EXATO |
| Adicionar prop nao especificada | Perguntar ao Opus/arquiteto |
| Usar hex direto no CSS | Usar var(--token) |
| Esquecer empty state | Toda lista precisa de empty state |
| Esquecer loading state | Skeleton ou indicador de progresso |
| Spinner em vez de skeleton | Skeleton para layouts previsiveis |
| Animacao sem reduced-motion | Sempre incluir fallback |
| Click handler sem feedback visual | Hover + active states |
| Texto truncado sem title/tooltip | Adicionar title no elemento |
| SVG sem role="img" e aria-label | Acessibilidade obrigatoria |

## Validacao final antes de PR

```bash
# 1. Lint
npm run lint

# 2. Testes
npm run validate:agent

# 3. Build
npm run build

# 4. Verificar que nao criou duplicatas
find src -name "*NomeComponente*" -type f

# 5. Verificar imports
grep -r "from.*NomeComponente" src/
```

## Reportando bloqueios

Se uma task esta BLOQUEADA (ex: W1-07 depende de F5.9):
1. NAO tentar implementar sem a dependencia
2. Reportar: "Task W1-07 BLOQUEADA: depende de F5.9 (Prescricoes)"
3. Passar para a proxima task disponivel
4. Atualizar o status no master doc

Se encontrar algo na spec que parece errado ou ambiguo:
1. NAO adivinhar a intencao
2. Reportar a ambiguidade com citacao da spec
3. Sugerir interpretacoes possiveis
4. Aguardar orientacao
