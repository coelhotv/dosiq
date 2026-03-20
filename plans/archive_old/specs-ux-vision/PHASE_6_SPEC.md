# Fase 6: Inteligencia & Insights — Overview

> **Versao:** 2.0 | **Data:** 20/03/2026
> **Tipo:** Overview/Resumo (para contexto de produto)
> **SSOT (Single Source of Truth):** `plans/EXEC_SPEC_FASE_6.md` ← **LEIA ESTE PARA IMPLEMENTACAO**
> **Baseline:** v3.2.0 (Fase 5 completa) → v3.3.0
> **Custo operacional:** R$ 0
> **Esforco total:** 39 SP em 5 sprints
> **Status:** 4/5 sprints ENTREGUES ✅ — apenas Sprint 6.3 (INT-01 + INT-02, 5 SP) pendente

---

## ⚠️ IMPORTANTE PARA AGENTES

**Para IMPLEMENTAR esta fase, use:**
```
/deliver-sprint plans/EXEC_SPEC_FASE_6.md
```

**Este documento (PHASE_6_SPEC.md) é apenas OVERVIEW.**
**O SSOT (Single Source of Truth) é `EXEC_SPEC_FASE_6.md`** com:
- ✅ Sequencialidade clara + paralelização permitida
- ✅ Dependências entre features (grafo)
- ✅ Padrões de integração (Pattern A, B, C)
- ✅ Wireframes + acessibilidade
- ✅ Checklist por sprint
- ✅ Instruções de qual arquivo ler primeiro

---

## Objetivo (Visão de Produto)

Transformar dados acumulados em predicoes acionaveis que tornam o app indispensavel para gestao diaria de medicamentos. **100% client-side, zero chamadas novas ao Supabase, zero dependências npm.**

---

## Principios Arquiteturais

| Principio | Regra |
|-----------|-------|
| Zero chamadas novas ao Supabase | Toda computacao sobre dados ja presentes no cache SWR (`useCachedQuery`) |
| Zero dependencias npm novas | Matematica pura (media, tendencia, arredondamento) |
| UI adaptativa | Insights so exibidos com dados suficientes (minimo 14 dias de logs) |
| Computacao client-side | Privacidade total, custo zero de infra |

---

## Features

### I01 — Previsao de Reposicao (5 SP) ✅ ENTREGUE (Sprint 6.1)

**Service:** `src/features/stock/services/refillPredictionService.js`

**Computacao:**
```
dias_restantes = stock.quantity / (consumo_real_30d / 30)
```
- `consumo_real` = doses registradas nos ultimos 30 dias (de `medication_logs`)
- Fallback se <14 dias de dados: consumo teorico (`protocol.dosage_per_intake * frequency`)

**UI:** Integrar no widget `StockBars` existente (`@stock/components/`), adicionando projecao visual de dias restantes como barra secundaria.

**Bot:** Alimentar alertas 14d e 7d antes do stockout previsto. Evolui a logica de estoque existente em `server/bot/tasks.js` (F5.5).

**Dados minimos:** 14 dias de logs.

**Testes:** Service puro, sem mocks de UI. Cenarios: consumo real disponivel, fallback teorico, estoque zerado, medicamento sem protocolo.

---

### I04 — Score de Risco por Protocolo (5 SP) ✅ ENTREGUE (Sprint 6.1)

**Service:** `src/features/adherence/services/protocolRiskService.js`

**Dependencias internas:** `adherenceService.calculateProtocolAdherence()` de `@services/api/adherenceService.js`

**Computacao:**
- `adherence_14d` = adesao dos ultimos 14 dias para o protocolo
- `trend_7d` = comparacao adesao ultimos 7d vs 7d anteriores (delta percentual)

**Classificacao:**

