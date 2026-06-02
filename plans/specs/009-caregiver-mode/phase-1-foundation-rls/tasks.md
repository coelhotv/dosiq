# Tasks: Foundation & RLS (Caregiver Mode — Phase 1)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-1-foundation-rls`
**Epic**: [Modo Cuidador](../EPIC.md) · **Input**: [spec.md](./spec.md), [plan.md](./plan.md)
**Status**: Dev Ready

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Criar arquivo de migração SQL em `docs/migrations/<data>_caregiver_relations.sql` (path obrigatório CLAUDE.md) contendo a tabela de vínculos, tabela de convites com constraint de 5 tentativas, triggers de autoupdate, **template de GRANTs + `ENABLE ROW LEVEL SECURITY`** após cada `CREATE TABLE`. FK de `caregiver_links.patient_id` referencia o `auth.users.id` do paciente (owner). RLS filtra por `<tabela>.user_id` (não `patient_id`).
- [ ] **T002** [C1] Confirmar a integração do Supabase CLI no ambiente de desenvolvimento local para teste de políticas RLS.

## Phase 2: Implementation

### Database & Security
- [ ] **T003** [US1] Executar a migration e escrever as políticas RLS para a tabela `caregiver_links`, permitindo leitura ao médico observador e controle completo ao cuidador gestor.
- [ ] **T004** [US1] Habilitar a constraint de tentativas excedidas na tabela de convites no Supabase.

### Shared / Core Schemas & Repositories
- [ ] **T005** [US2] Codificar os schemas Zod 4 `caregiverInviteSchema` e `caregiverLinkSchema` em `packages/core/src/schemas/caregiverSchemas.js` aplicando validações robustas (R-021).
- [ ] **T006** [US2] Mapear métodos do repositório `caregiverLinksRepository.js` no monorepo core.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em `packages/core` e corrigir warnings.
- [ ] **T008** [C4] Criar testes unitários para a validação dos schemas Zod 4 no core.
- [ ] **T009** [C4] Criar testes de integração Supabase validando que o RLS bloqueia mutações de médicos observadores (`role='observer'`) e aprova mutações de gestores (`role='manager'`).
- [ ] **T010** [C4] Executar `rtk npm run validate:agent` e garantir sucesso total.
- [ ] **T011** [C4] **Verificação de DoD Independente (R-060):** Conferir no banco de dados local que tentativas consecutivas de ativação errada travam a linha correspondente de convite ao atingir 5 tentativas erradas.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão em `packages/core/package.json`.
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
