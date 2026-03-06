# PRD Fase 5.5: Inteligência Preditiva Client-Side

**Versão:** 1.1
**Status:** DRAFT
**Data:** 21/02/2026
**Fase do Roadmap:** 5.5 de 7 (nova — inserida entre Fases 5 e 6)
**Baseline:** Fase 5 concluída (relatórios, calendário, exportação) + Fase 4 (v2.8.1) já entregue
**Princípio:** Custo operacional R$ 0 — toda computação é client-side

---

## 1. Visão Geral e Objetivos Estratégicos

A Fase 5.5 transforma dados históricos já acumulados pelo app em insights acionáveis e previsões inteligentes — sem nenhuma chamada a API externa. O diferencial competitivo é claro: o app deixa de ser um "lembrador de doses" e passa a ser um "assistente de tratamento" que aprende com o comportamento do usuário.

**Premissa técnica:** O Meus Remédios já acumula dados ricos:
- `medication_logs.taken_at` — timestamps reais de doses (quando a dose foi tomada de fato)
- `protocols.time_schedule` — horários programados pelo usuário
- `stock_entries.quantity + unit_price` — volume e custo de compras
- Série histórica de `adherence_scores` calculados localmente

Toda a inteligência desta fase é **matemática sobre esses dados** — sem ML, sem Groq, sem custo.

### Objetivos Estratégicos

| ID | Objetivo | Métrica Primária |
|----|----------|-----------------|
| OE5.5.1 | Prever necessidade de reposição de estoque com antecedência | Alertas de reposição acionados > 60% usuários com estoque |
| OE5.5.2 | Identificar padrões de falha por dia/hora para intervenção personalizada | Heatmap visualizado > 40% usuários/semana |
| OE5.5.3 | Sugerir ajuste de horário de alarme baseado em comportamento real | Aceitação de sugestão > 30% quando exibida |
| OE5.5.4 | Alertar protocolos em risco de abandono antes que aconteçam | Score de risco exibido, alertas clicados > 20% |
| OE5.5.5 | Mostrar custo total do tratamento com análise por medicamento | Feature usada > 35% usuários com `unit_price` preenchido |

### Pré-requisitos

- Fase 5 concluída (cache SWR otimizado, dados de logs disponíveis)
- Mínimo 14 dias de dados de `medication_logs` para usuário (insights adaptativos)
- `insightService.js` existente como base para novos insights
- `adherenceTrendService.js` existente para cálculos de tendência

### Infraestrutura da Fase 4 que Acelera Esta Fase

| Entrega F4 | Como Beneficia a Fase 5.5 |
|-----------|--------------------------|
| `analyticsService.js` (F4.4, 7 eventos) | I01–I05 podem adicionar eventos de tracking sem nova infraestrutura |
| Sparkline 3-way Taken/Missed/Scheduled (pós-F4) | Padrão de classificação já estabelecido — I02 (heatmap) herda esta lógica |
| Tolerância 2h por dose (pós-F4) | I04 (score de risco) deve usar `isInToleranceWindow()` existente ao calcular doses perdidas |
| Push Notifications VAPID (F4.3) | I01 (previsão de reposição) pode disparar push nativo além do bot Telegram |
| Bot messageFormatter/errorHandler (F4.5) | Alertas de I01/I04 via bot têm formatação padronizada sem código adicional |

---

## 2. Features

### I01 — Previsão Inteligente de Reposição de Estoque

**Descrição:** Calcula a data estimada de esgotamento de cada medicamento com base no consumo real (não teórico), exibindo no dashboard e enviando alerta via Bot com antecedência configurável.

**Cálculo:**
```
consumo_diário_real = doses_tomadas_últimos_30d / 30
dias_restantes = estoque_atual_em_unidades / consumo_diário_real
data_esgotamento = hoje + dias_restantes
```

**Diferencial vs cálculo atual:** O cálculo atual usa `time_schedule.length × dosage_per_intake` (consumo teórico). O novo cálculo usa dados reais de `medication_logs`, refletindo a aderência efetiva do usuário.

**UI:**
- Card "Previsão de Estoque" no dashboard com lista de medicamentos e data estimada de reposição
- Destaque visual (cor âmbar) se < 14 dias, cor vermelha se < 7 dias
- Integração com notificação do Bot: "⚠️ Você precisará repor [Medicamento] até [Data]. Seu estoque atual dura X dias com seu ritmo de uso."

**Critérios de Aceitação:**
- [ ] Previsão exibida apenas para medicamentos com >= 14 dias de histórico de logs
- [ ] Fallback para cálculo teórico quando histórico insuficiente (com indicação visual)
- [ ] Alerta via Bot enviado 14 dias e 7 dias antes da data estimada
- [ ] Cálculo ocorre inteiramente no cliente (sem chamada adicional ao Supabase além do cache existente)

