# Sistema de Insight Cards (Hints) — Dashboard PWA

> **Última atualização:** 2026-06-26
> **Arquivos-chave:**
> - `apps/web/src/features/dashboard/services/insightService.js`
> - `apps/web/src/features/dashboard/services/_insightGenerators.js`
> - `apps/web/src/features/dashboard/components/InsightCard.jsx` + `InsightCard.css`
> - `apps/web/src/views/Dashboard.jsx` (`selectCurrentInsight`, `handleDismissInsight`)
> - `apps/web/src/views/DashboardColumnLeft.jsx`

---

## O que é

O sistema de Insight Cards exibe um cartão contextual na coluna esquerda do Dashboard. Ele seleciona automaticamente o insight mais relevante para o usuário com base em dados de adesão, estoque, streak e uso de features. Só um card é exibido por vez.

**Não confundir com SmartAlerts** — esse componente foi removido em 2026-06-26. O `InsightCard` é o único mecanismo de dicas/hints do Dashboard.

---

## Arquitetura

```
Dashboard.jsx
  └── useDashboardViewState()
        ├── selectCurrentInsight({ stats, stockSummary, logs, protocols, onNavigate, excludeIds })
        │     └── insightService.selectBestInsight(params)
        │           └── generateAllInsights(params)  ← _insightGenerators.js
        ├── dismissedInsightIds: string[]  (estado local, volátil — reset no reload)
        └── handleDismissInsight(id)  → adiciona ao array → insight recalcula

DashboardColumnLeft.jsx
  └── <InsightCard insight={...} onDismiss={handleDismissInsight} />
```

### Fluxo de seleção

1. `generateAllInsights` executa todos os generators e filtra os que retornam `null`
2. `selectBestInsight` exclui IDs dispensados (`excludeIds`) e o último exibido (via `localStorage`)
3. Ordena por prioridade (`critical > high > medium > low > info`)
4. Retorna o primeiro candidato; se lista vazia e `'default'` não dispensado → retorna insight padrão; se `'default'` também dispensado → retorna `null` (box some)

### Persistência

- **Histórico de rotação** — `localStorage` key `mr_insight_history`, máx 10 entradas, evita repetir o último insight exibido entre sessões
- **IDs dispensados** — estado React local (`dismissedInsightIds`), volátil, resetado ao recarregar a página

---

## Catálogo de Insights

### Positivos — `ADHERENCE_POSITIVE`

| ID | Ícone | Gatilho | Prioridade | CTA | Destino |
|----|-------|---------|-----------|-----|---------|
| `streak_achievement` | 🔥 | streak atual ≥ 5 dias | low | Ver Histórico | `'history'` |
| `perfect_week` | ⭐ | adesão = 100% nos últimos 7 dias | low | Ver Histórico | `'history'` |
| `good_week` | 👍 | adesão entre 80%–99% | low | Ver Histórico | `'history'` |
| `improvement` | 📈 | tendência de alta ≥ 10% vs semana anterior | low | Ver Histórico | `'history'` |
| `stock_healthy` | ✅ | nenhum estoque baixo ou zerado | info | Ver Estoque | `'stock'` |

### Motivacionais — `ADHERENCE_MOTIVATIONAL`

| ID | Ícone | Gatilho | Prioridade | CTA | Destino |
|----|-------|---------|-----------|-----|---------|
| `missed_doses_today` | ⏰ | 1 ou 2 doses pendentes hoje | medium | Registrar Dose | abre `GlobalDoseModal` via `mr:open-dose-modal` |
| `low_adherence_week` | 💪 | adesão < 80% (excluindo 0%) | medium | Ver Histórico | `'history'` |
| `streak_broken` | 🔄 | streak = 0 e recorde histórico ≥ 3 dias | high | Registrar Dose | abre `GlobalDoseModal` via `mr:open-dose-modal` |
| `weak_day` | 📅 | dia da semana com < 50% da adesão do melhor dia | medium | Configurar Avisos | `'inbox'` |

### Lembretes — `PROTOCOL_REMINDER`

| ID | Ícone | Gatilho | Prioridade | CTA | Destino |
|----|-------|---------|-----------|-----|---------|
| `protocol_reminder` | 📋 | entre 1 e 3 tratamentos ativos | info | Ver Tratamentos | `'treatments'` |

### Oportunidades — `IMPROVEMENT_OPPORTUNITY`

| ID | Ícone | Gatilho | Prioridade | CTA | Destino |
|----|-------|---------|-----------|-----|---------|
| `best_time` | 🕐 | usuário tem ≥ 3 registros no mesmo horário (últimos 7 dias) | info | Configurar Avisos | `'inbox'` |

### Fallback

| ID | Ícone | Quando | Prioridade | CTA |
|----|-------|--------|-----------|-----|
| `default` | 💡 | nenhum insight aplicável | info | — (sem CTA) |

