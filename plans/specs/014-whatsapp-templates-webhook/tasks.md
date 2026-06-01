# Tasks: WhatsApp Templates & Webhook

**Feature Directory**: `plans/specs/014-whatsapp-templates-webhook`  
**Input**: [spec.md](file:///Users/coelhotv/git/dosiq/plans/specs/014-whatsapp-templates-webhook/spec.md), [plan.md](file:///Users/coelhotv/git/dosiq/plans/specs/014-whatsapp-templates-webhook/plan.md)  
**Status**: Migrated Draft

---

## Phase 1: Setup & Preflight

- [ ] **T001** [C1] Confirmar o mapeamento das variáveis de ambiente de assinatura e tokens de validação da Meta Cloud API no painel da Vercel.
- [ ] **T002** [C1] Criar backup do arquivo `api/telegram.js` em produção e testar rota localmente.

## Phase 2: Implementation

### Webhook Roteador Híbrido
- [ ] **T003** [US1] Escrever o validador de assinatura criptográfica `sha256` nos cabeçalhos (`x-hub-signature-256`) em `packages/core/src/utils/crypto.js` de acordo com as regras de segurança da Meta.
- [ ] **T004** [US1] Criar o arquivo de roteamento físico unificado `api/webhooks.js` integrando importações dinâmicas assíncronas.
- [ ] **T005** [US1] Deslocar o lógica do webhook de Telegram para o arquivo interno `api/_adapters/telegram.js`.
- [ ] **T006** [US1] Criar o arquivo interno de tratamento de payloads de WhatsApp em `api/_adapters/whatsapp.js`.

### Shared / Core Templates
- [ ] **T007** [US2] Mapear os 4 templates canônicos da Meta e a injeção ordenada de variáveis no arquivo `packages/core/src/templates/whatsappTemplates.js`.

## Phase 3: Validation & QA Gates (C4)

- [ ] **T008** [C4] Executar `rtk lint` em `api/` e `packages/core` corrigindo warnings.
- [ ] **T009** [C4] Criar testes unitários para a validação de assinatura sha256 no core.
- [ ] **T010** [C4] Criar testes de integração simulando chamadas nos adaptadores unificados e validando o correto direcionamento interno.
- [ ] **T011** [C4] Executar `rtk npm run validate:agent` e certificar que todos os testes passaram.
- [ ] **T012** [C4] **Verificação de DoD Independente (R-060):** Confirmar que requisições com assinatura sha256 Meta inválidas retornam imediatamente erro 401 e são bloqueadas antes de invocar o tratamento do canal do WhatsApp.

## Phase 4: DEVFLOW & SQP Record (C5)

- [ ] **T013** [C5] Atualizar a versão do monorepo core (`package.json`).
- [ ] **T014** [C5] Adicionar entrada no topo do `CHANGELOG.md` na seção `[Unreleased]` em português brasileiro.
- [ ] **T015** [C5] Gravar evidência de qualidade do SQP.
- [ ] **T016** [C5] Finalizar a escrita do journal e incrementar no status.
