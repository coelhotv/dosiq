# Feature Specification: Relatório Médico em PDF (Mobile + Web)

**Feature Directory**: `plans/specs/007-medical-pdf-report`
**Created**: 2026-06-01 · **Revised**: 2026-06-15
**Status**: planned — backlog; **absorve a Fase E do 012 (FR-016, descoped do 012 em 2026-06-15)**
**Tier**: 2 (port mobile + **agregação server-side dose×biomarcador (R-249)** + seção biomarcador + render de líquidos/injetáveis; antes Tier 1)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Sources**:
- `PHASE_5_6_PARITY_AND_BEYOND.md` §F6.2 (consolidação unificada)
- `plans/backlog-native_app/EXEC_SPEC_FASE5_ANALITICAS.md` PO-8 (**origem CRUD**: na Fase 5 o "Gerar PDF" era **placeholder "em breve · Fase 6"**; esta spec é a realização real)

> **Reconciliação:** o **share sheet do Modo Consulta (spec 005)** tem a opção "Gerar PDF" — na fonte CRUD ficava desabilitada (placeholder, PO-8). Esta spec (007) **realiza** essa opção: ao tocar "Gerar PDF" no share sheet do 005, dispara o `pdfGeneratorService` mobile (`expo-print`). Integração: 005 FR-004 → 007 FR-001.

> **✅ Absorve a Fase E do 012 (2026-06-15):** a Fase E do épico 012 foi **descoped** e seu escopo
> migrou p/ cá. Esta spec (007) agora **é** o destino do **FR-016**: cruzamento **dose × biomarcador**
> (glicemia etc., tabela `biomarkers_log`) no relatório clínico — agregação **server-side (R-249)**,
> **descritivo/SaMD** (sem recomendação nem cálculo de dose). Reusa a fundação da Fase C do 012 já
> em prod: tabela `biomarkers_log`, adapter `biomarkersToEvents` e os formatters core de líquidos
> (`formatIntakeDose`/`formatDoseItem`/`isLiquidMedicine`). Ver FR-005..FR-008 abaixo.

---

## Context

Relatório clínico em PDF p/ levar/enviar ao médico. **PWA já gera** via `jsPDF`+`jspdf-autotable`. Esta feature **porta** p/ o **mobile nativo** via `expo-print` (HTML inline) + `expo-sharing`, reusando o mesmo layout/dados.

**Absorvendo o 012 (descope da Fase E):** o relatório passa a contemplar o perfil diabético — (a)
**dose × biomarcador por período** (a contribuição clínica central do FR-016: o médico cruza a
glicemia/peso com as doses ao longo do dia, descritivo); (b) **medicamentos líquidos/injetáveis**
renderizados na unidade de tomada correta via formatters core (insulina "10 UI", GLP-1 "1 mg" —
nunca `dosage_unit` cru ou "comprimido"; R-272), incluindo forma injetável e validade biológica
quando relevante. Mantém a **linha SaMD**: registro/tendência, zero recomendação de dose.

> **Reality-check (revisão 2026-06-02):**
> - **Web PDF já existe e funcional**: `apps/web/src/features/reports/services/pdfGeneratorService.js` (jsPDF, `drawHeader`/`drawAdherenceSummary`/...) + `consultationPdfService.js`. **NÃO** criar `apps/web/src/features/history/services/webPdfService.js` (dir `features/history` não existe na web; o real é `features/reports`). O escopo web = **manter/otimizar lazy-load** (AP-B03), não reescrever.
> - **Mobile não tem `features/history` nem `features/reports`** (dirs: dashboard/dose/medications/notifications/onboarding/profile/stock/treatments). Criar `features/reports` no mobile (espelha a web) p/ o serviço nativo.
> - Dados de adesão vêm de `@dosiq/core` (`adherenceLogic`) + `dose_instances`; datas via `@dosiq/core`.

---

## User Scenarios & Testing

### User Story 1 — Gerar PDF no Celular (P1)
**Why**: salvar/enviar o relatório do smartphone.
**Independent Test**: tocar "Exportar Relatório PDF" no mobile; abre o visualizador nativo; PDF legível com tratamentos ativos + adesão do mês.

**Acceptance Scenarios**:
1. Given Dona Maria quer o histórico impresso, When toca "Exportar Relatório PDF", Then o app monta HTML clínico inline e gera o PDF via `expo-print` (`printToFileAsync`).

### User Story 2 — Compartilhamento Instantâneo (P1)
**Why**: enviar por WhatsApp/e-mail.
**Independent Test**: após gerar, "Compartilhar" abre o Share Sheet nativo (iOS/Android).

**Acceptance Scenarios**:
1. Given o PDF gerado, When "Compartilhar", Then `expo-sharing` (`shareAsync`) abre o menu nativo.

### User Story 3 — Cruzamento dose × biomarcador no relatório (P1) — **ex-012 FR-016**
**Why**: o médico decide olhando glicemia/peso **junto** das doses por período do dia; relatório que
só lista doses conta metade da história (paciente diabético).
**Independent Test**: gerar relatório de um período com doses + medidas (`biomarkers_log`); conferir
seção que cruza dose e biomarcador agrupados por período/dia, **agregada server-side**, **descritiva**
(sem recomendação/cálculo de dose).

