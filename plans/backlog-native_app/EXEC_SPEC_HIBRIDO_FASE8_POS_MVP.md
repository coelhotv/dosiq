# Exec Spec Híbrido - Fase 8: Especulativo (Pós-MVP)

> **Status:** Documento Vivo (Backlog Pós-Beta Interno)
> **Base obrigatória:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Objetivo:** Acumular e detalhar features avançadas que ficarão fora do escopo do Beta Inicial (Fases 5, 6 e 7). Este documento pode ir recebendo incrementos de design enquanto a equipe finaliza as sprints anteriores.

---

## 1. Visão Geral da Fase 8

A Fase 8 concentra todas as implementações que refinam e exploram as capacidades plenas da plataforma nativa, sem serem impeditivas para o MVP original. As Features listadas aqui podem ser implementadas como "Mini-Sprints" independentes após a estabilidade do monorepo e do mobile root.

**Placeholder de Features Planejadas (Conforme Master Spec):**
- ✅ **Notification Inbox (Central de Avisos)** - *Especificada abaixo*
- ⏳ Biometria Avançada
- ⏳ Persistência de Alta Performance (MMKV)
- ⏳ Integrações Nativas de Saúde (HealthKit / Google Fit)
- ⏳ Geração de PDF Nativo Refinado
- ⏳ Emergency Card Avançado
- ⏳ Chatbot Nativo (Interface Mobile Otimizada)

---

## Epic 1: Notification Inbox (Central de Avisos)

Notificações push em smartphones são efêmeras. Se o usuário as descarta (swipe) acidentalmente, ele perde um lembrete no qual a adesão ao tratamento dependia. O mesmo ocorre no Telegram se a mensagem se "perder" no histórico de chats da pessoa.

Criar uma **Central de Notificações / Inbox** ("Log") dentro do aplicativo age como uma **Rede de Segurança Crítica**. Lá, o usuário poderá consultar:
- Lembretes passados do dia (podendo clicar e dar "Baixa" se esqueceu).
- Avisos de estoque baixo.
- Comunicados importantes do tratamento.

A vantagem é que **metade do caminho técnico já está construído** (a tabela `notification_log` já existe desde a v3.0.0).

---

## 2. Inventário Existente e Complexidade (Baixa)

O banco de dados já possui as seguintes estruturas (via `docs/architecture/DATABASE.md`):

1. **Tabela `notification_log`:**
   - Já possui campos cruciais: `user_id`, `protocol_id`, `notification_type` (dose_reminder, stock_alert, etc.), `status` (pendente, enviada, falhou), `sent_at`, e `created_at`.
   - Já tem **Policies RLS** ativas (impedem usuários de lerem logs alheios).
   - Já tem bons **Índices** (`idx_notif_log_user`, `idx_notif_log_sent_at`).

2. **Dispatcher Multicanal (Entregue no Sprint 6.2):**
   - Centraliza o disparo de qualquer push e telegram no backend `server/notifications/dispatcher/dispatchNotification.js`.

---

## 3. Escopo Exato da Entrega

### 3.1. Supabase & Backend
1. **Migration Simples**: Hoje, `notification_log` tem a coluna `telegram_message_id`. Precisaremos de uma migration SQL simples renomeando/substituindo essa coluna para `provider_message_id` ou adicionando `provider_metadata` (jsonb) para suportar tanto IDs de Telegram quanto _Receipt Tickets_ de serviços Push (Expo).
2. **Atualização do Dispatcher**: Injetar o repositório de logs no `dispatchNotification.js`. Sempre que um canal consolidado reportar "Sucesso" (Push ou Telegram), fazer um `INSERT` na `notification_log` assincronamente (Fire-and-forget, para não travar o envio).

### 3.2. Novo Pacote Compartilhado (`packages/shared-data`)
1. Implementar `notificationLogRepository.js` no client-side para listar histórico paginado.
2. Criar hook universal `useNotificationLog({ limit: 20 })` usando SWR (`useCachedQuery`) para web e mobile consumirem.
3. Criar utilitário e schema Zod para formatar a visualização dos ícones locais em função do tipo da notificação.

### 3.3. Frontend App (Native) & Web (PWA)
1. **Notification Inbox UI**: Uma nova rota (ex: `/notifications`), acessível ou pelo Perfil ou através de um novo ícone 🔔 na Header bar/Tab bar.
2. Contendo uma **Lista Virtualizada** (já possuímos `Virtuoso` otimizado para mobile) exibindo cards das últimas notificações.
3. **Deep Linking**: O botão "Ação" do card das notificações antigas deve aproveitar os deeplinks de metadado (ex: Abrir aba Hoje para um Lembrete, aba Estoque para alerta de medicamento acabando).
4. *(Opcional)*: Tratamento de Badge (número vermelho) de mensagens "Não Lidas" usando `AsyncStorage/localStorage` para gravar qual a data do último acesso à tela da Inbox.

---

## 4. Ordem Recomendada de Implementação (Sprints)

- **Sprint 8.1 - Data Layer:** Migration SQL de `provider_metadata` + Dispatcher salva no DB. (O log começa a ser populado sem UI).
- **Sprint 8.2 - Shared Service:** Hook de leitura + Mocks.
- **Sprint 8.3 - UX Web & Mobile:** Desenvolvimento da tela e sinergia de badging 🔔.

---

## 5. DoD (Definition of Done) Verificável

- [ ] Lembrete disparado pelo cron (ou manualmente via admin) gera linha na tabela `notification_log`.
- [ ] Um disparo que for englobado pelo canal `both` registra perfeitamente na tabela, seja duplicado (por provedor) ou compilado.
- [ ] O usuário consegue acessar a nova área, ver os itens cronologicamente do mais novo para o mais antigo, independente de ter deletado seu push panel no celular.
- [ ] Clicar no log ativa o routing correspondente do App.
