# Feature Specification: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Migration Status**: migrated
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/specs/023-liquid-medications-core-api/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Context

Com banco (022) e core (023) prontos, implementamos as **interfaces (PWA Web + Mobile)**, o **wizard de onboarding** e o **Bot do Telegram** para a experiência de líquidos ponta-a-ponta (paciente "Dona Maria").

Responsabilidades:
1. **Expor as novas unidades de concentração** (`mg/ml`, `ui/ml`) nos dropdowns dos formulários de medicamento **e no wizard de onboarding**, removendo `ml`/`gotas` da lista de **concentração** (que agora são unidades de **tomada**, não de concentração).
2. **Forms dinâmicos**: badge `💧 Apresentação Líquida`; select de `intake_unit` (`gotas`/`ml`/`UI`) condicional no protocolo; inputs de frascos/ml no estoque.
3. **Banner de fim de frasco**: comparar o volume restante (`stock.quantity`, em ml) com a **dose convertida para ml** da próxima ocorrência.
4. **Bot do Telegram**: lembrete e callback `✅ Tomei` formatando com `formatDose` e debitando o volume físico via `consume_stock_fifo`.

> **Correção (revisão 2026-06-02):** (a) o dropdown de **concentração** do medicamento NÃO oferece `ml`/`gotas` (elas viram `intake_unit`); oferece `['mg','mcg','g','ui','un','mg/ml','ui/ml']`. (b) O banner converte `dose_instances.expected_dose` (que está na **unidade de tomada**, ex.: gotas) para ml via `drops_per_ml` ANTES de comparar com `stock.quantity` (ml) — comparar gotas com ml era erro de unidade. (c) Mobile é **JS** (`.jsx`/`.js`), não TS.

---

## User Scenarios & Testing

### User Story 1 — Cadastro com Novas Unidades (Web, Mobile e Wizard) (Priority: P1)
**Why this priority**: sem expor `mg/ml`/`ui/ml` nos dropdowns (incl. onboarding), o usuário não consegue cadastrar líquido no novo modelo.
**Independent Test**: abrir o form de medicamento (e o passo de medicamento do wizard) e confirmar que o dropdown de concentração lista `mg/ml`/`ui/ml` (sem `ml`/`gotas`); ao escolher `mg/ml`, surge o badge `💧 Apresentação Líquida` e o campo `Gotas por ml` (default 20).

**Acceptance Scenarios**:
1. Given o `MedicineForm` (web/mobile) ou o passo de medicamento do wizard, When o dropdown de unidade é aberto, Then lista `['mg','mcg','g','ui','un','mg/ml','ui/ml']` (sem `ml`/`gotas`) com label **"Concentração"**.
2. Given o usuário escolhe `'mg/ml'` ou `'ui/ml'`, When o form re-renderiza, Then exibe o badge `💧 Apresentação Líquida` e o campo `Gotas por ml` (default 20, editável).
3. Given o usuário cria um protocolo de medicamento líquido, When a tela renderiza, Then exibe o select de `intake_unit` (`gotas`/`ml`/`UI`) + hint *"💧 Defina a dose na unidade de tomada (gotas ou ml)."*; sólido oculta o select.

### User Story 2 — Cadastro de Estoque de Líquido (Priority: P1)
**Why this priority**: capturar "N frascos × V ml × preço total" de forma natural.
**Independent Test**: no `StockForm`, com medicamento líquido, ver o cabeçalho `💧 Inventário de Líquidos`, inputs `[ N ] frascos` / `[ V ] ml cada` e o campo `Preço Total da Compra (R$)`; submeter dispara o desmembramento (spec 023).

**Acceptance Scenarios**:
1. Given um medicamento líquido no `StockForm`, When renderiza, Then mostra `💧 Inventário de Líquidos`, dois inputs (`frascos`, `ml cada`) e `Preço Total da Compra (R$)` (não preço unitário).
2. Given submissão de `2 frascos / 50 ml / R$ 50,00`, When confirma, Then o payload `{numBottles:2, volumePerBottle:50, totalPrice:50}` vai ao `stockService` (desmembra via RPC — spec 023).

### User Story 3 — Banner de Fim de Frasco (Priority: P2)
**Why this priority**: avisar a Dona Maria antes do frasco acabar.
**Independent Test**: estoque `1.5 ml`; próxima dose `15 gotas` (`drops_per_ml=20` → `0.75 ml`)... não dispara. Próxima dose `40 gotas` (`2 ml`) → dispara (2 > 1.5).

