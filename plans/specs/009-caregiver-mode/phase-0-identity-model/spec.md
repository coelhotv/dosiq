# Feature Specification: Identity & Context Model (Caregiver Mode — Phase 0)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-0-identity-model`
**Epic**: [Modo Cuidador](../EPIC.md) · **Phase**: 0 (FUNDAÇÃO — bloqueia todas as demais)
**Created**: 2026-06-02
**Status**: Dev Ready
**Gate de entrada**: G0 (junto da phase-1)

---

## Context

Antes de tabelas, RLS, setup ou dashboard, o épico precisa responder **três perguntas de modelagem** que estavam implícitas e contraditórias nas fases originais:

1. Qual é o estado **default** do Dosiq? (não é "modo cuidador")
2. Como o cuidador cria a agenda de um paciente que **ainda não existe** no banco?
3. Uma conta pode ser **paciente de si mesma E cuidadora de outros** ao mesmo tempo?

Esta fase define o modelo de **identidade, conta e contexto** que torna o resto do épico coerente. É pré-requisito de phase-1.

---

## Princípios de modelagem (decisões D1/D3/D4)

### M1 — Default = auto-gestão (não cuidador)
O Dosiq **continua sendo, por padrão, um app de paciente auto-suficiente**. O cold-start normal é o onboarding de auto-gestão de sempre. **O modo cuidador é uma capability opt-in**, nunca o estado inicial. A tela de escolha `[ Sou Paciente ] / [ Sou Cuidador ]` **NÃO é a primeira tela do app** — só aparece no **contexto de convite** (um device sendo configurado por outra pessoa via deeplink/QR). Usuários normais nunca a veem.

### M2 — Provisionamento upfront com conta anônima (D3 Opção A + D4)
O cuidador cria o paciente como uma **conta provisória anônima** (`auth.users` provisionado, **sem PII** — sem e-mail/telefone obrigatório). **Todas as entidades** (`protocols`, `medicines`, `dose_instances`, estoque) nascem sob o `user_id` dessa conta **desde a criação**.

- O **código de 6 dígitos / QR** mapeia o **device físico do paciente** → essa conta provisória.
- Ao escanear + consentir, o paciente **reivindica** (claims) a conta provisória. **Nenhuma migração de dados** — o `uid` provisionado JÁ É o `uid` final. Owner=paciente desde sempre (invariante D1).
- O paciente **escolhe depois** como autenticar (telefone, e-mail, social) — a seu critério. A conta anônima só precisa de credencial real quando/se o paciente quiser portabilidade entre devices.
- **Descarte:** conta provisória + convite **não reivindicados em X dias** são limpos por cron (sem PII, descarte barato e seguro). X a definir pelo PO (sugestão 30 dias).

> **Por que anônima e não por celular/e-mail:** evita PII de terceiros (a filha cadastrar dado da mãe), evita verificação SMS (custo/burocracia), e deixa a soberania de autenticação com o próprio paciente.

### M3 — Conta = pessoa · Contexto = self + managed (Gap 3)
Uma **conta** representa uma pessoa (ex.: Ana Paula). Ela opera em **contextos**:
- **`self`** — os próprios tratamentos da Ana Paula (ela também é paciente Dosiq).
- **`managed`** — N contextos de pacientes que ela gerencia (mãe, pai…), definidos por `caregiver_links`.

"Cuidador" **não é um papel fixo da conta** — é a relação + o contexto ativo. O **seletor de contexto** (phase-3) alterna "Eu / Minha mãe / Meu pai". Conta sem nenhum `managed` = app normal de auto-gestão (M1).

---

## User Scenarios & Testing

### User Story 1 — App normal não muda (P1)
**Independent Test**: instalar limpo, abrir → onboarding de auto-gestão padrão, **sem** tela de escolha de papel.
1. Given usuário novo sem convite, When abre o app, Then vê o onboarding normal de auto-gestão (Dona Maria autônoma ou qualquer paciente).

