# Feature Specification: Modo Consulta (Mobile + Web)

**Feature Directory**: `plans/specs/005-consultation-mode-profile`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Needs Clarification (1 decisão arquitetural aberta) → depois Dev Ready
**Tier**: 1 (ou 2 se escolhida a opção A com migração/rota nova — ver Open Questions)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Source**: `PHASE_5_6_PARITY_AND_BEYOND.md` §M1.3

---

## Context

Dona Maria precisa mostrar a ficha clínica ao médico. O **Modo Consulta** dá: tela mobile full-screen de alto contraste (AAA) com abas (Medicamentos/Histórico/Aderência/Estoque) + um link temporário p/ o médico ver no desktop.

> **Reality-check (revisão 2026-06-02):**
> - **Web já tem `features/consultation`**: `ConsultationView.jsx`, `ConsultationViewRedesign.jsx`, `consultationDataService.js` (`getConsultationData`, adesão, estoque, prescrições). O modo consulta **reusa** isso — **não** criar `apps/web/src/features/profile/WebConsultationView.jsx`.
> - **Não existe tabela `profiles`** no dosiq (usa `user_settings`). Token, se houver, não vai em `profiles.*`.
> - Migração, **se necessária**, vive em `docs/migrations/` (não `supabase/migrations/`).
> - `api/share.js` existente = upload de **blob com TTL** (Vercel Blob, `expiresInHours`), retornando URL. Serve p/ compartilhar um **snapshot** (HTML/PDF) — não um read live com token.

---

## Open Questions — DECISÃO DO OPERADOR (resolver antes de codar)

- **[NEEDS CLARIFICATION: mecanismo do link do médico]** Duas opções, trade-off real:
  - **(A) Link "ao vivo"**: tabela `consultation_tokens` (`secure_key`, `expires_at`) + rota pública `dosiq.app/consult/:id?key=` lendo dados atuais + RLS por expiração. **Custo**: migração nova + **+1 função serverless (R-090: budget 12, CLAUDE.md)** + rota pública. Vira **Tier 2**.
  - **(B, recomendada) Link "snapshot"**: gera a ficha (HTML/PDF de `consultationDataService`) e compartilha via **`api/share.js`** (blob TTL 24h). **Sem migração, sem função nova, sem rota pública** (reusa infra). Link mostra o estado no momento da geração (aceitável p/ consulta). **Tier 1.**
  - Recomendação: **B** (mais barata, respeita R-090, zero superfície nova). Confirmar com o PO.

---

## User Scenarios & Testing

### User Story 1 — Exibição no Consultório (P1)
**Why**: mostrar a ficha física ao geriatra.
**Independent Test**: abrir Modo Consulta no mobile, full-screen retrato, contraste AAA, abas (Medicamentos/Histórico/Aderência/Estoque) com fontes grandes.

**Acceptance Scenarios**:
1. Given Dona Maria na consulta, When toca "Modo Consulta" no perfil, Then full-screen com fontes aumentadas, medicamentos ativos + histórico 30 dias em abas simples (dados de `consultationDataService` ou equivalente mobile).

### User Story 2 — Compartilhamento Clínico (P1)
**Why**: médico ver no desktop.
**Independent Test**: gerar link no celular, enviar via Share nativo, abrir o link; confirmar expiração em 24h.

**Acceptance Scenarios** (dependem da decisão A/B):
1. Given o médico prefere a tela grande, When "Compartilhar com o Médico", Then gera link temporário (24h) + abre o Share nativo. **(B)** o link aponta p/ o blob da ficha; **(A)** p/ a rota pública `?key=`.
2. Given link com mais de 24h, When o médico acessa, Then "Acesso Expirado" **(A)** ou 404 do blob expirado **(B)**.

---

## Edge Cases

- **Legibilidade baixo brilho**: contraste ≥ 7:1 texto/fundo.
- **Dados sensíveis**: o link expõe só posologia/histórico/adesão — sem endereço/credenciais.

---

## Requirements

### Functional Requirements

- **FR-001**: UI alto contraste (AAA, fontes grandes, toques amplos — R-137/138).
- **FR-002**: Mobile full-screen retrato com abas: Medicamentos Ativos, Histórico (30 dias), Aderência, Estoque. Dados reusando a lógica de `consultationDataService` (web) — extrair o cálculo p/ `@dosiq/core` se precisar compartilhar com mobile.
- **FR-003**: Botão Share nativo (RN `Share`) enviando o link temporário.
- **FR-004**: Link com expiração de 24h — mecanismo conforme decisão A/B (B: `api/share.js` `expiresInHours: 24`).
- **FR-005**: **(só se A)** rota web pública `dosiq.app/consult/:id?key=` read-only consumindo o token; RLS bloqueia `expires_at < now()`. **(B)** reusa `features/consultation` renderizando o snapshot.

### Key Entities

- **consultation data**: agregada por `consultationDataService` (web, existente).
- **(A) consultation_tokens**: `secure_key`, `expires_at` (se opção A). **(B)**: nenhum — TTL no blob.

---

## Success Criteria

- **SC-001**: Contraste texto principal ≥ 7:1.
- **SC-002**: Expiração rígida em 24h (A: RLS `expires_at`; B: TTL do blob).
- **SC-003**: Zero superfície nova desnecessária (se B: sem migração/função — R-090).
