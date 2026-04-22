# [AP-W28] Cálculo de Meia-Noite Frágil via setHours(24)

## Problema
Uso de `date.setHours(24, 0, 0, 0)` para calcular o início do dia seguinte.

## Sintoma
Comportamento inesperado em algumas engines JavaScript ou durante transições de horário de verão (DST), onde o ajuste de horas pode não saltar o dia corretamente ou resultar em horários duplicados.

## Como Evitar
- Sempre incremente o dia explicitamente via `setDate(getDate() + 1)`.
- Em seguida, zere as horas via `setHours(0, 0, 0, 0)`.

## Caso Real
Identificado pelo revisor Gemini no hook `useTodayData.js` durante a implementação da v0.1.3.
