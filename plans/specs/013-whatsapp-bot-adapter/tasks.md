# Tasks: WhatsApp Bot Adapter

**Feature Directory**: `plans/specs/013-whatsapp-bot-adapter`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/013-whatsapp-bot-adapter/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/013-whatsapp-bot-adapter/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar se as credenciais da Meta Cloud API (tokens e endpoints) estão mapeadas nas variáveis de ambiente locais do servidor.
- [ ] **T002** [C1] Verificar o estado do motor de notificações Telegram existente e criar suite de testes de regressão inicial.

## Phase 2: Implementation

### Refactoring Backend Services
- [ ] **T003** [US1] Criar a classe de interface canônica `INotificationChannel.js` sob `server/services/notification/`.
- [ ] **T004** [US1] Refatorar o Telegram para a nova interface comum de herança em `TelegramAdapter.js`.
- [ ] **T005** [US1] Escrever o canal de integração `WhatsAppAdapter.js` mapeando regras de conversão, HTTP requests e restrição de janela de 24h.
- [ ] **T006** [US2] Construir a classe centralizada `notificationManager.js` que monitora cotas agregadas mensais no Supabase e executa fallback para o Telegram em falhas.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T007** [C4] Executar `rtk lint` em `server/` e corrigir warnings.
- [ ] **T008** [C4] Criar testes unitários para a classe `WhatsAppAdapter` usando Mocks estruturados da Meta API REST.
- [ ] **T009** [C4] Criar testes unitários para o `notificationManager` validando regras de fallback sob falha de rede e bloqueio de cotas crítico (800 mensagens).
- [ ] **T010** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T011** [C4] **Verificação de DoD Independente (R-060):** Confirmar que ao disparar um alarme simulando falha na chamada HTTP da API do WhatsApp, o sistema reverte e entrega instantaneamente a notificação via Telegram.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T012** [C5] Atualizar a versão em `packages/core/package.json`.
- [ ] **T013** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T014** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T015** [C5] Finalizar a escrita do journal e incrementar no status.
