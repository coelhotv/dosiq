# Feature Specification: Public Emergency QR Card

**Feature Directory**: `plans/specs/006-public-emergency-qr-card`  
**Created**: 2026-06-01 · **Revised**: 2026-06-15
**Status**: draft — **absorve conceitos do épico 012 (descope da Fase E, 2026-06-15): líquidos e injetáveis** (sem biomarkers — medida pontual não é dado de socorro)
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §F6.1

> **✅ Absorve 012 (líquidos/injetáveis, 2026-06-15):** "Medicamentos Críticos/Contraindicações"
> (FR-003) deve exibir a dose na **unidade de tomada** via formatters core (insulina "10 UI", GLP-1
> "1 mg") e indicar **forma injetável** — informação relevante p/ o socorrista. **Biomarkers NÃO
> entram** no cartão (glicemia pontual não é dado de emergência soberano; fica em 005/007/008).

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
- **FR-003:** A tela de socorrista exibe apenas: Alergias, Tipo Sanguíneo, Condições Clínicas, Medicamentos Críticos/Contraindicações e Contatos de Emergência. **(012)** Em "Medicamentos Críticos", a dose de líquidos/injetáveis usa os formatters core (`formatIntakeDose`/`isLiquidMedicine`, `@dosiq/core`) na unidade de tomada — insulina "10 UI", GLP-1 "1 mg" — e marca **forma injetável**; **nunca** `dosage_unit` cru nem "comprimido" (R-272). Read-path traz `intake_unit`+`units_per_ml`+`dosage_per_pill` (R-267).
- **FR-004:** Botão "Revogar Acesso/Gerar Novo Token" no aplicativo nativo que altera de forma imediata o token correspondente no banco.
- **FR-005:** Toda a modelagem e validação dos dados de emergência deve obedecer rigorosamente ao schema Zod canônico `@dosiq/core/schemas/emergencyProfileSchema.js` (R-021).
- **FR-006 (012):** Quando um medicamento crítico for injetável/líquido, o payload de emergência carrega os campos necessários (`intake_unit`, `units_per_ml`, `dosage_per_pill`, `presentation`) p/ os formatters core renderizarem a dose correta na página pública — paridade mobile (geração do QR/payload) ↔ web (página pública ultraleve, mantendo bundle < 50kB; formatters core são puros e leves).

### Key Entities

- **EmergencyProfile:** Dados críticos de socorro e contatos salvos no banco.
- **Profiles:** Extensão de usuário contendo a coluna `emergency_token`.

---

## Success Criteria

- **SC-001:** Tempo de carregamento visual da página pública inferior a 1 segundo no Lighthouse Mobile sob conexões instáveis.
- **SC-002:** Segurança RLS rígida: acesso via SELECT é bloqueado para qualquer requisição que não forneça o `emergency_token` ativo e correspondente.
- **SC-003 (012):** medicamentos críticos injetáveis/líquidos aparecem na unidade de tomada correta (insulina "10 UI", não "10 un.") via formatters core, com indicação de forma injetável; página pública mantém bundle < 50kB.