---

## Prioridades

```js
INSIGHT_PRIORITY = {
  critical: 1,
  high:     2,
  medium:   3,
  low:      4,
  info:     5,
}
```

Menor número = maior prioridade. Dentro da mesma prioridade, a posição no array `generators` desempata.

---

## Abertura do modal de dose a partir de insights

`missed_doses_today` e `streak_broken` disparam `window.dispatchEvent(new CustomEvent('mr:open-dose-modal'))`. O `App.jsx` escuta esse evento e chama `setIsDoseModalOpen(true)`. Não há prop drilling — o insight não precisa receber nenhum callback extra.

Padrão equivalente ao `mr:open-measure-log` já existente.

---

## Comportamento do botão "Dispensar"

- Clique chama `onDismiss(insight.id)` no `InsightCard`
- `handleDismissInsight` adiciona o ID a `dismissedInsightIds[]`
- `useMemo` de `currentInsight` recomputa com `excludeIds` atualizado
- `selectBestInsight` pula todos os IDs dispensados e retorna o próximo diferente disponível
- Se não houver próximo, exibe o insight `default` (sem CTA)
- Ao dispensar o `default`, `selectBestInsight` retorna `null` → `DashboardColumnLeft` oculta o box inteiro
- **Sem persistência** — `dismissedInsightIds` é estado React local; reset completo ao recarregar a página

---

## Como adicionar um novo insight

### 1. Criar o generator em `_insightGenerators.js`

```js
export function createMeuInsight(dado, onNavigate) {
  if (!condicao(dado)) return null   // retorna null se não aplicável
  return {
    id: 'meu_insight',               // único, snake_case
    type: IT.ADHERENCE_MOTIVATIONAL, // usar constante IT local
    priority: 'medium',              // critical|high|medium|low|info
    icon: '🎯',
    text: 'Mensagem exibida ao usuário.',
    highlight: 'Trecho em destaque',
    actionLabel: 'Texto do CTA',
    onAction: () => {
      analyticsService.track('insight_action', { insight_id: 'meu_insight' })
      onNavigate?.('rota-destino')
    },
  }
}
```

### 2. Registrar em `insightService.js` → `generateAllInsights`

```js
import { createMeuInsight } from './_insightGenerators'

// dentro de generators[]:
() => createMeuInsight(dado, onNavigate),
```

### 3. Adicionar o dado ao payload em `Dashboard.jsx` → `selectCurrentInsight`

Se o generator precisa de um dado novo (ex.: `medicamentos`), adicionar ao objeto passado para `insightService.selectBestInsight`.

### 4. Registrar o tipo em `InsightCard.jsx` (se novo tipo)

Adicionar entradas em `getBadgeLabel` e `getIconComponent` para o novo `INSIGHT_TYPES` value.

---

## Regras de manutenção

- **Nunca** criar lógica de domínio dentro do `InsightCard` — ele é puramente de apresentação
- **Nunca** acessar `localStorage` diretamente fora de `insightService.js`
- Cada generator **deve** retornar `null` quando a condição não for atendida — não lançar exceção
- IDs de insight **devem** ser únicos globalmente; duplicatas causam comportamento inesperado na rotação
- O campo `actionLabel` é obrigatório para que o CTA apareça; omiti-lo esconde o botão silenciosamente
- Para CTA que abre o modal de dose: usar `window.dispatchEvent(new CustomEvent('mr:open-dose-modal'))` — não passar callback via prop
- Para CTA que navega: usar `onNavigate?.('rota')` — rotas válidas: `'history'`, `'stock'`, `'treatments'`, `'inbox'`, `'profile'`
- `onDismiss` é sempre passado pelo `DashboardColumnLeft` — o `InsightCard` não deve ter lógica própria de dismiss
- Dispensar o insight `default` oculta o box inteiro — não criar fallback de fallback

---

## Tipos de insight disponíveis (INSIGHT_TYPES)

```js
ADHERENCE_POSITIVE       // conquista / adesão boa
ADHERENCE_MOTIVATIONAL   // incentivo / adesão baixa
STREAK_CELEBRATION       // sequência de dias
STOCK_WARNING            // estoque crítico (reservado — não usado ativamente)
PROTOCOL_REMINDER        // lembrete de protocolo
MISSED_DOSE_ALERT        // dose perdida (reservado)
IMPROVEMENT_OPPORTUNITY  // sugestão de melhoria de hábito
```

---

## Frequência e frequency capping

`MIN_DISPLAY_INTERVAL = 0` — sem frequency capping ativo. A rotação é feita por exclusão do último ID exibido (via histórico no `localStorage`). Para reativar capping, alterar a constante e a lógica em `shouldShowInsight`.
