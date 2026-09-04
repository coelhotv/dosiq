---
title: Heurística de Expansão Estática em Mudança de Dia
summary: Heurística de expansão de UI não re-avaliada na virada de dia local.
layer: warm
status: active
applies_to:
  paths:
    - apps/web/**
  diff_triggers:
    - lastHeuristicDay
    - localDay
    - TodayScreen.jsx
    - useEffect
  keywords:
    - heurística
    - expansão
    - estática
    - mudança
    - dia
incident_count: 1
last_referenced: "2026-04-22"
---

# [AP-W29] Heurística de Expansão Estática em Mudança de Dia

## Problema
Travar a execução de uma heurística de UX (ex: abrir turnos do dashboard) apenas no estado vazio do componente (`Object.keys(state).length === 0`).

## Sintoma
Quando o dia muda (meia-noite ou retomada do background), os dados da agenda são atualizados, mas a interface mantém a expansão do dia anterior ou não abre os novos turnos automaticamente, pois o estado de expansão não foi zerado.

## Como Evitar
- Utilize um rastreador de dia de referência (ex: `lastHeuristicDay`).
- Adicione o `localDay` como dependência do `useEffect` que executa a heurística.
- Dispare a re-avaliação se o dia atual for diferente do último dia processado.

## Caso Real
Identificado no `TodayScreen.jsx` (v0.1.3), onde os turnos da manhã não expandiam sozinhos após a virada automática de meia-noite.