| Nivel | Criterio | Cor |
|-------|----------|-----|
| Estavel | >=80% AND trend >= -5% | verde (#22c55e) |
| Atencao | 50-79% OR trend entre -5% e -15% | amarelo (#f59e0b) |
| Critico | <50% OR trend < -15% | vermelho (#ef4444) |

**UI:** Badge colorido no `TreatmentAccordion` (`@protocols/components/`).

**SmartAlert:** Gerar alerta tipo `PROTOCOL_RISK` via `insightService` (`@dashboard/services/insightService.js`) para protocolos Criticos. Prioridade: `high`.

**PDF:** Incluir score no relatorio quando disponivel (integra com gerador jsPDF existente).

**Dados minimos:** 14 dias.

---

### I05 — Analise de Custo Avancada (5 SP) ✅ ENTREGUE (Sprint 6.2)

Evolui F5.10 (`costAnalysisService.js` criado na Fase 5).

**Computacao:**
```
custo_mensal = consumo_real_mensal * avg_unit_price
```
- `avg_unit_price` = media ponderada dos registros de compra (`stockSchema.unit_price`)
- `consumo_real` = doses registradas / periodo (de `medication_logs`)

**UI:** Componente `CostChart` (evolui EV-06 parcialmente construido).
- Barras horizontais por medicamento com valor em R$
- Total mensal + projecao 3 meses
- Usar componentes de `@shared/components/ui/` (Card, etc.)

**Localizacao:** Tab Estoque, secao "Custo Mensal".

---

### I02 — Heatmap de Padroes de Adesao (8 SP) ✅ ENTREGUE (Sprint 6.5)

**Component:** `src/features/adherence/components/AdherenceHeatmap.jsx`

**Computacao:**
- Agrupar `medication_logs` por `dia_da_semana` (0-6) x `periodo` (manha 6-12, tarde 12-18, noite 18-24, madrugada 0-6)
- Calcular taxa de adesao por celula: `doses_tomadas / doses_esperadas`
- Grid 7x4 com cores por intensidade (escala de opacidade sobre cor primaria do tema)

**Narrativa:** Texto automatico gerado pelo service:
> "Seu pior horario e [dia] a [periodo]"

Baseado na celula com menor taxa de adesao (minimo 3 amostras na celula para considerar).

**Localizacao:** Perfil > Minha Saude, abaixo do calendario existente.

**Dados minimos:** 21 dias.

**Mobile:** Layout responsivo — cards empilhados em vez de grid quando `tela < 380px`.

---

### I03 — Otimizador de Horario de Lembrete (8 SP) ✅ ENTREGUE (Sprint 6.4)

**Service:** `src/features/protocols/services/reminderOptimizerService.js`

**Computacao:**
- Para cada protocolo: calcular delta medio entre `protocol.time_schedule` e `taken_at` real (de `medication_logs`)
- Se `|delta_medio| > 30min` com >=10 amostras: sugerir novo horario
- Novo horario = arredondar `taken_at` medio para intervalo de 15min mais proximo

**UI:** Notificacao in-app nao-intrusiva (max 1x/semana/protocolo).
> "Voce costuma tomar Losartana as 08:45. Quer ajustar o lembrete de 08:00 para 09:00?"

Botoes:
- "Ajustar" — atualiza `protocol.time_schedule` via `protocolService.update()` existente
- "Manter" — dispensa por 30 dias
- "Nao perguntar mais" — dispensa permanentemente

**Persistencia:** Flag `optimizer_dismissed_{protocolId}` em localStorage com timestamp.

**Dados minimos:** 10 registros de dose para o protocolo.

---

### EV-07 — Timeline Visual de Prescricoes (3 SP) ✅ ENTREGUE (Sprint 6.5)

**Component:** `src/shared/components/ui/PrescriptionTimeline.jsx`

**Visual:** Barra horizontal representando `start_date` a `end_date` (de `protocolSchema`).
- Posicao do "hoje" marcada com linha vertical
- Segmento antes de hoje = preenchido (cor solida)
- Segmento depois de hoje = outline/claro

**Cores:**

| Condicao | Cor |
|----------|-----|
| >30 dias restantes | verde (#22c55e) |
| <=30 dias restantes | amarelo (#f59e0b) |
| Vencida (end_date < hoje) | vermelho (#ef4444) |

**Caso especial:** `end_date: null` = barra infinita com label "continuo".

**Interacao:** Tap navega para protocolo no tab Tratamento via `setCurrentView('protocols')`.

**Localizacao:** Tab Estoque, secao "Prescricoes" (acima das barras de estoque).

**Datas:** Usar `parseLocalDate()` de `@utils/dateUtils` para `start_date` e `end_date`.

---

### INT-01 — Risk Score no PDF Reports (2 SP) ⬚ PENDENTE (Sprint 6.3)

Integrar `protocolRiskService` com o gerador PDF existente (jsPDF).

**Conteudo:** Nova secao "Risco por Protocolo" no relatorio.

| Coluna | Fonte |
|--------|-------|
| Protocolo | `protocol.name` |
| Adesao 14d | `adherence_14d` (%) |
| Tendencia | `trend_7d` (seta + %) |
| Classificacao | Estavel / Atencao / Critico |

Usar cores no PDF (vermelho/amarelo/verde) para a coluna classificacao.

**Dependencia:** I04 (protocolRiskService).

---

### INT-02 — Refill Prediction nos Alertas Bot (3 SP) ⬚ PENDENTE (Sprint 6.3)

Integrar `refillPredictionService` com o scheduler do bot (`server/bot/tasks.js`).

**Mudanca:** Substituir logica atual de estoque simples (`quantity / daily_intake`) pela previsao baseada em consumo real.

**Fallback:** Manter calculo teorico se dados de consumo real forem insuficientes (<14 dias).

**Mensagem atualizada:** Incluir data prevista de stockout no alerta Telegram.

**Dependencia:** I01 (refillPredictionService).

---

## Sequencia de Implementacao

| Onda | Features | SP | Status | Justificativa |
|------|----------|----|--------|---------------|
| 1 | I01 + I04 | 10 | ✅ Sprint 6.1 ENTREGUE | Maior valor, menor risco. Services puros, testavel isoladamente |
| 2 | I05 | 5 | ✅ Sprint 6.2 ENTREGUE | Estende F5.10 recem-construido |
| 4 | I03 | 8 | ✅ Sprint 6.4 ENTREGUE | Requer dados de uso reais, construir apos I01/I04 |
| 5 | I02 + EV-07 | 11 | ✅ Sprint 6.5 ENTREGUE | Componentes visuais, podem ser paralelizados |
| 3 | INT-01 + INT-02 | 5 | ⬚ Sprint 6.3 PENDENTE | Integracoes com PDF e bot, dependem de I01/I04 |

---

## Criterios de Aceitacao

- Zero chamadas adicionais ao Supabase (verificar network tab do DevTools)
- UI adaptativa: insights so aparecem com dados suficientes (14 ou 21 dias conforme feature)
- Testes unitarios para cada service (>=90% cobertura)
- Lighthouse Performance mantido >=90 apos implementacao
- Risk Score integrado ao PDF existente sem regressao
- Refill Prediction integrado ao bot sem regressao
- Todos os services usam dados do cache SWR, nunca fetch direto

---

## Metricas de Sucesso

| Metrica | Alvo |
|---------|------|
| Previsao de reposicao visivel | >50% dos usuarios com dados de estoque |
| Protocolo "em risco" recuperado | >=1 (dose registrada apos alerta de risco) |
| Otimizador de horario aceito | >=30% dos usuarios que recebem sugestao |

---

## Mapa de Arquivos

```
src/features/stock/services/refillPredictionService.js        (I01 - NOVO)
src/features/adherence/services/protocolRiskService.js         (I04 - NOVO)
src/features/adherence/components/AdherenceHeatmap.jsx         (I02 - NOVO)
src/features/protocols/services/reminderOptimizerService.js    (I03 - NOVO)
src/shared/components/ui/PrescriptionTimeline.jsx              (EV-07 - NOVO)
src/features/stock/components/StockBars.jsx                    (I01 - MODIFICADO)
src/features/protocols/components/TreatmentAccordion.jsx       (I04 - MODIFICADO)
src/features/dashboard/services/insightService.js              (I04 - MODIFICADO)
src/features/dashboard/services/costAnalysisService.js         (I05 - MODIFICADO, criado F5)
server/bot/tasks.js                                            (INT-02 - MODIFICADO)
```

**Testes:**
```
src/features/stock/services/__tests__/refillPredictionService.test.js
src/features/adherence/services/__tests__/protocolRiskService.test.js
src/features/adherence/components/__tests__/AdherenceHeatmap.test.js
src/features/protocols/services/__tests__/reminderOptimizerService.test.js
src/shared/components/ui/__tests__/PrescriptionTimeline.test.js
```

---

*Documento criado 06/03/2026. Atualizado 20/03/2026 — Sprint 6.3 unico pendente.*
*Substitui PRD_FASE_5.5_ROADMAP_2026.md.*
