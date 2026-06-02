# Feature Specification: Setup Flow (Caregiver Mode — Phase 2)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-2-setup-flow`
**Epic**: [Modo Cuidador](../EPIC.md) · **Phase**: 2 · **Depende de**: phase-1 (tabelas + RLS)
**Created**: 2026-06-01 · **Revised**: 2026-06-02
**Status**: Dev Ready
**Gate de entrada**: G0 (junto da phase-1)
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §1. W7.1, W7.2

---

> **Decisões deste round:**
> - **Cold-start (M1, ver [phase-0](../phase-0-identity-model/)):** a tela `[ Sou Paciente ]/[ Sou Cuidador ]` **NÃO é a primeira tela do app**. O default é o onboarding normal de auto-gestão. Este fork só aparece **no contexto de convite** (device aberto via deeplink/QR de convite). Usuários comuns nunca o veem.
> - **Provisionamento (M2):** o paciente é uma **conta provisória anônima** criada pelo cuidador (phase-0); os dados já nascem sob o `user_id` final dele. O escaneamento + consentimento é um **claim** do device sobre essa conta — não importação/migração.
> - **Revogação = só deleta `caregiver_links` (D1):** os dados já são do paciente. Revogar **não migra nem re-aponta nenhuma entidade**; remove a linha de vínculo → RLS corta o cuidador e o app volta a standalone. Zero re-ownership.
> - **Convite = link multi-canal:** o botão "Compartilhar Convite" usa a **Share API nativa** (RN `Share` / web `navigator.share`). O canal (WhatsApp, SMS, Telegram, e-mail…) é escolhido no share sheet do SO — são apenas canais, sem dependência de provedor.
> - **Deeplink universal:** o link `dosiq.app/invite/<code>` reconcilia com a spec [019-universal-links-web-banner](../../019-universal-links-web-banner/) (Universal Links iOS + App Links Android + fallback store). Esta fase **consome** 019, não reimplementa.

---

## Context

Para anular a barreira de exclusão digital na terceira idade, a Cuidadora realiza todas as configurações clínicas complexas do tratamento (medicamentos, posologia e estoque), permitindo ao paciente idoso apenas visualizar as doses e confirmar o check-in. Esta feature provê a criação desse fluxo desacoplado de setup e verificação através de QR Codes e compartilhamento nativo de convites por aplicativos locais de mensagens, garantindo conformidade LGPD com consentimento e revogação soberana pelo paciente.

---

## User Scenarios & Testing

### User Story 1 - Geração de Convite Desacoplado (Priority: P1)
**Why this priority**: Permite que a filha configure o tratamento e convide o paciente idoso sem depender de infraestrutura de bot externa — só share nativo do SO.
**Independent Test**: cadastrar paciente no painel do cuidador, verificar que gera o QR Code e código de 6 dígitos e que ao clicar em "Compartilhar", a folha de compartilhamento nativo do SO (`Share` API) é aberta.

**Acceptance Scenarios**:
1. Given que Ana Paula cadastrou sua mãe no painel do cuidador, When ela finalizar o setup de medicamentos, Then o sistema deve exibir um QR Code grande e legível e um botão "Compartilhar Código".
2. When Ana Paula tocar em "Compartilhar Código", Then o app móvel deve acionar o módulo nativo `Share` permitindo enviar o código `A7X-92B` e o link `dosiq.app/invite?code=A7X-92B` pelo canal que ela escolher (app de mensagens, SMS, e-mail).

### User Story 2 - Importação e Consentimento LGPD (Priority: P1)
**Why this priority**: Crucial para conformidade de dados e facilidade de setup pelo paciente idoso.
**Independent Test**: Instalar o app em estado limpo, selecionar "Sou Paciente", escanear o QR Code de teste, validar que a folha de termos LGPD é exibida e que ao aceitar, as configurações de medicamentos são carregadas localmente por RLS.

