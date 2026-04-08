# AP-P13 — Disparar queries de background imediatamente após `setIsLoading(false)`

**Category:** Performance
**Status:** active
**Related Rule:** R-126
**Applies To:** all

## Problem

`setIsLoading(false)` permite ao React agendar um render, mas queries disparadas na mesma stack frame competem com o paint por HTTP/2 connection slots. Safari mobile pool: 4-6 slots. Com 12+ requests → main thread bloqueia → browser trava completamente

## Prevention

Usar `requestIdleCallback` (ou `setTimeout(100ms)` no Safari) para deferir queries não urgentes APÓS o browser completar o paint
