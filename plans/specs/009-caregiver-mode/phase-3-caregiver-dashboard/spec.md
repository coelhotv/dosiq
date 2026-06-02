# Feature Specification: Caregiver Dashboard (Caregiver Mode — Phase 3)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-3-caregiver-dashboard`
**Epic**: [Modo Cuidador](../EPIC.md) · **Phase**: 3 · **Depende de**: phase-1, phase-2
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Gate de entrada**: G1 — multi-perfil só após tração mono-paciente comprovada (ver EPIC)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §1. W7.3

---

> **Decisões deste round:**
> - **Registro remoto de dose:** o cuidador `manager` pode **registrar a dose do paciente remotamente** (painel web/app) — fluxo do DRAFT §Motor ("filha liga, confirma, clica Confirmar Dose"). Insere via `registerDose(...)` com `source='caregiver'`; sync tempo-real no device do paciente. **FR-006**.
> - **Faseamento por gate (G1):** o **switch multi-perfil (N pacientes)** só entra após o gate de adoção mono-paciente. A US1 mono-paciente é entregável independente; a expansão multi-perfil é gated.

---

## Context

Para que o cuidador consiga acompanhar múltiplos dependentes sem atrito ou complexidade de navegação, o Dosiq provê uma interface multi-perfil unificada. No celular, o cuidador pode alternar de forma instantânea através de um dropdown simples na barra superior, visualizando a agenda de cada idoso individualmente. Na web, um painel desktop robusto agrupa informações consolidadas em tempo real sobre alarmes atrasados, taxas de adesão e saldos de estoque estimados.

---

## User Scenarios & Testing

### User Story 1 - Alternância Multi-Perfil (Mobile) (Priority: P1)
**Why this priority**: Crucial para cuidadores familiares ou profissionais gerenciarem agendas distintas no mesmo celular.
**Independent Test**: Tocar no menu dropdown de perfil na barra superior do aplicativo do cuidador, selecionar outro dependente e verificar se a Home recarrega instantaneamente exibindo apenas os alarmes do dependente selecionado.

**Acceptance Scenarios**:
1. Given que Ana Paula cuida de seu pai (Seu João) e de sua mãe (Dona Maria), When ela abrir o app e tocar no dropdown no topo da tela, Then deve ver a opção de selecionar João ou Maria.
2. When ela selecionar "Seu João", Then os alarmes, calendários e listas da Home devem ser atualizados instantaneamente em fuso local para a grade posológica de seu pai.

### User Story 2 - Dashboard Consolidado (PWA/Web) (Priority: P1)
**Why this priority**: Permite monitoramento contínuo em tempo real a partir de computadores e telas maiores.
**Independent Test**: Acessar o painel web de cuidadores no desktop, verificar se as fichas consolidadas dos dependentes carregam em tempo real mostrando alertas visuais de doses atrasadas há mais de 30 minutos.

**Acceptance Scenarios**:
1. Given o painel do cuidador aberto no navegador do desktop, When Dona Maria deixar de tomar a Losartana programada para as 08:00 (após 30 minutos de tolerância), Then o cartão de Dona Maria na web deve piscar com sinalizador de alerta e somar +1 nas pendências críticas do dia.

---

## Edge Cases

- **Isolamento de dados entre Pacientes:** As consultas de SWR de cada dependente devem possuir chaves de cache isoladas e exclusivas baseadas em seu UUID correspondente. A alternância de perfil deve purgar caches temporários do paciente anterior para evitar cruzamento acidental de dados clínicos na tela.
- **Modificações Simultâneas de Posologia:** Se a filha alterar o horário de um remédio no painel web, o aplicativo do paciente idoso deve redefinir o alarme correspondente no próximo sync via webhook de notificação/background fetch.

---

## Requirements

### Functional Requirements

- **FR-001:** Dashboard de paciente único (mono-paciente) — entregável independente, **não gated**: cuidador vê agenda, adesão e estoque do paciente vinculado.
- **FR-002:** Dashboard desktop consolidado na plataforma web exibindo cards individuais de cada paciente cadastrado.
- **FR-003:** O painel web desktop exibe: últimas doses tomadas e alertas críticos de atrasos, progresso de adesão semanal e estimativa de esgotamento de estoque.
- **FR-004:** Uso de chaves SWR isoladas por dependente UUID para evitar contaminação de cache.
- **FR-005 [GATED por G1]:** Dropdown multi-perfil na barra superior (Header) mobile para alternância de dependentes (toque mínimo 60px) — **só implementar após o gate de tração mono-paciente** (ver EPIC). Antes do gate, header opera em modo single-patient.
- **FR-006:** **Registro remoto de dose** pelo cuidador `manager` (painel web/app) via `registerDose(...)` com `source='caregiver'`; o device do paciente reflete em tempo real no próximo sync.

### Key Entities

- **CaregiverLink:** Vínculo relacional contendo os IDs associados.
- **DoseInstance:** Registros materializados de doses filtrados por dependente.

---

## Success Criteria

- **SC-001:** Troca de perfil no mobile (quando G1 liberado) executada em menos de 200ms com recarregamento completo dos componentes da Home.
- **SC-002:** Zero vazamento ou cruzamento de dados de saúde entre dependentes (chaves SWR isoladas por UUID).
- **SC-003:** Dose registrada remotamente pelo cuidador (`source='caregiver'`) aparece no device do paciente no próximo sync, decrementa estoque e ancora a `dose_instance` correta — paridade com o registro local.