**Acceptance Scenarios**:
1. Given o primeiro acesso de Dona Maria ao app, When ela abrir a tela inicial, Then deve ver dois botões proeminentes: `[ Sou Paciente ]` e `[ Sou Cuidador ]`.
2. When ela clicar em `[ Sou Paciente ]` e escanear o QR Code da filha (ou digitar o código de 6 dígitos), Then o app deve exibir uma modal em tela cheia de consentimento LGPD: *"Sua filha Ana Paula quer te ajudar a cuidar da rotina. Você autoriza que ela veja se você tomou as doses e faça alterações de horários?"*.
3. When ela tocar em `[ Sim, eu autorizo ]`, Then o app deve importar e configurar instantaneamente todos os medicamentos definidos pela filha.

### User Story 3 - Revogação Soberana (Priority: P1)
**Why this priority**: Assegura a privacidade e controle absoluto do paciente idoso sobre sua saúde.
**Independent Test**: Acessar *Configurações > Cuidadores* no celular do paciente, clicar em "Revogar Acesso do Cuidador" e verificar se o relacionamento no Supabase é deletado, desligando a sincronização imediatamente.

**Acceptance Scenarios**:
1. Given que Dona Maria deseja desativar o controle de sua filha, When ela acessar *Configurações > Cuidadores* e clicar em "Revogar Acesso", Then o app do paciente deve excluir a conexão no banco e reverter o app para o modo autônomo local.

---

## Edge Cases

- **Erro de Conexão durante o Setup:** Se a câmera decodificar o QR Code mas o celular do paciente estiver sem sinal de internet, o app deve exibir aviso de erro e permitir digitar manualmente o código recebido, salvando-o localmente para tentativa de sincronização assim que houver sinal.
- **Diferença de Fuso Horário:** Se o cuidador cadastrar remédios em fuso horário diferente do paciente (ex: fuso de Manaus GMT-4 vs fuso de São Paulo GMT-3), a importação deve recalcular os alarmes e instâncias locais para o fuso local do dispositivo do paciente usando `parseLocalDate()`.

---

## Requirements

### Functional Requirements

- **FR-001:** No **contexto de convite** (device aberto via deeplink/QR), exibir tela com opções proeminentes `[ Sou Paciente ]` e `[ Sou Cuidador ]` (toque ≥60px). **Fora do contexto de convite, o cold-start é o onboarding normal de auto-gestão** (M1/phase-0) — este fork não é a 1ª tela universal.
- **FR-002:** Tela de leitura de QR Code integrada com câmera nativa e input manual alternativo de código de 6 dígitos.
- **FR-003:** Geração de convite no painel do cuidador exibindo QR Code + código de 6 díg + botão "Compartilhar Convite" via **Share API nativa** (RN `Share` / web `navigator.share`). O canal (WhatsApp/SMS/Telegram/e-mail/…) é escolhido no share sheet do SO — sem dependência de provedor específico.
- **FR-004:** Exibição obrigatória de tela cheia de consentimento de privacidade e termos LGPD antes da conclusão do setup do paciente.
- **FR-005:** Aba de controle em *Configurações > Cuidadores* no app do paciente com botão visível para **revogação soberana**. Revogar **deleta apenas a linha de `caregiver_links`** — os dados permanecem sob o `user_id` do paciente (owner desde o setup); o app reverte a standalone sem qualquer migração de entidades.
- **FR-006:** Convite acessível por **deeplink universal** `dosiq.app/invite/<code>` — comportamento delegado à spec [019-universal-links-web-banner](../../019-universal-links-web-banner/) (app instalado → fluxo com código pré-preenchido; não instalado → store + preserva código).

### Key Entities

- **CaregiverInvite:** Códigos de setup temporários de 6 dígitos com TTL de 72h.
- **CaregiverLink:** Relacionamento principal ativo entre as contas de usuário do Supabase.

---

## Success Criteria

- **SC-001:** Importação de toda a grade de medicamentos e alarmes em menos de 500ms após leitura bem-sucedida do código.
- **SC-002:** Após revogação, RLS bloqueia 100% dos acessos do cuidador no próximo request E **zero entidade do paciente foi migrada/re-apontada** (todas continuam sob o `user_id` do paciente). App standalone funcional offline.
