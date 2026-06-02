# Tasks: Liquid Medications Core API & Validations

**Feature Directory**: `plans/specs/023-liquid-medications-core-api`  
**Input**: `spec.md`, `plan.md`  
**Status**: Spec Draft (Wave M2)  

---

## Phase 1: Setup / Preflight

- [ ] T001 [C1] Verificar o estado e integridade das dependências do `@dosiq/core` na raiz e certificar-se de que os testes críticos estão passando com sucesso antes das modificações.

---

## Phase 2: Implementation (Zod, Services & Helpers)

- [ ] T002 [US1] Ajustar o validador Zod do medicamento (`src/schemas/medicineSchema.js`) para suportar a validação condicional de medicamentos líquidos.
- [ ] T003 [US1] Ajustar o validador Zod do protocolo (`src/schemas/protocolSchema.js`) para suportar dosagens decimais flexíveis.
- [ ] T004 [US2] Implementar a lógica de desmembramento transacional de múltiplos frascos e compensação financeira centava no `stockService.js` da Web.
- [ ] T005 [US2] Sincronizar a lógica de desmembramento transacional no `stockService.ts` do Mobile.
- [ ] T006 [US3] Criar o arquivo `packages/core/src/utils/doseUnit.js` contendo a função helper pura `formatDose` em português brasileiro.

---

## Phase 3: Validation (Quality Gates)

- [ ] T007 [C4] Escrever testes unitários para a validação do Zod (`medicineSchema.test.js` e `protocolSchema.test.js`) com cobertura de 100% de cenários válidos e inválidos.
- [ ] T008 [C4] Escrever testes unitários em `doseUnit.test.js` cobrindo formatações de ml, gotas e UI com números decimais e singulares/plurais.
- [ ] T009 [C4] Criar testes unitários para a lógica de desmembramento centavo a centavo do `stockService`.
- [ ] T010 [C4] Rodar `rtk npm run validate:agent` e atestar que a suíte crítica de testes, linting e produção funciona perfeitamente e sem erros.

---

## Phase 4: DEVFLOW Record

- [ ] T011 [C5] Realizar o checkpoint SQP (R-221) e atualizar os índices do DEVFLOW.
- [ ] T012 [C5] Submeter o PR consolidado para a aprovação final do operador humano ("Never self-merge" R-060).
