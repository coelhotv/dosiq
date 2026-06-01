# Feature Specification: Caregiver Demand Teaser

**Feature Directory**: `plans/specs/002-caregiver-demand-teaser`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/EXEC_SPEC_P0_2_TERMOMETRO_CUIDADOR.md`

---

## Context

Para evitar o investimento desnecessário de ~40 SP no desenvolvimento completo do Modo Cuidador (Fase 7A) antes de validar o interesse real da base de usuários, implementamos um **painted door test (Termômetro de Demanda)**. Esta feature exibe um botão visualmente atraente do "Modo Cuidador" na tela de Perfil (Mobile + PWA) que, ao ser clicado, abre uma bottom sheet ou modal explicativa com um formulário de cadastro de e-mail (pré-preenchido e editável) para fila de espera. 

A métrica chave de sucesso validará a tração do interesse da comunidade antes de codificar a infraestrutura complexa.

---

## User Scenarios & Testing

### User Story 1 - Acesso ao Teaser do Modo Cuidador (Priority: P1)
**Why this priority**: Garante visibilidade e atração para a funcionalidade de waitlist.
**Independent Test**: Acessar a tela de Perfil no mobile e no PWA, validar a exibição do botão "Modo Cuidador" com badge "EM BREVE".

**Acceptance Scenarios**:
1. Given que Ana Paula está logada no app, When acessar a tela de Perfil, Then deve visualizar o botão do Modo Cuidador com bordas destacadas e ícone `👨‍👩‍👧`.

### User Story 2 - Cadastro na Waitlist com E-mail Pré-preenchido (Priority: P1)
**Why this priority**: Reduz a fricção no onboarding de waitlist puxando a sessão ativa.
**Independent Test**: Clicar no botão, verificar se o e-mail da conta ativa vem pré-preenchido na bottom sheet/modal, clicar em "Quero ser avisado" e validar a inserção na tabela `beta_signups` com a chave `feature='caregiver_mode'`.

**Acceptance Scenarios**:
1. Given que Ana Paula tem o e-mail `ana@email.com` na sua sessão ativa, When tocar no botão "Modo Cuidador", Then o campo de e-mail deve vir pré-preenchido com `ana@email.com`, mas ser totalmente editável se ela preferir.
2. Given o e-mail inserido, When Ana Paula clicar em "Quero ser avisado", Then o sistema deve cadastrar o interesse no Supabase Supabase e exibir feedback de sucesso.

---

## Edge Cases

- **Teclado cobrindo input no Mobile:** O input de e-mail dentro da bottom sheet não deve ser ocultado pelo teclado virtual no Android/iOS (exige `KeyboardAvoidingView`).
- **Endpoint URL completo no Mobile:** Diferente do PWA, o aplicativo móvel não pode fazer fetch em rotas relativas (`/api/users/beta-signup`). O mobile exige a URL absoluta (`https://dosiq.app/api/...`).
- **Duplicação de Inscrição:** Se o usuário tentar se inscrever duas vezes com o mesmo e-mail para a mesma feature, o banco de dados Supabase deve responder com sucesso silencioso (idempotência, silenciando o erro `23505` de unique constraint).

---

## Requirements

### Functional Requirements

- **FR-001:** Exibir botão destacado do "Modo Cuidador" com badge "EM BREVE" na Tab Perfil (Mobile) e tela de Perfil (PWA).
- **FR-002:** Ao clicar, abrir Bottom Sheet deslizante (Mobile) ou Modal centralizada (PWA) explicando as 3 value props do cuidador familiar.
- **FR-003:** Pré-preencher o e-mail no formulário com a propriedade `user.email` da sessão ativa, mantendo o campo editável.
- **FR-004:** Realizar o post do e-mail no endpoint de waitlist no Supabase com `feature='caregiver_mode'`.
- **FR-005:** Disparar o evento de analytics `caregiver_interest_tap` ao clicar no botão, e `caregiver_waitlist_signup` ao enviar.

### Key Entities

- **BetaSignup:** Registro de waitlist (tabela `beta_signups`) mapeando os interessados por e-mail e identificador de feature.

---

## Success Criteria

- **SC-001:** Taxa de clicks no botão Modo Cuidador ≥ 5% dos usuários ativos mensais (MAU) medido em logs.
- **SC-002:** Conversão de clique-para-inscrição ≥ 30% dos que abriram a bottom sheet.

---

## Assumptions

- A migração física das colunas `platform` para `feature` na tabela `beta_signups` já foi efetuada no banco Supabase em produção.
