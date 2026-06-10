# Feature Specification: Modo Consulta + Apresentação (Mobile + Web)

**Feature Directory**: `plans/specs/005-consultation-mode-profile`
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: draft — não entregue como spec'ado (PO 2026-06-10); pendia 1 decisão de escopo
**Tier**: 1 (2 só se escolhida a opção A com migração/rota nova)
**Artifacts**: `spec.md` + `plan.md` + `tasks.md`
**Legacy Sources**:
- `PHASE_5_6_PARITY_AND_BEYOND.md` §M1.3 (consolidação unificada — adicionou o link web desktop)
- `plans/backlog-native_app/EXEC_SPEC_FASE5_ANALITICAS.md` §3 (**fonte original CRUD + decisões PO + mocks**)
**Mocks (PO-aprovados)**: `plans/backlog-native_app/MOCKS_APP_CRUD/export/fase-5/` — `mock-modoconsulta-meds.png`, `-aderencia.png`, `-prescricoes.png`, `-estoque.png`, `-sharesheet.png`, `-telacheia.png`, `mock-perfil-entrypoints-historico_modoconsulta.png`; código: `dosiq-mocks/analytics-screens.jsx` + `analytics-screens-2.jsx`.

> **Recuperado da fonte CRUD (perdido/distorcido na consolidação):**
> - **Tabs corretas (PO-6):** `Meds · Aderência · Prescrições+Titulação · Estoque`. A consolidação trocou por "Medicamentos/Histórico/Aderência/Estoque" — **errado**: Histórico **não** faz parte do Modo Consulta; a tab é **Prescrições+Titulação** (titulação agrupa com prescrições, pois é prescrita pelo médico). **Histórico dropado.**
> - **Modo Apresentação (PO-7):** tela full-bleed alto contraste — **estava totalmente ausente** do SDD.
> - **Share sheet (PO-8):** 3 opções (Apresentação · Gerar PDF [spec 007] · Compartilhar sistema).
> - **Reconciliação do link web:** o CRUD original entregava **só share nativo** (payload textual) — **sem** rota web pública. O "link 24h p/ desktop do médico" foi **adicionado pela consolidação PHASE_5_6**. Logo a decisão abaixo inclui a opção de **não** ter link web (escopo original).

---

## Open Questions — DECISÃO DO OPERADOR

- **[NEEDS CLARIFICATION: link web do médico]** trade-off real:
  - **(C, escopo original CRUD)** **Sem link web.** Só share nativo do payload textual + Modo Apresentação no próprio celular do paciente. Zero superfície nova. Mais simples; médico vê na tela do paciente.
  - **(B, recomendada se quiser desktop)** **Snapshot via `api/share.js`** (blob TTL 24h): gera a ficha (HTML/PDF) e compartilha o link. Sem migração/função nova. Mostra o estado no momento da geração.
  - **(A)** **Link "ao vivo"**: tabela `consultation_tokens` + rota pública `?key=` + RLS por expiração. Custa migração + **+1 função serverless (R-090)**. Vira Tier 2.
  - Recomendação: **C** se desktop não for requisito; **B** se for (barato, respeita R-090). Evitar **A** salvo necessidade de dado ao vivo.

---

## User Scenarios & Testing

### User Story 1 — Modo Consulta no Consultório (P1)
**Why**: mostrar a ficha clínica ao médico, read-only, alta legibilidade.
**Independent Test**: abrir Modo Consulta no mobile (Perfil › Ferramentas); full-screen retrato, contraste AAA, **4 tabs** (`Meds · Aderência · Prescrições+Titulação · Estoque`), footer fixo `padBottom 88`.

**Acceptance Scenarios**:
1. Given Dona Maria na consulta, When toca "Modo Consulta" no Perfil, Then abre full-screen com 4 tabs: **Meds** (medicamentos em uso, read-only), **Aderência** (resumo, reusa cálculo da 004), **Prescrições+Titulação** (tratamentos prescritos + `ConsultationTitrationCard`), **Estoque** (saldos, reusa repo da Fase 3). Mocks `mock-modoconsulta-*`.

### User Story 2 — Modo Apresentação (P1)
**Why**: visão limpa, à distância, sem chrome, p/ o médico olhar rápido.
**Independent Test**: do share sheet escolher "Apresentação"; abre full-bleed alto contraste.

**Acceptance Scenarios**:
1. Given o Modo Consulta aberto, When escolhe "Apresentação", Then `ConsultationPresentationScreen` full-bleed: faixa teal (nome + idade + data/hora) + **anel adesão "Excelente" 36px** + 3 KPIs grandes (Sequência · Pontualidade · Em uso) + "⚠️ ATENÇÃO · N prescrições vencidas" + footer "Deslize para ver mais · Toque no x para sair". Mock `mock-modoconsulta-telacheia.png`.

### User Story 3 — Compartilhamento (P1)
**Why**: enviar a ficha (sistema) e abrir presentation/PDF.
**Independent Test**: tocar share → sheet com 3 opções.

**Acceptance Scenarios**:
1. Given Modo Consulta, When toca compartilhar, Then share sheet (`mock-modoconsulta-sharesheet.png`): **Apresentação** (→ US2) · **Gerar PDF** (spec 007) · **Compartilhar (sistema)** (share nativo do payload textual). **(B/A)** acrescenta o link desktop 24h.

---

## Edge Cases

- **Legibilidade baixo brilho**: contraste ≥ 7:1 texto/fundo (AAA).
- **Dados sensíveis**: ficha expõe só posologia/adesão/prescrição/estoque — sem endereço/credenciais.
- **Prescrições vencidas**: destaque "ATENÇÃO" no Modo Apresentação.

---

## Requirements

### Functional Requirements

- **FR-001**: UI alto contraste (AAA, fontes grandes, toques amplos — R-137/138).
- **FR-002**: `ConsultationModeScreen` mobile full-screen retrato com **4 tabs** (PO-6): `Meds · Aderência · Prescrições+Titulação · Estoque`, footer fixo `padBottom 88`. Dados via `consultationDataService` (web existente) — extrair cálculo p/ `@dosiq/core` se o mobile precisar reusar (não duplicar).
- **FR-003**: `ConsultationPresentationScreen` (PO-7) — full-bleed alto contraste: faixa teal + anel "Excelente" 36px + 3 KPIs + alerta de prescrições vencidas + footer de gesto.
- **FR-004**: Share sheet (PO-8): **Apresentação** · **Gerar PDF** (delega à spec 007) · **Compartilhar sistema** (share nativo RN).
- **FR-005**: Entry point no **Perfil hub › Ferramentas** (linha "Modo Consulta", PO-1/2).
- **FR-006** *(condicional à decisão B/A)*: link temporário 24h p/ desktop — **(B)** snapshot via `api/share.js` (`expiresInHours:24`); **(A)** rota pública `?key=` + tabela/RLS. **(C)** não-aplicável.

### Key Entities

- **consultation data**: `consultationDataService.getConsultationData` (web existente — meds/adesão/estoque/prescrições/titulação).
- **ConsultationTitrationCard**: card de titulação na tab Prescrições.
- **(A) consultation_tokens**: `secure_key`, `expires_at` (só opção A).

---

## Success Criteria

- **SC-001**: Contraste texto principal ≥ 7:1.
- **SC-002**: 4 tabs corretas (sem "Histórico") + Modo Apresentação funcional.
- **SC-003**: Share sheet com 3 opções; "Gerar PDF" integra a spec 007. Sem superfície nova desnecessária (C/B: sem migração/função — R-090).