**Esforço:** 5 SP
**Arquivo(s) a criar/modificar:** `src/features/dashboard/services/refillPredictionService.js`, integração em `StockCard.jsx`

---

### I02 — Heatmap de Padrões de Aderência

**Descrição:** Visualização 7×24 (dias da semana × horas do dia) mostrando em quais dias e horários o usuário mais falha em tomar doses. Insight acionável: "Você falha mais às terças-feiras no período da tarde."

**Cálculo:**
```
Para cada dose esperada (cruzamento protocol.time_schedule × dias ativos):
  - Se log encontrado em ±2h do horário: dose tomada
  - Se não: dose perdida

Agrupar falhas por (weekday, hour_bucket) → taxa de falha
```

**UI:**
- Grid 7×6 (dias × períodos: madrugada/manhã/tarde/noite/noite-tarde/noite-alta) com intensidade de cor
- Verde = boa aderência, Âmbar = atenção, Vermelho = falha frequente
- Texto narrativo abaixo: "Seu pior momento é [dia] à [período]. Considere ajustar seus lembretes."
- Acessível: não depende apenas de cor (padrão de texto + ícone)

**Critérios de Aceitação:**
- [ ] Heatmap exibido apenas com >= 21 dias de dados
- [ ] Responsivo: em mobile, formato lista com barras de progresso por dia
- [ ] Respeita `prefers-reduced-motion`
- [ ] Texto narrativo gerado automaticamente com o pior dia/período

**Esforço:** 8 SP
**Arquivo(s) a criar:** `src/features/adherence/components/AdherenceHeatmap.jsx`, `src/utils/adherencePatternUtils.js`

---

### I03 — Otimizador de Horário de Lembrete

**Descrição:** Analisa a diferença entre o horário programado (`time_schedule`) e o horário real de tomada (`taken_at`) para sugerir ajuste de horário que corresponda ao comportamento real do usuário.

**Cálculo:**
```
Para cada protocol.time_schedule[i]:
  delta_médio = média(taken_at - scheduled_time) nos últimos 30 logs

Se abs(delta_médio) > 30 min E sample_size >= 10:
  sugerir novo horário = scheduled_time + delta_médio
```

**UI:**
- Notificação in-app (não intrusiva): "Você costuma tomar o Rivotril ~45 minutos mais tarde do que o lembrete. Ajustar para 21h45?"
- Botões: [Ajustar horário] [Manter como está] [Lembrar depois]
- Se aceito: chama `protocolService.update()` com o novo horário

**Critérios de Aceitação:**
- [ ] Sugestão exibida no máximo 1 vez por protocolo por semana
- [ ] Requer >= 10 amostras válidas para gerar sugestão
- [ ] Delta mínimo de 30 minutos para gerar sugestão (evitar ruído)
- [ ] Ajuste via UI atualiza `protocol.time_schedule` via `protocolService`

**Esforço:** 8 SP
**Arquivo(s) a criar:** `src/features/protocols/services/reminderOptimizerService.js`

---

### I04 — Score de Risco por Protocolo

**Descrição:** Classifica cada protocolo ativo como Estável / Atenção / Crítico com base nos últimos 14 dias de aderência e na tendência (melhorando ou piorando).

**Cálculo:**
```
aderência_14d = doses_tomadas / doses_esperadas (últimos 14 dias)
tendência = aderência_7d_recente - aderência_7d_anterior

score_risco:
  - ESTÁVEL: aderência >= 80% E tendência >= 0
  - ATENÇÃO: aderência 50-79% OU tendência < -10%
  - CRÍTICO: aderência < 50% OU tendência < -20%
```

**UI:**
- Badge de risco em cada protocolo no `TreatmentAccordion`
- Dashboard: destaque especial para protocolos Críticos com CTA para registrar dose
- SmartAlerts: protocolo Crítico gera alerta prioritário

**Critérios de Aceitação:**
- [ ] Score calculado apenas com >= 14 dias de dados no protocolo
- [ ] Protocolo Crítico gera `SmartAlert` com severidade `critical`
- [ ] Score atualizado a cada carregamento do dashboard (usa SWR cache)
- [ ] Exibido no relatório PDF da Fase 5 por protocolo

**Esforço:** 5 SP
**Arquivo(s) a criar/modificar:** `src/features/adherence/services/protocolRiskService.js`, integração em `TreatmentAccordion.jsx` e `SmartAlerts.jsx`

---

### I05 — Análise de Custo do Tratamento

**Descrição:** Exibe o custo total mensal do tratamento, com quebra por medicamento, usando o campo `unit_price` já existente em `stockSchema.js` e os dados de consumo real.

**Cálculo:**
```
custo_mensal_medicamento = consumo_real_mensal × unit_price
custo_total_mensal = Σ custo_mensal_por_medicamento
```

