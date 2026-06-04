# Feature Specification: Sistema de Feedback do Usuário e Admin (Mobile + Web)

**Feature Directory**: `plans/specs/023-user-feedback`
**Created**: 2026-06-04 · **Revised**: 2026-06-04
**Status**: Dev Ready
**Tier**: 2 (novas tabelas, API consolidada e fluxo cross-platform mobile ↔ web)
**Input**: Solicitações por e-mail de usuários após lançamento das apps nativas iOS e Android há 1 semana.
**Rules & Standards**: R-221 (SQP), R-247 (maxLength), R-021 (Portuguese Zod/UI), R-202 (Admin settings check bypass via telegram_chat_id / AP-135).

---

## Context

Após o recente lançamento (1 semana) das apps nativas iOS e Android, recebemos solicitações de usuários para enviar sugestões e relatos diretamente pelo app.

Este projeto provê:
1. Uma interface logada nativa (iOS/Android) para envio de feedbacks contendo assunto, texto, nota/estrelas (1 a 5) e metadados estruturados (dispositivo, SO, versão do app).
2. Um painel administrativo seguro rodando no PWA Web que permite listar feedbacks, visualizar metadados técnicos, ver resumos estatísticos de satisfação (ratings) e marcar feedbacks como resolvidos (`is_resolved = true`).
3. Uma API consolidada em um único slot serverless da Vercel (`api/admin.js`), prevenindo desperdício de limites do plano Hobby (R-090).

---

## User Scenarios & Testing

### User Story 1 — Envio de Feedback no Mobile (P1)
**Why**: Como usuário logado no aplicativo móvel, quero enviar sugestões ou relatos diretamente do app sem precisar escrever um e-mail manual.
**Independent Test**: Navegar até "Perfil" > "OUTROS" > "Enviar feedback". O app abrirá a tela correspondente. Preencher o assunto, comentário, selecionar 4 estrelas e enviar. O app deve exibir um Toast de sucesso e retornar à tela do perfil. Validar que uma nova linha foi inserida no banco com os metadados do simulador/device.

**Acceptance Scenarios**:
1. **Given** que o usuário está autenticado e na tela de feedback, **When** preenche todos os campos obrigatórios e confirma o envio, **Then** a inserção é feita diretamente via Supabase client, validando o schema com o repositório core, gravando o `user_id` correspondente ao `auth.uid()`.
2. **Given** o formulário aberto, **When** o usuário tenta enviar com assunto vazio ou comentário vazio, **Then** a validação local (Zod) bloqueia o envio e exibe mensagens de erro em português.

### User Story 2 — Painel Admin de Consulta e Resolução (P1)
**Why**: Como administrador do Dosiq, quero poder ler o feedback consolidado, analisar as notas médias de satisfação e marcar problemas como resolvidos quando forem implementados.
**Independent Test**: Fazer login na Web com a conta administrativa configurada com `telegram_chat_id` igual à env `ADMIN_CHAT_ID`. Ir nas configurações, acessar o painel "Feedbacks de Usuários". A listagem de feedbacks não resolvidos deve carregar. Clicar em "Marcar como Resolvido" em uma das linhas e verificar que a listagem atualiza o status.

**Acceptance Scenarios**:
1. **Given** que o usuário administrativo acessa o painel, **When** a tela carrega, **Then** ela busca os feedbacks usando a API segura consolidada `/api/feedbacks` (rodando em `/api/admin.js`), exibindo a média de estrelas total e permitindo filtrar por `is_resolved` (pendente/resolvido) e `rating` (1-5 estrelas).
2. **Given** um feedback pendente na listagem, **When** o admin clica em "Marcar como Resolvido", **Then** a API envia uma requisição `POST /api/feedbacks/:id/resolve`, atualizando a coluna `is_resolved = true` e atualizando o estado do componente.

---

## Edge Cases

- **Entrada de Texto Extensa**: Comentários podem ter no máximo 2000 caracteres, assunto no máximo 100 caracteres. O front-end e o schema Zod devem aplicar e impor `maxLength` rígido para evitar estouro de buffer ou poluição de dados (R-247).
- **Sem Fuso Horário no Banco**: Ao exibir feedbacks no painel administrativo Web, as datas/horas em formato UTC devem ser convertidas corretamente para a exibição local em português no timezone do administrador (America/Sao_Paulo).
- **Supressão de SELECT no Supabase Client**: Qualquer tentativa de fazer query de listagem (`SELECT`) direta no Supabase client na tabela `feedbacks` por um usuário final logado comum deve falhar (HTTP 401/403) por conta da RLS configurada de forma fechada (Write-Only).

---

## Functional Requirements

- **FR-001 (Schema & Validação)**: Definir o schema Zod do feedback em `packages/core/src/schemas/feedbackSchema.js` e forçar validação via `safeParse()` antes de qualquer escrita no repositório.
- **FR-002 (Limites estritos de tamanho)**: Aplicar e validar comprimento máximo de inputs: `subject` (100) e `comment` (2000) (R-247).
- **FR-003 (Coleta de Metadados Mobile)**: Coletar de forma transparente: `platform` ('ios' ou 'android'), `app_version` (extraído do `Constants.expoConfig?.version`), e `device` (modelo do celular resolvido por `Device.modelName`).
- **FR-004 (Políticas RLS Fechadas)**: A tabela `public.feedbacks` deve ter RLS habilitada. A única policy criada para usuários authenticated é de `INSERT` com o check `auth.uid() = user_id`. Acesso a `SELECT/UPDATE/DELETE` para usuários comuns é totalmente restrito.
- **FR-005 (Consolidação Serverless)**: A API administrativa deve ser implementada no arquivo `api/admin.js` consolidando o endpoint `/api/dlq` e `/api/feedbacks`. O rewrite no `vercel.json` deve realizar o encaminhamento de forma transparente ao cliente.
- **FR-006 (Gating Admin por Chat ID)**: O acesso à leitura e atualização dos feedbacks no `api/admin.js` deve utilizar o utilitário `verifyAdminAccess`, comparando o `telegram_chat_id` do usuário logado contra a variável de ambiente segura `ADMIN_CHAT_ID`.
- **FR-007 (Filtro e Paginamento Admin)**: O painel admin de feedback na Web deve usar lazy-load e renderizar dados paginados com suporte a filtros por `is_resolved` e `rating`.
- **FR-008 (Resolução do Feedback)**: Permitir marcar um feedback como resolvido via `is_resolved = true`, disparando a atualização do banco pela API administrativa.

---

## Success Criteria

- **SC-001**: O formulário de feedback do mobile deve ser leve, carregando instantaneamente e enviando a inserção em < 500ms (rede móvel estável).
- **SC-002**: Bloqueio total de vazamento de dados: tentativas de usuários finais de ler dados da tabela `feedbacks` no Supabase client devem falhar com erro de RLS.
- **SC-003**: Sem regressão de recursos serverless: o deploy na Vercel não deve aumentar o número total de serverless functions além dos 7 slots existentes (consolidando no `api/admin.js`).
- **SC-004**: Aderência completa ao SQP (R-221): classificação de SemVer realizada, bump de versões feito, changelog em português preenchido, e nenhuma nova regressão de linting ou testes após o PR.
