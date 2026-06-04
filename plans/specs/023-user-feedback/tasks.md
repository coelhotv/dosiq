# Tasks: Sistema de Feedback do Usuário e Admin

Lista de tarefas estruturada para execução do desenvolvimento (Tier 2).

---

## 🛠️ Desenvolvimento e Implementação

### Camada 1: Banco de Dados & Validação (Core)
- [ ] **T000** [Infra] Criar feature branch para o desenvolvimento.
- [ ] **T001** [US1] Criar migração SQL `docs/migrations/20260604_create_feedbacks.sql` com a tabela `public.feedbacks`, RLS fechada (insert authenticated/select service_role) e coluna `is_resolved`.
- [ ] **T002** [US1] Criar Zod schema de validação `packages/core/src/schemas/feedbackSchema.js` em português com maxLength de subject (100) e comment (2000).
- [ ] **T003** [US1] Exportar o novo schema no barrel file `packages/core/src/schemas/index.js`.
- [ ] **T004** [US1] Criar a factory `packages/core/src/repositories/createFeedbackRepository.js` com o método `submitFeedback`.
- [ ] **T005** [US1] Exportar o novo repositório em `packages/core/src/repositories/index.js`.

### Camada 2: API Serverless Consolidada (Backend/Infra)
- [ ] **T006** [US2] Renomear `api/dlq.js` para `api/admin.js` e atualizar dependências e imports para ser a rota consolidada de admin.
- [ ] **T007** [US2] Implementar handlers de feedbacks (`handleListFeedbacks`, `handleResolveFeedback`) dentro de `api/admin.js` protegidos por `verifyAdminAccess`.
- [ ] **T008** [US2] Atualizar as rotas e destinos no `vercel.json` direcionando `/api/dlq` e `/api/feedbacks` para `/api/admin.js`.

### Camada 3: Área Admin (Web PWA)
- [ ] **T009** [US2] Criar o serviço cliente `apps/web/src/services/api/feedbackAdminService.js` para chamar `/api/feedbacks`.
- [ ] **T010** [US2] Adicionar botão de acesso "Feedbacks de Usuários" em `AdminSection.jsx` (gated por `isAdmin`).
- [ ] **T011** [US2] Criar tela administrativa `apps/web/src/views/admin/FeedbackAdmin.jsx` com paginação, filtros (is_resolved, rating), estatísticas e ação de resolver.
- [ ] **T012** [US2] Adicionar rota `'admin-feedbacks'` de forma lazy-loaded no `AppViewRouter.jsx`.

### Camada 4: Formulário de Feedback (Mobile)
- [ ] **T013** [US1] Criar tela `apps/mobile/src/features/profile/screens/FeedbackScreen.jsx` com form de avaliação por estrelas (1 a 5), assunto, comentário e coleta de metadados em background.
- [ ] **T014** [US1] Adicionar a constante `FEEDBACK: 'Feedback'` em `routes.js`.
- [ ] **T015** [US1] Registrar a tela `FeedbackScreen` no `ProfileStack.jsx`.
- [ ] **T016** [US1] Adicionar botão "Enviar feedback" em `ProfileScreen.jsx` sob a seção "OUTROS".

---

## 🧪 Validação e Qualidade (C4)
- [ ] **T017** [C4] Executar verificação estrita de lint (`rtk lint`) e corrigir eventuais novos warnings/errors.
- [ ] **T018** [C4] Executar e validar suíte crítica de testes locais via `rtk npm run test:critical` e `rtk npm run validate:agent`.
- [ ] **T019** [C4] Realizar verificação manual E2E de envio no mobile e listagem/ação de resolver na Web.
- [ ] **T020** [C4] Seguir protocolo de release SQP (R-221): classificar SemVer, atualizar versões nos pacotes e documentar em português no `CHANGELOG.md` `[Unreleased]`.

---

## 💾 Fechamento e Memória (C5)
- [ ] **T021** [C5] Gravar finalização da sprint: atualizar `.agent/state.json` (status=completed), registrar evento no `events.jsonl` e escrever entrada no diário (Journal).
- [ ] **T022** [C5] Publicar Pull Request para peer review usando o template canônico `docs/standards/PULL_REQUEST_TEMPLATE.md`.
