# Spec 035 — Refactor: Dose-Log + Stock Service unificado no core (web↔mobile)

**Feature Directory**: `plans/specs/035-unified-dose-log-stock-core/`
**Created**: 2026-06-16
**Status**: draft (pré-specifying — aguarda priorização do PO)
**Tier**: 2
**Input**: Auditoria de divergência arquitetural durante a 033. Mobile (`doseService`) e web (`logService`) duplicam a orquestração de registro de dose (validar → registrar log → mexer no estoque → ancorar instância) com **implementações de estoque divergentes**. Schema/validação já são compartilhados via `@dosiq/core`; a orquestração + modelo de estoque não.

---

## Contexto

### Por que essa spec existe

O princípio **"service-first, screen-second"** (MASTER_PLAN) e o padrão de factories do core (`createTimelineService`, `createBiomarkerRepository`, `createDoseInstanceRepository`) estabelecem que **a lógica de negócio compartilhável vive no `@dosiq/core`**, e cada plataforma injeta só o `client`.

O registro de dose viola isso. Hoje existem **duas orquestrações paralelas** que fazem conceitualmente a mesma coisa, divergindo no eixo mais crítico (atomicidade do estoque):

```
Web — apps/web/src/shared/services/api/logService.js (logService.create)
  1. validateLogCreate (core ✅)
  2. insert medicine_logs
  3. stockService.decrease(medicine_id, qty, logId)   ← FIFO no APP (JS)
  4. on stock fail → DELETE manual do log              ← rollback compensatório em JS
  5. anchorLogToInstance(data, instanceId)             ← best-effort

Mobile — apps/mobile/src/features/dose/services/doseService.js (registerDose)
  1. logSchema (core ✅)
  2. consume_stock_fifo RPC                            ← FIFO no DB (atômico)
  3. insert medicine_logs
  4. âncora à instância
```

### Divergência (o que realmente difere)

| Eixo | Web | Mobile |
|------|-----|--------|
| FIFO de estoque | app-side (`stockService.decrease` em JS) | RPC `consume_stock_fifo` (Postgres) |
| Ordem | log → stock | stock → log |
| Atomicidade | **sem transação** — 2 roundtrips + delete compensatório | **atômico** no Postgres |
| Validação | `validateLogCreate` (core) | `logSchema` (core) |
| Âncora instância | `anchorLogToInstance` (best-effort) | inline (best-effort) |

### Consequências diretas

1. **Mobile está mais correto.** RPC atômico não deixa log órfão se o estoque falhar. Web faz `insert → decrease → (falhou) → delete`, que é a janela exata dos bugs **AP-231** ("ghost taken" / "furo de estoque", CHANGELOG, descobertos no smoke da 012 B4).
2. **Fix num lado não alcança o outro.** Qualquer correção de regra (ordem, rollback, âncora) precisa ser portada manualmente — drift garantido a cada feature.
3. **Lógica de negócio fora do core.** Orquestração reversível de estoque não é testável de forma compartilhada; cada plataforma testa a sua.

### Benefício do alinhamento

Core como dono da orquestração → web e mobile herdam:
- Atomicidade do estoque (sem classe AP-231 possível)
- Âncora log↔instância (AP-193) testada uma vez
- Todo fix futuro de registro/undo/update/delete num lugar só

---

## Princípio que isso ataca

> **Ir eliminando legados dissonantes web↔mobile frente à arquitetura centralizada.**
> A unidade de trabalho é o *service*; a tela é consumidora. Toda regra de negócio
> duplicada entre plataformas é dívida que faz drift a cada entrega (evidência: AP-231,
> spec 030, spec 033). Esta spec é a primeira da trilha "convergência de serviços de escrita".

---

## User Stories

### US1 — Desenvolvedor: orquestração de registro de dose no core
Como dev, quero uma factory `createDoseLogService({ client })` no `@dosiq/core` que encapsule
`register` / `undo` / `update` / `delete` (com estoque reversível atômico + âncora de instância),
para que web e mobile compartilhem a mesma regra testada uma vez.

**Aceitação:**
- Core expõe `createDoseLogService({ client, getUserId })` espelhando as factories existentes.
- `register(logData, { instanceId })` é **atômico** quanto ao estoque (sem janela órfã).
- `undo` / `update` / `delete` devolvem/reajustam estoque de forma reversível (FIFO).
- 100% das regras cobertas por testes unitários no core (mock client).