**UI:**
- Card "Custo do Tratamento" nas Configurações ou aba Estoque
- Lista de medicamentos com custo mensal estimado + total
- Comparativo com mês anterior (se dados disponíveis)
- Exportável como parte do relatório PDF (Fase 5)
- Se `unit_price = 0` para medicamento: exibir "Preço não cadastrado" com CTA para preencher

**Critérios de Aceitação:**
- [ ] Visível apenas quando ao menos 1 medicamento tem `unit_price > 0`
- [ ] Custo baseado em consumo real (logs), não consumo teórico
- [ ] Incluído no relatório PDF da Fase 5 como seção opcional
- [ ] Botão de ação: "Atualizar preço" leva direto ao formulário de estoque do medicamento

**Esforço:** 5 SP
**Arquivo(s) a criar:** `src/features/stock/services/costAnalysisService.js`, `src/features/stock/components/CostAnalysisCard.jsx`

---

## 3. Arquitetura Técnica

### Camadas de Computação

```
Dados existentes (SWR cache)
  ↓
Serviços de análise (client-side, novos)
  ├── refillPredictionService.js
  ├── protocolRiskService.js
  ├── reminderOptimizerService.js
  ├── costAnalysisService.js
  └── adherencePatternUtils.js (util, não serviço)
  ↓
insightService.js (existente — adaptado para receber novos insights)
  ↓
Dashboard / InsightCards (existentes)
```

### Princípio de Dados Mínimos

Cada feature define seu `minDataRequirement`:

```javascript
const MIN_REQUIREMENTS = {
  refillPrediction: { days: 14, logs: 5 },
  heatmap: { days: 21, logs: 15 },
  reminderOptimizer: { days: 14, logsPerSchedule: 10 },
  riskScore: { days: 14, logs: 7 },
  costAnalysis: { stockEntriesWithPrice: 1 }
}
```

UI adaptativa: se dados insuficientes, exibe placeholder com progresso ("Faltam X dias para ativar esta funcionalidade").

### Integração com Bot (Telegram + futuro WhatsApp)

- `refillPredictionService` expõe `getUsersNeedingRefillAlert(daysThreshold)` para uso em `tasks.js`
- `protocolRiskService` expõe `getUsersWithCriticalProtocols()` para alerta proativo
- Ambos usam queries existentes no Supabase (sem migrations novas)

---

## 4. Roadmap de Entrega

| Sprint | Features | SP |
|--------|---------|-----|
| 5.5.1 | I01 (Previsão Reposição) + I04 (Score de Risco) | 10 |
| 5.5.2 | I05 (Análise de Custo) + I03 (Otimizador Horário) | 13 |
| 5.5.3 | I02 (Heatmap de Padrões) | 8 |

**Esforço Total:** 31 story points
**Dependências:** Fase 5 concluída; cache SWR estável; histórico de logs (usuários existentes têm dados suficientes)

---

## 5. Critérios Globais de Aceitação

- [ ] Zero chamadas adicionais ao Supabase (toda computação usa dados já em cache SWR)
- [ ] Nenhuma dependência nova de npm para os cálculos (JavaScript puro)
- [ ] Todas as features têm graceful degradation quando dados insuficientes
- [ ] Insights integrados ao `insightService.js` existente
- [ ] Score de risco incluído no relatório PDF da Fase 5
- [ ] Previsão de reposição integrada ao Bot usando `messageFormatter.js` existente (F4.5)
- [ ] I04 usa `isInToleranceWindow()` de `adherenceLogic.js` (entregue pós-F4) ao classificar doses como perdidas
- [ ] Novos eventos de tracking adicionados ao `analyticsService.js` existente (F4.4), sem nova infraestrutura
- [ ] `npm run validate` passa sem novos erros (baseline: 93 testes críticos passando)

---

## 6. Indicadores de Sucesso

| Métrica | Meta | Ferramenta |
|---------|------|------------|
| Previsão de reposição visualizada | > 60% usuários com estoque ativo | Analytics local |
| Heatmap acessado por semana | > 40% usuários com dados suficientes | Analytics local |
| Sugestão de horário aceita | > 30% quando exibida | Event tracking |
| Score de risco — protocolos Críticos identificados | Tracking de ocorrências | Supabase query |
| Análise de custo — usuários com `unit_price` preenchido | > 50% (incentivado pelo CTA) | Analytics local |

---

## 7. Posicionamento Competitivo

| App | Inteligência Preditiva | Canal BR | Voz | Custo Operacional |
|-----|----------------------|---------|-----|-------------------|
| **Meus Remédios (v3.5)** | ✅ Client-side, 5 features | WhatsApp + Telegram | Em planejamento | R$ 0 |
| MyTherapy | ❌ Básico | ❌ Apenas push | ❌ | Freemium pago |
| Medisafe | ❌ Básico | ❌ Apenas push | ❌ | Freemium pago |
| Soluções BR existentes | ❌ Nenhuma | ❌ Variável | ❌ | Variável |

---

*PRD criado em: 21/02/2026*
*Próxima revisão: após priorização da Fase 5*
