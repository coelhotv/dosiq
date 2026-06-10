# Feature Specification: Relatório Médico em PDF (Mobile + Web)

**Feature Directory**: `plans/specs/007-medical-pdf-report`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Tier**: 1 (port mobile; web já existe)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Sources**:
- `PHASE_5_6_PARITY_AND_BEYOND.md` §F6.2 (consolidação unificada)
- `plans/backlog-native_app/EXEC_SPEC_FASE5_ANALITICAS.md` PO-8 (**origem CRUD**: na Fase 5 o "Gerar PDF" era **placeholder "em breve · Fase 6"**; esta spec é a realização real)

> **Reconciliação:** o **share sheet do Modo Consulta (spec 005)** tem a opção "Gerar PDF" — na fonte CRUD ficava desabilitada (placeholder, PO-8). Esta spec (007) **realiza** essa opção: ao tocar "Gerar PDF" no share sheet do 005, dispara o `pdfGeneratorService` mobile (`expo-print`). Integração: 005 FR-004 → 007 FR-001.

> **⚠️ Coordenação 012 (Diabetes T2 — 2026-06-10):** o cruzamento **dose × biomarcador** (glicemia
> etc., tabela `biomarkers_log`) no relatório clínico é **escopo da Fase E da 012** (FR-016 lá:
> agregação server-side R-249, descritivo, linha SaMD). Esta spec (007) NÃO deve duplicar — se a
> 012 Fase E já estiver entregue quando a 007 rodar, reusar a agregação; senão, o PDF da 007 sai
> sem biomarcadores e a 012 Fase E o estende depois.

---

## Context

Relatório clínico em PDF p/ levar/enviar ao médico. **PWA já gera** via `jsPDF`+`jspdf-autotable`. Esta feature **porta** p/ o **mobile nativo** via `expo-print` (HTML inline) + `expo-sharing`, reusando o mesmo layout/dados.

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

### Key Entities

- **Dados do relatório**: posologias ativas + agregados de adesão (`@dosiq/core`).

---

## Success Criteria

- **SC-001**: PDF mobile pronto p/ visualização/compartilhamento em < 1.5s.
- **SC-002**: Zero incremento no bundle gzip principal do PWA (dynamic imports mantidos).
- **SC-003**: Layout mobile visualmente consistente com o web.
