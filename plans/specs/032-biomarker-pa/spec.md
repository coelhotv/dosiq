# Feature Specification: Biomarcador Pressão Arterial (PA)

**Feature Directory**: `plans/specs/032-biomarker-pa`
**Created**: 2026-06-15
**Status**: draft
**Tier**: 1 (UI sobre modelo já schema-ready; sem migração)
**Artifacts**: `spec.md` (lite) — `plan.md`/`tasks.md` no Planning
**Input**: "/devflow specifying 032 - biomarker pressão arterial"
**Legacy Sources**:
- Épico 012 Fase C (`biomarkers_log` genérico — PR #665/#666, ADR-060/CON-025)

> **Pré-requisito ✅ já em prod (012 Fase C):** a tabela `biomarkers_log` nasceu **genérica e
> schema-ready p/ PA**: coluna `value_secondary` (numeric, nullable) reservada p/ o 2º componente
> de medidas compostas (PA = sistólica em `value` + diastólica em `value_secondary`; decisão PO
> 2026-06-10 — duas colunas, não duas linhas). O `biomarkerLogSchema` (core) já tem `applyPaRefine`.
> **v1 da Fase C entregou só glicemia + peso na UI** — PA ficou schema-ready, sem UI. Esta spec
> **032 implementa a camada de UI/UX de PA**, sem tocar DB nem schema canônico.

---

## Context

Pressão arterial é o 3º biomarcador mais relevante p/ o público do Dosiq (idoso, hipertensão
frequentemente comórbida com diabetes T2). O modelo de dados já suporta PA desde a Fase C do 012; o
que falta é a **superfície**: registrar "12 por 8" (sistólica/diastólica) com fricção mínima, ver na
tendência e na timeline. Mantém a **linha SaMD** (ADR-062): registro/tendência descritivos, **sem
classificação de risco** (nunca "hipertensão estágio 2", nunca cor por qualidade do valor — cor
diferencia tipo de evento, não qualidade).

**Mobile-first + espelho web** (mesmo padrão da Fase C: PR 3a mobile → PR 3b web).

---

## User Scenarios & Testing

### User Story 1 — Registrar PA com 2 campos (P1)
**Why**: PA é composta (sistólica/diastólica); o fast-log de 1 valor (glicemia/peso) não serve.
**Independent Test**: no fast-log, escolher tipo "Pressão arterial"; o sheet exibe **2 campos**
(sistólica e diastólica) na unidade `mmHg`; salvar grava `value`=sistólica + `value_secondary`=
diastólica em `biomarkers_log`.

**Acceptance Scenarios**:
1. Given o fast-log (layout B "idoso primeiro"), When seleciono "Pressão arterial" e informo `120` e
   `80`, Then cria `biomarkers_log` (`type='pressao_arterial'`, `value=120`, `value_secondary=80`,
   `unit='mmHg'`, `measured_at`=instante, `source='manual'`), validado por `biomarkerLogSchema` +
   `applyPaRefine` (ambos os campos obrigatórios p/ PA).
2. Given vírgula PT-BR / campo vazio, When digito, Then normaliza/valida (R-270/R-276) — não grava PA
   pela metade (refine exige sistólica **e** diastólica).
3. Given a trava SaMD, When registro PA, Then o app **só exibe/armazena** — nenhuma classificação de
   risco ou recomendação.

### User Story 2 — PA na tendência e na timeline (P1)
**Why**: ver a evolução da PA ao longo do tempo, junto das demais medidas/doses.
**Independent Test**: registrar algumas PAs; abrir a Área de Medidas; chip "Pressão arterial"; ver a
tendência (2 séries: sistólica/diastólica) e o card na timeline mostrando "120 por 80 mmHg".

**Acceptance Scenarios**:
1. Given medidas de PA, When abro a tendência, Then o gráfico mostra as **duas séries** (sistólica e
   diastólica) — descritivo, **sem zona/meta/linha-alvo** (SaMD); média descritiva como número.
2. Given a timeline/registro, When uma PA aparece, Then o card exibe "**{sistólica} por {diastólica}
   mmHg**" (formatação composta), reusando o `BiomarkerEventCard`/`MeasureCard` da Fase C.
3. Given multi-biomarcador, When troco de chip, Then PA coexiste com glicemia/peso sem redesenho
   (chips sem ícone; `IconRuler` marca medida).

---

## Functional Requirements

- **FR-001**: Fast-log suporta tipo **`pressao_arterial`** com **2 campos** (sistólica → `value`,
  diastólica → `value_secondary`), unidade fixa `mmHg`. Reusa o bottom sheet/modal da Fase C (layout
  B), só estendendo p/ o 2º campo quando o tipo é PA.
- **FR-002**: Validação via `biomarkerLogSchema` + `applyPaRefine` (core, já existentes) — ambos os
  componentes obrigatórios; vírgula PT-BR normalizada (R-270/R-276). Nada de PA parcial.
- **FR-002b**: Contexto de PA opcional com chips: `ao_acordar` · `em_repouso` · `apos_exercicio` · `ao_dormir` · `pos_medicacao`. Enum `BIOMARKER_PA_CONTEXTS` separado de glicemia; exibido quando presente nos cards.
- **FR-003**: Exibição composta "**S por D mmHg**" em todos os renderizadores de medida (card da
  timeline, último registro, lista do histórico, detalhe) — helper de formatação no core (`@dosiq/core`),
  reusado web↔mobile (não duplicar).
- **FR-004**: Tendência de PA com **duas séries** (sistólica/diastólica) no scatter/gráfico da Área de
  Medidas — descritivo, **sem zona/meta** (SaMD). Decidir no Planning: 2 cores neutras (tipo, não
  qualidade) ou 2 marcadores.
- **FR-005**: Adicionar PA ao chip de tipos da Área de Medidas (mobile + web).
- **FR-006**: Espelho web (mesmo helper/agregador core); paridade com mobile.

## Success Criteria

- **SC-001**: registrar/editar/excluir PA (2 campos) end-to-end, mobile + web; grava `value`+
  `value_secondary` corretos.
- **SC-002**: PA na tendência (2 séries) e na timeline com formato "S por D mmHg"; **sem** classificação
  de risco/zona/meta (SaMD preservado).
- **SC-003**: zero migração de DB / zero mudança no schema canônico (só UI + helper de formatação);
  `biomarkerLogSchema` existente cobre PA.

## Assumptions / Open Questions

- ✅ `biomarkers_log.value_secondary` + `applyPaRefine` já em prod (Fase C do 012) — só falta UI.
- ✅ Contextos PA definidos no Planning: `ao_acordar`, `em_repouso`, `apos_exercicio`, `ao_dormir`, `pos_medicacao`. Enum separado de glicemia (`BIOMARKER_PA_CONTEXTS`).
- ✅ Representação visual das 2 séries na tendência: 2 círculos/pontos por leitura em 2 cores neutras (sistólica = `info`, diastólica = `neutral[400]`). Cor = identidade de série, nunca qualidade (SaMD ok).
