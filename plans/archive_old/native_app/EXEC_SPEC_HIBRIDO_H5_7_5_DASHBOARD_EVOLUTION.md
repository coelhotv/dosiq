# Spec H5.7.5 — Evolução UX Dashboard Mobile
 
> **Status:** Concluído ✅ (Merged em 2026-04-15)
> **Sprint:** H5.7.5
> **Objectivo:** Elevar a estética da `TodayScreen` para o padrão Premium (Design System) e optimizar a hierarquia de acções.
> **Base:** `plans/DESIGN-SYSTEM.md` + `packages/core/src/utils/adherenceLogic.js`

---

## 🏗️ 0. Arquitetura e Lógica Compartilhada (ZOD-RDS-Core)

O mobile DEVE reutilizar as funções puras do pacote corporativo para evitar drifts de lógica (R5-004):
- **Adherence Score:** Utilizar `calculateAdherenceStats` do `@dosiq/core`.
- **Dose Status:** Utilizar `calculateDosesByDate` do `@dosiq/core` para classificar itens em `takenDoses`, `missedDoses` e `scheduledDoses`.
- **Janela de Tolerância:** Padrão fixo de **+/- 2 horas** para paridade com a web.

## 🎨 1. Design System & Estética (Material 3 Hybrid)

Aplicar as cores e tokens definidos no sistema de design para paridade com a versão desktop premium:

### Cores e Superfícies (R-DS-35)
- **Fundo da App:** `surface` (#f8fafb)
- **Cards de Dose:** `surface_container_lowest` (#ffffff)
- **Sombras:** "Ambient Shadows" — blur de 24px, opacidade de 4% (em vez de bordas sólidas).
- **Gradiente de Acção:** Botões primários devem usar gradiente de `primary` (#006a5e) para `primary_container` (#008577) a 135 graus.

### Tipografia (R-DS-49)
- **Títulos:** FontWeight 700 (ou bold) para nomes de medicamentos.
- **Corpo:** Mínimo 400 de peso para legibilidade (Dona Maria).

---

## 📊 2. Componentes de Performance (Adhesion & Streaks)

### Adherence Ring (Ring Gauge)
- **Visual:** Stroke grosso de 12pt. Track `secondary` (#005db6) e progresso `primary_fixed` (#90f4e3).
- **Performance:** Implementação pura via `react-native-svg`. O valor deve ser memorizado (`useMemo`) para evitar repaints decorrentes de outros estados.
- **Lógica:** (Doses tomadas hoje / Total agendado para hoje) * 100.

### Streak Badge (Fogueira 🔥)
- **Visual:** Ícone de fogueira com contador de dias seguidos (adesão > 90%).
- **Cálculo:** Incrementado localmente no sucesso da última dose do dia ou recuperado do `user_settings`.

---

## 📋 3. Refatoração da Lista de Doses (Splitting & Sorting)

### Independência de Horários (Splitting por Zonas)
Conforme o Redesign Wave 6 da Web, o mobile adotará a separação por "Zonas de Dose" para facilitar a ação imediata.

**As 4 Zonas Mobile:**
1. **EM ATRASO (Late):** Doses agendadas para horários passados (hoje) e não marcadas como tomadas.
2. **AGORA (Now):** Doses na janela de tolerância de +/- 2h (exibidas no Priority Action Card).
3. **PRÓXIMAS (Upcoming):** Doses agendadas para o restante do dia (fora da janela de tolerância).
4. **CONCLUÍDAS (Done):** Doses já registradas hoje.

**Lógica de Transformação:**
Utilizar `calculateDosesByDate(today, logs, protocols)` do Core. O mobile mapeará o retorno para a UI de forma a privilegiar o PAC (Priority Action Card).

### Status da Tomada (Checkmark)
Doses já tomadas devem mostrar visualmente o estado "Concluído" (Checkmark verde) em vez do botão "Tomar", mantendo a card na lista mas com menos peso visual (opacidade reduzida).

---

## ⚡ 4. Priority Action Card (PAC)

- **Regra:** Se houver doses agendadas no intervalo de `H-30m` a `H+60m` relativo ao horário actual.
- **Ações:** Agrupar até 3 medicamentos. Botão "Confirmar Agora" em destaque.
- **Posição:** Sempre fixo no topo da lista (abaixo do resumo), empurrando a lista cronológica para baixo.

---

## 🚀 5. Plano de Implementação (Fase Média e Hardening)

### Fase 1: Data Engine (useTodayStats)
- Criar hook `useTodayStats` que consome `useTodayData`.
- Chamar `calculateAdherenceStats` para o RingGauge.
- Chamar `calculateDosesByDate` para alimentar as listas.

### Fase 2: UI Dashboard Evolution
- Implementar `AdherenceRing` (SVG) e `PriorityDoseCard` (Gradient).
- Refatorar `DoseListItem` para UI minimalista.
- Adicionar `StockAlertInline` (Padrão Redesign Web) para alertas críticos no dashboard.

### Fase 3: TodayScreen Layout
- Reposicionar elementos conforme a Spec H5.7.5.
- Aplicar o novo sistema de cores e superfícies (sem bordas, apenas sombras e tons).

---

## ✅ 6. Critérios de Aceitação

1. O gráfico circular de adesão actualiza em tempo real após o registo de dose.
2. Cada dose (horário) aparece em seu próprio card, ordenada cronologicamente.
3. Não há degradação perceptível de frames no scroll da lista (testar com 15+ doses).
4. As cores seguem rigorosamente o `DESIGN-SYSTEM.md`.
5. O botão "Confirmar Agora" aparece apenas quando há doses na janela crítica.