### User Story 2 — Provisionamento sem conta do paciente (P1)
**Independent Test**: cuidador cria paciente + agenda; verificar que entidades gravam sob um `user_id` provisório anônimo e que o convite referencia esse `uid`.
1. Given Ana Paula (logada) ativa modo cuidador e cadastra a mãe + remédios, When finaliza, Then o sistema cria conta provisória anônima e grava tudo sob o `user_id` dela; gera código/QR mapeando device→esse `uid`.

### User Story 3 — Claim sem migração (P1)
**Independent Test**: device do paciente escaneia código → reivindica a conta provisória → dados aparecem; confirmar zero migração (mesmo `uid`).
1. Given conta provisória da mãe com agenda, When a mãe escaneia o código no device dela e consente, Then o device é vinculado à conta provisória (claim); os dados aparecem sem qualquer cópia/migração.

### User Story 4 — Conta dupla (self + managed) (P2)
1. Given Ana Paula tem tratamentos próprios E gerencia a mãe, When abre o app, Then opera por padrão no contexto `self`; pode alternar para o contexto `managed` da mãe via seletor (phase-3).

---

## Edge Cases

- **Convite nunca reivindicado:** conta provisória + convite expiram e são limpos após X dias (cron). Sem PII → descarte seguro.
- **Paciente já é usuário Dosiq:** se a mãe já tem conta própria, o convite vincula a conta existente (não cria provisória) — `caregiver_links` aponta para o `uid` real dela. Modelo suporta ambos os caminhos.
- **Claim em device errado:** o claim exige consentimento explícito; código de uso único + rate-limit (phase-1) impedem sequestro.
- **Conta provisória reivindicada por engano:** consentimento LGPD full-screen é a barreira; reclaim não é destrutivo (dados são do paciente).

---

## Requirements

### Functional Requirements

- **FR-001:** Cold-start padrão = onboarding de auto-gestão. Tela de escolha de papel **só** no contexto de convite (deeplink/QR), nunca como primeira tela universal.
- **FR-002:** Criar **conta provisória anônima** (`auth.users` sem PII obrigatória) ao cuidador cadastrar um novo paciente; todas as entidades nascem sob esse `user_id`.
- **FR-003:** Convite/código mapeia device do paciente → `user_id` da conta provisória; o **claim** vincula o device sem migrar dados (uid provisionado = uid final).
- **FR-004:** Paciente escolhe método de autenticação **após** o claim, a seu critério (não obrigatório no setup).
- **FR-005:** Cron de descarte de contas provisórias + convites **não reivindicados em X dias** (sem PII).
- **FR-006:** Modelo de **contexto**: conta opera em `self` (default) + N `managed` (via `caregiver_links`). Conta sem `managed` = app de auto-gestão idêntico ao atual.

### Key Entities

- **Account (`auth.users`)**: pessoa; pode ser provisória anônima ou plena.
- **Context**: `self` | `managed(patient_uid)` — derivado de `caregiver_links`.
- **CaregiverInvite**: código → `user_id` da conta provisória (substitui o vago `patient_profile_id`).

---

## Success Criteria

- **SC-001:** Usuário sem convite **nunca** vê a tela de escolha de papel; experiência de auto-gestão inalterada.
- **SC-002:** Entidades do paciente gravadas sob `user_id` final desde a criação — **zero migração** no claim e na revogação.
- **SC-003:** Conta provisória sem claim é descartada após X dias sem resíduo de PII.
- **SC-004:** Uma conta consegue manter contexto `self` + ≥1 `managed` sem cruzamento de dados.

---

## Open Questions

- **[NEEDS CLARIFICATION: X dias]** janela de descarte de conta provisória não reivindicada (sugestão 30 dias).
- **[NEEDS CLARIFICATION: provisionamento auth.users anônimo]** validar com a infra Supabase a criação de `auth.users` sem e-mail/telefone (anônimo) e o fluxo de claim/upgrade posterior — pode exigir Supabase Anonymous Sign-Ins.