### US2 — Usuário (web): registro de dose sem furo de estoque
Como usuário web, quero que registrar/desfazer uma dose nunca crie log órfão nem fure o estoque,
para não ter o estado inconsistente da classe AP-231.

**Aceitação:**
- Web migra `logService.create/update/delete` para delegar ao `createDoseLogService` do core.
- Estoque consumido via caminho atômico (RPC `consume_stock_fifo` ou equivalente), não via
  `insert → decrease → delete` compensatório em JS.
- Regressão: cenários AP-231 ("ghost taken", "furo de estoque") cobertos por teste e verdes.

### US3 — Usuário (mobile): paridade de comportamento
Como usuário mobile, quero registro/undo/update idênticos à web,
para que correções valham nas duas plataformas simultaneamente.

**Aceitação:**
- Mobile `doseService` vira casca fina sobre `createDoseLogService`.
- Smoke mobile (registro, undo, retroativo, avulsa/PRN) sem regressão.

---

## Pré-requisito crítico (ordem de execução)

> **Não é extração, é convergência.** Extrair antes de unificar o estoque cristalizaria a
> divergência dentro do core (factory ramificando por plataforma = abstração vazada).

**Sequência obrigatória:**
1. **Convergir o modelo de estoque primeiro** — web migra de `stockService.decrease`
   (app-side + delete compensatório) para `consume_stock_fifo` RPC (atômico, padrão mobile).
   Mata a classe AP-231 na origem.
2. **Extrair a orquestração** — `createDoseLogService({ client })` no core; `register/undo/update/delete`
   ancorando instância (CON a catalogar).
3. **Cascar as plataformas** — `logService` (web) e `doseService` (mobile) viram adaptadores finos.

Inverter (1)↔(2) é o anti-objetivo.

---

## Functional Requirements (rascunho)

- **FR-001**: Core expõe `createDoseLogService({ client, getUserId })` com `register`, `undo`, `update`, `delete`.
- **FR-002**: `register` consome estoque atomicamente (RPC) antes/durante a gravação do log — sem janela de log órfão.
- **FR-003**: Web migra estoque app-side → RPC atômico (pré-requisito; pode ser PR próprio).
- **FR-004**: `logService` (web) e `doseService` (mobile) delegam 100% ao core; nenhuma regra de estoque/âncora duplicada permanece nas plataformas.
- **FR-005**: Âncora bidirecional log↔instância (AP-193) implementada uma vez no core.
- **FR-006**: Suíte de regressão AP-231 (ghost taken + furo estoque) no core, verde em web e mobile.

## Success Criteria (rascunho)

- **SC-001**: Zero lógica de estoque/orquestração de dose duplicada entre `apps/web` e `apps/mobile` (grep auditável).
- **SC-002**: Registro de dose é atômico quanto ao estoque nas duas plataformas (sem `insert→delete` compensatório).
- **SC-003**: Cenários AP-231 cobertos por teste no core e verdes.
- **SC-004**: Smoke web + mobile (registro, undo, retroativo, avulsa/PRN, edição) sem regressão.

## Assumptions / Riscos

- `consume_stock_fifo` RPC já cobre todos os casos que `stockService.decrease` cobre na web (validar antes de migrar — lotes/validade/FIFO).
- Toca `medicine_logs` + estoque (caminho crítico de escrita) → **Tier 2**, alto risco de regressão. Migração de dados improvável, mas RLS/grants a revisar se RPC mudar de assinatura.
- Provável fatiar em sub-PRs: (A) convergência estoque web · (B) factory core + testes · (C) cascas web/mobile.
- Catalogar **CON-NNN** para a interface `createDoseLogService` e avaliar **ADR-NNN** para "estoque sempre via RPC atômico".

## Próxima ação (assignment)

PO priorizar contra roadmap (009 caregiver, 026/028 em andamento). Quando priorizada:
`/devflow specifying` completo (Tier 2 → spec + plan + tasks + analysis + checklist), começando pela
auditoria de paridade `stockService.decrease` ↔ `consume_stock_fifo` (gate do pré-requisito FR-003).

---

## Trilha "convergência de serviços de escrita" (contexto maior)

Esta 035 é a primeira de uma possível trilha de eliminação de legado dissonante web↔mobile.
Candidatos futuros a auditar com a mesma lente (service-first compartilhado):
- `medicineService` (CRUD de medicamentos) — verificar duplicação web/mobile.
- `protocolService` / planos de tratamento.
- `stockService` completo (compras, refil, custo) pós-convergência FIFO.

(não-escopo desta spec; registrado para não perder o fio.)
