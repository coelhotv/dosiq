# Feature Specification: Foundation & RLS (Caregiver Mode — Phase 1)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-1-foundation-rls`
**Epic**: [Modo Cuidador](../EPIC.md) · **Phase**: 1 (fundação bloqueante)
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Gate de entrada**: G0 (>50 signups — ver EPIC)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §2. Modelo de Dados, §2.1 Schemas Zod, RLS

---

## Context

A integridade e segurança no compartilhamento de dados médicos são vitais no ecossistema do Dosiq. Esta feature especifica a modelagem relacional de banco de dados e as regras de segurança refinadas ao nível de linha (RLS - Row Level Security) do Supabase para o relacionamento entre pacientes, cuidadores gestores e médicos observadores, em conformidade com as regras de validação estrutural do Zod 4 no core.

> **Princípio fundador — Owner = Paciente (D1):** o paciente é SEMPRE o owner dos dados (`user_id` = `auth.users.id` do paciente). O cuidador é **operador via RLS**, nunca dono. Todas as entidades nascem sob o `user_id` do paciente desde o setup → a **revogação só deleta a linha de `caregiver_links`**, sem migração de ownership. As policies RLS abaixo filtram por `user_id` (coluna real do schema dosiq), não por `patient_id`.

---

## User Scenarios & Testing

### User Story 1 - Segurança de Permissão Manager (Priority: P1)
**Why this priority**: Permite ao cuidador realizar a gestão clínica sem expor dados de pacientes não associados.
**Independent Test**: Tentar inserir ou atualizar um tratamento clínico em nome de um paciente cadastrado, verificando que o Supabase aceita a mutação apenas se houver uma linha correspondente com `role='manager'` em `caregiver_links`.

**Acceptance Scenarios**:
1. Given que Ana Paula é cuidadora vinculada de Dona Maria com perfil `manager`, When ela cadastrar um novo medicamento no celular dela para a mãe, Then o Supabase deve aprovar o INSERT e salvar o registro com sucesso.
2. Given que Ana Paula tenta fazer o INSERT na tabela de outro paciente não vinculado, When a requisição for processada, Then o Supabase RLS deve rejeitar a operação instantaneamente.

### User Story 2 - Restrição Clinica do Médico Observador (Priority: P1)
**Why this priority**: Evita que profissionais de saúde façam alterações acidentais de dosagem ou registros de dose.
**Independent Test**: Autenticar como médico com relacionamento `role='observer'`, tentar executar um UPDATE ou DELETE em `dose_instances` ou `medicines`, verificando que o Supabase rejeita a operação com erro de permissão negada.

**Acceptance Scenarios**:
1. Given que o Dr. Marcos (médico) está vinculado a Dona Maria com perfil `observer`, When ele visualizar a grade de remédios no dashboard, Then ele deve ler os dados com sucesso (SELECT aprovado).
2. When o Dr. Marcos tentar desativar ou deletar um medicamento da paciente, Then o banco deve bloquear a mutação de imediato.

---

## Edge Cases

- **Revogação de Vínculo em Tempo Real:** Se o paciente clicar em "Revogar Acesso", a linha relacional em `caregiver_links` é excluída. A política de RLS deve garantir que qualquer SELECT subsequente do cuidador falhe imediatamente no Supabase (zero cache de credenciais do banco).
- **Tentativas Excedidas de Convite (Rate Limit):** A tabela `caregiver_invites` limita a 5 o número de tentativas erradas de ativação do código (`attempts <= 5`) para impedir ataques de força bruta. Tentativas subsequentes devem travar o código e retornar erro "Código bloqueado".

---

## Requirements

### Functional Requirements

- **FR-001:** Mapear tabelas relational no banco Supabase: `caregiver_invites` e `caregiver_links`.
- **FR-002:** Implementar políticas RLS do Supabase para restrição total baseada nos relacionamentos de vínculo ativo.
- **FR-003:** O perfil `role='manager'` possui direitos de inserção e edição nos dados do paciente vinculado.
- **FR-004:** O perfil `role='observer'` possui direitos restritos de leitura (SELECT), sendo totalmente bloqueado para INSERT, UPDATE ou DELETE.
- **FR-005:** Schemas canônicos de validação Zod 4 implementados em `@dosiq/core/schemas/caregiverSchemas.js`: `caregiverInviteSchema` e `caregiverLinkSchema`.

### Key Entities

- **CaregiverInvite:** Cadastro de código temporário de setup.
- **CaregiverLink:** Cadastro de relacionamentos e perfis de permissão.

---

## Success Criteria

- **SC-001:** 100% de eficácia no bloqueio de tentativas de mutação (INSERT/UPDATE/DELETE) para usuários não autorizados ou observadores (médicos).
- **SC-002:** Bloqueio e cancelamento automático de códigos de convite com 5 tentativas incorretas consecutivas.
