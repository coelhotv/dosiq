# Implementation Plan: Foundation & RLS (Caregiver Mode — Phase 1)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-1-foundation-rls`
**Epic**: [Modo Cuidador](../EPIC.md) · **Spec**: [spec.md](./spec.md)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §2. Modelo de Dados, §2.1 Schemas Zod, RLS

---

## Technical Context

Esta feature envolve a escrita e execução de migrations de banco de dados no Supabase local, a codificação de políticas RLS em PostgreSQL e a criação dos schemas de validação Zod 4 no monorepo core.

---

## Constitution Check

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Health Data Safety** | ✅ PASS | Segurança rigorosa de dados clínicos isolada via RLS e validação de runtime com Zod. |
| **II. Mobile-First Reliability** | ✅ PASS | Consultas otimizadas sem loops redundantes de requests. |
| **IV. Timezone Correctness** | ✅ PASS | Expiração dos códigos de convite monitorada via timestamps UTC no banco. |
| **VI. Release and SQP Discipline** | ✅ PASS | Processo inclui tarefas de versão, changelog e validação de linter. |

---

## Target Files

| Path | Purpose | Source Evidence |
|:---|:---|:---|
| `packages/core/src/schemas/caregiverSchemas.js` | Schemas Zod de validação `caregiverInviteSchema` e `caregiverLinkSchema` (R-021). | `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` |
| `packages/core/src/repositories/caregiverLinksRepository.js` | Repositório de leitura e manipulação de vínculos integrados no core. | `@dosiq/core` integration |
| `docs/migrations/<data>_caregiver_relations.sql` | Migration SQL criando tabelas relacionais, constraints de rate limit e políticas de RLS. **Path obrigatório `docs/migrations/`** (CLAUDE.md), nunca `supabase/migrations/`. Inclui template GRANTs + `ENABLE ROW LEVEL SECURITY` após cada `CREATE TABLE`. | Supabase DB Schema |

---

## Architectural Approach

### 1. Expo Go Decommission & Build Constraints
> [!IMPORTANT]
> **COMPILAÇÃO NATIVA OBRIGATÓRIA:**  
> A integração do cliente Supabase e a autenticação segura dependem de chaves criptográficas nativas. Todo teste de verificação deve ocorrer via Development Builds locais (`rtk expo run:android` / `rtk expo run:ios`).

### 2. Validação com Schemas Zod 4
* **Runtime Validation:** Antes de efetuar INSERT ou UPDATE na tabela `caregiver_links` ou `caregiver_invites` pelo cliente, o repositório core executa `caregiverLinkSchema.safeParse()` ou `caregiverInviteSchema.safeParse()` de acordo com as regras de nomenclatura e português brasileiro do Zod (R-021).

### 3. PostgreSQL RLS Policies (Supabase)
* **Manager Policy:**
  ```sql
  CREATE POLICY "Managers can do all mutations on linked patients"
  ON medicines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM caregiver_links
      WHERE caregiver_links.caregiver_id = auth.uid()
      AND caregiver_links.patient_id = medicines.user_id  -- schema dosiq usa user_id (owner=paciente)
      AND caregiver_links.role = 'manager'
    )
  );
  ```
* **Observer Policy:**
  ```sql
  CREATE POLICY "Observers can only select linked patients"
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

---

## 🔒 3. Standard Quality Protocol Checklist (R-221)

Toda tarefa e commit desta feature deve seguir rigorosamente a regra **R-221 (SQP)**:
* **Identificação de Plataformas:** Esta feature altera as plataformas **Shared/Core** (`packages/core`) e **Infra/Supabase**.
* **SemVer Impact:** Classificado como **minor** (modelo relacional e segurança RLS do cuidador).
* **Version Update:**
  * Core: Atualizar `packages/core/package.json` (`version`).
* **Changelog:** Adicionar entrada em português no arquivo `CHANGELOG.md` na seção `[Unreleased]` documentando a chegada das tabelas relacionais do cuidador e politicas RLS de proteção médica no Supabase.
* **Quality Commands:**
  * Executar `rtk lint` no core.
  * Executar `rtk npm run validate:agent` e garantir sucesso de regressões.
