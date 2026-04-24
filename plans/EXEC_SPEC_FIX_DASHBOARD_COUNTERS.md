# EXEC_SPEC: Fix Dashboard Counters & Persona Logic (Mobile)

## 🎯 Goal
Corrigir o erro onde o contador de doses tomadas (`taken`) nos accordions de turnos permanece zerado e não atualiza após o registro. Alinhar a lógica de persona (Simple/Complex) com a [Regra R-183].

## 📋 Deliverables
1.  **[MODIFY]** `packages/core/src/utils/adherenceLogic.js`: Injetar `isRegistered` na função `evaluateDoseTimelineState`.
2.  **[MODIFY]** `apps/mobile/src/features/dashboard/screens/TodayScreen.jsx`:
    - Atualizar a heurística `isComplex` para basear-se no número de medicamentos (`> 3`) conforme [R-183].
    - Corrigir a derivação de `countsByShift` para usar a propriedade injetada.

## ✅ Acceptance Criteria (DoD)
- [ ] O contador no header do accordion (ex: `(1/2)`) deve refletir doses tomadas corretamente.
- [ ] O contador deve atualizar imediatamente após o registro de uma dose (consequência do `refresh()`).
- [ ] Doses passadas (histórico do dia) devem ser recuperadas do cache/offline e contabilizadas como `taken`.
- [ ] A interface deve alternar entre modo Simple (lista única) e Complex (grupos/turnos) corretamente baseada no threshold de 3 medicamentos.

## ⚠️ Risk Flags
- **Contratos**: Altera o objeto de retorno da timeline no `@dosiq/core`. Verificar se afeta o Web (Web usa `useDoseZones`, que é independente, mas compartilha a lógica base).
- **Timezone**: Garantir que `parseLocalDate` continue sendo usado para evitar drift de data no contador.

## 🔍 Quality Gates
- `npm run lint` no mobile e core.
- `npm run test:critical` no core para validar `evaluateDoseTimelineState`.
- Verificação visual via simulador/render.

---
**Status**: [PLANNING]
**Relates to**: R-183, R-026, CON-018
