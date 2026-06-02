# Feature Specification: Patient Cared Mode & Upstream Signals (Caregiver Mode — Phase 6)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-6-patient-cared-mode`
**Epic**: [Modo Cuidador](../EPIC.md) · **Phase**: 6 · **Depende de**: phase-0, phase-1, phase-2
**Created**: 2026-06-02
**Status**: Dev Ready
**Gate de entrada**: G0 (entrega junto do core 7A — é a contraparte do paciente)

---

## Context

As fases anteriores detalham bem o lado do **cuidador** (dashboard, alertas). A experiência do **paciente cuidado** (Dona Maria) ficava quase em branco. Esta fase especifica:

1. O **modo paciente cuidado** — uma UI simplificada AAA para o idoso, quando o device está vinculado a um cuidador `manager`.
2. Os **sinais upstream** paciente→cuidador — o espelho da alert engine (phase-4): a Maria avisa a filha de eventos que só ela percebe.

> **Por que importa:** sem isto, metade do valor do épico some. O cuidador recebe alertas do sistema (phase-4), mas a Maria não tem como dizer *"estou acabando o remédio"* ou *"derrubei uns comprimidos"* — e esses são exatamente os eventos que o sistema não consegue detectar sozinho.

---

## Modo Paciente Cuidado — o que a Maria PODE e NÃO PODE

| Ação | Maria (paciente cuidado) |
|---|---|
| Ver agenda do dia (doses de hoje) | ✅ |
| Registrar dose ("Tomei") | ✅ |
| Ajustar hora/data da dose tomada | ✅ (retroativo simples) |
| **Sinalizar** estoque acabando | ✅ (botão simples → notifica cuidador) |
| **Sinalizar** perda/queda de comprimidos | ✅ |
| **Sinalizar** "não consegui tomar" / mal-estar | ✅ |
| Cadastrar/editar medicamentos | ❌ (desabilitado — é função do cuidador) |
| Editar posologia/agenda | ❌ |
| Revogar acesso do cuidador | ✅ (soberania LGPD — phase-2) |

> A UI esconde tudo que a Maria não pode fazer. Tela limpíssima: agenda + "Tomei" gigante + atalhos de sinal. **Não** é o app completo com edição.

---

## User Scenarios & Testing

### User Story 1 — Confirmar dose (P1)
**Independent Test**: Maria abre o app em modo cuidado, vê as doses de hoje e toca "Tomei" numa dose.
1. Given device da Maria vinculado a cuidador `manager`, When ela abre o app, Then vê a agenda de hoje com botões "Tomei" grandes (AAA) e nada de edição de medicamentos.

### User Story 2 — Sinalizar estoque acabando à distância (P1)
**Why**: evento que só a Maria percebe; precisa chegar à filha que está no trabalho.
**Independent Test**: Maria toca "Está acabando" num remédio → cuidador recebe notificação.
1. Given Maria percebe que a cartela está no fim, When ela toca "Está acabando" no remédio, Then o cuidador recebe sinal upstream ("Dona Maria avisou que a Losartana está acabando").

### User Story 3 — Sinalizar perda/não-tomei (P2)
1. Given Maria derrubou comprimidos, When ela toca "Perdi alguns comprimidos", Then o cuidador é notificado e o estoque pode ser ajustado pelo cuidador.
2. Given Maria não conseguiu tomar (passou mal/esqueceu), When ela toca "Não consegui tomar", Then a dose registra o estado e o cuidador recebe o sinal.

---

## Edge Cases

- **Device standalone (sem cuidador):** modo cuidado não se aplica — Maria autônoma usa o app normal (phase-0 M1). Os sinais upstream só existem havendo `caregiver_links manager`.
- **Sem internet:** sinal enfileira local (AsyncStorage) e sincroniza ao reconectar; UI confirma "vamos avisar quando voltar a conexão".
- **Cuidador com canal `none`:** sinal ainda é registrado/visível no dashboard, mas sem push (respeita preferência de canal — phase-4).
- **Idoso toca por engano:** sinais são informativos/reversíveis; nada destrutivo. Confirmar com 1 toque, desfazer fácil.

---

## Requirements

### Functional Requirements

- **FR-001:** **Modo paciente cuidado** — UI simplificada AAA exibida quando o device está vinculado a cuidador `manager`: agenda do dia + "Tomei" + atalhos de sinal; edição de medicamentos/posologia **oculta**.
- **FR-002:** Sinal upstream **"estoque acabando"** por medicamento → notifica o cuidador (reusa transporte da phase-4).
- **FR-003:** Sinal upstream **"perdi/derrubei comprimidos"** → notifica o cuidador + permite ajuste de estoque pelo cuidador.
- **FR-004:** Sinal upstream **"não consegui tomar"** → registra estado da dose + notifica o cuidador.
- **FR-005:** Sinais enfileiram offline e sincronizam ao reconectar (feedback claro à Maria).
- **FR-006:** Registro de dose retroativo simples (hora/data) mantido para a Maria (reusa `registerDose`).

### Key Entities

- **PatientSignal**: evento upstream (tipo, medicamento opcional, timestamp, paciente, cuidador-alvo) — pode reusar/estender `notification_log` ou tabela própria leve.
- **DoseInstance / Stock**: alvos dos sinais.

---

## Success Criteria

- **SC-001:** Maria consegue confirmar dose e enviar um sinal em ≤ 2 toques, com alvos ≥ 60px e contraste ≥ 7:1.
- **SC-002:** Sinal upstream chega ao cuidador (no canal configurado) em ≤ 1 min online; enfileira e entrega ao reconectar offline.
- **SC-003:** Em modo cuidado, nenhuma função de edição de medicamento/posologia é acessível à Maria.

---

## Open Questions

- **[NEEDS CLARIFICATION: entidade PatientSignal]** reusar `notification_log` (bidirecional) ou criar tabela leve `patient_signals`? Decidir em C1 com a estrutura real do log.
