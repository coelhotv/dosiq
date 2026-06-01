# Implementation Plan: Patient Dose History

**Feature Directory**: `plans/specs/003-patient-dose-history`  
**Spec**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/003-patient-dose-history/spec.md)  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §M1.1

---

## Technical Context

Esta feature realiza a leitura e mutações na tabela materializada `dose_instances` pós-refactor Fase 3. Os dados de histórico e status são carregados por meio de consultas otimizadas e cacheados localmente.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Mutações retroativas atualizam apenas os registros do usuário autenticado via políticas RLS existentes. |
| **II. Mobile-First Reliability** | ✅ PASS | O calendário e a lista cronológica usam componentes nativos e virtualização para suportar listas longas sem engasgos no mobile. |
| **IV. Timezone Correctness** | ✅ PASS | Todo o fuso horário para montagem do calendário e dia local do check-in utiliza `parseLocalDate()` de `@utils/dateUtils`. |
| **VI. Release and SQP Discipline** | ✅ PASS | O checklist obrigatório R-221 (SemVer e CHANGELOG) está embutido no processo de desenvolvimento da feature. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/mobile/src/features/history/components/AdherenceCalendar.jsx` | Componente de calendário em linha com botões grandes de acessibilidade. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/history/components/DoseHistoryList.jsx` | Lista virtualizada e cronológica de medicamentos tomados e pendentes. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/history/components/DoseActionSheet.jsx` | Bottom sheet de ação para check-in retroativo ou reversão de status. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `apps/mobile/src/features/history/screens/HistoryScreen.jsx` | Tela de histórico agregando o calendário e a lista cronológica. | `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` |
| `packages/core/src/repositories/doseInstanceRepository.js` | Métodos de leitura e mutação Supabase de `dose_instances` integrados no monorepo core. | `@dosiq/core` integration |

---

## Architectural Approach

### 1. Expo Go Decommission & Build constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> O Dosiq utiliza dependências nativas no mobile. O desenvolvimento e testes locais de histórico devem ocorrer puramente via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`). O Expo Go padrão é incompatível.

### 2. Leitura Materializada SWR
- O mobile consome dados do Supabase cacheando-os sob a chave `@dosiq/dose-instances-snapshot` no AsyncStorage.
- Após qualquer inserção ou reversão executada na `DoseActionSheet`, o hook `useDoseMutation` deve invalidar as chaves de histórico no SWR cache (`@dosiq/dose-instances-snapshot` e `@dosiq/adherence-snapshot`) para que a UI de estatísticas e o calendário reflitam a mudança imediatamente.

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:

*   **Identificação de Plataformas:** Esta feature altera as plataformas **Mobile** e **Shared/Core** (`packages/core`).
*   **SemVer Impact:** Classificado como **minor** (nova visualização clínica de histórico e calendário no mobile).
*   **Version Update:**
    *   Mobile: Atualizar `apps/mobile/app.config.js` (`APP_VERSION`).
*   **Changelog:** Adicionar uma entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do calendário histórico e controle de doses no mobile.
*   **Store Note:** Preparar notas de atualização destacando a maior autonomia no controle retroativo de medicamentos.
*   **Quality Commands:**
    *   Executar `rtk lint` no core e no mobile.
    *   Executar `rtk npm run validate:agent` e garantir sucesso total antes do commit final.
