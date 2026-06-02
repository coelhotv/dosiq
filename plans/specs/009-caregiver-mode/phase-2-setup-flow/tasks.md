# Tasks: Setup Flow (Caregiver Mode — Phase 2)

**Feature Directory**: `plans/specs/009-caregiver-mode/phase-2-setup-flow`
**Epic**: [Modo Cuidador](../EPIC.md) · **Input**: [spec.md](./spec.md), [plan.md](./plan.md)
**Status**: Dev Ready

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar a integração e permissões nativas de câmera (`NSCameraUsageDescription` / `android.permission.CAMERA`) no arquivo de configuração do aplicativo.
- [ ] **T002** [C1] Verificar se chaves aliases estão ativas no core e prontas para consumir o repositório local.

## Phase 2: Implementation

### Mobile UI Screens & Components
- [ ] **T003** [US2] Construir a tela de boas-vindas `WelcomeScreen.jsx` com botões proeminentes AAA de toque mínimo de 60px.
- [ ] **T006** [US1] Criar o leitor de QR Code integrado `QrScannerScreen.jsx` com input de texto de contingência para digitação do código.
- [ ] **T007** [US2] Desenhar o diálogo em tela cheia `ConsentDialog.jsx` cobrando consentimento de privacidade e termos LGPD.
- [ ] **T008** [US3] Construir a tela `CaregiverSettingsScreen.jsx` com listagem de conexões autorizadas e botão "Revogar Acesso" — revogar executa **apenas `DELETE FROM caregiver_links`** (dados ficam sob o `user_id` do paciente; sem migração de entidades).

### Shared / Core Integration
- [ ] **T009** [US2] Implementar os métodos de importação, decodificação e processamento transacional de grade de medicamentos no arquivo `packages/core/src/repositories/caregiverFlowRepository.js`.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T010** [C4] Executar `rtk lint` em todos os diretórios do monorepo e corrigir warnings.
- [ ] **T011** [C4] Escrever testes unitários mockando o módulo de câmera e validando a importação do repositório core.
- [ ] **T012** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T013** [C4] **Verificação de DoD Independente:** Confirmar que ao escanear o QR Code de teste o consentimento LGPD é exibido, e que ao aceitar o consentimento, as instâncias de medicamentos importadas são salvas no banco com a tag `source='caregiver'`.
- [ ] **T014** [C4] **Smoke PO Manual:** Testar no simulador móvel o fluxo de clique na opção "Revogar Acesso", validando que a conexão é excluída instantaneamente do Supabase e que o app reverte para o modo standalone offline.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T015** [C5] Atualizar a versão do aplicativo no mobile (`app.config.js`) e no core (`package.json`).
- [ ] **T016** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T017** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T018** [C5] Finalizar a escrita do journal e incrementar no status.
