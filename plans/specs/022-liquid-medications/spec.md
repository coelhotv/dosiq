# Feature Specification: Medicamentos Líquidos (Épico)

**Feature Directory**: `plans/specs/022-liquid-medications`
**Created**: 2026-06-01 · **Revised**: 2026-06-03 · **As-Built**: 2026-06-08
**Status**: delivered — PRs #650 (A) · #651 (B) · #652 (C), 2026-06-08. Ver **As-Built (Fase C)** ao final para os deltas spec→produção apurados no smoke.
**Tier**: 2 (épico — DB + core + UI/bot ponta-a-ponta)
**Artifacts**: `spec.md` · `plan.md` · `tasks.md` (faseado A→B→C) · `analysis.md` · `contracts/`
**Legacy Sources**:
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`
- `docs/architecture/DOSE_INSTANCES.md`

> **Histórico:** consolida as antigas specs 023 (core/API) e 024 (UI/bot), que eram **camadas** da mesma feature, não features independentes. Staging de PR vive em `tasks.md` (Fases A/B/C), não em dirs separados.

> **⚠️ Amendment 2026-06-03 — Coordenação com a spec 012 (Diabetes T2). [RESOLVIDA via ADR-058 — re-sync concluído 2026-06-07]** A 012 **depende
> desta spec** e reusa sua fundação (`intake_unit`, enum `ui/ml`, `consume_stock_fifo`
> volume-aware, `formatDose`). Para evitar rename + migração dupla, **duas colunas desta spec
> nascem já generalizadas**, em vez de específicas-de-líquido:
> 1. **`units_per_ml` → coluna genérica de densidade/razão→ml** (`FR-002`): significado se adapta
>    à `dosage_unit` — `gotas`→`20` (gotas/ml), `ui/ml`→`100` (UI/ml, U-100), etc. A 012 reusa
>    esse mesmo campo para a conversão UI→ml da insulina, **sem nova coluna**.
> 2. **Nova coluna `medicines.presentation`** (`FR-002b`, forma farmacêutica geral) — additiva,
>    **não** reverte a decisão-mãe (`is_liquid` segue derivado de `dosage_unit LIKE '%/ml'` no
>    caminho de decremento). `presentation` é o eixo de **forma** que a 012 estende para
>    `injecao`/`pomada`; para líquidos deve ficar consistente com o flag derivado.
>
> **Sequenciamento (duro):** 022 mergeada **antes** do C-coding da 012. **Nome final (ADR-058):**
> a coluna genérica permanece **`units_per_ml`** (`NUMERIC`, descarta o `drops_per_ml` específico)
> + `presentation` (nome EN, valores PT R-021). Downstream (`plan.md`, `tasks.md`, `analysis.md`,
> `contracts/`) **já refletem** esse nome final — re-sync concluído em 2026-06-07.

---

## Context

Suportar medicamentos líquidos (xaropes, gotas, soluções, suspensões) no Dosiq, ponta a ponta: banco → core/validações → UI (PWA + Mobile) + Bot do Telegram. Persona-guia: paciente "Dona Maria" cadastrando e tomando um xarope/gotas.

**Decisão arquitetural-mãe (PO):** a natureza líquida é **derivada da unidade de concentração** do medicamento — **não** de um booleano `is_liquid`. A unidade de concentração passa a ser razão massa/volume: **`'mg/ml'`** ou **`'ui/ml'`**. Logo: `is_liquid := dosage_unit LIKE '%/ml'`.

Consequências obrigatórias (todas cobertas neste épico):
1. **Estender o enum** `dosage_unit` (`DOSAGE_UNITS` core + CHECK SQL) com `'mg/ml'` e `'ui/ml'`.
2. **Migrar dados legados**: medicamentos com `dosage_unit IN ('ml','gotas')` hoje **conflam concentração e unidade de tomada**. Convertê-los: a unidade de tomada antiga (`ml`/`gotas`) migra para `protocols.intake_unit`; o medicamento passa a `dosage_unit = 'mg/ml'`. Sem isso, líquidos legados deixam de ser detectados (`LIKE '%/ml'` não casa com `ml`/`gotas`).
3. **Expor as novas unidades nos dropdowns** dos forms de medicamento **e no wizard de onboarding**, removendo `ml`/`gotas` da lista de **concentração** (viram unidades de **tomada**).

`stock.quantity` (já `numeric`) passa a representar, para líquidos, o **volume contínuo restante em ml** do lote (`original_quantity` = volume nominal do frasco). A RPC `consume_stock_fifo` é sobrecarregada para baixas decimais por FIFO, dentro do modelo de estoque v4.0.0 (`purchases` + `stock` + `stock_consumptions`) — sem trigger paralelo. A escrita de inventário usa N× `create_purchase_with_stock` (nunca insert direto).

---

## User Scenarios & Testing

### User Story 1 — Modelagem + Novas Unidades de Concentração (P1) — Fase A
**Why**: persistir metadados de líquidos e habilitar detecção por unidade sem quebrar dados existentes.
**Independent Test**: inspecionar o enum `dosage_unit` (aceita `'mg/ml'`/`'ui/ml'`); confirmar `protocols.intake_unit` e `medicines.units_per_ml` como nullable/com default.

**Acceptance Scenarios**:
1. Given o enum de concentração, When inspecionado, Then inclui `'mg/ml'`/`'ui/ml'` além dos sólidos (`mg`,`mcg`,`g`,`ui`,`un`).
2. Given `medicines`, When `units_per_ml` é inspecionada, Then é `integer` default `20`, aceita `NULL`.
3. Given `protocols`, When `intake_unit` é inspecionada, Then é `text` nullable (`'gotas'`/`'ml'`/`'UI'`; NULL p/ sólidos).

### User Story 2 — Migração de Líquidos Legados (P1) — Fase A
**Why**: sem migrar `ml`/`gotas` → `mg/ml` + `intake_unit`, líquidos atuais ficam órfãos (não detectados) e o decremento fracionado nunca dispara.
**Independent Test**: rodar a migração; confirmar (a) nenhum medicamento permanece com `dosage_unit IN ('ml','gotas')`; (b) protocolos desses medicamentos receberam `intake_unit` da unidade antiga.

**Acceptance Scenarios**:
1. Given medicamento legado `dosage_unit = 'gotas'` + protocolos, When a migração roda, Then medicamento → `dosage_unit = 'mg/ml'`, `units_per_ml = 20`; cada protocolo → `intake_unit = 'gotas'`.
2. Given medicamento legado `dosage_unit = 'ml'`, When migra, Then → `dosage_unit = 'mg/ml'`; protocolos → `intake_unit = 'ml'`.
3. Given concentração ativa (`dosage_per_pill`) desconhecida no legado, When migra, Then `dosage_per_pill` permanece `NULL` (decremento e adesão por razão não dependem da concentração; massa ativa só exibida quando o usuário preencher).

### User Story 3 — Baixa Transacional Contínua por FIFO (P1) — Fase A
**Why**: tomadas deduzem volume contínuo em ml por FIFO, precisão decimal, dentro do modelo v4.0.0.
**Independent Test**: invocar `consume_stock_fifo` com `2.5 ml` e com `15 gotas` (`units_per_ml = 20`); confirmar baixa exata em `stock.quantity` por FIFO + linhas em `stock_consumptions`.

**Acceptance Scenarios**:
1. Given `'mg/ml'` + `intake_unit = 'ml'`, When confirma `2.50` ml, Then RPC deduz exatamente `2.50` do lote ativo por FIFO; `stock_consumptions.quantity_consumed = 2.50`.
2. Given `'mg/ml'`, `units_per_ml = 20`, `intake_unit = 'gotas'`, When confirma `15` gotas, Then RPC calcula `ROUND(15/20, 2) = 0.75` ml e deduz `0.75` por FIFO.
3. Given múltiplos lotes com validades distintas, When a dose supera o 1º frasco, Then zera o 1º e debita o saldo do próximo, atomicamente.
4. Given sólido (`'mg'`,`'g'`,`'ui'`,`'un'`), When a RPC roda, Then desvia ao caminho linear legado (subtrai inteiro, sem divisão).

### User Story 4 — Validação Zod de Concentração + Tomada (P1) — Fase B
**Why**: impedir cadastros líquidos incompletos e permitir doses decimais válidas no registro.
**Independent Test**: cadastrar `'mg/ml'` sem `units_per_ml` → Zod rejeita; registrar log de `100 ml` → Zod aceita (não barra no antigo teto 100).

**Acceptance Scenarios**:
1. Given `dosage_unit` terminando em `/ml`, When `medicineSchema` valida, Then exige `units_per_ml` (int positivo, default 20); `dosage_per_pill` é opcional/nullable (legados migrados têm `NULL`).
2. Given protocolo líquido, When `protocolSchema` valida, Then exige `intake_unit ∈ {gotas,ml,UI}`, aceita `dosage_per_intake` decimal (`2.5`).
3. Given sólido, When `protocolSchema` valida, Then `intake_unit` permanece `NULL`.
4. Given log de `100 ml`, When `logSchema` valida `quantity_taken`, Then aceita (teto revisado p/ `1000`).

### User Story 5 — Desmembramento de Compra via RPC + Custo por mL (P1) — Fase B
**Why**: UX "N frascos + preço total" numa tela, alimentando custo mensal com precisão, sem furar o modelo `purchases`.
**Independent Test**: `stockService.createPurchase` com `3 frascos de 100 ml`, total `R$ 30,00` → 3× `create_purchase_with_stock`, cada `p_quantity=100`, `p_unit_price=0.10`, última compensando centavos.

**Acceptance Scenarios**:
1. Given `3 frascos de 100 ml` por R$ 30,00, When processa, Then 3× `create_purchase_with_stock` (`p_quantity=100`, `p_unit_price=0.10`), criando 3 lotes independentes (cada um com `purchase_id`).
2. Given `3 frascos de 100 ml` por R$ 10,00 (divisão inexata), When processa, Then 2 primeiros usam `unit_price=ROUND(3.33/100,4)`; o último compensa o centavo p/ fechar R$ 10,00 exato.

### User Story 6 — Cadastro com Novas Unidades (Web, Mobile, Wizard) (P1) — Fase C
**Why**: sem expor `mg/ml`/`ui/ml` nos dropdowns (incl. onboarding), o usuário não cadastra líquido no novo modelo.
**Independent Test**: abrir form de medicamento (e o passo do wizard); dropdown de concentração lista `mg/ml`/`ui/ml` (sem `ml`/`gotas`); ao escolher `mg/ml`, surge badge `💧 Apresentação Líquida` + campo `Gotas por ml` (default 20).

**Acceptance Scenarios**:
1. Given `MedicineForm` (web/mobile) ou passo de medicamento do wizard, When o dropdown abre, Then lista `['mg','mcg','g','ui','un','mg/ml','ui/ml']` (sem `ml`/`gotas`), label **"Concentração"**.
2. Given escolha de `'mg/ml'`/`'ui/ml'`, When re-renderiza, Then exibe badge `💧 Apresentação Líquida` + campo `Gotas por ml` (default 20, editável).
3. Given criação de protocolo líquido, When renderiza, Then exibe select `intake_unit` (`gotas`/`ml`/`UI`) + hint *"💧 Defina a dose na unidade de tomada (gotas ou ml)."*; sólido oculta o select.

### User Story 7 — Cadastro de Estoque de Líquido (P1) — Fase C
**Why**: capturar "N frascos × V ml × preço total" de forma natural.
**Independent Test**: no `StockForm` com medicamento líquido, ver `💧 Inventário de Líquidos`, inputs `[N] frascos` / `[V] ml cada` + `Preço Total da Compra (R$)`; submeter dispara o desmembramento (US5).

**Acceptance Scenarios**:
1. Given medicamento líquido no `StockForm`, When renderiza, Then mostra `💧 Inventário de Líquidos`, dois inputs (`frascos`,`ml cada`) e `Preço Total da Compra (R$)`.
2. Given `2 frascos / 50 ml / R$ 50,00`, When confirma, Then payload `{numBottles:2, volumePerBottle:50, totalPrice:50}` → `stockService` (desmembra via RPC).

### User Story 8 — Banner de Fim de Frasco (P2) — Fase C
**Why**: avisar a Dona Maria antes do frasco acabar.
**Independent Test**: estoque `1.5 ml`; dose `15 gotas` (`units_per_ml=20` → `0.75 ml`) não dispara; dose `40 gotas` (`2 ml`) dispara (2 > 1.5).

**Acceptance Scenarios**:
1. Given `stock.quantity = 1.5` (ml) e próxima `expected_dose = 40` (`intake_unit='gotas'`, `units_per_ml=20`), When a timeline abre, Then converte `40/20 = 2 ml`, detecta `2 > 1.5`, exibe *"⚠️ Seu frasco ativo está no fim (restam apenas 1,5 ml). Lembre-se de abrir um novo frasco!"*.
2. Given dose convertida ≤ saldo, When abre, Then banner NÃO aparece.

### User Story 9 — Formatação de Dose + Confirmar Tomada no Telegram (P1) — Fase B/C
**Why**: exibir a tomada na unidade real (PT-BR) reusando o helper existente; tomadas via chat com débito físico consistente.
**Independent Test**: `formatDose(15,'gotas')→"15 gotas"`, `formatDose(2.5,'ml')→"2,5 ml"`, `formatDose(1,'gotas')→"1 gota"`. Alarme de Dipirona `15 gotas`; `✅ Tomei` → log + `consume_stock_fifo` debita `0.75 ml`; mensagem editada.

**Acceptance Scenarios**:
1. Given `(15,'gotas')`/`(2.5,'ml')`/`(1,'gotas')`, When `formatDose` roda, Then `"15 gotas"`/`"2,5 ml"`/`"1 gota"` (vírgula decimal via `formatNumberPtBR`; singular).
2. Given alarme *"🔔 Hora da sua Dipirona! Tomar 15 gotas agora."* (via `formatDose`), When clica `✅ Tomei`, Then bot persiste log, chama `consume_stock_fifo(p_quantity=15,...)` (RPC converte gotas→ml) e edita p/ *"✅ Dipirona confirmada!"*.

---

## Edge Cases

- **Underflow / dízimas**: conversões de gotas usam `ROUND(..., 2)`; `stock.quantity` é `numeric` (precisão por `ROUND` aplicativo + Zod, não escala de coluna). `CHECK (quantity >= 0)` impede saldo negativo.
- **Retrocompat sólidos**: caminho linear inteiro, sem conversão.
- **Líquido legado sem concentração**: `dosage_per_pill = NULL` tolerado; só a exibição de massa ativa (mg) fica oculta; decremento/adesão funcionam.
- **`intake_unit = 'UI'`**: ~~(v1) escala direta~~ **[As-Built — revisado]** UI agora **converte p/ ml via `units_per_ml`** (`ROUND(p_quantity/units_per_ml, 2)`), igual a `gotas` — `lower(intake_unit) IN ('gotas','ui')`. O smoke da Fase C expôs dose de insulina em UI (refil de caneta U-100): sem conversão, `100 UI` debitava `100 ml` → "Estoque insuficiente". Migração `20260608_fix_consume_fifo_ui_conversion.sql`. Só `intake_unit='ml'` é escala direta.
- **Centavos no custo/ml**: 3 frascos por R$ 10,00 → `price_per_bottle = 3.33`, último compensado `3.34`. Total reconstruído (`Σ unit_price*V`) ≈ R$ 10,00 sem perda.
- **Estoque zerado na confirmação Telegram**: por ação simultânea no app, o bot registra log best-effort e responde *"Registrei sua tomada, mas seu estoque está zerado no app!"* — sem exceção técnica (R-245/246).
- **Mobile sem `StockForm` dedicado**: o cadastro de estoque mobile pode estar em screen/fluxo distinto — **verificar o caminho real em C1**, não assumir paridade de nome com a web.

---

## Requirements

### Functional Requirements

**Fase A — DB/Backend**
- **FR-001**: Estender o enum `dosage_unit` (`DOSAGE_UNITS` core + CHECK/enum SQL) com `'mg/ml'` e `'ui/ml'`.
- **FR-002**: Adicionar **coluna genérica de densidade/razão→ml** em `public.medicines` (numeric,
  default `20`, nullable) cujo significado se adapta à `dosage_unit`: `gotas`→gotas/ml (`20`),
  `ui/ml`→UI/ml (`100`, reusada pela 012 p/ insulina). **Generaliza o antigo `units_per_ml`** num
  campo único razão→ml (nome final **`units_per_ml`** por ADR-058; manter retrocompat de leitura
  onde `units_per_ml` já for referenciado).
- **FR-002b**: Adicionar `presentation` (text/enum PT — `comprimido`/`capsula`/`liquido`/`injecao`/
  `pomada`/`spray`/`outro`, alinha `MEDICINE_TYPES`) em `public.medicines`, **additiva**. Forma
  farmacêutica explícita; **não** substitui a derivação `is_liquid := dosage_unit LIKE '%/ml'` do
  decremento (decisão-mãe). Para líquidos, popular consistente com o flag derivado. Base do eixo de
  forma que a 012 (Diabetes) estende para injetáveis. Migração: popular linhas existentes (default
  + heurística por `dosage_unit`/`type`) — detalhar no Planning desta spec.
- **FR-003**: Adicionar `intake_unit` (`text`, nullable) em `public.protocols`.
- **FR-004**: Adicionar `CHECK (quantity >= 0)` em `public.stock`.
- **FR-005**: **Migração de dados** — `dosage_unit IN ('ml','gotas')` → `dosage_unit = 'mg/ml'` + `units_per_ml = COALESCE(units_per_ml, 20)`, movendo a unidade antiga p/ `protocols.intake_unit`. Idempotente.
- **FR-006**: `public.consume_stock_fifo` infere líquido via `dosage_unit LIKE '%/ml'`, converte a tomada (`intake_unit` + `units_per_ml`) p/ ml e deduz por FIFO de `stock.quantity`, gravando `stock_consumptions`. Sólidos = linear. Mantém a assinatura `(p_user_id, p_medicine_id, p_quantity, p_medicine_log_id)`.

**Fase B — Core/Validações/Serviços**
- **FR-007**: `DOSAGE_UNITS` (`packages/core/src/schemas/medicineSchema.js`) ganha `'mg/ml'`/`'ui/ml'`; `medicineSchema` exige `units_per_ml` quando a unidade termina em `/ml` (concentração opcional/nullable).
- **FR-008**: `protocolSchema` (`packages/core/src/schemas/protocolSchema.js`) ganha `intake_unit` (`z.enum(['gotas','ml','UI']).nullable().optional()`) + superRefine: líquido ⇒ `intake_unit` obrigatório. `dosage_per_intake` permanece `.max(1000)` decimal.
- **FR-009**: Revisar o teto R-022 (cap-100) onde realmente vive — `logSchema.quantity_taken`, `adherencePatternSchema`, `costAnalysisSchema`, `reminderOptimizerSchema` — elevando p/ `.max(1000)`. Segurança real do volume = `CHECK`/saldo (Fase A), não o cap Zod.
- **FR-010**: `stockService.createPurchase` (web + mobile, ambos `.js`) desmembra `N frascos × V ml × preço total` em **N chamadas** `create_purchase_with_stock` (`p_quantity=V`, `p_unit_price=custo/ml`), compensando centavos no último. **Nunca** `supabase.from('stock').insert(...)`.
- **FR-011**: Estender `packages/core/src/utils/doseUnit.js` com `formatDose(value, unit)` reusando `formatNumberPtBR` (sem arquivo novo — DRY/R-231).
- **FR-012**: Leituras de saldo expõem a fração de frasco por `quantity / original_quantity` por lote (helper puro), sem tocar hooks de cache compartilhados.

**Fase C — UI/UX + Telegram**
- **FR-013** **[As-Built — revisado]**: `MedicineForm` (web + mobile) e o wizard filtram o dropdown de concentração p/ `['mg','mcg','g','ui','un','mg/ml','ui/ml']`, label "Concentração", badge `💧` p/ unidades `/ml`. **A densidade (`units_per_ml`) NÃO é mais pedida no cadastro do medicamento** (era contra-intuitivo — PO no smoke): `units_per_ml` virou **opcional** no `medicineSchema`; a densidade é capturada **contextualmente no form de tratamento** (FR-014), só quando a `intake_unit` é `gotas`/`UI` (não-`ml`), e persistida no medicamento via `medicineService.update`.
- **FR-014**: `ProtocolForm` (web `sections/ProtocolFormDosesSection.jsx`; mobile `treatments/components/ProtocolFormBody.jsx`) exibe condicionalmente o select `intake_unit` + hint quando líquido.
- **FR-015**: `StockForm` (web `features/stock/components/StockForm.jsx` + `sections/StockFormPurchaseDetails.jsx`) exibe `💧 Inventário de Líquidos`, inputs `frascos`/`ml cada` + `Preço Total da Compra (R$)`; despacha payload de desmembramento (FR-010). Caminho mobile a verificar em C1.
- **FR-016**: Banner em `features/dashboard/components/StockAlertInline.jsx` compara `stock.quantity` (ml) com `expected_dose` **convertida p/ ml** (via `units_per_ml` quando `intake_unit='gotas'`).
- **FR-017**: Bot (`api/notify.js` + `server/bot/callbacks/doseActions.js`) formata mensagens com `formatDose(expected_dose, intake_unit)`; callback `✅ Tomei` passa a dose na unidade de tomada p/ `consume_stock_fifo` (converte p/ ml internamente — FR-006).

### Key Entities
- **Medicine**: `dosage_unit` (enum estendido) + **coluna genérica de densidade/razão→ml** (ex-
  `units_per_ml`; `20` p/ gotas, `100` p/ UI) + **`presentation`** (forma farmacêutica, additiva).
  Líquido (decremento) = unidade termina em `/ml` (decisão-mãe inalterada).
- **Protocol**: `intake_unit` (`gotas`/`ml`/`UI`) — unidade física da tomada.
- **Stock**: `quantity` = ml restantes (líquidos) / unidades (sólidos); `original_quantity` = volume nominal do frasco.
- **Core**: `medicineSchema`, `protocolSchema`, `logSchema` & cousins (teto), `stockService` (desmembramento), `doseUnit.js` (`formatDose`).
- **UI/Bot**: forms web+mobile+wizard, `StockAlertInline`, `notify.js`, `doseActions.js`.

---

## Success Criteria

- **SC-001**: `consume_stock_fifo` faz baixas decimais (ml) e inteiras (sólidos) precisas por FIFO; nenhum medicamento permanece com `dosage_unit IN ('ml','gotas')` pós-migração; migração idempotente.
- **SC-002**: Zod valida concentração/tomada decimal e bloqueia líquidos sem `units_per_ml`/`intake_unit`, zero falso-positivo em sólidos legados; compras de N frascos geram N lotes via `create_purchase_with_stock` com total reconstruído sem perda de centavos.
- **SC-003**: Dropdowns (incl. wizard) expõem `mg/ml`/`ui/ml` e ocultam `ml`/`gotas` da concentração; o banner dispara só quando a dose **convertida p/ ml** supera o saldo; o bot formata via `formatDose` e debita o volume correto; estoque zerado não trava.

---

## As-Built — Fase C (smoke 2026-06-07/08)

Deltas spec→produção apurados no smoke PO (web complex + mobile + Telegram). Esta seção é **canônica** para o que foi ao ar.

### Decisões de UX revisadas no smoke
- **Densidade fora do cadastro de medicamento** (ver FR-013 revisado): `units_per_ml` virou opcional no `medicineSchema`; capturada no form de **tratamento** só quando `intake_unit ∈ {gotas, UI}`; persistida via `medicineService.update`. Removida dos 5 forms de medicamento (web form+wizard+onboarding, mobile form+onboarding).
- **Conversão de `UI`** (ver edge-case revisado): `consume_stock_fifo` converte `gotas` **e** `UI` via `units_per_ml`; só `ml` é escala direta. Migração `20260608_fix_consume_fifo_ui_conversion.sql`.
- **Custo por dose** (novo, além da spec): o KPI de estoque passou de "custo/ml|un" para **"Custo por dose"** (`avgUnitPrice × consumo_dia ÷ tomadas_dia`), com fallback custo/un|ml quando não há tratamento ativo. Decisão PO: número que o paciente entende.
- **Aba "Tratamentos"** (web): renomeada de "Tratamento" (paridade com mobile).

### Princípio constitucional novo
- **Constituição IX — Transparência Radical com o Paciente** (v0.2.0): proíbe silenciar falhas/falhas parciais em fluxos clínicos. Aplicado no registro em lote (`buildBulkOutcome` no mobile): informa quantas doses entraram, quantas falharam e por quê. Toast ganhou variante `warning`.

### Bugs de read-path corrigidos (recorrente no smoke)
Toda query/cálculo que renderiza ou consome dose líquida precisa de `intake_unit` (protocolo) + `units_per_ml` (medicamento). Faltavam em: estoque (lista + detalhe), dashboard (hoje), histórico de doses, lista de tratamentos, cartão de emergência, consulta médica, e os serviços de cálculo `calculateDailyIntake`/`predictRefill`/`costAnalysisService`. **Custo mensal** inflava (ex: insulina R$17k) por multiplicar dose em UI × preço/ml sem converter.

### Drift de contrato corrigido
- `consume_stock_fifo` passou a exigir `p_user_id` (Fase A) mas os callers não foram atualizados → registro de dose quebrava p/ **qualquer** medicamento. Corrigido em `doseService` (mobile, single+batch) e `createStockRepository.decreaseStock` (web/core).

### Centralização no core (`@dosiq/core`, web↔mobile)
Helpers acrescentados a `doseUnit.js` além do `formatDose` (FR-011): `isLiquidMedicine`, `stockUnitLabel`, `formatStockCount`, `formatStockQuantity`, `formatConcentration`, `formatIntakeDose`, `formatDoseItem`, `formatDoseHint`; `doseToMl` + `calculateDailyIntake` liquid-aware em `adherenceLogic.js`; `doseZones.DoseItem` ganhou `intakeUnit`/`unitsPerMl`. Regra emergente: **unidade nunca renderizada crua** — sempre via `formatConcentration`/labels.

### Telegram
- **`/registrar` desativado** (e o atalho `quick_register`): o registro de dose por chat usava dose-math pré-022 (mg = comprimidos × concentração) incompatível com líquidos + double-conversion com a RPC. `handleRegistrar` agora redireciona ao app/botão "Tomei". Lembrete de dose, botão "Tomei", `/status`, `/estoque`, `/hoje` seguem liquid-aware.
- Gap conhecido (fix-pack): inline query (`@bot` busca) ainda exibe estoque líquido como "X mg/ml".

### Correção fora-de-escopo (smoke)
- z-index de autocompletes empilhados no wizard (campo seguinte cobria o dropdown) — `:focus-within` no `.autocomplete-wrapper`.
