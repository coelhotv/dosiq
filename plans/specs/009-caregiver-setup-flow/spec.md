# Feature Specification: Caregiver Setup Flow

**Feature Directory**: `plans/specs/009-caregiver-setup-flow`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_7_COMMUNICATION_CUIDADOR.md` §1. W7.1, W7.2

---

## Context

Para anular a barreira de exclusão digital na terceira idade, a Cuidadora realiza todas as configurações clínicas complexas do tratamento (medicamentos, posologia e estoque), permitindo ao paciente idoso apenas visualizar as doses e confirmar o check-in. Esta feature provê a criação desse fluxo desacoplado de setup e verificação através de QR Codes e compartilhamento nativo de convites por aplicativos locais de mensagens, garantindo conformidade LGPD com consentimento e revogação soberana pelo paciente.

---

## User Scenarios & Testing

### User Story 1 - Geração de Convite Desacoplado (Priority: P1)
**Why this priority**: Permite que a filha configure o tratamento e convide o paciente idoso sem depender da infraestrutura de bot de WhatsApp ativa.
**Independent Test**: cadastrar paciente no painel do cuidador, verificar que gera o QR Code e código de 6 dígitos e que ao clicar em "Compartilhar", a folha de compartilhamento nativo do SO (`Share` API) é aberta.

**Acceptance Scenarios**:
1. Given que Ana Paula cadastrou sua mãe no painel do cuidador, When ela finalizar o setup de medicamentos, Then o sistema deve exibir um QR Code grande e legível e um botão "Compartilhar Código".
2. When Ana Paula tocar em "Compartilhar Código", Then o app móvel deve acionar o módulo nativo `Share` permitindo enviar a mensagem com o código `A7X-92B` e o link de convite `dosiq.app/invite?code=A7X-92B` para o WhatsApp local de sua mãe.

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

- **FR-001:** Exibir tela de onboarding com opções proeminentes `[ Sou Paciente ]` e `[ Sou Cuidador ]` (área de toque mínima de 60px).
- **FR-002:** Tela de leitura de QR Code integrada com câmera nativa e input manual alternativo de código de 6 dígitos.
- **FR-003:** Geração de convite no painel do cuidador exibindo o QR Code físico e botão integrado à API `Share` nativa do React Native.
- **FR-004:** Exibição obrigatória de tela cheia de consentimento de privacidade e termos LGPD antes da conclusão do setup do paciente.
- **FR-005:** Aba de controle em *Configurações > Cuidadores* no app do paciente com botão visível e acessível para revogação instantânea de conexões.

### Key Entities

- **CaregiverInvite:** Códigos de setup temporários de 6 dígitos com TTL de 72h.
- **CaregiverLink:** Relacionamento principal ativo entre as contas de usuário do Supabase.

---

## Success Criteria

- **SC-001:** Importação de toda a grade de medicamentos e alarmes em menos de 500ms após leitura bem-sucedida do código.
- **SC-002:** Sincronização offline e desativação total via RLS imediatamente após a revogação de chaves.
