# Feature Specification: Medical Observer Dashboard (Caregiver Mode — Phase 5)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-5-observer`
**Epic**: [Modo Cuidador](../EPIC.md) · **Phase**: 5 · **Depende de**: phase-1 (vínculos + RLS)
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Gate de entrada**: G3 — demanda clínica comprovada (ver EPIC)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §1. W7.4

---

> **Decisão de segurança deste round (D2):** o dashboard do médico **NÃO é rota pública**. Acesso por **token temporário com TTL 24–72h** gerado pelo paciente OU pelo cuidador, **ou** sessão autenticada do médico. O `auth.uid()` necessário ao RLS vem da sessão; no modo token, o token assinado mapeia para o vínculo `role='observer'` válido e não-expirado. Token expirado → 403. Isto reconcilia a contradição da versão migrada (que falava em "rota pública autenticada"). Padrão espelha `api/share` (TTL de blob), evitando função serverless nova.

---

## Context

Para aproximar os profissionais de saúde do dia a dia do paciente, o Dosiq provê o papel de **Médico Observador** (`role='observer'`). Esta feature especifica o painel desktop focado em computadores de clínicas e consultórios, onde médicos autorizados podem acompanhar em tempo real o histórico e as taxas de adesão semanal de seus pacientes, operando estritamente em formato de leitura de dados (read-only) com proteção integral de RLS no Supabase.

---

## User Scenarios & Testing

### User Story 1 - Acompanhamento do Paciente (Priority: P1)
**Why this priority**: Permite que o cardiologista ou geriatra avalie a fidelidade à posologia antes de alterar dosagens de tratamentos.
**Independent Test**: Fazer login no portal médico, carregar a rota de dashboard em navegador desktop e verificar se a listagem exibe todos os pacientes vinculados com suas respectivas taxas de adesão dos últimos 7 dias.

**Acceptance Scenarios**:
1. Given que o Dr. Marcos (médico) está logado em `dosiq.app/doctor/dashboard`, When ele carregar a página inicial, Then ele deve visualizar uma lista enxuta de seus pacientes contendo: Nome do Paciente, Aderência 7d, Último medicamento tomado e Tendência.

### User Story 2 - Tentativa de Mutação Bloqueada (Priority: P1)
**Why this priority**: Evita alterações não autorizadas ou acidentais de registros de saúde.
**Independent Test**: Tentar enviar uma requisição PATCH ou DELETE em nome de um paciente vinculado a partir do portal médico, verificando que o Supabase bloqueia a mutação através de regras RLS com erro 403.

**Acceptance Scenarios**:
1. Given o portal médico aberto para o Dr. Marcos, When ele acidentalmente tentar alterar o horário da Losartana de Dona Maria na grade, Then a operação deve ser rejeitada imediatamente pelo banco e exibir a mensagem: *"Acesso Read-Only: Você não possui permissão para editar medicamentos."*

---

## Edge Cases

- **Revogação pelo Paciente durante a Consulta:** Se o paciente revogar o acesso do médico no aplicativo nativo, a linha em `caregiver_links` (com `role='observer'`) é deletada. O dashboard do médico deve imediatamente mascarar e bloquear a exibição dos dados do paciente no próximo pooling SWR.
- **Isolamento entre Pacientes de Médicos Distintos:** O RLS deve assegurar de forma rígida que o Dr. Marcos não consiga, em nenhuma circunstância, efetuar SELECT em dados de pacientes vinculados a outros médicos no sistema.

---

## Requirements

### Functional Requirements

- **FR-001:** Rota desktop no PWA `dosiq.app/doctor/dashboard` (sem app nativo) protegida por **sessão autenticada OU token temporário TTL 24–72h** (gerado pelo paciente ou cuidador). **Nunca acesso anônimo.** Token expirado/revogado → 403.
- **FR-006:** Geração/revogação de token de observer pelo paciente ou cuidador; expiração automática no TTL. RLS `role='observer'` condicionada a vínculo válido + (sessão `auth.uid()` OU token válido mapeado ao vínculo).
- **FR-002:** Tela com layout clínico exibindo: Lista de pacientes vinculados, adesão nos últimos 7 dias, último medicamento tomado e chip indicador de tendência (Estável, Crescente, Queda).
- **FR-003:** O perfil `role='observer'` herda estritamente direitos de leitura (SELECT), sendo incapaz de realizar inserções ou modificações de dados.
- **FR-004:** A exclusão da linha de relacionamento no banco deleta instantaneamente as permissões de leitura RLS sem persistência de credenciais no cliente.
- **FR-005:** Gráficos leves de tendências integrados sem inflar o bundle size na web.

### Key Entities

- **CaregiverLink:** Relacionamento com `role='observer'`.
- **DoseInstance:** Registros históricos de doses consumidas.

---

## Success Criteria

- **SC-001:** Bloqueio e rejeição absoluta (100% de eficácia) de qualquer INSERT/UPDATE/DELETE no banco pelo perfil de médico observador.
- **SC-002:** Ocultação instantânea de dados do paciente no painel médico assim que o vínculo for revogado na conta do paciente.
- **SC-003:** Acesso ao dashboard impossível sem sessão autenticada ou token válido não-expirado; token expirado retorna 403 e não vaza dado clínico.