**Acceptance Scenarios**:
1. Given `stock.quantity = 1.5` (ml) e próxima `dose_instances.expected_dose = 40` com `intake_unit = 'gotas'` e `drops_per_ml = 20`, When a timeline abre, Then o sistema converte `40/20 = 2 ml`, detecta `2 > 1.5` e exibe *"⚠️ Seu frasco ativo está no fim (restam apenas 1,5 ml). Lembre-se de abrir um novo frasco!"*.
2. Given a dose convertida ≤ saldo, When a timeline abre, Then o banner NÃO aparece.

### User Story 4 — Confirmar Tomada no Telegram (Priority: P1)
**Why this priority**: tomadas via chat com débito físico consistente.
**Independent Test**: alarme de Dipirona `15 gotas`; clicar `✅ Tomei` → log persistido + `consume_stock_fifo` debita `0.75 ml`; mensagem editada.

**Acceptance Scenarios**:
1. Given o alarme *"🔔 Hora da sua Dipirona! Tomar 15 gotas agora."* (formatado por `formatDose`), When o paciente clica `✅ Tomei`, Then o bot persiste o log, chama `consume_stock_fifo(p_quantity=15, ...)` (a RPC converte gotas→ml), e edita a mensagem para *"✅ Dipirona confirmada!"*.

---

## Edge Cases

- **Estoque zerado na confirmação Telegram**: se o estoque estiver zerado por ação simultânea no app, o bot registra o log best-effort e responde *"Registrei sua tomada, mas seu estoque está zerado no app!"* — sem exceção técnica.
- **Mobile sem componente `StockForm` dedicado**: o cadastro de estoque mobile pode estar em screen/fluxo distinto — **verificar o caminho real em C1** antes de implementar (não assumir paridade de nome com a web).
- **`intake_unit = 'UI'`**: na v1 a UI exibe `UI` mas a conversão de estoque é escala direta (insulina/canetas = épico diabetes). Sem cálculo de gotas.

---

## Requirements

### Functional Requirements

- **FR-001**: `MedicineForm` (web `apps/web/src/features/medications/components/MedicineForm.jsx` + seção de dosagem; mobile `apps/mobile/src/features/medications/screens/MedicineFormScreen.jsx`) **e o wizard de onboarding** filtram o dropdown de concentração para `['mg','mcg','g','ui','un','mg/ml','ui/ml']`, label "Concentração", badge `💧 Apresentação Líquida` + campo `Gotas por ml` para unidades terminadas em `/ml`.
- **FR-002**: `ProtocolForm` (web `apps/web/src/features/protocols/components/ProtocolForm.jsx` / `sections/ProtocolFormDosesSection.jsx`; mobile `apps/mobile/src/features/treatments/components/ProtocolFormBody.jsx`) exibe condicionalmente o select `intake_unit` (`gotas`/`ml`/`UI`) + hint quando o medicamento for líquido.
- **FR-003**: `StockForm` (web `apps/web/src/features/stock/components/StockForm.jsx` / `sections/StockFormPurchaseDetails.jsx`) exibe `💧 Inventário de Líquidos`, inputs `frascos`/`ml cada` e `Preço Total da Compra (R$)`; despacha payload de desmembramento. Caminho do estoque mobile a verificar em C1.
- **FR-004**: Banner de fim de frasco em `apps/web/src/features/dashboard/components/StockAlertInline.jsx` comparando `stock.quantity` (ml) com `expected_dose` **convertida para ml** (via `drops_per_ml` quando `intake_unit='gotas'`).
- **FR-005**: Bot do Telegram (`api/notify.js` + `server/bot/callbacks/doseActions.js`) formata mensagens com `formatDose(expected_dose, intake_unit)`; o callback `✅ Tomei` passa a dose na unidade de tomada para `consume_stock_fifo` (que converte para ml internamente — spec 022).

### Key Entities

- **UI Forms** (medicine/protocol/stock) web+mobile + wizard.
- **StockAlertInline**: banner com conversão de unidade.
- **Telegram dispatcher/callback**: `notify.js`, `doseActions.js`.

---

## Success Criteria

- **SC-001**: Dropdowns (incl. wizard) expõem `mg/ml`/`ui/ml` e ocultam `ml`/`gotas` da concentração; selects de tomada e hints operam em web e mobile.
- **SC-002**: O banner dispara apenas quando a dose **convertida para ml** supera o saldo (sem erro de unidade).
- **SC-003**: Bot formata em PT-BR via `formatDose` e debita o volume correto; estoque zerado não trava o fluxo.
