# Exec Spec Híbrido - Fase 8: Especulativo (Pós-MVP)

> **Status:** Documento Vivo (Backlog Pós-Beta Interno)
> **Base obrigatória:** `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
> **Objetivo:** Acumular e detalhar features avançadas que ficarão fora do escopo do Beta Inicial (Fases 5, 6 e 7). Este documento pode ir recebendo incrementos de design enquanto a equipe finaliza as sprints anteriores.

---

## 1. Visão Geral da Fase 8

A Fase 8 concentra todas as implementações que refinam e exploram as capacidades plenas da plataforma nativa, sem serem impeditivas para o MVP original. As Features listadas aqui podem ser implementadas como "Mini-Sprints" independentes após a estabilidade do monorepo e do mobile root.

**Placeholder de Features Planejadas (Conforme Master Spec):**
- ✅ **Notification Inbox (Central de Avisos)** - *Especificada abaixo*
- ✅ **Redesign Nativo do Dashboard ("Santuário Terapêutico")** - *Concluído*
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

---

## Epic 2: Redesign Nativo do Dashboard ("Santuário Terapêutico")

> **DIRETRIZ DE PROTEÇÃO CRÍTICA:** Toda e qualquer refatoração de serviços ou componentes lógicos sob `packages/shared-data` ou `src/features` deve **preservar a experiência Web "as is"**. Apenas o contexto de visualização do Mobile Root (`apps/mobile/`) será impactado por este épico visual. Nenhuma dependência que quebre o build web poderá ser introduzida.

O MVP do Aplicativo (Fase 5) focou na paridade de dados. Neste Epic, elevamos a experiência do Dashboard Nativo (aba "Hoje") para um layout verticalizado orientado não a medicamentos isolados, mas aos **"Momentos do Dia"** do paciente, adotando a linguagem de *Therapeutic Sanctuary* nativa.

### 2.1. Anatomia Funcional e Composição

Esta fase insere um agrupamento de itens baseados em "Turnos" (Manhã, Tarde, Noite). A lógica de negócios atual precisa ser traduzida para os **5 Estados de Interação** das doses:

1.  **Planejada (Futuro > 2h)**: Card de visualização inativo (sem Hero). Outline circle, sem CTA de confirmação.
2.  **Próxima (Aviso Prévio < 2h)**: Destacada como **Hero Card** no topo da visualização (TOMAR AGORA). Fundo teal `primary` gradient, botão *Confirmar Uso* **habilitado**.
3.  **Tomada (+/- 2h)**: Registrada no DB `adherence_logs`. Retorna ao repositório temporal (passado). Torna-se em `opacity-50` com traçado (*strikethrough*). Check indicativo à direita.
4.  **Atrasada (< 2h perdida)**: Encontra-se inadivertidamente esquecida. Mantém-se promovida como **Hero Card** ativável até extinguir sua validade clínica na janela de tolerância. Botão CTA ativo.
5.  **Perdida (> 2h sem uso)**: Desqualificada silenciosamente da view ativa. Retorna a ser card simples, em formato de outline vazio desativado e `opacity-50`, no fundo da timeline temporal do dia. Não ativável.

---

### 2.2 Inventário de Serviços: Reaproveitamento Misto

**✅ Serviços que JÁ EXISTEM e estão conectados (Usar "As Is"):**
*   `services/adherenceService.js` (Web/PWA): Já possui extração local baseada em protocolos `cachedAdherenceService.getFilteredLogs`.
*   `services/treatmentPlanService.js`: Sabe os horários brutos definidos por prescrição médica.
*   **Design Tokens da Web (`DESIGN-SYSTEM.md`)**: A cor Teal já existe em Tailwind tokens (`--color-primary-*` como `#006a5e`). Devemos portar o exato hex code para o Stylesheet nativo (`StyleSheet.create` no Mobile).
*   **Componente Lógico Ring Gauge**: Os cálculos algébricos do *"Você está indo muito bem hoje (75%)"* que orientam o anel de completude já servem à versão Web.

**⚠️ Serviços que requerem AJUSTES ESTRUTURAIS para o nativo:**
*   **Extrator / Filtro Temporizado (`DoseStateEngine`)**: Precisaremos de um utilitário (ex: em `shared/utils/dateUtils.js`) `evaluateDoseTimelineState()` que englobe localTime e `Date()` operations resilientes a timezone (regra R-020) para devolver ENUM: `"PLANEJADA" | "PROXIMA" | "TOMADA" | "ATRASADA" | "PERDIDA"`.
*   A injeção do componente gráfico SVG do anel de progresso (Ring Gauge), que pode não ser portável nativamente se a web usa `<svg>` plain. Avaliar uso de `react-native-svg` ou equivalentes seguros.

---

### 2.3 Roteiro de Sprints (Prescritivo)

#### Sprint 8.4: Data Binding e Util de Linha do Tempo
- [x] **Tarefa**: Codificar e testar nativamente a máquina de estados `evaluateDoseTimelineState(dosesArray)`.
- [x] **Quality Gate**: Escrever Vitest focado que rode simulações (vi.useFakeTimers) no Brasil/GMT-3 e confira que a janela +2h de facto chaveie "ATRASADA" -> "PERDIDA".
- [x] **Artefato**: Sem código em Views! Somente manipulação em data / helpers.

#### Sprint 8.5: Adherence Card & TimeBlock Container
- [x] **Tarefa**: Criar no Mobile UI os subcomponentes `<AdherenceDayCard />` e o `<TimeBlockSeparator />` (turnos).
- [x] **Quality Gate**: O Adherence Metric usa `useDashboardContext` já provido ou equivalente. Teste local renderizando perfeitamente independente da plataforma.

#### Sprint 8.6: Dose Cards, Assemble UI e Acesso ao Botão de Confirmação.
- [x] **Tarefa**: Desenvolver as implementações de visualização do card `HeroActionableCard` vs `StandardVisualCard` e montar do `DashboardNativeScreen`.
- [x] **Quality Gate**: Ao clicar "Confirmar Uso", ele chama exatamente as mesmas signatures via payload do que quando apertavamos do botão nativo MVP antigo.

---

### 2.4 Definition of Done e Validação Humana 🔑
> **Aprovação mandatória antes do PR:** Ao integrar Sprint 8.6, o Code Agent deverá expor log verde do runner de testes local (`npm run validate:agent`) e **parar categoricamente (HALT)**. O analista de produtos (Agente Humano) assumirá a máquina local, executará o emulador (Expo/iOS ou Android) e testará tátil/manualmente os estados antes de autorizar o Merge ou Code Review.

**Requisitos Finais (DoD):**
- [x] Timeline visivelmente fatiada em 3 blocos (Manhã, Tarde, Noite).
- [x] Ring Gauge percentual exibe total diário fidedigno aos logs do BD.
- [x] Componente Desktop/PWA abre em build isolado e não sofreu 1 pixel de quebra por contaminações de escopo cruzado.
- [x] CTAs (Confirmar Uso) só reagem dentro da janela de `+/- 2h`.
- [x] O app compila livre de `eslint/no-restricted-imports` nativo cruzados (ex: SVGs puros importados no Root Native).
- [x] Assinatura Humana presencial em emulador autorizando a funcionalidade 100%.
