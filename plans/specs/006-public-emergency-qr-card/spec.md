# Feature Specification: Public Emergency QR Card

**Feature Directory**: `plans/specs/006-public-emergency-qr-card`  
**Created**: 2026-06-01  
**Status**: draft
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §F6.1

---

## Context

Em uma situação crítica de acidente ou desmaio presencial, a velocidade de acesso às informações clínicas do paciente (alergias graves, tipo sanguíneo e contatos de familiares) pode salvar vidas. Esta feature provê a geração de um QR Code impresso (cartão físico de carteira/chaveiro) que aponta para uma página web pública ultraleve, otimizada para socorristas e blindada sob consentimento LGPD com revogação instantânea e soberana pelo próprio usuário.

---

## User Scenarios & Testing

### User Story 1 - Acesso Socorrista Instantâneo (Priority: P1)
**Why this priority**: Crucial para o atendimento médico de emergência na rua.
**Independent Test**: Escanear o QR Code de teste, verificar que abre a URL `dosiq.app/emergency/patient_id?auth_token=xxx` em navegador móvel, carregando a página em < 1 segundo com dados visíveis e sem exigir qualquer login.

**Acceptance Scenarios**:
1. Given que Dona Maria desmaiou na rua e porta seu cartão físico, When o socorrista do SAMU escanear o QR Code de sua carteira, Then o navegador móvel dele deve exibir imediatamente o tipo sanguíneo, alergia grave a Penicilina e o telefone da filha Ana Paula em destaque.

### User Story 2 - Revogação Soberana (LGPD) (Priority: P1)
**Why this priority**: Garante conformidade rígida de privacidade e controle de dados pelo paciente.
**Independent Test**: Clicar em "Desativar Cartão" ou "Trocar Token" no aplicativo do paciente e tentar carregar a URL antiga de emergência, validando que o retorno é uma página de erro 404 sem exposição de dados.

**Acceptance Scenarios**:
1. Given que o cartão físico de Dona Maria foi extraviado, When ela tocar em "Revogar Acesso do Cartão" no aplicativo nativo, Then o `profiles.emergency_token` no banco deve ser deletado ou modificado de forma idempotente.
2. Given a URL do cartão revogado, When o socorrista (ou qualquer terceiro) tentar acessá-la, Then o sistema web deve retornar erro "404 - Acesso Revogado" instantaneamente.

---

## Edge Cases

- **Sem sinal/Rede Lenta:** A página pública de socorrista deve ser extremamente enxuta, com tamanho de bundle gzip inferior a 50kB e zero dependências pesadas, garantindo renderização rápida mesmo em conexões de dados móveis 3G de rodovias.
- **Idempotência de Revogação:** Se o usuário tentar revogar o acesso sem conectividade de internet, o aplicativo deve enfileirar a requisição e avisar de forma clara: "Desativação pendente - o cartão será revogado assim que restabelecer sua conexão".

---

## Requirements

### Functional Requirements

- **FR-001:** Geração de QR Code dinâmico na ProfileScreen do paciente contendo a URL: `dosiq.app/emergency/:patient_id?auth_token=:token`.
- **FR-002:** Rota web pública e ultraleve (`bundle size < 50kB`) com renderização otimizada para navegadores móveis sem requisição de login.
- **FR-003:** A tela de socorrista exibe apenas: Alergias, Tipo Sanguíneo, Condições Clínicas, Medicamentos Críticos/Contraindicações e Contatos de Emergência.
- **FR-004:** Botão "Revogar Acesso/Gerar Novo Token" no aplicativo nativo que altera de forma imediata o token correspondente no banco.
- **FR-005:** Toda a modelagem e validação dos dados de emergência deve obedecer rigorosamente ao schema Zod canônico `@dosiq/core/schemas/emergencyProfileSchema.js` (R-021).

### Key Entities

- **EmergencyProfile:** Dados críticos de socorro e contatos salvos no banco.
- **Profiles:** Extensão de usuário contendo a coluna `emergency_token`.

---

## Success Criteria

- **SC-001:** Tempo de carregamento visual da página pública inferior a 1 segundo no Lighthouse Mobile sob conexões instáveis.
- **SC-002:** Segurança RLS rígida: acesso via SELECT é bloqueado para qualquer requisição que não forneça o `emergency_token` ativo e correspondente.