**Acceptance Scenarios**:
1. Given histórico de doses + biomarcadores num período, When o relatório é gerado, Then cruza ambos
   por período do dia (agrupamento) com agregação **server-side** (R-249, Constitution III), em PDF.
2. Given a linha SaMD, When o relatório é gerado, Then é **descritivo** (registro/tendência) — sem
   recomendação de dose, sem meta/alvo glicêmico como parâmetro.
3. Given um paciente sem biomarcadores no período, When o relatório é gerado, Then a seção de
   biomarcador é **omitida graciosamente** (sem seção vazia) — o PDF de meds/adesão sai normal.

### User Story 4 — Dose de líquidos/injetáveis no PDF (P1) — **ex-012 (FR-015 herança)**
**Why**: insulina/GLP-1 no relatório precisam aparecer na unidade real ("10 UI", "1 mg"), não "10 un.".
**Independent Test**: gerar relatório com insulina U-100 e GLP-1; conferir dose via formatters core.

**Acceptance Scenarios**:
1. Given um tratamento líquido/injetável, When o relatório lista a posologia, Then a dose usa
   `formatIntakeDose`/`formatDoseItem` (`@dosiq/core`) na unidade de tomada (UI/ml/gotas/mg, case
   canônico — R-272), **nunca** `dosage_unit` cru nem "comprimido" hardcoded. Query traz
   `intake_unit`+`units_per_ml`+`dosage_per_pill` (R-267).

---

## Edge Cases

- **Grandes volumes (90 dias, dezenas de medicamentos)**: HTML inline com tabelas enxutas/paginação simples — não estourar memória.
- **Web lazy-load (AP-B03)**: `jsPDF`/`jspdf-autotable` por dynamic import — bundle principal inalterado.

---

## Requirements

### Functional Requirements

- **FR-001**: Mobile gera PDF via `expo-print` (`printToFileAsync({ html })`) a partir de HTML+CSS inline.
- **FR-002**: Layout: cabeçalho de identificação, Medicamentos Ativos, indicadores de Aderência (reusa `adherenceLogic` core), histórico cronológico resumido — espelhando o layout web (`pdfGeneratorService.js`).
- **FR-003**: Mobile compartilha via `expo-sharing` (`shareAsync(uri)`) a partir do arquivo temporário.
- **FR-004**: Web **mantém** `features/reports/pdfGeneratorService.js` com lazy-load (AP-B03) — sem regressão de bundle. (Sem reescrever.)

**Absorvidos do 012 (Fase E descoped → 007):**
- **FR-005 (ex-012 FR-016)**: o relatório cruza **dose × `biomarkers_log`** por período/dia, com
  **agregação server-side** (R-249, Constitution III), **descritivo** (sem recomendação/cálculo de
  dose — linha SaMD). Reusa a fundação da Fase C do 012 (`biomarkers_log` + `biomarkersToEvents`).
  Aplica-se a mobile **e** web (mesmo agregador). Seção omitida graciosamente quando não há medidas.
- **FR-006**: Dose de medicamentos **líquidos/injetáveis** renderizada via formatters core
  (`formatIntakeDose`/`formatDoseItem`/`isLiquidMedicine`, `@dosiq/core`) na unidade de tomada
  (UI/ml/gotas/mg, case canônico — R-272); **nunca** `dosage_unit` cru nem "comprimido". A query do
  relatório traz `intake_unit`+`units_per_ml`+`dosage_per_pill` (R-267 read-path completo).
- **FR-007**: Quando aplicável, exibir **forma injetável** e **validade biológica** (TTL pós-abertura)
  do 012 Fase A na seção de medicamentos/estoque do relatório (informativo, sem alerta interativo).
- **FR-008**: Paridade mobile↔web da seção de biomarcador e de líquidos: o **agregador é
  compartilhado** (`@dosiq/core`/serviço server-side), os renderizadores (HTML inline mobile / jsPDF
  web) consomem o mesmo dado — sem duplicar lógica de cruzamento.

### Key Entities

- **Dados do relatório**: posologias ativas + agregados de adesão (`@dosiq/core`).
- **Cruzamento dose × biomarcador** (ex-012 FR-016): doses (`dose_instances`/`medicine_logs`) ×
  `biomarkers_log` agrupados por período/dia, agregação server-side, descritivo.
- **Posologia líquida/injetável**: dose na unidade de tomada via formatters core (`intake_unit`,
  `units_per_ml`, `dosage_per_pill`, `presentation`, `shelf_life_days`).

---

## Success Criteria

- **SC-001**: PDF mobile pronto p/ visualização/compartilhamento em < 1.5s.
- **SC-002**: Zero incremento no bundle gzip principal do PWA (dynamic imports mantidos).
- **SC-003**: Layout mobile visualmente consistente com o web.
- **SC-004 (ex-012 SC-005)**: relatório cruza dose × biomarcador **server-side**, descritivo (zero
  recomendação de dose — linha SaMD), em mobile e web; seção omitida quando não há medidas.
- **SC-005**: dose de líquidos/injetáveis no PDF sempre na unidade de tomada via formatters core
  (insulina "10 UI", GLP-1 "1 mg") — nunca `dosage_unit` cru nem "comprimido".
