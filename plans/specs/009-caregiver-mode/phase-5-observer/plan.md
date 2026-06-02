# Implementation Plan: Medical Observer Dashboard (Caregiver Mode — Phase 5)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-5-observer`
**Epic**: [Modo Cuidador](../EPIC.md) · **Spec**: [spec.md](./spec.md)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §1. W7.4

---

## Technical Context

Esta feature envolve a criação de rotas e componentes desktop exclusivos na web Next.js/Vite e a validação do perfil read-only pelas políticas RLS PostgreSQL no Supabase.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Políticas de segurança RLS blindam de forma atômica contra qualquer escrita não autorizada de médicos observadores. |
| **II. Mobile-First Reliability** | ✅ PASS | Layout desktop otimizado sem processamentos redundantes em aparelhos móveis. |
| **IV. Timezone Correctness** | ✅ PASS | Agrupamento de adesão consolidado no fuso GMT-3 cadastrado do paciente. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `apps/web/src/features/doctor/screens/DoctorDashboard.jsx` | Tela desktop consolidada de monitoramento clínico de pacientes vinculados. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `apps/web/src/features/doctor/components/PatientRow.jsx` | Componente de linha de tabela exibindo adesão, chips de tendência e dosagem. | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `packages/core/src/repositories/doctorRepository.js` | Repositório de leitura dos dados de pacientes vinculados integrados no core. | `@dosiq/core` integration |
| `docs/migrations/<data>_observer_permissions.sql` | Migration RLS SELECT para `role='observer'` + tabela/colunas de **token TTL 24–72h** (gerado por paciente/cuidador). **Path `docs/migrations/`** (CLAUDE.md). Template GRANTs + RLS após `CREATE TABLE`. RLS filtra por `<tabela>.user_id`. | Supabase DB Schema |

---

## Architectural Approach

### 1. Build Constraints & Desktop Target
* **Target Desktop:** Como o portal do médico é desenhado para uso em computadores e clínicas, a rota `apps/web/src/features/doctor/` é otimizada para navegadores desktop, sem impacto nos bundles móveis nativos.

### 2. Políticas RLS de Leitura Isolada
* **PostgreSQL RLS:** As tabelas `medicines`, `dose_instances` e `protocols` herdam políticas de consulta restritas por relacionamento de chave estrangeira com a tabela `caregiver_links`. O médico observador (`role='observer'`) só pode executar SELECT se existir linha de vínculo:
  ```sql
  CREATE POLICY "Médico observador lê dados do paciente"
  ON medicines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM caregiver_links
      WHERE caregiver_links.caregiver_id = auth.uid()
      AND caregiver_links.patient_id = medicines.user_id  -- schema dosiq usa user_id (owner=paciente)
      AND caregiver_links.role = 'observer'
    )
  );
  ```
  *(Políticas de INSERT, UPDATE e DELETE correspondentes NÃO são criadas para observer, impossibilitando qualquer mutação de dados por design).*

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Web**, **Shared/Core** (`packages/core`) e **Infra/Supabase**.
* **SemVer Impact:** Classificado como **minor** (painel desktop de monitoramento para médicos observadores).
* **Version Update:**
  * Web: Atualizar `apps/web/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada do painel médico observador e restrições RLS de leitura.
* **Quality Commands:**
  * Executar `rtk lint` no core e na web.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
