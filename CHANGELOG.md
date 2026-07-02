# Changelog - Dosiq

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## App v0.24.3 (mobile) + Backend — 2026-07-02 — Feat (042 Slice A): trilha de auditoria de dose crítica (debug-first)

> **Bump:** mobile `0.24.2 → 0.24.3` (patch — feature aditiva, sem UI). **Plataforma:** Mobile + Backend + Core. Migração aditiva (tabela nova `dose_critical_events`, append-only, RLS por usuário, prune 90d via pg_cron). Sem impacto para o usuário final — instrumentação de observabilidade.

### ✨ Novidades (interno / observabilidade)

- **Trilha de auditoria do ciclo de vida da dose crítica:** nasce a tabela append-only `dose_critical_events` que registra os marcos de uma dose crítica — `alarm_scheduled`, `snoozed`, `resolved` (mobile), e `push_sent`/`push_failed`/`push_skipped_no_token`/`surface_transitioned` (servidor APNs). Permite reconstruir a trajetória de uma dose ("por que o alarme não tocou?") sem depender do simulador conectado. Emissão **fail-open**: jamais quebra o alarme/registro/push.

### 🔒 Segurança / Privacidade

- **RLS por usuário** (SELECT/INSERT do próprio `user_id`), **append-only** (sem UPDATE/DELETE para `authenticated`; prune só via `service_role`/cron). Emits do servidor derivam `user_id` da própria `dose_instance` (não de input). `detail` sem PII: nunca grava nome de medicamento, token ou segredo.

### 🧱 Interno

- Novo `criticalAuditService` + `criticalAuditEventSchema` em `@dosiq/core` (CON-031, ADR-077). Enum espelha os CHECKs SQL (R-270).

---

## App v0.24.2 (mobile) + Backend — 2026-07-02 — Fix: superfícies presas + "Tomei" em dose velha + nome nos cards iOS

> **Bump:** mobile `0.24.1 → 0.24.2` (patch — bugfix). **Plataforma:** Mobile + Backend.

### 🐛 Correções

- **Alarme/superfície não ficam mais presos na tela por horas/dias:** quando a cadeia de agendamentos quebrava (app fechado a noite toda / Doze / simulador suspenso), a notificação local de uma dose vencida não sumia sozinha — e ao abrir o app ela ainda era promovida para a tela cheia. Agora, ao abrir/voltar ao app, uma varredura cancela toda notificação de dose cuja janela de tomada já passou (missed), e a tela cheia só reabre para uma dose ainda ativa. Vale para Android e iOS.
- **Tocar "Tomei" numa dose já registrada/vencida não mostra mais erro vermelho:** o registro batia na guarda do banco (`P0001` — dose já registrada / fora de janela) e exibia erro catastrófico. Agora é no-op idempotente: entende que a dose já está resolvida, limpa a superfície/alarme e não alerta. Não altera o registro normal nem a detecção de estoque insuficiente.
- **Live Activity (iOS) volta a mostrar o nome do tratamento:** os cards iniciados/transicionados por push apareciam "discretos" (rótulo genérico "Hora da dose", sem o nome). Como o iOS não redige a Live Activity pela privacidade do sistema, o padrão passa a ser **explícito** (mostra o nome), em paridade com a superfície aberta em foreground. Ocultar o nome fica como toggle próprio futuro (backlog LGPD).

---

## App v0.24.1 (mobile) + Backend — 2026-07-02 — Fix (041 fix-up): Live Activity transiciona e encerra via push (iOS)

> **Bump:** mobile `0.24.0 → 0.24.1` (patch — fix-up da fase 041). **Plataforma:** Mobile (iOS) + Backend. Migração aditiva. **Só validável em prod** (serverless não roda em dev/preview).

### 🐛 Correções

- **Live Activity agora transiciona de estado e encerra sozinha, com o app fechado:** a entrega original (v0.24.0) só _iniciava_ a superfície por push; as transições (`próxima→na hora→atrasada`) e o encerramento dependiam do app estar aberto rodando — então, com o app fechado, o countdown congelava no zero, o estado `atrasada` ficava preso na lock screen até swipe manual, e registrar a dose não trocava para `Tomada ✓`. Agora o servidor dirige o ciclo completo via push APNs: **update** de estado ao cruzar cada limite e **end** (card `Tomada ✓` + dismiss) quando a dose é registrada — tudo sem depender de o app ir a foreground.

### 🧱 Interno

- `server/notifications/apns/liveActivityPush.js`: `sendLiveActivityUpdate` (event `update`, priority 5) + `sendLiveActivityEnd` (event `end` + `dismissal-date`), reusando o cliente HTTP/2 + timeout (AP-256).
- `server/notifications/apns/dispatchLiveActivityLifecycle.js` (novo): no loop de minuto (`checkReminders`), para cada LA ativa (`dose_instances.la_push_token`) dispara update ao mudar de estado (idempotência via `la_push_state`) e end na resolução (`taken`/`skipped`/`missed`), limpando o token. Fail-open total (nunca toca o alarme).
- iOS nativo: `Activity.request(pushType: .token)` + observa `activity.pushTokenUpdates` (token per-Activity) → RN grava em `dose_instances.la_push_token` (sessão viva). `getActivityPushToken` no bridge.
- Migração `20260702` (aditiva): `dose_instances.la_push_token` + `la_push_state`.
- **Decisão revertida:** ADR-076 Decisão 2 (start-only → start+update+end) — a premissa "transições degradam bem como na 039" era falsa. Ver `plans/specs/041-ios-push-to-start/spec.md §Fase Fix-up`.

---

## App v0.24.0 (mobile) + Backend — 2026-07-01 — Feat (041): Live Activity push-to-start no iOS

> **Bump:** mobile `0.23.4 → 0.24.0` (minor — novo épico/feature). **Plataforma:** Mobile (iOS) + Backend. **NÃO server-free** (servidor dispara push). Migração aditiva (sem backfill).

### ✨ Novidades

- **Live Activity da dose crítica aparece antes do horário, com o app fechado (iOS 17.2+):** fecha o gap da 039/F3 — antes a superfície (Dynamic Island / lock screen) só iniciava com o app em foreground. Agora o servidor dispara um push APNs ActivityKit (`push-to-start`) na janela pré-dose (T0−60min) e o iOS inicia a Live Activity sem o app abrir. Transições e encerramento seguem o modelo 039 (`staleDate`/foreground). Estado inicial recomputado no disparo (dose editada nasce no estado certo).

### 🔒 Segurança / Privacidade

- Push escopado ao dono do token (object-level check — o disparo usa `service_role` que ignora RLS).
- Modo discreto resolvido no servidor: nome do medicamento NÃO sai no payload do push.
- Falha/ausência de APNs degrada com segurança para o comportamento 039 (foreground) e **nunca** suprime o alarme crítico.

### 🧱 Interno

- `server/notifications/apns/`: cliente APNs raw (JWT ES256 + HTTP/2), builder de content-state (CON-029), disparo no loop de minuto (`api/notify.js`→`checkReminders`, best-effort + fail-open).
- Estende `notification_devices` (provider `apns_liveactivity`) + coluna `dose_instances.la_push_started_at` (idempotência) — migração `20260630`, zero tabela/função nova (R-090 intacto).
- iOS nativo: observa `Activity.pushToStartTokenUpdates`; RN registra o token via RPC existente. `NSSupportsLiveActivitiesFrequentUpdates` habilitado. ADR-076, CON-030 estendido.
- **Requer** chave APNs `.p8` dedicada nas envs do backend (`APNS_AUTH_KEY` base64 + KEY_ID/TEAM_ID/BUNDLE_ID) — guia em `plans/specs/041-ios-push-to-start/APNS_SETUP.md`.

---

## Backend (bot) — 2026-06-30 — Fix: dose crítica vazava no Telegram + horário errado no body da soneca

> **Bump:** nenhum (backend/bot — não versionado como app). **Plataforma:** Backend (servidor de notificações). **Server-side**, sem migração de schema.

### 🐛 Correções

- **Dose crítica (alarme timeSensitive) não vai mais junto pelo Telegram:** o lembrete de dose
  essencial/crítica agora é entregue **só pelo canal de alarme** (push mobile). Antes, além do alarme,
  disparava Telegram e web push em paralelo — duplicando o aviso. Se o usuário não tiver dispositivo
  mobile ativo, cai para o Telegram como fallback (nunca fica sem aviso). Doses não-críticas seguem
  multi-canal normalmente. Causa: o gate de canais (`resolveChannelsForUser`) só *adicionava* o push
  para doses críticas, sem *remover* os demais canais.
- **Horário no corpo do lembrete = horário ORIGINAL agendado da dose:** ao adiar uma dose (soneca),
  o re-disparo imprimia no fim do texto a **hora de saída do push** (ex.: "15:08") em vez do horário
  agendado da dose. Agora usa sempre o `scheduled_for` da ocorrência. Causa: o builder usava a hora
  atual (`currentHHMM`) e o `SELECT` do reminder nem buscava `scheduled_for` (AP-215 — read-path).

### 🧱 Interno

- `_reminderHelpers.js`: `scheduled_for` no select + `mapInstanceToDose` + `_formatScheduledLabel` (tz do dono).
- `resolveChannelsForUser`: gate crítico = só `mobile_push`, fallback `telegram`.
- Testes: horário agendado (snooze) + 4 casos do gate de canal crítico.

---

## App v0.23.4 (mobile) — 2026-06-30 — Fix: cor do estado "atrasada" nas Live Activities iOS (acessibilidade)

> **Bump:** mobile `0.23.3 → 0.23.4` (patch — correção visual/acessibilidade). **Plataforma:** Mobile (iOS). **Server-free**, sem migração.

### ♿ Acessibilidade

- **Contraste do estado "atrasada" nas Live Activities iOS (Dynamic Island + lock screen):** a cor âmbar usada para o logo dosiq, rótulos e botão "Tomar" no estado `late` era `#904d00` (contraste 3,36:1 sobre preto — reprovado no WCAG AA). Substituída por `#F59E0B` (`warningBright`, contraste **9,82:1** — WCAG AAA), mantendo hue âmbar de atenção com legibilidade muito superior para pessoas com visão comprometida.
- Android não afetado: mesma cor é usada como acento sobre fundo claro (Material), onde o contraste é adequado (6,25:1).

### 🧱 Interno

- Novo token `status.warningBright: '#F59E0B'` em `tokens.js` (mobile) para superfícies com fundo escuro.

---

## App v0.23.3 (mobile) — 2026-06-30 — Fix: card de estado contínuo da dose não aparecia no Android (produção)

> **Bump:** mobile `0.23.2 → 0.23.3` (patch — correção de bug em produção). **Plataforma:** Mobile (Android). **Server-free**, sem migração.

### 🐛 Correções

- **Card de acompanhamento da dose crítica não aparecia (Android):** o aviso fixo (ongoing notification)
  que acompanha a dose crítica — com cronômetro e botões Registrar/Adiar — nunca era exibido em
  dispositivos reais, embora o alarme normal funcionasse. Causa: a notificação referenciava um ícone
  (`ic_dosiq_mark`) que não estava no build do app; o Android rejeita notificações sem ícone válido e o
  erro era engolido silenciosamente. O ícone também se perdia a cada build (não era versionado). Agora
  a marca dosiq é gerada de forma reprodutível em todo build e assume a cor de cada estado da dose
  (próxima/agora/atrasada), como no iOS.

### 🧱 Interno

- Novo config plugin `withDoseActivityAndroidIcon.js` escreve o vector drawable monocromático da marca
  dosiq no prebuild (mesmo padrão dos plugins iOS de Live Activity).
- Canal de notificação da superfície: `dose-activity-v1` → `dose-activity-v2`, importância `DEFAULT` →
  `HIGH` (MIUI/HyperOS silenciava canais `DEFAULT`).

---

## App v0.23.2 (mobile) / Web v4.15.2 — 2026-06-30 — Fix: superfícies de dose só mostram tratamentos vigentes hoje

> **Bump:** mobile `0.23.1 → 0.23.2` (patch — correção de bug). Web `4.15.1 → 4.15.2` (patch). Core: novo predicado canônico.
> **Plataforma:** Mobile + Web. **Server-free**, sem migração.

### 🐛 Correções

- **Vazamento de prescrições encerradas/futuras na seleção de dose:** ao registrar dose por um plano
  (modal bulk via botão "Tomar" da Dynamic Island/lock screen no mobile, ou FAB global de doses na web),
  apareciam doses de tratamentos do mesmo plano que **já terminaram** (`end_date` < hoje) ou que **ainda
  não começaram** (`start_date` > hoje). Causa: o filtro considerava só a flag `active`, ignorando o
  período de vigência. Agora as superfícies de seleção de dose só trazem tratamentos **vigentes hoje**
  (ativos **e** com hoje dentro de `[start_date, end_date]`).

- **Horário do picker ignorado no registro bulk (mobile):** ao ajustar a data/hora da tomada no
  seletor da modal bulk, o valor escolhido não era gravado — a dose ficava com o horário "agora" do
  sistema (ex.: tomada das 23:47 de ontem registrada como 01:05 de hoje, caindo no dia errado do
  calendário). Duas causas: (1) o seletor iOS abria como Modal aninhada e os gestos não registravam;
  (2) o horário escolhido era resetado para "agora" quando a lista de doses re-renderizava. Agora o
  seletor é um overlay na mesma superfície e o horário só é inicializado na abertura da modal.

### 🧱 Interno

- Novo predicado canônico `isTreatmentSchedulableOn(protocol, today)` em `@dosiq/core` (combina
  `isTreatmentActive` + `isProtocolActiveOnDate`), elimina o literal `=== 'ativo'` espalhado e
  centraliza a regra de elegibilidade de dose web↔mobile.

---

## App v0.23.0 (mobile) — 2026-06-29 — Dose como estado contínuo: Live Activity + Dynamic Island (iOS)

> **Bump:** mobile `0.22.0 → 0.23.0` (minor — nova superfície iOS, épico 039 Dose State Machine, F3). Web sem alteração.
> **Plataforma:** Mobile (iOS). **Server-free** (timer vivo da Live Activity, zero APNs).
> **Extensão do alarme crítico** (sem toggle novo): mesma máquina de estados da F2 (Android), agora na ilha/lock screen iOS.
> **iOS mínimo:** Live Activity a partir de 16.2; **botões Registrar/Adiar exigem iOS 17+** (App Intents).

### ✨ Novidades (iOS)

- **Live Activity + Dynamic Island:** a dose crítica vira um estado contínuo na ilha e na lock screen —
  próxima (cinza) → chegando/agora (teal, contagem regressiva viva) → atrasada (âmbar, progressiva) →
  tomada ✓ (verde) → perdida. Cor e rótulo acompanham o estado (paridade visual com o Android, CON-030).
- **Botões na ilha (iOS 17+):** **Registrar** abre a app na tela de registro (escolha de quantidade e,
  em injetáveis, sítio de aplicação) e **Adiar** soneca o alarme — direto da Dynamic Island.
- **Encerramento automático:** registrar a dose por qualquer caminho encerra a Live Activity (sem dose fantasma).
- **Server-free:** contador vivo (`Text(timerInterval:)`), sem push. Config plugin reproduzível
  (`@bacons/apple-targets`) + Widget Extension Swift (ADR-075).

### 🔧 Notas técnicas

- Novo Widget Extension target gerado no prebuild/EAS (não mais wiring manual no Xcode).
- App Group `group.com.coelhotv.dosiq` (App Intent → fila → RN registra com sessão viva, PO-SEC-2).

---

## App v0.22.0 (mobile) — 2026-06-28 — Dose como estado contínuo: notificação persistente (Android, alarme crítico)

> **Bump:** mobile `0.21.3 → 0.22.0` (minor — nova feature, épico 039 Dose State Machine, F2). Web sem alteração.
> **Plataforma:** Mobile (Android). **Server-free** (zero APNs/endpoint novo).
> **Extensão do alarme crítico** (sem toggle novo): vale para tratamentos com alerta crítico ativado.

### ✨ Novidades

- **Superfície de estado contínuo da dose (Android):** uma notificação persistente "companheira"
  (canal silencioso, sem som) acompanha a dose como um **estado que transiciona** —
  próxima (cinza) → chegando/agora (teal, contagem regressiva contínua) → pendente (âmbar,
  contagem progressiva) → tomada ✓ (verde). A cor e o rótulo mudam junto com o estado.
- **Contagem regressiva contínua:** o cronômetro corre da janela "chegando" (90min antes) até o
  horário da dose, sem sumir nos minutos finais; ao chegar a zero vira "agora".
- **Botão Registrar abre a app na tela de registro** da(s) dose(s) — permite escolher quantidade e,
  em injetáveis, o **sítio de aplicação**. **Adiar** age direto (soneca). Registrar por qualquer
  caminho encerra a notificação (sem dose fantasma).
- **Card de confirmação "Tomada às HH:mm ✓"** (verde) após registrar uma dose que estava sendo
  acompanhada — some sozinho em ~3 minutos.
- Aparece automaticamente para doses de tratamentos com **alerta crítico** ativado (extensão visual
  do alarme crítico — sem configuração adicional).
- Doses de longo atraso (ex.: semanais/GLP-1) mostram contagem progressiva só nas primeiras ~2h e
  depois um rótulo estático ("ontem"/"há N dias"), sem cronômetro correndo por dias.
- Modo discreto na tela de bloqueio (não revela o nome do medicamento) por padrão em doses críticas.

### 🏪 Nota de loja (Android)

Os tratamentos com alerta crítico agora acompanham a dose direto na barra de notificações: um
lembrete contínuo que mostra quanto falta, avisa a hora e deixa você registrar com um toque —
sem abrir o app.

---

## App v0.21.3 (mobile) — 2026-06-26 — Correção: editar dose injetável já tomada

> **Bump:** mobile `0.21.2 → 0.21.3` (patch — correção de bug). Web sem alteração.

### 🐛 Correções

- **Editar dose já tomada (mobile):** no histórico, editar uma dose agendada já tomada (ex.: alterar
  o sítio de aplicação de um injetável) falhava com "Ocorrência já registrada ou indisponível" (P0001).
  `DoseActionSheet` roteava a edição para `registerRetro` (INSERT via `register_dose_atomic`) em vez de
  `updateLog`, pois só tratava doses órfãs (`source==='log'`) como editáveis. Doses agendadas tomadas
  carregam `logId` (`medicine_log_id`), então o roteamento passa a usar a presença de `logId`:
  com log de apoio → UPDATE atômico (`update_dose_log_atomic`); sem log (pending/missed) → registro retroativo.

---

## Web v4.15.1 + App v0.21.2 (mobile) — 2026-06-26 — Consistência multi-superfície no card de dose prioritária

> **Bump:** web `4.15.0 → 4.15.1` (patch — polimento UX no PriorityDoseCard) · mobile `0.21.1 → 0.21.2`
> (patch — paridade de comportamento no HeroDoseCard + todas as doses na modal).

### ✨ Melhorias

- **Visual por status (PWA):** `PriorityDoseCard` distingue doses "Agora" (azul brand) de doses
  "Atrasada" (fundo âmbar, badge ⚠, CTA laranja) via campo `zone` injetado pelo `Dashboard.jsx`.
- **Tempo relativo (mobile):** `HeroDoseCard` passa a exibir "Agora", "Em X min" ou "Às HH:MM"
  — mesma lógica já presente no PWA.
- **Carry-over com dia da semana (PWA + mobile):** doses de injetáveis semanais (ex.: GLP-1)
  que permanecem pendentes 1-3 dias exibem "Quinta-feira às 22:00" em vez de apenas "Às 22:00"
  ou "Agora" enganoso. Detecção via comparação de `scheduledFor` vs hoje no fuso `America/Sao_Paulo`.
- **Todas as doses na modal (mobile):** removido `.slice(0, 3)` de `priorityDoses` no `TodayScreen`;
  `BulkDoseRegisterModal` passa a receber o conjunto completo de doses pendentes (não apenas 3).

### 🧹 Limpeza

- Removidos 39 arquivos legados pré-redesign em `apps/web/src/features/dashboard/components/`:
  `DoseZoneList`, `PlanModeZone`, `ZoneSection`, `BatchRegisterButton`, `DoseCard`,
  `SwipeRegisterItem`, `TreatmentAccordion`, `DashboardWidgets`, `StockAlertsWidget`,
  `QuickActionsWidget`, `HealthScoreCard`, `HealthScoreDetails`, `LastDosesWidget`,
  `DailyDoseModal`, `DoseListItem`, `AdaptiveLayout`, `ViewModeToggle`, `StockBars`, `PlanBadge`
  e respectivos CSS, testes e hook `useSmartAlerts`.
- `SmartAlerts` substituído por `InsightCards` no Dashboard (refatoração interna sem impacto visível).

---

## Web v4.15.0 + App v0.21.1 (mobile) — 2026-06-24 — Paridade do chat PWA↔mobile + textos no core (spec 015, Onda 3)

> **Bump:** web `4.14.0 → 4.15.0` (minor — paridade de UX no chat) · mobile `0.21.0 → 0.21.1`
> (patch — welcome deixa de embutir o disclaimer; passa a vir do banner). Textos de UI do chat
> centralizados em `@dosiq/core/chatbot` (fonte única web↔mobile).

### ✨ Melhorias (PWA — paridade com o app nativo)

- **Bolhas alinhadas:** mensagens do usuário à direita, do assistente à esquerda (antes corriam
  centralizadas — o alinhamento era anulado pelo wrapper da lista).
- **Header com identidade:** ícone do assistente + título "Assistente Dosiq IA".
- **Disclaimer em banner** próprio, com fundo amarelo claro (não se confunde com as bolhas ao rolar).
- **"Digitando" animado** (pontos pulsando) no lugar do texto estático.
- **Chips de sugestão** disparam a mensagem direto ao toque (antes só preenchiam o campo).
- **Foco mantido** no campo de texto após enviar (não precisa reclicar a cada pergunta).

### 🐛 Correções

- **Adesão no payload (web):** o chat passava a adesão no shape do Dashboard (`rates.adherence`),
  não no contrato do core (`stats.adherence`) — a linha sumia e o assistente respondia "não tenho
  informações". Normalizado no adapter web.
- Mensagens de erro transitórias (falha de conexão, limite atingido) deixam de poluir o histórico
  persistido — exibidas na tela, não salvas.
- Acesso defensivo à sessão (evita erro raro de inicialização).
- Chave de renderização de mensagem estável (corrige warning de chave duplicada do `AnimatePresence`).

### ⚡ Performance — Groq Prompt Caching

- Reordenação das `messages` enviadas ao Groq (web/mobile + Telegram) p/ maximizar cache hit por
  prefixo: `system` estático (cache global entre usuários) → dados do paciente (estáveis na sessão)
  → histórico → pergunta. Antes o contexto do paciente era embutido no `system`, tornando o bloco
  inteiro por-usuário e quase nunca cacheável.

### 🛠️ Dev

- Proxy do Vite dev (`/api` → `EXPO_PUBLIC_API_BASE_URL`) p/ smoke do chat IA em `vite dev` sem
  rodar o serverless localmente (server-side, sem CORS). Dev-only; build de prod inalterado.

### 🧹 Interno

- Textos de UI do chat (boas-vindas, disclaimer, sugestões) numa fonte única em `@dosiq/core`,
  consumida por web e mobile (fim da duplicação). Guardrails de segurança permanecem server-side.

---

## App v0.21.0 (mobile) + Web v4.14.0 — 2026-06-24 — Assistente IA no mobile + payload cross-superfície enriquecido (spec 015, Onda 2)

> **Bump:** mobile `0.20.1 → 0.21.0` (minor — nova feature: chat IA nativo) · web `4.13.0 → 4.14.0`
> (minor — chat ganha contexto enriquecido + guardrails). Núcleo compartilhado em `@dosiq/core`,
> então as melhorias de payload valem web + Telegram + mobile de uma vez.
> **Release nas lojas:** primeira versão com o Assistente IA dentro do app nativo.

### 📱 Release notes — App Store / Play Store (pt-BR)

```
Novidades da versão 0.21.0

Chegou o Assistente IA do Dosiq no celular:

• Converse com o assistente direto do app: toque no ícone do robô no topo das telas
  Hoje, Tratamentos e Estoque e pergunte sobre suas doses, adesão e estoque.
• Respostas no contexto do seu tratamento — incluindo medicamentos líquidos e injetáveis
  com a unidade certa (mL, UI, gotas) e tratamentos semanais com o dia agendado.
• Limpe a conversa quando quiser começar do zero, com um toque.
• O assistente não substitui orientação médica e nunca recomenda doses.
```

### ✨ Novidades

- **Chat IA nativo (mobile):** `ChatScreen` full-screen com bolhas assimétricas, markdown
  (negrito/itálico/listas), histórico local (AsyncStorage), banner offline, chips de sugestão,
  "digitando…" animado e botão de limpar conversa. Entry-point (ícone `BotMessageSquare`) no
  header das abas Hoje/Tratamentos/Estoque.
- **Markdown compartilhado:** parser puro em `@dosiq/core/markdown` (tokenizer único web↔mobile).

### 🐛 Correções de payload do chatbot (web + Telegram + mobile via core)

- **Tratamentos semanais/PRN/personalizados** voltam a aparecer no contexto: o filtro passou a
  ser por período de vigência (não mais "a frequência cai hoje"), com o dia da semana agendado
  na linha do medicamento.
- **Unidades corretas para líquidos/injetáveis:** estoque, dose e consumo deixam de ser achatados
  em "un." — agora em mL/UI/gotas (ex.: Lantus "5,2 mL", dose "10 UI (≈ 0,1 mL)").
- **Doses pendentes** resolvem o nome do medicamento (fim do "Desconhecido").
- **Consumo diário** arredondado (sem dízimas).
- **Perfil do paciente** (nome/idade) e **dia da semana** entram no contexto quando disponíveis.

### 🔒 Robustez do assistente

- Guardrail de **escopo do app** no system prompt: o assistente não inventa funcionalidades
  inexistentes (ex.: "entrega de medicamentos").
- Contexto **regional Brasil/ANVISA** + `max_tokens` 512 → 1024 (respostas longas não truncam).

---

## App v0.19.1 (mobile) — 2026-06-17 — Alarme: transparência clínica + cancel cross-superfície (spec 036)

> **Bump:** mobile `0.19.0 → 0.19.1` (patch — correção de bug + transparência clínica na tela cheia).
> **Release nas lojas:** agrega as novidades desde a última versão publicada (`0.17.1`) — ou seja,
> `0.18.0` (pressão arterial), `0.18.1` (fix cursor PA iOS), `0.19.0` (histórico integrado) e `0.19.1`
> (alarme). Detalhes técnicos por versão nas seções abaixo e em `[Unreleased]`.

### 📱 Release notes — Apple App Store (pt-BR)

```
Novidades da versão 0.19.1

Mais controle da sua saúde, com lembretes mais seguros:

• Pressão arterial: registre sua pressão (sistólica e diastólica) em segundos, com
  o contexto da medição (em repouso, ao acordar, após exercício...) e acompanhe a
  tendência ao longo do tempo.
• Histórico integrado: glicemia, peso e pressão agora aparecem na sua linha do tempo,
  lado a lado com as doses do dia — edite ou exclua um registro sem sair da tela.
• Alarme mais claro e seguro: a tela do alarme agora mostra a concentração do
  remédio e exatamente quanto tomar, na unidade certa (mg, UI, mL, gotas), com o
  ícone da forma do medicamento.
• Correção importante: o alarme não reabre mais para uma dose que você já registrou
  por outro caminho (linha do tempo, web ou bot) — sem risco de contar a dose duas vezes.
• Pequenas correções e melhorias de estabilidade.

Continuamos cuidando da sua rotina com carinho e zero complicação. 💙
```

### 🤖 Release notes — Google Play (pt-BR)

```
Mais controle da sua saúde e lembretes mais seguros:

• Pressão arterial: registre sistólica e diastólica em segundos, com o contexto da
  medição (em repouso, ao acordar, após exercício) e veja a evolução ao longo do tempo.
• Histórico integrado: glicemia, peso e pressão aparecem na linha do tempo do dia,
  junto das doses — com edição e exclusão direto pela tela.
• Alarme mais claro: agora mostra a concentração do remédio e quanto tomar, na unidade
  certa (mg, UI, mL, gotas), com o ícone da forma do medicamento.
• Correção: o alarme não reabre mais para uma dose já registrada por outro caminho,
  evitando contar a dose duas vezes.
• Estabilidade e pequenas correções.

Cuidando da sua rotina com carinho e zero complicação. 💙
```

---

## App v0.19.0 (mobile) — 2026-06-16 — Histórico Integrado (doses + biomarcadores)

> **Bump:** mobile `0.18.1 → 0.19.0` (minor — nova feature user-facing: biomarcadores na lista do dia). Spec 033.

### 📱 Alterado (mobile)

- **Refactor arquitetural do histórico de doses** (spec 033 — service-first): `useHistoryData.js`
  refatorado para hook fino; lógica de fetch/transform migrada para `historyTimelineService.js`
  (novo service mobile que envolve `createTimelineService` do core — CON-023). Elimina
  `fetchOrphanLogs`, `normalizeOrphanLog` e `enrichInstancesWithProtocol` locais ao hook.
  Deduplicação log↔instância (AP-193) e `localDay` por fuso passam a ser responsabilidade do core.

- **Biomarcadores na lista do dia** (US2/FR-004/FR-005): medidas de glicemia, peso e PA registradas
  aparecem no histórico do dia selecionado, intercaladas com as doses por horário. Novo componente
  `BiomarkerHistoryCard` com ações inline Editar (abre `MeasureLogSheet` sem sair do histórico) e
  Excluir (com confirmação). Chip "X DOSES" continua contando apenas doses (FR-005, ADR-054).

- **KPIs de aderência isolados** (ADR-054): `adherence30d`, `streak` e `dosesThisMonth` calculados
  apenas sobre eventos `type === 'dose'`; biomarcadores não contaminam os cálculos de adesão.

---

## [Unreleased]

### ✨ Adicionado (Chatbot IA — contexto agrupado por plano terapêutico, spec 015 Onda 1b) — web `4.12.0`→**`4.13.0`** (minor) · Telegram · core

- **O contexto enviado ao LLM agora agrupa os medicamentos pelo nome do plano terapêutico** (`treatment_plans.name`): cada plano nomeado ganha um cabeçalho `Plano "<nome>":` com seus itens, fazendo o bot responder pela **intenção** do paciente (os planos que ele nomeou) em vez de inferir por classe terapêutica (US1/FR-002). Vale para as 3 superfícies (web, Telegram e — futuramente — mobile) por consumirem o builder único do core.
- **Tratamentos sem plano nomeado** são listados flat **no início, sem cabeçalho** (sem rótulo "Sem plano" — evita injetar ruído/associação falsa no LLM e gasta menos tokens); os grupos nomeados vêm depois. Quando nenhum tratamento tem plano nomeado, a saída é o **formato legado idêntico** (compat).
- **SemVer:** web minor (`4.12.0`→`4.13.0`, melhoria user-facing no assistente). Telegram bot não-versionado (deploy contínuo). `@dosiq/core` interno. PO-1 + PO-5 fechados; sem migração DB (join `treatment_plan` já trazido na Onda 1a).

### ♻️ Refatorado (Chatbot IA — fetcher + builder de contexto canônicos no core, spec 015 Onda 1a) — core · web (no-user-impact) · Telegram

- **Contexto do paciente do chatbot centralizado em `@dosiq/core/chatbot`** (CON-028 / ADR-074): novo `fetchChatbotContextData({supabase,getUserId})` (selects únicos: medicines+stock, protocols+`treatment_plan`, logs, dose_instances, treatment_plans) + `buildPatientContext(data)` (builder **puro**, agnóstico de runtime) + seam Zod `ChatbotContextData`. Mata os dois forks: `contextBuilder.js` (web) e `buildServerContext`/`fetchPatientData` (Telegram) **removidos** — web `chatbotService` e o bot passam a importar do core. **Sem agrupamento por plano ainda** (Onda 1b).
- **Telegram ganha paridade de contexto:** o bot agora envia `dose_instances` (doses pendentes/atrasadas de hoje) + alertas de estoque + dias-restantes, antes ausentes no fork server-side. **Adesão unificada instances-based** (`taken/(taken+missed)`, R-248) — antes web era 30d-instances e Telegram 7d-logs.
- **Trava-drift:** teste de paridade (`packages/core/src/chatbot/__tests__/parity.test.js`) — mesmo `ChatbotContextData` → string idêntica nas superfícies (PO-5). Guardrails de segurança (systemPrompt + `safetyGuard`) permanecem **server-side**, intactos (AP-237 — `api/chatbot.js` não tocado).
- **SemVer:** sem bump. Web = refatoração sem mudança de comportamento (builder é port exato → output idêntico). Telegram bot não é versionado (deploy contínuo). `@dosiq/core` interno.

### ♻️ Refatorado (ANVISA on-demand — mobile consome o core, spec 037 Slice 2) — mobile `0.20.0`→**`0.20.1`** (patch) · core

- **`useMedicineDatabase` (mobile) passa a consumir os helpers canônicos de `@dosiq/core`** (`fetchJson`/timeout, `shouldRefreshCache`, `resolveDataUrl`, `normalizeText`, `matchesPrefix` — CON-027/ADR-073), matando a triplicação que existia entre mobile e os 2 services web. O hook mantém sua orquestração de 2 fases (cache instantâneo + refresh em background) e o estado de erro — **comportamento idêntico** (rede de segurança `useMedicineDatabase.test.js` 22/22 verde). Persistência via novo `_asyncStorageAdapter` (AsyncStorage, interface CON-027), preservando as chaves de cache em produção.

### 🐛 Corrigido (mobile — categoria regulatória não pré-preenchia no iOS) — mobile `0.20.1` · core

- **Categoria regulatória vazia ao selecionar medicamento da base ANVISA (iOS):** `handleAnvisaSelect` (MedicineFormScreen) usava `item.regulatoryCategory` **cru** da base (sem acento, ex. `Biologico`), mas o Picker — estrito no iOS — só casa o valor canônico acentuado (`Biológico`), deixando o campo em branco (Android tolerava o valor cru). Fix: normalizar via `normalizeRegulatoryCategory` (mesma correção já aplicada na web) — agora exportado também pelo índice `@dosiq/core` (`schemas/index.js`). Mapeia para o enum canônico (fallback `Outros`, nunca vazio). Bug pré-existente, detectado no smoke iOS do 037 Slice 2.

### 🔒 Segurança / Config (subdomínio Supabase fora do código — repo opensource)

- **URL do Supabase deixa de ser hardcoded:** o subdomínio do projeto (`*.supabase.co`) estava embutido em `apps/mobile/src/shared/hooks/useMedicineDatabase.js` e em `scripts/analyze-notifications.js`. Passam a ler de env (`EXPO_PUBLIC_SUPABASE_URL` via `nativePublicAppConfig` no mobile; `SUPABASE_URL`/`VITE_SUPABASE_URL` no script) — alinhado ao padrão já usado no resto do app. AP-242.

### ♻️ Melhorado (ANVISA → wizard de tratamento — começa no passo 1) — web `4.12.0`

- **Wizard de tratamento a partir da busca ANVISA agora inicia no passo 1 (Medicamento), pré-preenchido:** antes, selecionar um medicamento da base ANVISA pulava direto pro passo 2 (Como Tomar), saltando campos fundamentais do cadastro do medicamento que a base ANVISA **não fornece** — concentração, unidade de dosagem, forma de apresentação e TTL (injetáveis). Agora o wizard abre no passo 1 com nome/laboratório/princípio ativo/categoria já preenchidos, e o usuário completa os campos clínicos antes de avançar. Mudança em `useTreatmentWizardState` (`useWizardNavigation(1)`).

### 🐛 Corrigido (ANVISA → wizard de tratamento — prefill de laboratório) — web `4.12.0`

- **Laboratório não pré-preenchia no wizard de tratamento:** ao selecionar um medicamento da base ANVISA na busca da aba Tratamentos (`AnvisaSearchBar`), o `TreatmentWizard` abria com `laboratory` (e `regulatory_category`) vazios para não-genéricos — o payload era montado à mão com só 3 campos, divergindo do mapper canônico `formatSelectedMedicine` usado pelo form de medicines. Fix: reusar `formatSelectedMedicine` nos dois pontos (paridade por construção) + teste de regressão. Bug pré-existente (não regressão do 037). AP-241.

### ✨ Adicionado / ♻️ Refatorado (ANVISA on-demand na web — spec 037 Slice 1) — web `4.11.0`→**`4.12.0`** · core

- **Base ANVISA on-demand na web (paridade mobile):** os services web `medicineDatabaseService` e `laboratoryDatabaseService` deixaram de importar os JSONs da ANVISA do bundle (`medicineDatabase.json` ≈ 1.35 MB + `laboratoryDatabase.json`) e passaram a **baixá-los on-demand do Supabase Storage público** com cache na **Cache Storage API** (versionado por `manifest.json` + TTL 7d). Resultado: **~1.36 MB a menos no build/deploy PWA** (precache caiu p/ 58 entries / 2451 KiB) e a base atualiza sem redeploy da web. API pública dos services **inalterada** (FR-004); degradação graciosa offline sem cache ⇒ autocomplete vazio, form 100% utilizável, sem throw (FR-003/FR-008). Removido o `manualChunks` `feature-medicines-db` do `vite.config.js`.
- **Núcleo compartilhado em `@dosiq/core` (CON-027 / ADR-073):** criado `createAnvisaDatabase({baseUrl,fileKey,storageAdapter,ttlMs,timeoutMs})` + helpers puros (`fetchJson` com timeout/AbortController, `shouldRefreshCache`, `resolveDataUrl`, `normalizeText`, `matchesPrefix`) — extraídos do mobile `useMedicineDatabase`, parametrizados por um **storage adapter injetável**. Web injeta `_cacheStorageAdapter` (Cache Storage, guard `typeof caches` + fallback memória). Mata a triplicação na origem; o consumo pelo mobile (adapter AsyncStorage) vem no **Slice 2**.
- **Fonte de upload movida p/ a raiz:** `git mv` dos 3 JSONs de `apps/web/src/features/medications/data/` → **`data/anvisa/`** (fora do grafo de build, co-locado com o upload). `scripts/process-anvisa.js` (`DATA_DIR`) e o guia de operações `GUIA_UPLOAD_ANVISA_SUPABASE_STORAGE.md` atualizados (FR-007; web como consumidor + nova fonte + path `git-icloud`→`git`).

### ♻️ Refatorado (estrutura web — aposenta naming "redesign", Slice A) — web · no-user-impact

- **Spec 038 / Slice A:** o redesign da experiência do paciente foi entregue, mas a pasta de produção das views ainda se chamava `views/redesign/`. `git mv views/redesign/* → views/` (Dashboard, Stock, Treatments, Medicines, HealthHistory, Settings, Emergency, Profile, Consultation, NotificationInbox + subpastas `history/ profile/ settings/`); artefatos Landing agrupados em `views/landing/`. Atualizados `AppViewRouter` (12 lazy imports), `vite.config.js` (alias `@settings` + manualChunks `HealthHistory`/`Stock`/`Landing`), o resolver `@settings` do `eslint.config.js` (alias duplicado fora do vite — AP-238) e 3 arquivos de teste. Refator puro, sem mudança de comportamento. Slices B (dissolver `*Redesign`/dead code) e C (carve-out + doc) a seguir.
- **Spec 038 / Slice B1:** removido dead code legado (7 componentes pré-redesign com 0 importers: `InsightCard`, `SmartAlerts`, `StockCard`, `MedicineCard`, `ConsultationView`, `ReminderSuggestion` + a base `PrescriptionTimeline` com test/css — testava código morto) e renomeados 4 componentes `*Redesign` collision-free para a base (`RingGaugeRedesign`→`RingGauge`, `CostSummaryRedesign`→`CostSummary`, `PrescriptionTimelineRedesign`→`PrescriptionTimeline`, `BottomNavRedesign`→`BottomNav` — arquivo + css + identificador + importers). −2843 linhas. Refator puro, sem mudança de comportamento. B2 (dissolver pastas `redesign/` + 6 renames com base morta) e C (carve-out + doc) a seguir.
- **Spec 038 / Slice B2:** dissolvidas as 4 pastas `features/{consultation,medications,protocols,stock}/components/redesign/` — conteúdo achatado para `components/` (incl. subpasta aninhada `medicines/` de medications). Renomeados 6 componentes `*Redesign` cujas bases pré-redesign ainda existiam: removida a base morta colidente (`ConsultationSections` legado, 0 importers) e promovido o `*Redesign` para o nome base (`InsightCardRedesign`→`InsightCard`, `SmartAlertsRedesign`→`SmartAlerts`, `ReminderSuggestionRedesign`→`ReminderSuggestion`, `MedicineCardRedesign`→`MedicineCard`, `ConsultationViewRedesign`→`ConsultationView`, `StockCardRedesign`→`StockCard` + exports internos `Redesign*Section`→`Consultation*Section`). Imports/aliases (`@medications`/`@stock`/`@protocols/components/redesign/*` → sem `/redesign/`) e importers das views atualizados. Pasta `redesign/` extinta em `features/`. **Deferido p/ Slice C:** classes CSS BEM `*-redesign__*` e arquivos `*Redesign` ainda em `views/{settings,emergency,profile,history}/`. Refator puro, sem mudança de comportamento.
- **Spec 038 / Slice C (carve-out + doc):** (1) **Carve-out** — `deriveProtocolStatus` (lógica de vigência de prescrição inline em `views/Stock.jsx`) extraída para `@dosiq/core` como `derivePrescriptionStatus` (`packages/core/src/utils/prescriptionStatus.js`) com 7 testes unitários e enum `PRESCRIPTION_STATUS`; web passa a importar do core (paridade web↔mobile, R-279). (2) **views/*Redesign** — deletados 3 componentes dead (`ProfileLinkRedesign`, `ProfileSectionRedesign`, `ProfileHeaderRedesign`, 0 importers) e renomeados 4 CSS (`{Settings,Emergency,Profile,History}Redesign.css` → sem sufixo) + limpos identificadores/comentários `*Redesign` nas views. `apps/web/src` agora com **0 arquivos `*Redesign`**. (3) **Doc** — `R-279` (lógica de domínio não nasce em `views/`) + `CLAUDE.md` raiz (views/ = camada de composição, alias `@settings`). **Deferido (cosmético):** classes CSS BEM `*-redesign__*` ainda em uso. Refator puro, sem mudança de comportamento.

### 🐛 Corrigido (Chatbot IA — render de markdown) — web · UI

- **Render de markdown nas respostas do chat:** ao liberar markdown nas respostas do bot (endurecimento abaixo), o componente `ChatMessageList` só renderizava `_itálico_` — `**negrito**` e listas apareciam crus (`**Pregabalina**`, `- item`). Estendido o parser inline próprio (sem dependência nova, zero XSS/bundle): `**negrito**`→`<strong>`, listas `-`/`*`→bullet `• `, mantido `_itálico_` e quebras `\n`→`<br/>`.

### 🔒 Segurança / ✨ Melhorado (Chatbot IA — endurecimento) — web `4.10.0`→**`4.11.0`** · backend/infra · Telegram

- **Segurança (A):** `api/chatbot.js` agora exige **autenticação** (Supabase JWT, `Bearer` → `getUser`; 401 sem token) — antes era endpoint aberto (abuso anônimo da quota Groq). O **system prompt passa a ser composto NO SERVIDOR**: o cliente envia apenas `patientContext` (dados, sem PII/IDs), nunca o prompt inteiro — fecha o bypass das "REGRAS ABSOLUTAS" (um POST direto podia remover os guardrails SaMD). Adicionados **safety guard** (`CHATBOT_BLOCKED_PATTERNS` → 422) e **rate limit por usuário** server-side (Map em memória, padrão `beta-signup`). AP-237.
- **Contexto (B):** o contexto do paciente passa a considerar **somente tratamentos ativos com prescrição válida na data** (`p.active && isProtocolActiveOnDate(p, hoje)`) — corrige o bot sugerir repor estoque de cursos já finalizados/pausados. Por medicamento, inclui **consumo diário + dias restantes** (runway relativo), não só o total. Adiciona **próximas doses pendentes + atrasadas** (`splitDayTimeline`, core) e dose **líquido-aware** (`formatDoseItem`: gotas/ml/UI). Seção "Atenção de estoque". R-278.
- **Modelo/Params/Prompt (C):** modelo padrão `groq/compound` → **`meta-llama/llama-4-scout-17b-16e-instruct`** (sem web search — alinha grounding clínico e contorna o RPD baixo do compound; `GROQ_MODEL` na Vercel permite A/B com `openai/gpt-oss-120b`). `max_tokens` 300 → **512**. **Prompt de dois níveis**: fatos do paciente com grounding rígido; conhecimento geral (pra que serve / como age / genérico vs marca) permitido em nível educativo, ancorado no princípio ativo + classe terapêutica; guardrails SaMD reforçados (ADR-062). Cold-start atualizado.
- **Paridade Telegram:** `chatbotServerService` recebe modelo, `max_tokens`, prompt de dois níveis e escopo de tratamento ativo. (Próximas/atrasadas + runway + líquidos no Telegram ficam como follow-up — exigem buscar `dose_instances` na camada do bot.)
- **Doc:** `docs/architecture/CHATBOT_AI.md` atualizado (seção "Atualização 2026-06").

### 🧹 Limpeza / 🐛 Corrigido (web — pós-redesign) — web `4.11.0`

- **Dead code:** removidas views legadas não referenciadas por nenhum menu/CTA após o redesign — `views/Medicines.{jsx,css}`, `views/Settings.{jsx,css}` (substituídas por `views/redesign/*`) e toda a subárvore da view `protocols` (`Protocols.{jsx,css}`, `ProtocolsContent`, `ProtocolsModals`, `ProtocolsTreatmentPlans`, `useProtocolHandlers`) — inalcançável (a navegação para "protocols" virou "treatment"). Limpeza do threading `initialProtocolParams` em `App.jsx`/`AppViewRouter.jsx`.
- **Design system:** CTAs com gradiente/neon legado migrados para tokens sanctuary — `Button.css` `.btn-primary` (verde) e `.btn-danger` (vermelho), corrigindo "+ Novo" (Tratamentos), "+ Adicionar" (Medicines), botões "Excluir" dos cards e submits "Cadastrar"/"Atualizar" dos forms.
- **Navegação:** botão "← Tratamentos" na view secundária Medicines (alcançada via Tratamentos).
- **ANVISA autocomplete:** `normalizeRegulatoryCategory` (core) mapeia a categoria regulatória da base (sem acento/dados sujos: "Biologico", "Generico"…) para o enum canônico acentuado — corrige o campo "Categoria Regulatória" não preencher ao selecionar medicamento não-genérico.

### ✨ Adicionado (031 — Rotação de sítio de aplicação, slice A) — web `4.10.0` · core · mobile
- **Sítio de injeção** registrável na tomada de injetáveis (`medicine_logs.injection_site`,
  8 sítios anatômicos PT, opcional/nullable). Detecção por `presentation === 'injetavel'`.
- **Rotação global** cross-medicamento: "última aplicação" no formulário (mais recente por
  `taken_at`, sem filtro de medicamento) + alerta não-bloqueante ao repetir o último local.
- **Histórico** (web + mobile) exibe o local da dose; oculto quando ausente (oral/legado).
- **Hint educacional** de absorção por sítio (não-SaMD; sem recomendação de sítio).
- Core: util `injectionSites`, `logSchema.injection_site` (sync c/ CHECK), RPCs
  `register/update_dose_atomic` com `p_injection_site`, `getLastInjectionSite`.
- Migração `20260621_injection_site.sql` (aditiva + CHECK + índice parcial; reversível).
- ADR-072.

### ✨ Adicionado (031 — slice B) — mobile `0.20.0` · web `4.10.0` · core
- **Editar/adicionar sítio pós-registro** (FR-011): web via `LogForm` (edição do histórico);
  mobile via `DoseActionSheet` para **qualquer status** — `taken`, `missed` ou `pending`. Editar
  uma dose `missed` registra retroativamente já com o sítio (paciente sem app/conexão na hora),
  sem alterar `taken_at`. Core `update_dose_log_atomic` ganha `p_has_injection_site` (flag de
  presença: distingue "não enviado" de "limpar para NULL").
- **Registro em lote per-item** (mobile `BulkDoseRegisterModal`): cada injetável marcado escolhe
  o próprio sítio — canetas aplicadas no mesmo horário não podem compartilhar o mesmo local.
- **Paridade mobile US2/US3**: "última aplicação" + alerta não-bloqueante de repetição nos 3
  pickers mobile (single/lote/edição); `getLastInjectionSite` exposto no `doseService`.
- **Hint de absorção** trazido para os pickers mobile (web já tinha).
- **Ícones**: emoji `📍`/`⚠️` substituídos por lucide (`LocateFixed`/`AlertTriangle`) no histórico
  (web + mobile) — alinhado à diretriz de só-lucide do projeto.
- Decisão: alarme de tela cheia mantém ação de 1-toque (mínima fricção); sítio é editável depois
  pela sheet do histórico.

---

## App v0.19.3 (mobile) & Web v4.9.2 — 2026-06-20 — Faxina de Complexidade e Tamanho do ESLint (Waves 1-3)

> **Bump:** mobile `0.19.2 → 0.19.3` (patch), web `4.9.1 → 4.9.2` (patch), core/infra preventivos.
> **Release notes:** Refatoração global preventiva para atingir conformidade estrita com as regras de ESLint de complexidade ciclomática e tamanho de funções em todas as superfícies (core, server/bot, web, mobile), sem alteração de comportamento clínico ou visual.

### 📱 Alterado (mobile)
- **Refatoração de telas e hooks** para eliminar warnings de complexidade ciclomática e tamanho de funções:
  - `TodayScreen.jsx`: extraído `TodaySummary` e `NoDosesEmptyState`.
  - `BulkDoseRegisterModal.jsx`: extraído seletor de doses e botões de rodapé.
  - `DoseActionSheet.jsx`: simplificação de handlers e extração de botões de tomada de dose.
  - `historyTimelineService.js`: extraído helper `_getProtocolProperties`.
  - `MedicineDetailScreen.jsx`: extraído hook `useMedicineDetailState`.
  - `MedicineSelectorSheet.jsx`: extraído `MedicineSelectItem` e `EmptySheetContent`.
  - `ProtocolFormBody.jsx`: extraído hook `useProtocolFormDerived` e subseções do formulário.
  - `TreatmentCard.jsx`: simplificadas checagens condicionais.
  - `TreatmentsScreen.jsx`: extraído hook `useTreatmentsScreenState` e listas de protocolos ativos/arquivados.
  - `Navigation.jsx`: extraído hook `useAuthSession`.
  - `SignupScreen.jsx`: extraído `SignupBrandmark`, `SignupInfoCard`, `SignupConfirmHint` e `SignupTerms` (mantendo os inputs inline para evitar perda de foco).
  - `alarmService.js` e `authService.js`: simplificadas construções de strings e mapeamentos de erros.

### 💻 Alterado (web/PWA)
- **Refatoração de views e utilitários** para eliminar todos os warnings do ESLint:
  - `_medicineFormUtils.js`: simplificação de `getInitialFormData` utilizando um mapeamento flat com o operador `??` para reduzir complexidade de branches.
  - `NudgesAdmin.jsx`: extraído `NudgesHeader` e `NudgeEmptyState` para reduzir a quantidade de linhas do componente principal.
  - `useNudgesAdminState.js`: extraído sub-hooks `useNudgeFilters` and `useNudgeActions` para segregação de responsabilidades de paginação/filtros e mutações de CRUD.
  - Demais componentes refatorados nas waves anteriores: `App.jsx`, `AppViewRouter.jsx`, `MeasureLogModal.jsx`, `MedicineFormDosageInfo.jsx`, `ProtocolForm.jsx`, `TitrationWizard.jsx`, `ProtocolFormDosesSection.jsx`, `TreatmentWizardStep2.jsx`, `_stockFormUtils.js`, `StockCardRedesign.jsx`, `StockFormMedicineDetails.jsx`, `_stockDataTransformer.js`, `FeedbackAdmin.jsx`, `NudgeFormModal.jsx` e `HealthHistory.jsx`.

### ⚙️ Alterado (core e backend)
- Refatoração dos utilitários `doseUnit.js`, `doseZones.js` e `titrationUtils.js` no pacote `@dosiq/core`.
- Refatoração do scheduler e mappers em `server/bot/_reminderHelpers.js`, push notification channels (`expoPushChannel.js`, `webPushChannel.js`), payloads de notificação (`buildNotificationPayload.js`) e api handlers (`admin.js`, `feedbacks.js`).


### 035 — Refactor: Dose-Log + Stock unificado e ATÔMICO no core (PR #TBD)

> **Decisão (Option A, ADR-071):** a orquestração de tomada de dose passa a rodar dentro de
> **uma única transação Postgres** por operação (RPCs `register_dose_atomic` /
> `update_dose_log_atomic` / `delete_dose_log_atomic`). Elimina na origem a janela de log
> órfão / furo de estoque (classe **AP-231**) — sem rollback compensatório `insert→delete`
> em JS, que era o padrão que ambas as plataformas duplicavam.

#### Banco de dados (migração)
- **Added** (`minor`): `docs/migrations/20260619_atomic_dose_logging.sql` — 3 RPCs `SECURITY DEFINER`
  (`SET search_path = ''`, isolamento de tenant via `auth.uid()`, grants `authenticated`/`service_role`)
  que compõem `consume_stock_fifo`/`restore_stock_for_log` numa transação maior. Ancoragem estrita
  (tomada direta numa ocorrência → double-click aborta a transação inteira, Edge Case #1) vs
  best-effort (snap retroativo/avulsa). `update_dose_log_atomic` usa flags de presença
  (`p_has_notes`/`p_has_protocol`) para permitir limpar campos nullable para NULL no edit.

#### Core (@dosiq/core)
- **Added** (`minor`, CON-026): Factory `createDoseLogService` (`packages/core/src/services/doseLogService.js`)
  unifica registrar/desfazer/atualizar/excluir delegando 100% da atomicidade estoque↔log↔ocorrência às
  RPCs transacionais. JS retém apenas validação Zod e snap de instância (`findAnchorInstance`).
  Tolerância de undo/delete unificada em `DEFAULT_TOLERANCE_MINUTES` (120) com fallback à tolerância
  da própria ocorrência (resolve divergência 30 vs 120 min).

#### App mobile (mobile)
- **Changed** (`patch`): `doseService.js` vira casca fina sobre o core. Mantidos side-effects locais
  (`_ERR_OFFLINE`, `_cancelAlarmBestEffort`, Firebase `logEvent`). Cancelamento de alarmes em lote
  passa a casar pelo `instanceId` ecoado em cada resultado (sem acoplamento posicional). Removido
  o teste obsoleto `apps/mobile/src/__tests__/doseService.undoDose.test.js`.

#### App web (@dosiq/web)
- **Changed** (`patch`): `logService.js` delega mutações ao core. Mantida a consulta das relações
  `protocol`/`medicine` pós-escrita para preservar a retrocompatibilidade visual do front-end.

### Adicionado
- **Pressão arterial como medida** (spec 032, mobile `0.18.0` + web `4.9.0`): registro com 2 campos
  (sistólica "por" diastólica, mmHg), contexto opcional (ao acordar / em repouso / indo dormir /
  após exercício / após medicação), tendência com 2 séries (sistólica + diastólica, cores neutras —
  sem classificação de risco, SaMD) e exibição composta "120 por 80 mmHg" em toda a UI de medidas
  (mobile + web; cards mostram rótulo curto "Pressão" + data/hora no histórico).

### Alterado
- **`biomarkers_log.context` agora é domínio extensível** (ADR-070): removido o `CHECK` do banco;
  o Zod (core) passa a ser a autoridade única do conjunto de contextos por família de biomarcador,
  igual a `type`/`source`. Encerra a necessidade de migração a cada nova família de contexto.
- Formatação de medidas unificada no core (`formatBiomarkerDisplay`/`formatBiomarkerContext`) —
  consolida 4 cópias locais; padrão de PA passou de "120/80" para "120 por 80".

### Corrigido
- **Alarme reabria numa dose já registrada** (spec 036, mobile `0.19.1`): ao tirar soneca de um
  alarme crítico e marcar a dose como tomada por outra superfície (timeline/FAB do app) antes do
  re-disparo, o alarme de tela cheia voltava a abrir numa dose já resolvida, forçando Tomei/Soneca/
  Pular (risco de dupla contagem / status corrompido). Agora registrar a dose por qualquer via
  cancela o alarme local (incl. soneca/nag pendentes), e a tela cheia se fecha sozinha quando a dose
  não está mais pendente. **Transparência clínica:** a tela cheia passa a mostrar a concentração do
  medicamento e a quantidade a tomar, na unidade correta (mg/UI/mL/gotas), no modo single e agrupado.
  No modo single, o ícone agora reflete a forma/tipo do medicamento (mesmo ícone das demais telas,
  ex.: seringa p/ injetável) e o layout foi reordenado: ícone → "Hora da dose" → horário → nome +
  concentração → "Dose:" + quantidade.
- **Cursor do campo de PA no iOS** (mobile `0.18.1`): ao abrir o sheet de medida em PA ou trocar de
  tipo, o cursor não aparecia na sistólica e o teclado fechava. Causa: a árvore do input era trocada
  por tipo (desmontava o campo focado) e o placeholder divergente (`120`/`80`) re-media o input,
  sumindo o caret. Agora o campo do valor é o mesmo elemento em todos os tipos (foco/teclado
  persistem) e o placeholder é `0` em todos.

> **Migração:** `20260616_drop_biomarker_context_check.sql` (`DROP CONSTRAINT` — só afrouxa; valores
> legados permanecem válidos; sem migração de dados).

---

## App v0.17.0 (mobile) — 2026-06-15 — Suporte a Diabetes Tipo 2 (épico 012 A→D)

> **Bump:** mobile `0.16.6 → 0.17.0` (minor — fechamento do épico 012). `versionCode`/`buildNumber` = `1700`.
> Consolida as Fases A–D do épico 012 (injetáveis + validade biológica, GLP-1/titulação, biomarcadores,
> insulina basal) entregues ao longo das 0.16.x, agora publicadas como release minor única.

### 📱 Release notes — Apple App Store (pt-BR)

```
Novidades da versão 0.17.0

Agora o Dosiq cuida de quem tem diabetes tipo 2 — de ponta a ponta:

• Canetas e injetáveis: cadastre insulina e GLP-1 (Ozempic, Mounjaro, Wegovy) com a dose na
  unidade certa (UI, mg) e acompanhe a validade após aberto da caneta/frasco.
• Glicemia e medidas: registre glicemia, peso e outras medidas em segundos e veja a evolução
  na sua linha do tempo, junto das doses.
• Estoque inteligente: o app mostra quantas aplicações restam (não mililitros soltos) e avisa
  com antecedência quando está acabando.
• Titulação guiada: tratamentos com aumento gradual de dose avançam sozinhos conforme o
  cronograma do seu médico.
• Lembretes mais claros: notificações de dose de líquidos agora mostram a dose exata (ex.: 10 UI).

Continuamos cuidando da sua rotina com carinho e zero complicação. 💙
```

### 🤖 Release notes — Google Play (pt-BR)

```
Suporte completo a diabetes tipo 2 no Dosiq:

• Insulina e GLP-1 (Ozempic, Mounjaro, Wegovy) com dose em UI/mg e controle de validade da
  caneta após aberta.
• Registro rápido de glicemia, peso e outras medidas, com tendência ao lado das doses.
• Estoque em "aplicações restantes" e aviso antecipado de recompra.
• Titulação que avança sozinha conforme o cronograma do médico.
• Lembretes de dose de líquidos mais precisos (ex.: 10 UI).

Simples para quem mais precisa. 💙
```

> **Notas de loja (internas):** release sem mudança de permissões. Sem novos dados sensíveis além de
> `biomarkers_log` (já declarado no fluxo de privacidade). Screenshots sugeridas: tela de medidas,
> card de caneta com validade, lembrete de insulina "10 UI".

---

## [Unreleased]

### 030 — Histórico expõe doses avulsas/PRN + fixes de mutação de log (PR #668)

#### Core (@dosiq/core)
- **Fixed** (`patch`): `isCoveredBySlot` (`timelineService`) construía slots de tolerância temporal para instâncias `taken`, suprimindo uma segunda dose real do dia como "duplicata" (caso Lantus 09/jun, 63min após `scheduled_for`, tol 120min). Slots agora só para `pending`/`missed`; `taken` já deduplica via `collectConsumedLogIds` (AP-193 bidirecional).

#### App web (@dosiq/web 4.8.0 → 4.8.1 — patch: correção de bug)
- **Fixed** (`patch`, AP-231): **ghost taken** — `logService.delete` deletava o `medicine_log` sem reverter a `dose_instance` ancorada. A FK `ON DELETE SET NULL` limpava `medicine_log_id` mas deixava `status='taken'` → dose fantasma no histórico (sem edit/delete) contando como tomada. Agora reverte para `missed`/`pending` (por janela de tolerância) pós-delete.

#### App mobile (0.17.0 → 0.17.1 — patch: correção de bug)
- **Added** (`patch`, US1/US2/US6): histórico expõe **doses avulsas** (logs sem `dose_instance`) e **PRN**; ícone `CircleCheckBig` + chip textual de status no detalhe; editar/excluir de avulsa opera no `medicine_log_id` (não `dose_instance_id`).
- **Fixed** (`patch`, AP-231): **furo de estoque** — `useHistoryMutation` mutava `medicine_logs` direto via cliente, bypassando o FIFO. Lógica movida para `doseService.updateOrphanLog`/`deleteOrphanLog` (service-first): restaura+reconsome estoque (`restore_stock_for_log`/`consume_stock_fifo`), espelhando `logService` web + `undoDose`.
- **Fixed** (`patch`): hint de equivalência de dose **líquida injetável** no `DoseActionSheet` usava `formatActiveIngredientFormula` (multiplicava `qty × dosage_per_pill`, ex.: 10 UI → "1.000 ui/ml"); agora `formatIntakeDose` p/ líquidos (ex.: "10 UI ≈ 0,1 ml").
- **Fixed** (`patch`, review #668): `parseFloat` da quantidade não sanitizava **vírgula decimal PT-BR** (`1,5` → `1`); janela UTC de busca de avulsos (`T00/T23:59Z` sobre data local) perdia doses na borda por fuso (GMT-3 pós-21h cai no dia seguinte em UTC) → busca expandida ±1 dia, agrupamento por dia local no filtro em memória.

### 012 Fase D — Frase de dose líquida nos pushes (FR-015b)

#### Backend/serverless (notificações — `no-user-impact` de versão; correção de texto)
- **Fixed** (`patch`, FR-015b/R-272): **resumo diário** (`daily_digest`) exibia dose líquida como `1 un.` (lossy) e em minúsculas. O `formatDose` local de `_payloadBuilders.js` foi substituído pelo formatter core `formatDoseItem` (`@dosiq/core`) → unidade de tomada real (`gotas`/`ml`/`UI`/`mg`) + `≈ ml`, case canônico (`UI` maiúsculo). Read-path do digest (`_reminderHelpers.js`) passou a trazer `intake_unit`+`units_per_ml`+`dosage_per_pill` no SELECT/shape (R-267); `dailyDigestDataSchema.medicines[]` ganhou os campos (aditivo — R-193).
- **Fixed** (`patch`, FR-015b/R-272): lembrete de dose (`dose_reminder`/`_by_plan`/`_misc`) — concentração na frase com case canônico (`ui/ml` → `UI/ml`) via `DOSAGE_UNIT_LABELS` em `formatMedicineDescription`.
- **Removed** (`no-user-impact`): código morto `buildDoseReminderPayload` + helper `formatDose` local (sem caller; substituídos pelo caminho `formatMedicineDescription`/formatters core).
- **Fixed** (`patch`): relatório matinal de adesão (`adherence_report`) dizia "vs ontem" na comparação, mas os dados são de ontem → a base é **anteontem**. Texto corrigido para "vs anteontem" (o builder já comparava `yesterday` × `beforeYesterday`).
- **Changed** (`patch`): supressão hierárquica de overlap dos relatórios (decisão PO 2026-06-15). Os 3 relatórios disparam 09:00 (tz do user) → domingo colidia diário+semanal; dia 1 (se domingo), os 3. Agora **maior granularidade vence**: dia 1 → só mensal (suprime semanal+diário); domingo → só semanal (suprime diário); demais dias → diário. Janela maior cobre a menor (semanal 7d ⊇ ontem; mensal 30d ⊇ semana). Supressão tz-aware em `_getEligibleUsersForAdherence` (diário) e `checkAdherenceReportsViaDispatcher` (semanal cede ao mensal no dia 1). Corrige tb. comentário stale `ADHERENCE_REPORT_TIME` (era "23:00"; valor real `'09:00'`).

### 012 Fase C — Biomarcadores: registro, timeline mista e Área de Medidas (PR 3a — mobile-first)

#### DB (migração prod — `20260614_diabetes_c_biomarkers.sql`)
- **Added** (`minor`, ADR-060/CON-025): tabela `biomarkers_log` (genérica: `type`/`value`/`value_secondary`/`unit`/`measured_at`/`context`/`source`/`notes`) + índice `(user_id, measured_at DESC)`, RLS (4 policies `auth.uid()`), REVOKE anon e grants `authenticated`/`service_role`. `type`/`source` sem CHECK (extensível ADR-060); `context` com CHECK (jejum/pre_refeicao/pos_refeicao/ao_deitar/outro). v1 UI = glicemia + peso (PA schema-ready, sem UI).

#### Core (@dosiq/core)
- **Added** (`minor`, ADR-060): `biomarkerLogSchema` (enums TYPES/CONTEXTS/SOURCES/UNITS/LABELS; `Create`/`Update` partial sem refine — R-274; preprocess `'' → null`; `applyPaRefine` p/ PA); `createBiomarkerRepository` (DI cross-platform R-231: `list`/`getLatest`/`create`/`update`/`remove`, `measured_at` ausente → DB DEFAULT now() p/ R-020); `biomarkersToEvents` (adapter puro p/ timeline) + `TIMELINE_EVENT_TYPES.BIOMARKER`.

#### App mobile (0.16.5 → 0.16.6 — patch: fase do épico 012)
- **Added** (`minor`, FR-010/FR-011): feature **Medidas** — hub "Histórico de Medidas" (chips glicemia/peso, tendência ScatterTrend com escala Y e dias do mês, lista de cards, detalhe Editar/Excluir com data/hora editável); fast-log `MeasureLogSheet` (layout idoso-primeiro, vírgula PT-BR, contexto p/ glicemia); speed-dial do FAB (dose · medida); **interleave** das medidas do dia na Agenda de Hoje (simple+complex, auto-update ao salvar); card "Última medida" do dia com nudge "Registre a primeira" quando vazio.
- **Fixed** (`patch`): edição de tratamento **não-líquido** bloqueada por `intake_unit=''` (falhava `z.enum`) → usa `null`; cross-tab nav do card "Última medida" prendia a aba Perfil (2 passos via `navigationRef`, mesmo padrão do 028); teclado iOS cobria os botões do sheet (`KeyboardAvoidingView`); seletor "+" de horário (form de tratamentos) abre na **hora atual** do device (era 08:00 fixo).

#### App web (@dosiq/web 4.7.0 → 4.8.0 — minor: espelho web da feature)
- **Added** (`minor`, FR-010/FR-011/FR-011b — PR 3b): espelho web dos biomarcadores. Camada de dados (`measuresRepo` via `createBiomarkerRepository` + `useMeasures`/`useTodayMeasures`); **timeline mista** — `getMonthTimeline` mescla biomarcadores como eventos `biomarker` (adapter `biomarkersToEvents` + `buildTimeline`, CON-025 web-only) renderizados por `BiomarkerEventCard` (registro tintado) via `eventCardRegistry`; **fast-log** `MeasureLogModal` (layout idoso-primeiro, vírgula PT-BR via `coerceDecimal`/R-276) + **FAB** "Registrar medida" no Dashboard; card **"Última medida"** no fim da agenda + nudge de dia vazio; **Área de Medidas** embutida no Histórico (chips glicemia/peso, `ScatterTrend` SVG 7d com WeekNav e média descritiva — sem zona/meta SaMD, lista cronológica, editar/excluir). Reusa `formatTimePtBR`/`formatDateTimePtBR` do core. Estado-zero + transparência radical de erro (FR-012b). v1 UI = glicemia + peso.

### 012 Fase B4 — `injection_container` por lote (slice 3: T044b / FR-030 / ADR-068)

#### DB (migração prod — `20260613_b4_injection_container_por_lote.sql`)
- **Changed** (`minor`, FR-030/ADR-068): `injection_container` (apresentação física do injetável) migra de **medicine-level** → **LOTE**. Novas colunas `stock.injection_container` e `purchases.injection_container` (+ CHECK do enum); valores dos 3 medicines existentes copiados para seus lotes; RPC `create_purchase_with_stock` ganha `p_injection_container` (append no fim — AP-221) gravando nas duas tabelas no INSERT atômico; **DROP `medicines.injection_container`** + CHECK. Motivo: a apresentação é atributo da compra (paciente troca caneta↔refil entre lotes), não do medicamento — fonte única no lote evita drift.

#### Core (@dosiq/core)
- **Changed** (`minor`, ADR-068): `medicineSchema` perde `injection_container`; `stockCreateSchema` ganha (`enum` nullable, sync com CHECK — R-271). Repo `createPurchase`/`createLiquidPurchase` passam `p_injection_container`; `updatePurchase` grava em `purchases` **e** propaga ao lote `stock` vinculado.

#### Web (4.6.0 → 4.7.0) / App mobile (0.16.4 → 0.16.5 — patch: fase do épico 012)
- **Changed** (`minor`, ADR-068): forms de compra (web `StockForm`/`_useStockFormState`/`_stockFormUtils`; mobile `PurchaseFormScreen`) perguntam a apresentação em **toda compra** de injetável (não só na 1ª) e gravam no lote via RPC — sem mais `medicineService.update` best-effort. Rendimento do card (`_stockDataTransformer`) deriva a apresentação do **lote ativo** (aberto mais antigo, fallback 1º lote com valor).

### 012 Fase B4 — estoque dose-primário (slice 2: core + web + mobile)

#### Core (@dosiq/core)
- **Added** (`minor`, FR-026/ADR-067): `stockDoseMetrics(qty, protocols, medicine)` — modelo dose-primário: `dosesRemaining` (doses físicas, número exibido), `runwayDias` (dias corridos derivados via `frequencyDailyFactor`), `dosesPorDia`, `isDaily`. `cleanFloat` antes do floor (R-277).
- **Fixed** (`patch`, R-277/AP-226): `formatActiveIngredientShort` envolve `qty × dosagePerPill` em `cleanFloat` — artefato de float (`1,5×0,1=0,150000…2`) vazava pro chip de estoque.

#### Web (4.5.0 → 4.6.0) / App mobile (0.16.3 → 0.16.4 — patch: fase do épico 012, convenção 0.16.x)
- **Changed** (`minor`, FR-028/ADR-067): chips/cards de estoque e card de tratamento exibem **"N doses"** (não "N dias") para frequência ≠ diária; a **cor/status** continua medindo `runwayDias` (recompra cronológica). Diário inalterado ("N dias"). Web: `StockPill`/`StockCardRedesign`; Mobile: `StockLevelBadge`/`StockItem`/`StockDetailScreen`.
- **Fixed** (`patch`, ADR-067): card de tratamento web colorava por `daysRemaining` do `predictRefill` (sem fator de frequência → "0 dias" no Mounjaro); agora `predictRefill` aplica `frequencyDailyFactor` e a cor usa `runwayDias` do modelo dose-primário — converge com o card de estoque.
- **Added** (`minor`, FR-027): `costAnalysisService` expõe `custoPorDose`/`custoPorDia`/`dosesPorDia` (custo/dose primário — R$425, fim do "R$0,07/dia" ilegível). Schema de custo ganha `frequency`/`weekdays`/`dosage_per_pill` — sem eles o `safeParse` stripava e a cadência/conversão mg caíam errado (AP-214).

#### Backend/Infra (bot — Telegram /estoque)
- **Fixed** (`no-user-impact`, FR-013c/ADR-067): comando `/estoque` somava a dose crua (UI/gotas) contra o saldo em ml (mesma raiz do cron, slice 1); agora usa `calculateDailyIntake` + `stockDoseMetrics` e exibe doses + runway-contexto.

#### Reports (PDF de consulta)
- **Changed** (`patch`, FR-029): seção de atenção de estoque exibe doses físicas + runway entre parênteses para freq ≠ diária (`_pdfSectionBuilders`/`consultationPdfDataBuilder`).

> **Nota:** FR-030 (`injection_container` por lote + DROP em `medicines`) entregue na slice 3 acima (PR dedicado, migração prod).

### 012 Fase B4 — estoque dose-primário (slice 1: serverless)

#### Backend/Infra (bot cron — serverless)
- **Fixed** (`no-user-impact` de versão app; risco clínico, FR-013c/ADR-067): o cron de alerta de estoque (`_processUserStockAlert` em `server/bot/_reminderHelpers.js`) somava a dose na **unidade de tomada crua** (UI/gotas) contra o saldo em **ml** → `floor(ml ÷ UI)` = "0 dias" falso para insulina/GLP-1 (ex.: Lantus 5,3 ml com 10 UI/dia disparava alerta crítico quando ainda restam ~53 dias). Agora reusa `calculateDailyIntake` (converte intake→ml via `doseToMl` unit-aware + aplica `frequencyDailyFactor`) e `calculateDaysRemaining` do `@dosiq/core`. Read-path completo (R-267): selects do cron passam a trazer `protocols.intake_unit`/`active` e `medicines.units_per_ml`/`dosage_unit`/`dosage_per_pill`.
- **Fixed** (`no-user-impact`): payload `stock_alert` exibia o saldo cru em ml rotulado como "doses" ("Restam 5,3 doses"); agora exibe a contagem real de **doses** (`floor(saldo ÷ tamanho da tomada)`, com `cleanFloat` antes do floor — R-277).

### 012 Fase B3 — units_per_ml NULL + fallback unit-aware + concentração com denominador

#### Backend/Infra (DB + RPC)
- **Changed** (`minor`, ADR-065): migração `20260613_b3_units_per_ml_null_denominador.sql` (prod) — `medicines.units_per_ml` perde o DEFAULT `20` (blanket) e nasce `NULL`; backfill derivado da unidade de tomada do tratamento (UI→100, gotas→20, demais→NULL). `consume_stock_fifo` converte gotas/UI com densidade **unit-aware** (gotas≈20, UI≈100) em vez do `COALESCE(...,20)` cego — corrige conversão de insulina (UI) 5× errada quando a densidade falta. Assinatura intacta.
- **Added** (`minor`, ADR-066/FR-031): coluna `medicines.concentration_volume_ml` (NUMERIC, nullable; NULL = "por 1 mL") — volume do rótulo da concentração; seed do modelo (amount, volume) futuro.

#### Core (@dosiq/core)
- **Added** (`minor`, FR-024): helper `densityFor(intakeUnit, unitsPerMl)` — densidade unit-aware (explícita > gotas 20 > UI 100 > null). `doseToMl` e `formatIntakeDose` passam a usá-lo (fim do fallback 20 cego).
- **Changed** (`minor`, FR-031): `formatConcentrationLabel(mgPerMl, volumeMl=1)` reconstrói "amount mg em volume mL" (Mounjaro razão 5 + volume 0,5 → "2,5 mg em 0,5 mL"); compatível com a Fase B2 (volume 1). Schema `medicineSchema` + `concentration_volume_ml` (nullable, R-082).

#### Web (4.5.0) / Mobile (0.4.0) / App (0.16.3)
- **Added** (`patch`, FR-031): form de medicamento ganha campo "Volume da concentração (mL no rótulo)" para líquidos (default 1 mL; muda só p/ Mounjaro etc.). Normaliza `dosage_per_pill = amount ÷ denominador` ao salvar e reexibe o `amount` do rótulo na edição. Validação impede denominador ≤ 0. Inputs decimais PT-BR (R-276).

### 012 Fase B2 — correções do smoke (2026-06-12)

#### Core (@dosiq/core)
- **Fixed** (`patch`, segurança clínica): `medicineUpdateSchema` não reintroduz mais os `.default()` de `presentation`/`type` em update parcial — no Zod v4 `.partial()` mantém o default, e qualquer update parcial (ex.: gravar `injection_container`) FLIPAVA `injetavel→comprimido` (líquido→sólido) no banco. `presentation`/`type` viram optional sem default no path de update; defaults seguem só no create. Testes anti-flip.
- **Added** (`minor`, FR-019): `'refil'` no enum `INJECTION_CONTAINERS` (cartucho de caneta recarregável — insulina), distinto da caneta pré-preenchida descartável. Migração `20260612_b2_injection_container_refil.sql` aplicada em prod (autorização PO).
- **Added** (`minor`): `LIQUID_PRESENTATIONS` (`['liquido','injetavel']`) — fonte única p/ web+mobile não engolirem `injetavel` em unidades `/ml`.
- **Added** (`patch`, R-270/AP-167): helper canônico `coerceDecimal` (vírgula PT-BR → número) em `formUtils`.

#### Web (4.5.0)
- **Fixed** (`patch`): unidade `/ml` deixava de TRAVAR a apresentação em "Líquido" — agora restringe a Líquido/Injetável (injetável habilita validade após aberto/TTL) no form de medicamento e no wizard passo 1.
- **Fixed** (`patch`): edição de tratamento não pede mais densidade (`units_per_ml`) para dose em `mg` (usa `dosage_per_pill`).
- **Fixed** (`patch`, R-270): todos os inputs numéricos dos forms (medicamento, compra, tratamento, wizard) aceitam vírgula decimal PT-BR (`type=text inputMode=decimal` + `coerceDecimal` no persist/validação) — `type=number` bloqueava `,` e `Number('2,5')=NaN` quebrava o salvamento.

#### Mobile (0.4.0)
- **Fixed** (`patch`): chip de titulação reflete `titration_status` (Titulando/Estável) no detalhe de medicamento e de tratamento (antes "Estável" hardcoded); saldo de estoque de líquido exibe "ml" (não "un."); edição de compra recupera/corrige `injection_container`; bottom sheet de dose líquida usa a unidade de tomada do tratamento (gotas), não a do medicamento (mg/ml).

### Backend/Infra (DB + cron — 012 Fase B2)
- **Added** (`minor`, Spec 012 Fase B2, FR-017): Migração `20260612_diabetes_b2_glp1_mg.sql` — `protocols.intake_unit` CHECK ganha `'mg'` (canetas/ampolas GLP-1 dosadas em mg sobre líquido `mg/ml`); `consume_stock_fifo` converte `mg ÷ units_per_ml = ml` no ramo sub-ml (única alteração; assinatura intacta). Nova coluna `medicines.injection_container` (caneta/ampola/frasco_ampola/seringa_preenchida, nullable + CHECK).
- **Added** (`minor`, Spec 012 Fase B2, FR-021): Titulação N1 — etapa do cronograma marcada `requires_new_medicine` faz o cron emitir notificação-CTA "Hora de trocar de apresentação" (em vez do aviso de avanço normal), sem alterar a dose (registro passivo do cronograma prescrito — SaMD/ADR-062).

### Core (@dosiq/core — 012 Fase B2)
- **Added** (`minor`, Spec 012 Fase B2, FR-017/FR-018/FR-020): `intake_unit` enum + `'mg'`; novo enum `INJECTION_CONTAINERS`; `titrationStageSchema` ganha `requires_new_medicine`. Helpers `formatConcentrationLabel` ("[X] mg em 1 mL" — confirma a densidade da bula) e `formatStockApplications` (rendimento de estoque em APLICAÇÕES com floor — "≈ 27 canetas", nunca ml cru; overfill não conta). `formatIntakeDose` arredonda a equivalência em ml a 2 casas (evita dízima em mg).

### Web (4.4.0 → 4.5.0)
- **Added** (`minor`, Spec 012 Fase B2, FR-018/FR-022): Form de tratamento aceita dose em `mg` para injetáveis GLP-1, com concentração (`mg/ml`) **obrigatória** (bloqueia salvar — nunca herda default) e rótulo de confirmação "[X] mg em 1 mL". Wizard de titulação ganha marcação "esta etapa troca de medicamento/apresentação" (nova caneta). Card de estoque exibe rendimento em aplicações para injetáveis em mg.
- **Added** (`minor`, Spec 012 Fase B2, FR-019): Tela de compra captura a apresentação do injetável (caneta/ampola/...) na primeira compra (persiste no medicamento; fallback "unidade").

### Mobile (0.16.1 → 0.16.2)
- **Changed** (`patch`, Spec 012 Fase B2): Exibição de dose em `mg` (canetas GLP-1) e arredondamento da equivalência em ml herdados via `@dosiq/core` — sem alteração de UI própria nesta fase (formulário de titulação e captura de apresentação são web). Sem nota de loja.

### Backend/Infra (cron — 012 Fase B)
- **Added** (`minor`, Spec 012 Fase B, FR-005b): Avanço AUTOMÁTICO de etapa de titulação por cronograma no cron diário — `stage_started_at + duration_days` esgotado avança `current_stage_index` (múltiplas etapas de uma vez se vencidas; `stage_started_at` novo = fim acumulado da etapa anterior, fiel ao cronograma mesmo com cron atrasado); última etapa esgotada marca `titration_status='alvo_atingido'`. Notificação `titration_alert` agora dispara **só no evento** de avanço ("Etapa N/M iniciada conforme o cronograma", sem CTA de dose — SaMD/ADR-062).
- **Fixed** (`patch`, Spec 012 Fase B, T009): Cron de titulação disparava `titration_alert` TODO dia para TODO protocolo em titulação (spam sem informação nova) e não carregava `stage_started_at` no select (R-267) — não tinha como saber se a transição venceu.

### Core (@dosiq/core — 012 Fase B)
- **Added** (`minor`, Spec 012 Fase B, ADR-061/FR-007): `computeTolerances` frequency-aware — frequências não-diárias usam o PERÍODO da frequência como wrap-around (semanal=10080min, dias_alternados=2880min) **sem o cap de 120min**: dose semanal única ganha tolerância 5040min (3,5 dias — cobre o perdão clínico de 72h do GLP-1). Diário inalterado (cap 120 preservado).
- **Added** (`minor`, Spec 012 Fase B, FR-006/FP-1): `resolveTitrationStageAt(protocol, at)` — resolve a etapa de titulação vigente num instante arbitrário; o gerador de `dose_instances` congela `expected_dose` da etapa vigente NA DATA da ocorrência (instância futura nasce com a dose da etapa futura, antes do avanço formal no banco).
- **Added** (`minor`, Spec 012 Fase B, FR-008b): `daysAgoLabel(scheduledFor, now, tz)` — rótulo relativo por data-calendário ("ontem"/"há N dias") para doses pendentes multi-dia.

### Web (4.3.0 → 4.4.0)
- **Added** (`minor`, Spec 012 Fase B, FR-008b): Carry-over multi-dia — janela de busca de ocorrências ampliada para 4 dias atrás (dose GLP-1 semanal pendente de 2-3 dias continua registrável); seção "Pendências de ontem" vira "Doses pendentes" com rótulo relativo por card ("ontem · 10:00", "há 2 dias · 10:00"). Sem re-notificação (gate `notified_at` único).
- **Fixed** (`patch`, Spec 012 Fase B, R-270): Dose do regime de titulação (wizard) aceita vírgula PT-BR ("0,25") — input decimal com normalização no blur + no payload do protocolo (banco nunca vê string).

### Mobile (0.16.0 → 0.16.1)
- **Added** (`minor`, Spec 012 Fase B, FR-008b): Mesmo carry-over multi-dia da web — seção "Doses pendentes" com subtítulo e rótulo relativo nos cards de dose carregada.
- **Nota de loja relevante:** "Novo: doses semanais (como canetas GLP-1) atrasadas há mais de um dia continuam visíveis e registráveis na tela inicial, com indicação de há quantos dias estão pendentes — e a tolerância de registro agora respeita o intervalo real da dose semanal."

### Backend/Infra (DB + cron — 012 Fase A)
- **Added** (`minor`, Spec 012 Fase A, ADR-059): Migração `20260610_diabetes_a_injectable_ttl.sql` — `medicines.shelf_life_days` (TTL pós-abertura, nullable, CHECK > 0) e `stock.opened_at` (timestamptz). `consume_stock_fifo` agora infere `opened_at` na primeira tomada que debita o lote (`COALESCE(opened_at, now())` — nunca re-seta; assinatura intacta). Novo kind de notificação `stock_expiry_alert` (push/Telegram) com cadência D-3 + vencimento, no cron diário de estoque — avisa quando o frasco/caneta aberto atinge a validade pós-abertura.

### Core (@dosiq/core — 012 Fase A)
- **Added** (`minor`, Spec 012 Fase A): Helpers puros `isBiologicallyExpired(stock, medicine)` e `biologicalExpiryDaysLeft(stock, medicine)` em `utils/stock.js` — eixo de validade biológica PARALELO ao status de volume 4-tiers (ADR-018). `medicineSchema` ganha `shelf_life_days` (int positivo nullable, `''`→null R-270). `createStockRepository` carrega `shelf_life_days` (R-267).

### Web (4.2.0 → 4.3.0)
- **Added** (`minor`, Spec 012 Fase A): Cadastro de medicamento expõe select de Apresentação (injeção/pomada etc.) com campo "Validade após aberto (dias)" para injetáveis (prefill 28, editável). Card de estoque exibe alerta de validade biológica (ícone relógio) — "vence em N dias" / "vencido (validade após aberto)" — distinto do alerta de volume.

### Mobile (0.15.4 → 0.16.0)
- **Added** (`minor`, Spec 012 Fase A): Mesmo conjunto da web — seletor de Apresentação + validade após aberto no form de medicamento (prefill 28 p/ injeção); badge de TTL biológico (relógio) na listagem de estoque, detalhe e cartões de compra, em paralelo ao status de volume.
- **Nota de loja relevante:** "Novo: para insulinas e outros injetáveis, o dosiq agora avisa quando o frasco ou caneta aberta está perto de perde a eficácia após abertura — mesmo que ainda reste algum conteúdo."

### Mobile (0.15.3 → 0.15.4)
- **Fixed** (`patch`): Corrigido bug onde registrar retroativamente uma dose pulada (`skipped_user`) pelo histórico criava entradas duplicadas no dia — `markTaken` não incluía `skipped_user` na whitelist de status elegíveis, causando inserção do log sem atualizar a instância original. Ícone de dose pulada alterado de `FastForward` para `RedoDot` (mais intuitivo).

### Mobile (0.15.2 → 0.15.3)
- **Fixed** (`patch`): Corrigido bug de timezone no calendário do histórico de doses — dot colorido do dia agora converte UTC→local antes de comparar datas, evitando que doses às 22h–23h local (= dia seguinte em UTC) apareçam no dia errado.
- **Fixed** (`patch`): Corrigido alias `@dosiq/core` ausente na config ESLint do mobile — eliminava 368 falsos erros de `import-x/no-unresolved` ao rodar lint no workspace mobile.
- **Added** (`minor`): Histórico de doses com UX melhorada: filtro de doses `skipped_paused` (tratamento pausado não gera entradas visíveis); janela futura ampliada para d+7 (era d+2); navegação semanal limitada entre d-29 e d+7 com setas desabilitadas visualmente nos limites; ícone `FastForward` (lucide) para doses puladas pelo usuário (`skipped_user`).
- **Nota de loja relevante:** "Melhoria: histórico de doses mais limpo — doses de tratamentos pausados não aparecem mais como entradas no histórico, e a navegação por semanas agora mostra corretamente até 7 dias à frente."

### Mobile (0.15.1 → 0.15.2)
- **Fixed** (`patch`, commit 065c72aa): Corrigido bug onde pausar um tratamento deixava instâncias `pending` futuras (além das primeiras 24h) expostas ao sweep de missed — resultado: doses viravam `missed` indevidamente durante o período de pausa. Causa raiz: `markSkippedPaused` só cobria 24h, e o `sweepMissedInstances` corria antes do cron noturno que limparia o restante. Fix: pausa agora chama `markAllFutureSkippedPaused` — todas as instâncias futuras viram `skipped_paused` imediatamente, sem depender do cron. Resume inalterado: `reactivateFuturePaused` + regen. **Nota de loja:** "Correção: tratamentos pausados (ex: pausa de 7 dias entre cartelas de anticoncepcional) não geram mais doses perdidas no histórico durante o período de pausa."
- **Added** (`minor`, PR #653): Épico 026 Fase 1 — sistema de nudges in-app. Substitui `TzNudgeCard` por `NudgeBanner` genérico; `useNudges('profile'|'dashboard')` busca nudges remotos do Supabase e filtra dispensados via `AsyncStorage`. Dashboard exibe nudge quando sem doses urgentes. Preparado para nudges de versão de app e ativação de push via painel admin.
- **Nota de loja relevante:** "Novo: dicas e avisos contextuais aparecem na tela inicial quando você não tem doses urgentes — fique por dentro de novidades e configurações importantes sem sair do app."

### Shared/Core (nudges — 026)
- **Added** (`minor`, PR #TBD): `semver.js` — `compareSemver(a,b)` e `satisfiesSemver(version,min,max)` puros, sem deps. `nudgeScheduler.js` — `buildNudgeList(remote,local,opts)` com filtragem por plataforma/datas/versão/dismiss e priorização. `TZ_RECONCILE_NUDGE` + `TZ_NUDGE_LEGACY_KEY` exportados. Storage injetado via `opts.dismissed` (Set).

### Backend/Infra (DB — 026)
- **Added** (`minor`, PR #TBD): Migration `plans/specs/026-activation-strategy/migrations/001_create_in_app_nudges.sql` — tabela admin-managed de nudges remotos com RLS (leitura authenticated), CHECKs de `target_view`/`action_type`/`platform`, e índices parciais por `target_view` e `platform`.

### Shared/Core (0.1.1-phase2 → 0.2.0-phase3)
- **Added** (`minor`, PR #TBD): Medicamentos líquidos 022 **Fase C** (helpers de apresentação cross-platform web↔mobile). Novos em `doseUnit.js`: `isLiquidMedicine`, `stockUnitLabel`, `formatStockCount`, `formatStockQuantity`, `formatConcentration`, `formatIntakeDose`, `formatDoseItem`, `formatDoseHint` (regra: unidade nunca renderizada crua — UI maiúsculo / ml minúsculo). `adherenceLogic.js`: `doseToMl` + `calculateDailyIntake` liquid-aware (gotas/UI→ml). `doseZones.DoseItem` ganha `intakeUnit`/`unitsPerMl`. `costAnalysisSchema` preserva `intake_unit`/`units_per_ml`/`dosage_unit`. `medicineSchema`: `units_per_ml` agora **opcional** (densidade saiu do cadastro do medicamento → capturada no tratamento, contextual).
- **Fixed** (`patch`, PR #TBD): `createStockRepository.decreaseStock` passa `p_user_id` — drift da assinatura 4-arg de `consume_stock_fifo` (Fase A) que quebrava o registro de dose de qualquer medicamento.
- **Added** (`minor`, PR #TBD): Medicamentos líquidos 022 Fase B (core/validações/serviços). `medicineSchema`: `DOSAGE_UNITS` ganha `mg/ml`/`ui/ml` e perde `ml`/`gotas` (viram unidade de tomada); novos campos `units_per_ml` (razão→ml, ADR-058) e `presentation` (+`PRESENTATIONS`); `dosage_per_pill` agora nullable (líquidos legados); superRefine exige `units_per_ml` para unidades `/ml`. `protocolSchema`: campo `intake_unit` (`gotas`/`ml`/`UI`) + refine que o exige para líquidos. Cap `quantity_taken` revisado 100→1000 (`logSchema`, `costAnalysisSchema`, `adherencePatternSchema`, `reminderOptimizerSchema`) — cobre doses em gotas (R-022). Novo `formatDose(value, unit)` em `doseUnit.js` (vírgula PT-BR, singular/plural de gota). Novo `createPurchaseRepository.createLiquidPurchase` — desmembra N frascos × volume × preço total em N lotes via `create_purchase_with_stock`, compensando centavos no último (exposto no `stockService` web; mobile herda via spread).
- **Fixed** (`patch`, PR #TBD): Corrigido `wipeFuturePending` e `wipeFuturePendingForProtocols` no repositório de instâncias de dose para deletar também instâncias com status `skipped_paused` no futuro. Isso garante que edições de agendamento ou propriedades (como `critical_alarm`) realizadas em tratamentos pausados limpem corretamente as instâncias futuras de 24h que estavam pausadas.

### Mobile (0.13.1 → 0.14.0)
- **Added** (`minor`, PR #TBD): Medicamentos líquidos 022 **Fase C** (UX líquida ponta-a-ponta). Estoque liquid-aware: cards de saldo/consumo/dias em ml, **custo por dose** (substitui custo/ml|un, com fallback quando sem tratamento ativo), detalhe/edição de compra, acertar saldo decimal, histórico de compras em ml. Modais de dose (single + bulk) e histórico exibem a dose na **unidade de tomada** (gotas/ml/UI), não na unidade do medicamento. Densidade capturada no form de tratamento (contextual, gotas/UI). **Transparência radical** (Constituição IX): registro em lote nunca silencia falha/falha parcial — informa quantas entraram, quantas falharam e por quê (`buildBulkOutcome`); toast ganha variante `warning`.
- **Fixed** (`patch`, PR #TBD): `doseService` passa `p_user_id` a `consume_stock_fifo` (single + batch) — drift da assinatura 4-arg que quebrava o registro de dose.
- **Fixed** (`patch`, PR #TBD): Corrigido o bug onde a reativação de um tratamento pausado, após alteração em suas propriedades de criticidade ou horários, não agendava corretamente os alarmes críticos locais nas primeiras 24h por conta de instâncias obsoletas `skipped_paused` residuais.
- **Nota de loja relevante:** "Novo: suporte completo a medicamentos líquidos! Agora você cadastra gotas, ml e insulina (UI) com a dose na unidade certa, estoque convertido automaticamente e o custo médio por dose do seu tratamento."

### Web/PWA (4.1.5 → 4.2.0)
- **Added** (`minor`, PR #TBD): **Feature 028 — Painel Admin de Nudges**. Novo painel em Configurações → Administração → "Nudges (In-App)" para criar, editar, ativar/desativar e visualizar banners in-app. Modal de formulário com JSON builder condicional (navigate/open_url/dismiss_only), filters por status e tela alvo, paginação de 20 nudges por página. Integração full-stack: `nudgeAdminService.js` (getAll/create/update/toggleActive), `useNudgesAdminState.js` hook com paginação e filtros, `NudgesAdmin.jsx` view + `NudgeFormModal.jsx` component, endpoints `POST/PATCH/PUT/GET /api/admin/nudges` consolidados em `api/admin.js` (R-090 budget), `nudgeSchema.js` Zod (validações + enums PT-BR). Admin auth via `verifyAdminAccess` existente (reuso). **SemVer**: minor — feature não-breaking, sem breaking contracts.
- **Added** (`minor`, PR #TBD): Medicamentos líquidos 022 **Fase C** (UX líquida completa). Dashboard (hoje), cards de tratamento, estoque (cards, dias restantes, histórico, **custo mensal** — corrigido cálculo absurdo que multiplicava dose em UI × preço/ml sem converter), consulta médica (dose/dia liquid-aware) e cartão de emergência passam a exibir a dose na unidade de tomada e a concentração com casing correto. Wizard de tratamento: campos `intake_unit` + densidade para líquidos; hint de dose liquid-aware. Aba renomeada **"Tratamentos"** (paridade mobile). `predictRefill`/`costAnalysisService`/`_stockDataTransformer` liquid-aware.
- **Fixed** (`patch`, PR #TBD): z-index de autocompletes empilhados no wizard de tratamento (campo seguinte cobria o dropdown de medicamentos).

### Backend/Infra (DB) — Medicamentos Líquidos 022
- **Fixed** (`patch`, PR #TBD): Migração `docs/migrations/20260608_fix_consume_fifo_ui_conversion.sql` (Fase C) — `consume_stock_fifo` converte `UI` além de `gotas` (`lower(intake_unit) IN ('gotas','ui')` → `ROUND(p_quantity/units_per_ml, 2)`). Antes `UI` caía em escala direta (punt da Fase A), fazendo `100 UI` debitar `100 ml` → "Estoque insuficiente" em insulina U-100. `CREATE OR REPLACE` (preserva grants); aplicada em produção.
- **Added** (`minor`, PR #TBD): Migração `docs/migrations/20260607_liquid_meds_db.sql` — fundação de medicamentos líquidos (épico 022 Fase A): CHECK de `dosage_unit` com `mg/ml`/`ui/ml`; colunas `medicines.units_per_ml` (razão→ml genérica, ADR-058) e `medicines.presentation`; `protocols.intake_unit`; `CHECK (stock.quantity >= 0)`; migração idempotente de líquidos legados (`ml`/`gotas` → `mg/ml` + `intake_unit`). RPC `consume_stock_fifo` (4-arg) ganha ramo líquido (converte tomada→ml via `units_per_ml`, baixa decimal por FIFO); overload legacy 3-arg removido. Líquido derivado de `dosage_unit LIKE '%/ml'` (decisão-mãe).

### Server
- **Changed** (`patch`, PR #TBD): 022 Fase C — comando `/registrar` (e atalho `quick_register`) **desativado** no Telegram. O registro de dose por chat usava dose-math pré-022 (mg = comprimidos × concentração) incompatível com líquidos + double-conversion com a RPC. `handleRegistrar` redireciona ao app/botão "Tomei". Lembrete de dose, botão "Tomei", `/status`, `/estoque`, `/hoje` seguem liquid-aware (`buildNotificationPayload`/`formatters` já convertidos).
- **Changed** (`patch`, PR #TBD): `server/bot/callbacks/conversational.js` migrado para a assinatura 4-arg de `consume_stock_fifo` (passa `p_user_id`) após remoção do overload 3-arg (022 Fase A).
- **Fixed** (`patch`, PR #TBD): Corrigido bug em `_reminderHelpers.js` onde lembretes individuais (`dose_reminder`) mostravam o emoji `🌙` e saudações noturnas a qualquer hora do dia por ausência de envio do parâmetro `hour` no payload de notificação.
- **Fixed** (`patch`, PR #TBD): Corrigido duplo deslocamento de fuso horário de Brasília no endpoint `/api/notify.js` que causava atraso em execuções de cron e predições de estoque no Vercel (12:00 PM/1:00 PM em vez de 10:00 AM).
- **Refactored** (`patch`, PR #TBD): Adicionada função utilitária `getRawNow()` em `server/utils/dateUtils.js` e substituído `new Date()` em `api/notify.js` para conformidade com regras do linter ESLint sem uso de diretivas bypass `eslint-disable`.


### Mobile (0.12.0 → 0.13.0)
- **Alarmes Críticos Locais, Supressão de Pushes e Melhoria de Usabilidade** (Minor, Spec 025):
  - Habilitada a flag `native_alarm_enabled` por padrão para iOS e Android para supressão automática de pushes remotos de doses críticas e prevenção de duplicidades.
  - Implementado o agrupamento local de alarmes no Notifee (`useAlarmScheduler.js`), consolidando múltiplas doses críticas do mesmo minuto em um único trigger.
  - Atualizada a tela cheia de alarme (`AlarmFullScreen.jsx`) e as ações rápidas (`quickDoseRegistration.js`) para suportar visualização e confirmação/descarte em lote.
  - Ajustadas as cópias de exibição do alarme local em `alarmService.js` para usar o padrão clínico customizado para doses críticas (essenciais) de forma coerente.
  - Integrada a solicitação contextual de permissões de push (`enablePushAtIntent`) ao toggle de alarme essencial do formulário de protocolos (`ProtocolFormBody.jsx`), incluindo modais de aviso customizadas para Xiaomi (HyperOS/MIUI) e Android 14+.
  - Mapeado o deep link `'history'` para a tela correta de Histórico de Doses (`ROUTES.DOSE_HISTORY`) nas telas de inbox e no hook de recebimento de notificações.
  - Corrigido o canal de áudio crítico do Android bumpado para `dose-alarm-critical-v2` e direcionado ao som `alarm_dose` para evitar o som padrão do sistema (como gotas no Xiaomi).
  - Substituído o erro console.error obstrutivo no setup do token de push por console.warn no hook `usePushNotifications.js` para evitar a tela de erro no ambiente de desenvolvimento que cobria a tela de alarme.
  - **Nota de loja relevante:** "Novo: Lembretes mais inteligentes para medicamentos essenciais. Se você tem mais de um remédio no mesmo horário, o alarme agora toca apenas uma vez e permite confirmar todos de uma vez só."

### Server
- **Divisão de blocos de notificação no Cron, Preferências do Bot e Novo Copy Clínico** (Minor, Spec 025):
  - Modificado o cron do backend (`_reminderHelpers.js`) para pré-separar instâncias críticas e normais antes de agrupar, evitando o silenciamento de medicamentos normais em blocos mistos.
  - Atualizado o comando `/start` do bot do Telegram para configurar `channel_telegram_enabled = true` e atualizar `notification_preference` de forma consistente no banco de dados.
  - Refatorado o copy das notificações (`buildNotificationPayload.js`) para formato clínico acolhedor e estruturado com concentração e unidade em lembretes unitários no Telegram e Push.
  - Integrado o suporte completo de Soneca (+5 min) e Skip (Pular) para o bot do Telegram via callback query, manipulando as instâncias de dose no banco.

### Infra
- **Ancoragem rígida no Node 22 e CI Hardening** (Patch, apps/web 4.1.3→**4.1.5**):
  - Atualizado o runtime do projeto do Node 20 para o Node 22 LTS nos ambientes local, CI e Vercel, fixando a restrição em `"22.x"` no `package.json` raiz para evitar upgrades silenciosos indesejados da Vercel para a versão 24.
  - Atualizado `actions/github-script` de `v7` para `v8` em todos os workflows do GitHub Actions para eliminar deprecation warnings de Node 20.
  - Substituída a action de terceiros `tj-actions/changed-files` por um script Git nativo com `git diff` no workflow de testes para mitigação de riscos de supply chain (adicionando `fetch-depth: 0` ao checkout do lint job).
  - Implementado smoke test de cold start (`scripts/smoke-server.mjs`) que valida as importações de módulos críticos de backend/serverless (Supabase, Bot Factory, DLQ e canais de notificação) integrado ao pipeline de CI.

### Web/PWA (4.0.0 → 4.1.3)
- **Scroll interno para comentários longos no painel de feedbacks** (Patch, web 4.1.2→**4.1.3**): adicionada uma caixa com scroll interno vertical e altura máxima no campo de comentário para garantir estabilidade visual e uma altura constante/previsível para as linhas da listagem de feedbacks na interface de administração.
- **Identificação de usuários no painel de feedbacks** (Patch, web 4.1.1→**4.1.2**): atualizada a formatação do display_name dos usuários. Exibe `{Nome} ({email})` se houver nome e `{email}` se o nome estiver vazio (com fallback para `Usuário do Dosiq`).
- **Hotfix Área Administrativa de Feedbacks** (Patch, web 4.1.0→**4.1.1**): corrigida falha 500 no carregamento de feedbacks causada por tentativa de junção implícita inválida no PostgREST (o banco não possuía relacionamento direto feedbacks <-> user_settings). Os display_names são agora buscados separadamente por ID em uma query dedicada.
- **Área administrativa de feedbacks** (Minor, Spec 023, web 4.0.0→**4.1.0**): implementado painel administrativo consolidado para visualização, filtros por status/nota e estatísticas em tempo real de feedbacks recebidos dos usuários finais. Ação de marcar como resolvido ou reabrir os feedbacks.
- **Roteador único consolidado admin** (Patch, Spec 023): DLQ e feedbacks unificados no único slot físico `/api/admin.js` preservando o limite do plano Hobby da Vercel (R-090) e mantendo endpoints legados por reescrita de URL.

### Mobile (0.11.1 → 0.12.0)
- **Tela de Histórico de Doses** (Minor, Spec 003, mobile 0.11.1→**0.12.0**): adicionada nova tela "Histórico de Doses" acessível pelo hub de Perfil › Ferramentas. Inclui calendário semanal navegável com dots de adesão (cheio/parcial/nenhum), 3 KPIs (Adesão 30d, Sequência, Doses do mês), lista cronológica de instâncias por período (Manhã/Tarde/Noite/Madrugada) e bottom sheet para editar ou excluir registro (com reversão de estoque via `restore_stock_for_log`). **Nota de loja:** "Novo: Histórico de Doses — veja tudo o que aconteceu com as suas doses nos últimos 30 dias, semana a semana. Encontre qualquer dose no calendário, confira sua taxa de adesão e sequência atual, e corrija ou apague registros com um toque. Acesse em Perfil › Ferramentas."

### Mobile (0.10.0 → 0.11.1)
- **Ajustes visuais no menu de perfil** (Patch, mobile 0.11.0→**0.11.1**): adicionado badge âmbar escrito "novo" no item de envio de feedback, removido o placeholder ocioso "Sobre o Dosiq", corrigido o alinhamento vertical dos itens de menu para centralização perfeita dentro do box, e ajustada a cor do hint das estrelas de avaliação (`starsLabel`) para verde institucional (`brand.primary`) para harmonização de identidade visual.
- **Formulário interno para envio de feedbacks** (Minor, Spec 023, mobile 0.10.0→**0.11.0**): adicionada área logada sob o hub de Perfil para que usuários possam enviar notas de 1 a 5 estrelas e comentários sobre o produto. Coleta automatizada de metadados em background (device, OS e versão do app) para facilitar a depuração. **Nota de loja relevante: adicionada área interna para envio de feedback diretamente pelo app.**

### Shared/Core
- **Validação e persistência de feedbacks** (Minor, Spec 023): criação da tabela feedbacks no banco com RLS restritiva, schema de validação Zod e repositório factory core reutilizável.

---

## [4.0.0 / 0.10.0] — 2026-06-04

### Mobile (0.9.0 → 0.10.0)
- **Alarme Nativo v2 — Alerta crítico por-tratamento** (Minor, Spec 010, mobile 0.9.0→**0.10.0**): toggle "Alerta crítico" no formulário de cada tratamento (default OFF, opt-in consciente). Doses de tratamentos críticos disparam alarme em tela cheia; doses normais recebem push regular — sem dupla notificação. iOS: `interruptionLevel:'critical'` (fura mudo físico) com fallback `timeSensitive` quando entitlement não aprovado. Soneca agora persiste `dose_instances.snoozed_until` (durável cross-restart). Gate server per-dose: push suprimido apenas para a dose crítica coberta por alarme (granularidade por-ocorrência, não por-device). Toggle global de device (v1) aposentado — controle migra para cada tratamento. ADR-055/056, R-255/R-258/R-239/R-261, CON-024. **Nota de loja relevante: melhoria no sistema de lembretes de doses críticas.**

### Web/PWA
- **Troca de fuso pergunta a intenção: viagem × mudança** (Major, PR-F4.3f.2, web 3.11.0→**4.0.0** — marco da Fase 4 / fechamento do refactor de `dose_instances`): ao trocar o fuso nas Configurações com doses futuras pendentes, abre uma **modal de intenção** (`TzIntentModal`, reusa `Modal`): **"Estou aqui só de viagem"** (persiste o fuso, **sem** mexer nas doses — instante absoluto intacto, a agenda passa a aparecer no fuso local) ou **"Me mudei para {cidade}"** (persiste **e re-ancora** todas as doses futuras no fuso novo via `regenActiveProtocolsForTz`: wipe das `pending` futuras + regeneração por tratamento ativo, best-effort). Ambas **persistem** o fuso; a diferença é só o regen. Fechar/cancelar = nada muda. Sem dose futura → persiste direto, sem perguntar. Render do dashboard invalida `user:timezone` + `doseInstances:today*`. Cidade derivada do label de `TIMEZONE_OPTIONS` (nunca IANA cru). Auto-corrige na volta (re-seleção do fuso de origem re-dispara o prompt). ADR-049/053, CON-024, R-231/R-245/R-246/R-254/R-166.
- **"Hoje" no fuso do perfil** (Minor, PR-F4.3f.1, web 3.10.0→3.11.0): o dashboard "hoje" passa a derivar a **virada-de-dia e o HH:MM no fuso horário do usuário** (`user_settings.timezone`), não mais São Paulo fixo. `useDashboardContext` busca o `timezone` (chave de cache `user:timezone`, invalidada no login) e o injeta em `useDoseZones` → `splitDayTimeline`/`getUserTime` (fallback SP quando ausente). Para brasileiros em outro fuso (BR ou exterior), "Pendências de ontem"/"Em breve" e os horários das doses passam a bater com o relógio local. A janela de fetch segue ampla (superset [ontem, amanhã]); a partição precisa usa o tz real. ADR-049/053, CON-024.
- **Landing abre cadastro (sign-up first)** (Patch, PR-F4.3f.0, web): o botão "Começar Agora" da landing passa a abrir a tela de **cadastro** em vez de login — happy path de produto recém-lançado. Usuários com conta usam o link "Já tem uma conta? Entrar" (toggle já existente). `Auth` ganha prop `defaultLogin` (default `true`, retrocompat); só a entrada sem sessão usa `defaultLogin={false}`.
- **Captura de fuso no signup + convite de fuso no Perfil** (Minor, PR-F4.3f.0, web 3.9.0→3.10.0): contas novas passam a **gravar o fuso horário real do device** já na **confirmação do cadastro** (`Intl.DateTimeFormat().resolvedOptions().timeZone`, normalizado contra a lista suportada ADR-053; fora dela → São Paulo) — antes toda conta nascia no DEFAULT `America/Sao_Paulo` porque a UI nunca capturava o fuso, deixando brasileiros em outro fuso (no Brasil ou no exterior) silenciosamente em SP. Capturar no signup (e não só ao fim do onboarding) **cobre quem pula o wizard** e deixa o tz pronto para a geração do **1º tratamento** (passo 3) no fuso correto; `completeOnboarding` mantém a gravação como rede de segurança. Captura **silenciosa**. Para os **usuários existentes**, um **convite passivo no Perfil** (card "Novidade: fuso horário") leva ao seletor de fuso nas Configurações; dispensável (dismiss em `localStorage`). Fundação para a geração/leitura no fuso do dono (F4.3f.1). Helper core `resolveSupportedTz`/`getDeviceTimezone` compartilhado web↔mobile (R-231). ADR-049/053.
- **Carry-over cross-dia bidirecional ("Pendências de ontem" + "Em breve")** (Minor, PR-F4.3e, web 3.8.1→3.9.0): o dashboard "hoje" ganha **janela actionável deslizante cross-dia, simétrica pela tolerância**. (1) **"Pendências de ontem"** no topo — doses de ontem ainda `pending` dentro da tolerância (atrasadas, ainda registráveis) param de sumir à meia-noite. (2) **"Em breve"** no rodapé — doses de amanhã já dentro da tolerância PARA FRENTE (ex.: às 23:30 a dose de amanhã 00:30 aparece), espelho do carry-over. A janela de fetch alargou de só-hoje para **[ontem 00:00, amanhã 23:59]** (chave de cache `doseInstances:today:v2`); o core `splitDayTimeline` (CON-024 aditivo) particiona em `carryOver`/`today`/`lookAhead` — critério simétrico `|diff| ≤ tolerância` (`tolerance_minutes` dinâmico, não 120 fixo), só `pending`. Doses de outro dia já `taken`/`missed`/fora da tolerância NÃO entram. O cronograma de hoje segue **day-bound** — carry-over/look-ahead são **seções próprias**, nunca slots de hoje (preserva o fix do slot-fantasma cross-meia-noite). Mesmo helper core no web e mobile (R-231). MASTER ln 204-211 ("janela deslizante cross-dia"). ADR-050/054, R-248.
- **Zonas de dose extraídas para o core** (Patch, PR-F4.3a, web 3.8.0→3.8.1): `useDoseZones` (web) deixa de definir `classifyDose`/`buildDoseItemsFromInstances` localmente e passa a **reexportá-las do `@dosiq/core`** (`packages/core/src/utils/doseZones.js`, CON-024). Fundação para a migração da timeline do Hoje mobile (F4.3b) reusar a mesma lógica sem duplicata (R-231) — **zero mudança de comportamento** no dashboard "hoje" (testes do hook verdes sem alteração de asserção). ADR-050/054.
- **Fusos expat no seletor de timezone** (Minor, PR-F4.2b S4.4b, web 3.7.0→3.8.0): `TIMEZONE_OPTIONS` (core, ADR-053) ganha um punhado curado de destinos para brasileiros no exterior — **Nova York, Los Angeles, Lisboa, Londres** — além dos 16 fusos BR (ordenação BR-first mantida). Brasileiro em outro país persiste o fuso IANA real → lembretes e fronteira-de-dia corretos no fuso local (agora que a injeção de tz fechou na PR-F4.2). DST resolvido pelo **nome IANA** via `Intl`, nunca por offset (offset≠identidade). Caminho C (lista IANA completa) segue gated (YAGNI). Seletor web (PreferenceSection) e mobile (SettingsScreen) iteram a mesma lista — mobile recebe as opções no próximo build nativo (PR-F4.3). Sem migração (coluna `timezone` é `text` livre; Zod é o gate). ADR-053.
- **Histórico ← timeline event-agnóstica + estados reais + tz** (Minor, PR-F4.2 S4.3+S4.4, web 3.6.3→3.7.0): o "Histórico de Doses" passa a **consumir** a timeline de eventos (`timelineService.getMonthTimeline` ← `dose_instances`+`medicine_logs`, FP-3/ADR-050) em vez de listar só os logs tomados. O painel do dia agora reflete o **estado real** de cada ocorrência — **Tomada / Perdida / Pendente** (badge + barra lateral colorida, idoso-friendly) — não só doses registradas. Renderização por **registry** indexado por `event.type` (`{ dose: DoseEventCard }`): adicionar um tipo futuro (`biomarker`/`note`) = registrar um card, **sem tocar a view nem o painel**. **Fecha G1 (tz)** no caminho da timeline: o fuso do usuário (`user_settings.timezone`) é injetado ponta-a-ponta e governa a derivação do dia local (cross-meia-noite correto — dose de ontem 22:30 aparece em ontem), com limites de janela em **UTC real** (sem double-shift, AP-194). **Novo no header do painel:** contagem de doses do dia à direita ("Doses do Dia" ⟷ "N doses"). Editar/excluir seguem disponíveis em eventos com log (taken/avulso); missed/pending não têm ação. Adesão/sparkline/heatmap (views `*FromView`) intactos (R-249). R-252, CON-023, ADR-049/050.
- **Erro de compartilhamento mais claro** (Patch, fora do escopo F4.1): `shareService._uploadToShareApi` passa a checar `response.ok` ANTES de `response.json()`. Num 404/500 com corpo vazio (ex: `/api/share` não servido no dev Vite), o parse estourava "Unexpected end of JSON input" mascarando o status — agora surge "Erro 404 ao compartilhar relatório". Não corrige o 404 em si (share é função serverless Vercel, só roda em deploy/`vercel dev`).
- **Cache-bust de adesão no deploy (persistKey v2)** (Patch, PR-F4.1): `webQueryCache` passa a usar `persistKey: 'dosiq_query_cache_v2'`. Como a PR reescreveu a fonte das views de adesão (`medicine_logs`→`dose_instances`), o cache de query persistido em `localStorage` guardava números pré-migração e **sobrevivia ao hard reload** (Cmd+Shift+R só limpa HTTP/memória), prendendo sparkline/heatmap com dados antigos (SWR serve stale + componente fixa no state). Trocar a chave abandona o cache velho no deploy → todo cliente refetcha as views novas sem refresh manual (AP-200). Regra: bumpar a cada mudança de fonte/shape de query cacheada server-side.
- **Refocus da aba não reseta mais a view** (Patch, PR-F3.2d, web 3.6.1→3.6.2): estando em qualquer tela ≠ "hoje" (ex.: Histórico de Saúde), trocar de janela e voltar ao navegador **não joga mais o usuário de volta no dashboard** (AP-192). Causa: o refresh do token de acesso (disparado no refocus) criava um novo objeto `session` com o **mesmo** `user.id`, re-disparando o effect de roteamento inicial (`App.jsx`) que lia a URL `/` e forçava `setCurrentView('dashboard')`. Fix: o effect passa a ser gatear por `session?.id` (identidade do usuário) em vez do objeto `session` inteiro — token refresh do mesmo usuário deixa de re-rotear. Os fluxos de **login**, **confirmação de e-mail** e **reset de senha** vindos dos links do Supabase seguem intactos (são transições `null→id`, que continuam disparando o roteamento/overlay).
- **SparklineAdesao: clamp + escala 0-100 + tooltip + a11y + drift** (Patch, PR-F3.2c, web 3.6.0→3.6.1): o gráfico "Adesão 30 Dias" (HealthHistory): (1) **clampa adesão 0-100** no componente — para de exibir `>100%`/"118%↓" mesmo se a fonte mandar errado (defesa AP-191; raiz na view fica p/ F4/G6); (2) **escala vertical fixa 0-100** (`projectY`) — adesão é métrica absoluta (50% parece 50%); (3) **curva passa pelos pontos** (Catmull-Rom) — dots não descasam mais da linha; (4) **tooltip como overlay HTML** (não mais `<text>` SVG, que esticava no `preserveAspectRatio="none"` → fonte gigante); (5) **acessibilidade**: container `role="img"` + dots `role="button"`/`aria-label`/teclado (Enter/Espaço); (6) **drift do hover** corrigido — `<circle>` escalava da origem do viewport (`transform-box: fill-box; transform-origin: center`). Remove `SparklineTooltip.jsx` (SVG) órfão. 10 testes de contrato verdes.
- **Dashboard "hoje" ← dose_instances** (Minor, PR-F3.2b, web 3.5.0→3.6.0): o "hoje" do dashboard (zonas ATRASADAS/AGORA/PRÓXIMAS/MAIS TARDE/REGISTRADAS, `urgentDoses`, totais) passa a **consumir** as ocorrências materializadas (`dose_instances`) da janela do dia em vez de **inferir** slots a partir do `time_schedule` + casamento de logs ±2h. `useDoseZones` classifica pelo **instante absoluto** (`scheduled_for`), eliminando o bug cross-meia-noite: a dose de ontem 22:30 registrada às 00:05 **não cria mais slot fantasma de hoje** — fica ancorada em ontem. O botão "Tomar" agora ancora **diretamente pela `instanceId`** (determinístico p/ doses passadas, complementa o snap por tolerância da F2.3; cai no snap se a marcação direta falhar). Ocorrências `skipped_*` não aparecem como pendência; `missed` segue actionável (self-heal). Fetch da janela do dia adicionado ao `useDashboardContext` (curto, OOM-safe — R-249); cache `doseInstances:today` invalidado no registro (AP-168). **Tolerância dinâmica honrada:** `classifyDose` (zonas + cronograma) usa o `tolerance_minutes` da ocorrência (metade do gap entre doses adjacentes) em vez de 120min fixo — duas doses próximas não ficam mais actionáveis ao mesmo tempo; passou da tolerância → sai do actionável (espelha o sweep F2.5). **Anel "Adesão"/score/streak/insight migrados:** `_useDashboardDerived` passa a usar `adherenceService.getAdherenceSummary('30d')` (instances, head-count server-side) em vez do legado `calculateAdherenceStats` (logs ±2h) — anel capado 0-100 (sem o >100%), streak consistente com a lista de doses, cache `adherence:summary` invalidado no registro. **Limpeza:** `RingGauge.jsx` morto (sparkline 7d nunca renderizado pós-redesign) removido. R-248. ADR-048/050.
- **Adesão ← dose_instances** (Minor, PR-F3.2a, web 3.4.2→3.5.0): `adherenceService` passa a **consultar** a adesão das ocorrências materializadas (`dose_instances`) por status (`taken`/`missed`/`pending`/`skipped_*`) em vez de **inferir** por casamento ±2h sobre os logs. Adesão = `taken/(taken+missed)`; pausa/skip consciente não penaliza (fora do denominador); dose registrada após a meia-noite passa a contar no dia correto. Métodos migrados: `calculateAdherence`, `calculateProtocolAdherence`, `calculateAllProtocolsAdherence`, `getCurrentStreak`, `getLongestStreak`, `getAdherenceSummary`, `getDailyAdherence`. O **streak** mantém o limiar de **≥80% das doses do dia** (paridade com a lógica anterior — quem perde 1 de várias doses não vê o streak sumir; hoje incompleto não quebra). As views de relatório/PDF/heatmap (`*FromView`) seguem como estão até a Fase 4 (R-249, agregação server-side). **Os percentuais de adesão podem mudar** — passam a refletir doses realmente perdidas (`missed`) em vez de estimadas. R-248. ADR-048/050.
- **Push Routing** (Patch, Spec #2): Adicionado suporte a Deep Linking no PWA Web. O aplicativo agora intercepta parâmetros de busca (query params) e caminhos na inicialização para redirecionar o usuário para a view correspondente (como estoque, histórico ou tela principal) e abrir modais de tomadas individuais ou coletivas (planos/avulsos) pré-preenchidos.
- **Wizard** (Minor, PR #601): Simplificados condicionais e labels de "comprimidos" para utilizar a unidade genérica "un." quando o medicamento for cadastrado como tal no Wizard (Steps 2 e 3).
- **Form Wizard** (Minor, PR #601): Refatorada a label de `"Dosagem"` para `"Concentração"` no Passo 1 do wizard e formulário principal de medicamento para dirimir ambiguidades.
- **Warning Alert** (Minor, PR #601): Adicionado alerta visual educativo condicional quando a unidade genérica `'un.'` for selecionada e a concentração for superior a `1`.

### Mobile
- **Fix: push de dose não tocava o som custom no iOS com a tela bloqueada** (Patch, server `expoPushChannel`): o lembrete de dose enviava `sound: 'push_chime.wav'` como **string crua** ao Expo. No contrato do Expo (expo-server-sdk v6), a string só vale como `'default'` — som **custom** no iOS exige a forma **objeto** `{ name }`. Resultado: no caminho **locked/background** (em que o iOS toca pelo payload, não pelo app) o push caía no som padrão/nenhum; em foreground o app mascarava o bug tocando via `shouldPlaySound`. Corrigido para `sound: { name: 'push_chime.wav' }` + `interruptionLevel: 'time-sensitive'` (antes ia como `active`, sem furar Focus/DND). **Não** fura o mudo físico — só Critical Alerts (v2, deixada pronta e comentada no código, pós-aprovação do entitlement Apple). **Store-note:** "Correção: o som de aviso das doses agora toca no iPhone mesmo com a tela bloqueada." Validar em build/device (som de push não roda em simulador). Spec 010/FR-005.
- **Alarme nativo persistente (opt-in)** (Minor, Spec 001 / PR feat/alarme-nativo, mobile 0.8.1→**0.9.0** — Android A1 + iOS A2): nova feature **Alarmes críticos** — alarme local em **tela cheia** na lock screen, tocando `alarm_dose.wav` no horário da dose **mesmo no silencioso/DND/Doze Mode** (Android, canal `HIGH`+`bypassDnd`, `AlarmManager.setExactAndAllowWhileIdle` via `@notifee/react-native`, full-screen intent). Coexiste com o push remoto (`expo-notifications` → `push_chime.wav`) — `cancelAll` usa `cancelTriggerNotifications()`, só toca as notificações do Notifee. **Default OFF (opt-in)**: nunca liga sozinho — toggle no card "Notificações" do Perfil (R-197) + **nudge de anúncio** dispensável (espelha o nudge de fuso, R-253) com CTA ao toggle. "**Tomei**" registra pela via canônica `registerDose(log,{instanceId})` (cria `medicine_log`→`consume_stock_fifo`→ancora `dose_instances.status='taken'`+`medicine_log_id`, com rollback — sem update cru); "**Pular**" → `status='skipped_user'`. **Soneca** (+5min, máx 3) e **nag reativo** (+5min, máx 3), ambos respeitando a `tolerance_minutes` **dinâmica** da ocorrência. **Som em loop** (`loopSound`+`ongoing`) até o usuário escolher — `cancelAlarm` cancela a notif EXIBIDA (`cancelNotification`) além do trigger, parando o som em Tomei/Pular/Soneca. Corpo com horário: "Está na hora de tomar {medicamento} ({HH:MM})". Agendamento por **janela look-ahead de 72h** reusando `@dosiq/core` (`ensureInstancesUpTo`→`getWindow`→`buildDoseItemsFromInstances`, CON-024) — `scheduled_for` é instante absoluto (trigger TIMESTAMP direto, sem conversão tz), idempotência cross-restart por `notificationId=doseInstanceId`. Invalida os snapshots reais pós-ação (`today/stock/treatments`). **iOS (A2):** `interruptionLevel:'timeSensitive'` (fura Focus/DND; entitlement Time Sensitive declarado, **não** fura mudo físico — Critical Alerts pendente de aprovação Apple), categoria de ações registrada (`setNotificationCategories`) p/ os botões Tomei/Soneca/Pular, `foregroundPresentationOptions` p/ tocar com o app aberto, `keychainAccessible:AFTER_FIRST_UNLOCK` na sessão (SecureStore) p/ ações na lock screen (Apple Watch) não falharem com "User interaction is not allowed". **Gate de duplicata (A2):** com o alarme ON, o device marca `native_alarm_enabled` (RPC `upsert_notification_device` + coluna em `notification_devices`) e o canal expo (server) **pula o push de lembrete de DOSE** pra esse device (alarme local já cobre) — por-device + só-dose; estoque/outros tipos e web/telegram seguem normais. **Out of scope (v2):** toggle por protocolo + interação com quiet-hours; iOS Critical Alerts (entitlement em avaliação). **Requer build nativa** (Expo Go incompatível com Notifee). **Store-note:** "Novo: alarme em tela cheia no horário da dose, mesmo com o celular no silencioso — para as doses que não podem ser esquecidas. Ative em Perfil › Notificações." ADR-048/049/051/053, CON-024, R-197/R-231/R-253.
- **Fix: registro retroativo em lote ancorava no dia errado** (Patch, PR #631, mobile 0.8.0→**0.8.1**): o **FAB de doses** (lista todas as agendadas ativas, permite selecionar as tomadas e **ajustar data/hora**) ancorava a ocorrência pelo **dia atual** (`instancesByKey` da timeline de hoje), ignorando a **data selecionada** no seletor retroativo. Com o relógio já virado para o dia seguinte, registrar as doses de ontem (backdatando o `taken_at`) gravava o log na **ocorrência de hoje** → a ocorrência real virava **`missed`** e a de hoje ficava **"fantasma" tomada** (falseava adesão/streak; na web o Histórico listava no mesmo dia a *perdida* original e a *tomada* do log). **Fix:** quando a tomada é backdatada para outro dia local, o mapa de hoje é ignorado (`instance_id=null`) → `registerDoseMany` cai no **snap por tolerância** (`findAnchorInstance`), que ancora pelo `taken_at` real, no dia correto. Dados de produção afetados já re-ancorados. **Store-note:** "Correção no registro de doses passadas: a tomada agora é vinculada ao dia certo." Follow-up: guard de dia em `_anchorLogToInstance`/`markTaken` (core).
- **Troca de fuso pergunta a intenção: viagem × mudança** (Minor, PR-F4.3f.2, mobile 0.7.3→**0.8.0** — release de loja, fecha a Fase 4): ao trocar o fuso nas Configurações com doses futuras pendentes, abre um **bottom-sheet de intenção** (`TzIntentSheet`, padrão `LogoutSheet`/R-233 statusBarTranslucent): **"Estou aqui só de viagem"** (persiste o fuso, sem mexer nas doses — só muda o render) ou **"Me mudei para {cidade}"** (persiste e **re-ancora** todas as doses futuras no fuso novo via `regenActiveProtocolsForTz`, best-effort). Ambas persistem o fuso; a diferença é o regen. Cancelar = nada muda. Sem dose futura → persiste direto. Cidade derivada do label de `TIMEZONE_OPTIONS`. **Store-note:** "Mudou de cidade ou está viajando? Ao ajustar o seu fuso, o Dosiq pergunta se quer manter a agenda original das doses ou passá-las para o horário local." ADR-049/053, R-231/R-245/R-246/R-166/R-233.
- **"Hoje" no fuso do perfil** (Minor, PR-F4.3f.1, mobile 0.7.2→0.7.3): a aba **Hoje** deriva a virada-de-dia, o HH:MM e a partição cross-dia (timeline + "Pendências de ontem"/"Em breve") no **fuso do perfil** (`user_settings.timezone`), não mais SP fixo (residual G1 mobile fechado). `useTodayData` propaga o `timezone` (e o `localDay`/segregação de cache passam a virar no fuso certo); `_useTodayDerived` injeta o tz em `splitDayTimeline`/`getTodayLocal`. Fallback SP. **Store-note:** "A sua agenda do dia agora segue o seu fuso horário." ADR-049/053, R-231/R-166.
- **Captura de fuso no signup + convite de fuso no Perfil** (Minor, PR-F4.3f.0, mobile 0.7.1→0.7.2): contas novas passam a **gravar o fuso horário real do device** já na **confirmação do cadastro (OTP)** — via `Intl` no Hermes, normalizado contra a lista suportada ADR-053; indisponível/fora dela → São Paulo. Capturar no signup **cobre quem pula o onboarding** e deixa o tz pronto p/ a geração do 1º tratamento no fuso certo (`completeOnboarding` mantém como rede). Para os **existentes**, um **card "Novidade: fuso horário"** no Perfil (espelho do web, R-166) leva às Configurações; dispensável (dismiss em `AsyncStorage`). Sem dependência nativa nova (usa `Intl`, não `expo-localization` → sem rebuild de provisioning). **Store-note:** "Agora o Dosiq detecta o seu fuso horário ao criar a conta. Quem já usa pode ajustar o fuso no Perfil." Fundação para a geração/leitura no fuso do dono (F4.3f.1). Helper core compartilhado (R-231). ADR-049/053.
- **Carry-over cross-dia bidirecional na Agenda de Hoje** (Minor, PR-F4.3e, mobile 0.7.0→0.7.1): a aba **Hoje** ganha duas seções espelhadas: **"Pendências de ontem"** acima da agenda (Simple: antes do listão; Complex: antes dos períodos) — doses de ontem ainda `pending` dentro da tolerância (±2h/dinâmica) — e **"Em breve"** no rodapé — doses de amanhã já chegando dentro da tolerância (ex.: às 23:30 a dose de amanhã 00:30). Reusa o core `splitDayTimeline` (CON-024, paridade exata com o web — R-231/R-166): a timeline do dia segue day-bound; carry-over/look-ahead são seções próprias, nunca slots de hoje. Doses de outro dia já tomadas/perdidas/fora da tolerância não entram. **Store-note:** "Doses do fim de ontem e do começo de amanhã, ainda no prazo, aparecem destacadas na sua agenda do dia." MASTER ln 204-211. ADR-050/054.
- **Dose prioritária registra todas de uma vez + bulk ancora por ocorrência** (Minor, PR-F4.3d, mobile 0.6.6→0.7.0): o card de **dose prioritária** (HeroDoseCard) deixa de abrir a modal de dose única (1 tratamento por vez — com 3 prioritárias o usuário repetia o fluxo 3×) e passa a abrir a **modal em lote** com as doses prioritárias instanciadas — **1 confirmação registra todas**. Além disso, o registro em lote (lote prioritário, FAB "doses de hoje", plano, deep-link) passa a **ancorar cada dose diretamente na sua `dose_instance`** (`registerDoseMany` aceita `instance_id` por entrada → `markTaken` direto) em vez do snap por tolerância: a modal resolve a ocorrência de cada item pelo par `protocol_id`+horário contra as instâncias do dia. Determinístico mesmo com o seletor retroativo de horário (ancora pela ocorrência, não pelo `taken_at`). Sem `instance_id` resolvido (PRN/avulso) → fallback snap preservado; se a marcação direta falhar não cai no snap (espelha web/F4.3c, AP-193). Best-effort (R-245/246). R-166.
- **Registro de dose ancora direto na ocorrência** (Patch, PR-F4.3c, mobile 0.6.5→0.6.6): ao tomar uma dose a partir da timeline do Hoje (card ou dose prioritária), o registro passa a **ancorar diretamente na `dose_instance`** correspondente (`instanceId` plumbado card/hero→modal→`registerDose({instanceId})`→`markTaken` direto) em vez de depender do snap por tolerância. Determinístico para doses passadas/cross-meia-noite (não erra a ocorrência quando há duas próximas). Se a marcação direta falhar (já tomada/duplo-clique) **não** cai no snap — evita ancorar noutra pendente legítima (espelha o web `logService`, AP-193). PRN/avulso sem `instanceId` segue via snap. Best-effort (R-245/246). R-166.
- **Ordem dos turnos: Madrugada primeiro** (Patch, PR-F4.3b, bug legado): no modo `complex`, a agenda de Hoje renderizava **Madrugada por último** (`['Manhã','Tarde','Noite','Madrugada']`). Corrigido para a ordem cronológica do dia — **Madrugada → Manhã → Tarde → Noite**.
- **Timeline do Hoje ← dose_instances** (Minor, PR-F4.3b, mobile 0.6.4→0.6.5): a "Agenda de Hoje" (lista de doses, turnos Madrugada/Manhã/Tarde/Noite e o card de dose prioritária) passa a **consumir** as ocorrências materializadas (`dose_instances`) com **estado real** — Tomada / Perdida / Atrasada / Próxima / Planejada — via core `buildDoseItemsFromInstances` + `classifyDose` (CON-024, paridade com o web e com a adesão da F3.3). Sai a inferência ±2h sobre logs+`time_schedule` (`calculateDosesByDate`/`evaluateDoseTimelineState`), que reintroduzia o **slot fantasma cross-meia-noite** (dose de ontem 22:30 registrada às 00:05 virava slot de hoje) e a tolerância fixa de 120min. A classificação usa o **instante absoluto** (`scheduled_for`) e honra a **tolerância dinâmica** da ocorrência (metade do gap entre doses adjacentes) — duas doses próximas não ficam mais actionáveis ao mesmo tempo (AP-194). `missed`/`pending` agora são estados reais materializados, não derivados. tz default São Paulo (residual G1 mobile — auto-detecção de fuso é follow-up). ADR-050/054, R-248, R-231.
- **Adesão ← dose_instances + âncora de registro** (Minor, PR-F3.3 S3.6+S3.6.2, mobile 0.6.3→0.6.4): o anel de adesão do "Hoje" (`AdherenceRing`/`AdherenceDayCard`) passa a **consumir** as ocorrências materializadas (`dose_instances`) por status — adesão = `taken/(taken+missed)`, `skipped_*` neutro — em vez de **inferir** sobre logs ±2h. Janela de 7 dias (atual vs. 7d anteriores p/ a tendência); cap 0-100. **Correção crítica (AP-193):** o registro de dose no mobile (FAB `registerDose` + lote `registerDoseMany`) agora **ancora o log à ocorrência** (snap por tolerância, escopo `protocol_id`, marca `taken` + elo bidirecional) — antes o mobile inseria o log e parava, deixando-o avulso → a ocorrência ficava `pending` → o sweep diário a marcava `missed` → **falso "perdida"** que derrubava streak e adesão. Best-effort (R-245/R-246): falha de âncora não bloqueia o registro nem o estoque. Paridade com web (`logService`) e bot (`doseActions`). **Os percentuais podem mudar** — passam a refletir doses realmente perdidas. ADR-054, R-248.
- **Modal** (Minor, PR #601): Simplificada a label de quantidade no DoseRegisterModal para se adequar dinamicamente à unidade genérica "unidades".
- **Labels** (Minor, PR #601): Refatorada a label `"Dose por unidade"` para `"Concentração"` nas telas de Onboarding, Detalhes e Formulário para clareza em relação à dosagem da tomada.
- **Warning Alert** (Minor, PR #601): Adicionados alertas visuais de aviso correspondentes no Onboarding e Formulário completo de medicamentos quando a concentração for maior que `1` com unidade `'un.'`.

### Shared/Core
- **Regeneração de doses ao mudar de fuso (core)** (`no-user-impact`, PR-F4.3f.2): novo `packages/core/src/services/timezoneRegen.js` (reexportado pelo barrel `@dosiq/core`): `hasFuturePendingDoses(client, userId)` (head-count `pending` futura — governa se o prompt de intenção aparece; best-effort → false) e `regenActiveProtocolsForTz({ client, userId, tz })` que re-ancora as ocorrências futuras de **todos os tratamentos ativos** no fuso de destino — por protocolo: `wipeFuturePending` (só `pending` + futuro, nunca toca passado/taken/missed — AP-203) + `planWindow(now → computeWindowEnd, tz)`. Best-effort por tratamento (R-231/R-245/R-246): falha não derruba o lote nem desfaz o persist do fuso. Consumido pela opção "Me mudei" do prompt de troca de fuso web+mobile (F4.3f.2). ADR-049/053, R-254.
- **Geração de dose_instances no fuso do dono (write-path + cron)** (`no-user-impact`, PR-F4.3f.1): novo `resolveUserTz(client, userId)` + `resolveUserTzMap(client, userIds)` em `@dosiq/core` (lê `user_settings.timezone`, fallback SP, nunca lança). `createProtocolRepository.syncInstancesOnWrite` resolve o tz do **dono** do protocolo e o passa a `planWindow`/`computeWindowEnd` → o `scheduled_for` materializa no fuso do usuário ao criar/editar tratamento. O cron `doseInstanceScheduler.generateDoseInstances` resolve o tz por lote (`resolveUserTzMap`, 1 query — sem N+1) e o passa a `renewProtocolWindow`. `computeWindowEnd` passa a aceitar `tz` (fim-do-dia do `end_date` no fuso do dono). Fallback SP idêntico nos dois lados (consistência geração↔leitura, G2). Best-effort (R-245/246). ADR-049/053, R-231/R-090/R-042.
- **resolveSupportedTz + getDeviceTimezone (core)** (`no-user-impact`, PR-F4.3f.0): Adicionados em `packages/core/src/schemas/userSettingsSchema.js` (reexportados pelo barrel `@dosiq/core`): `getDeviceTimezone()` lê o fuso IANA do device via `Intl` em escopo de função (try/catch → `null`; respeita R-199/AP-155, Hermes legado cai no fallback) e `resolveSupportedTz(tz)` normaliza para uma opção suportada (`TIMEZONES_BR`, ADR-053) ou `DEFAULT_TIMEZONE` (`America/Sao_Paulo`). Constante `DEFAULT_TIMEZONE` exportada. `createProfileRepository` ganha `captureDeviceTimezone(timezone?)` (upsert só do tz, no-op se ausente) — usado na **confirmação de signup** (ponto primário) — e `completeOnboarding(timezone?)` passa a aceitar tz opcional como rede (grava só quando válido; ausente preserva o DEFAULT do DB, R-082). Habilita a captura de fuso no signup/onboarding web+mobile (F4.3f.0). ADR-049/053, R-231.
- **splitDayTimeline — partição carry-over/today/look-ahead (core)** (`no-user-impact`, PR-F4.3e): Adicionado `splitDayTimeline(instances, protocols, { now, tz })` em `packages/core/src/utils/doseZones.js` (CON-024 aditivo) — particiona as ocorrências em `{ carryOver, today, lookAhead }`: **today** = janela do dia local (day-bound, igual F3.2b/F4.3b); **carryOver** = ocorrências de dia(s) anterior(es) ainda actionáveis para trás (`status==='pending'` E `diff ≥ -tolerância`); **lookAhead** = ocorrências do(s) próximo(s) dia(s) já actionáveis para frente (`pending` E `diff ≤ +tolerância`). Janela deslizante **simétrica** pela `tolerance_minutes` dinâmica (não 120 fixo). Puro e tz-injetável (deriva o "hoje" do `now` injetado, não de `new Date()`). Helper único compartilhado web↔mobile (R-231) — habilita as seções "Pendências de ontem"/"Em breve" nas duas plataformas (F4.3e) sem duplicar fronteiras de dia. ADR-050/054, R-248.
- **doseZones — zonas de dose puras (core)** (`no-user-impact`, PR-F4.3a): Adicionado `packages/core/src/utils/doseZones.js` (CON-024) com `classifyDose(scheduledFor, now, …, toleranceMinutes)` (classificação temporal por instante absoluto, cutoff = tolerância da ocorrência, AP-194) e `buildDoseItemsFromInstances(instances, protocols, tz)` (DoseItems a partir de `dose_instances`, tz-injetável default SP) — movidas do hook web `useDoseZones` sem mudança de comportamento. API compartilhada web↔mobile (R-231) que habilita a migração da timeline do Hoje mobile na PR-F4.3b. ADR-050/054, R-248.
- **Schema** (Minor, PR #601): Substituída a unidade de medida padrão de "cp" para "un" no Zod Schema para dar suporte a inalatórios, adesivos e tópicos.
- **DoseUnit** (Minor, PR #601): Atualizados os formatadores centrais para tratar a unidade "un" de forma genérica ("unidade/unidades/un.") de acordo com o padrão gramatical brasileiro.
- **Planning** (Minor, PR #601): Expandido e enriquecido extensivamente o rascunho de especificação técnica para o suporte nativo a medicamentos líquidos e controle de estoque decimal no documento [LIQUID_MEDICATIONS_EPIC_DRAFT.md](file:///Users/coelhotv/git/dosiq/plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md) com análise de impacto de riscos.
- **dose_instances — motor de geração** (Minor, PR #603): Adicionado `doseInstancePlanner` (core) que orquestra a geração e persistência idempotente de ocorrências de dose, e os hooks de lifecycle de protocolo (`createProtocolRepository`) que materializam a janela ao criar/editar/pausar/religar tratamentos — best-effort (R-245). Sem impacto visível ao usuário até a Fase 3/4 (nenhuma UI consome ainda). ADR-048.
- **dose_instances — âncora de log** (Minor, PR-F2.3): Ao registrar uma tomada (web `logService.create` e bot Telegram), o log passa a ser ligado à ocorrência materializada via snap por tolerância (escopo `protocol_id`, mais próxima dentro da janela de cada slot) — a instância vira `taken` com elo bidirecional. Resolve a raiz do bug das doses cross-meia-noite (22:30 registrável após 00:00 ancora na ocorrência de ontem). Best-effort (R-246): o log é a fonte de verdade; dose fora de qualquer janela fica avulsa (`dose_instance_id=null`). Sem impacto visível ao usuário até a Fase 3/4 (adesão ainda não lê instâncias). ADR-048/050.
- **dose_instances — backfill histórico** (`no-user-impact`, PR-F2.4): Adicionado script one-shot `scripts/backfill_dose_instances.mjs` que materializa as ocorrências passadas dos protocolos de um usuário e casa os logs históricos às instâncias (`taken`), marcando as não-tomadas como `missed`. Ferramenta de migração escopada a um `userId` (R-179), com `--dry-run` obrigatório e idempotente; roda manual fora do bundle. Fecha a Fase 2 do refactor. ADR-048.
- **dose_instances — leitor de adesão (core)** (`no-user-impact`, PR-F3.1): Adicionadas funções puras `computeAdherenceFromInstances(instances, {mode})` e `computeStreakFromInstances(instances, {tz})` em `adherenceLogic` (core), que passam a derivar adesão e streak das ocorrências materializadas por status (`taken`/`missed`/`pending`/`skipped_*`) em vez de inferir sobre logs. Suportam modo `binary` (default: `taken/(taken+missed)`) e `dose_exactness` opt-in (`Σaplicado/Σesperado`, FP-1). Adicionado `countByStatus()` ao `createDoseInstanceRepository` (head-count por status, imune ao truncamento PostgREST). `skipped_*` nunca penaliza; denominador vazio → `rate=null`. Honra os 3 seams da ADR-052 (semântica de unidade, modo por protocolo, sem cap pill). Sem consumidor ainda (nenhuma UI lê) — comportamento inalterado até a PR-F3.2. ADR-048/050/052.
- **Timeline event-agnóstica — modelo + builder + adapter (core)** (`no-user-impact`, PR-F4.1 S4.1+S4.2): Adicionados `timeline.js` (builder puro `buildTimeline(events,{tz,order})` + `groupByLocalDay` + `deriveLocalDay`; modelo `TimelineEvent = {id,type,occurred_at,payload}`, `type` string aberta — FP-3/ADR-050) e `timelineService.js` (`doseInstancesToEvents` adapter `dose_instances`+`medicine_logs`→eventos `dose`, dedupe instância-ancorada=1 evento e supressão de avulso coberto por slot — AP-193; `createTimelineService.getTimeline` lê janela paginada e ordena por instante absoluto). Sem consumidor de UI ainda (histórico migra na PR-F4.2/F4.3). Limites de janela em UTC real (AP-194). ADR-050/052.
- **`getWindow` paginado (AP-186)** (Patch, PR-F4.1): `createDoseInstanceRepository.getWindow` fazia `.select('*')` sem paginação → PostgREST truncava em ~1000 linhas sem erro. Usuário pesado numa janela de 90d (ex: 1590 ocorrências) tinha adesão/timeline truncadas — o PDF mostrava "942/**1000**" (o 1000 era o teto do truncamento, não o esperado real de 1209). Agora pagina por `.range()` (leitura pura → offset seguro) até a página incompleta. Afeta `getAdherenceSummary` (90d), `getDailyAdherence`, `getTimeline` e qualquer consumidor do repo (web/mobile/bot). ADR-048.
- **Aposentadoria de `calculateAdherenceStats`** (`no-user-impact`, PR-F4.1 S4.2b): Removida a função legada de inferência de adesão ±2h sobre logs (`adherenceLogic` core + barrel `utils/index.js`, CON-018 RETIRADO) após migrar o último consumidor (`consultationDataService`) para a fonte única `dose_instances` (ADR-054). Convergência concluída: anel/sparkline/relatório/PDF/consulta derivam todos de `dose_instances`.
- **Auditoria Ampla de Qualidade e Devflow Mining** (`no-user-impact`, PR #TBD): Realizada a extração e classificação de 1.125 críticas históricas geradas pelo Gemini Code Assist antes do decommission seguro da tabela `gemini_reviews`. Reconciliados e atualizados os contadores de incidentes em mais de 10 regras e anti-padrões no ecossistema de memória (como fuso horários, ordem de hooks, validação Zod e limites de dosagem). Adicionada a nova regra construtiva `R-247` (Uso obrigatório de `maxLength` em inputs/textareas para evitar erros de truncamento Postgres 22001 e clipping visual) e o novo anti-pattern `AP-189` (Armadilha de fallback com array vazio `[]` em JavaScript).

### Backend/Infra
- **PDF clínico: adesão instance-based** (Patch, PR-F4.1 S4.2b): o `ReportGenerator` (2º consumidor de `getConsultationData`, além do Modo Consulta) agora também injeta os sumários instance-based 30d/90d (`getAdherenceSummary`) — antes o PDF saía com adesão `0/0 doses`/`0%` porque a chamada não passava os summaries (caíam no fallback vazio). Agora PDF == anel == Modo Consulta. ADR-054.
- **🔒 Fix segurança: `security_invoker` nas views de adesão** (Patch, PR-F4.1 S4.2b): `CREATE OR REPLACE VIEW` resetou o reloption `security_invoker` das views de adesão → passaram a rodar como owner e **bypassar a RLS** de `dose_instances`. Como o client as consome sem filtro `user_id` (depende de RLS), retornavam linhas de TODOS os usuários → heatmap/sparkline com células 0% e "pior horário" errados + vazamento cross-usuário. Corrigido com `ALTER VIEW ... SET (security_invoker = true)` (validado: usuário autenticado vê só as próprias 28 células, 1 por slot). AP-201.
- **Views de adesão ← dose_instances (G6)** (Patch, PR-F4.1 S4.2b, web 3.6.2→3.6.3): Reescrita a FONTE de `v_daily_adherence` e `v_adherence_heatmap` de `medicine_logs` (inferência ±2h sobre `time_schedule`) → `dose_instances` (status real), **mantendo a mesma interface de saída** (colunas/shape que Reports/PDF/Consultation/HealthHistory já consomem) e a **agregação no servidor** (R-249, mitigação OOM low-mid — client segue recebendo ~28 linhas prontas). `expected = count(taken+missed)`, `taken = count(taken)`, **clamp 0-100**, pending/skipped fora do denominador (R-248). **Mata AP-191**: no legado `expected` vinha só de `protocols.active=true` mas `taken` contava todos os logs → protocolo finalizado saía do denominador e ficava no numerador → `adherence > 100%` ("118%"). Numerador e denominador agora derivam da mesma fonte/escopo. Validado em prod: paridade view↔core (403/405) e 0 linhas >100%/<0%. **Consulta/PDF migrados** (`consultationDataService` ← summaries instance-based 30d/90d, ADR-054) — PDF == anel do dashboard. ADR-054, R-248/R-249.
- **Reconcile histórico de órfãos (one-shot)** (`no-user-impact`, PR-F4.1 S4.0.5): Varredura de todos os usuários reconciliando logs avulsos pré-âncora (AP-193) contra instâncias `missed` no mesmo slot (tolerância). DB encontrado já limpo (correção de streak F3.2 + anchoring mobile S3.6.2 zeraram os falsos-`missed`); 1 único slot `pending` ancorado por higiene. Os 123 logs sem-elo remanescentes são PRN/`quando_necessario`/freeform legítimos (sem slot na tolerância) → eventos avulsos na timeline.
- **Bot Telegram: adesão/streak ← dose_instances** (Minor, PR-F3.3 S3.7): os relatórios do bot (diário 23h, semanal, mensal) e o **streak** (confirmação de dose no `/registrar` e no fluxo conversacional) passam a **consumir** as ocorrências materializadas (`dose_instances`) por status — adesão = `taken/(taken+missed)`, `skipped_*` neutro, clamp 0-100 — em vez de **inferir** por contagem de logs ÷ `time_schedule`. Percentuais via `countByStatus` (head-count server-side, R-249/AP-186); streak via `computeStreakFromInstances` (janela 90d, ≥80%/dia). **Relatório das 23h roda `sweepMissedInstances()` antes** (E2): fecha as ocorrências vencidas cedo no dia que ainda estavam `pending` (o sweep regular é só às 3AM) — sem isso o relatório inflava a adesão. Remove `calculateStreak(logs)` legado. Paridade com web (PR-F3.2a) e mobile (PR-F3.3 S3.6). **Os percentuais podem mudar** — refletem `missed` real. ADR-054, R-248.
- **dose_instances — sweep de `missed` + self-heal** (Minor, PR-F2.5): Adicionado o **writer #3** da máquina de estados — o cron diário (`api/generate-doses.js`) agora varre ocorrências `pending` cuja janela de tolerância expirou (`scheduled_for + tolerance_minutes < agora`) e as marca `missed` (`markMissedDueInstances`, paginado/idempotente). Sem ele, doses esquecidas ficavam `pending` para sempre, inflando a adesão e impedindo o streak de quebrar (gap detectado na F3.2, AP-190). Complementarmente, a âncora (`findAnchorInstance`/`markTaken`) passou a aceitar instâncias `missed` além de `pending`: um registro retroativo dentro da tolerância (ex.: paciente que ficou offline e registra as doses do dia anterior, ou o FAB de dose com data/hora) reverte `missed → taken` (self-heal). ADR-048, R-246.
- **Web Push Channel** (Patch, Spec #2): Implementado o canal de disparo `web_push` no Dispatcher Central de notificações usando chaves VAPID (`web-push` NPM). Suporta detecção proativa de erros 410 Gone / 404 Not Found para inativação instantânea de tokens inválidos na tabela `notification_devices`.
- **Serverless Consolidation** (Patch, PR #606): Refatoração para consolidação dos endpoints Vercel, combinando `api/beta-signup.js` e `api/register-webpush.js` dentro do roteador `api/users.js` para reduzir a contagem de funções consumidas do limite do plano Hobby (R-090). A rota sem uso `api/health/notifications.js` foi removida.
- **Telegram Bot** (Minor, PR #601): Ajustado o formatador de quantidade de tomadas do bot do Telegram para suportar "un", mantendo comprimidos ("cp") para dosagens em massa (mg/mcg/g) e melhorando líquidos ("ui") para que sejam representados de forma autônoma.
- **dose_instances — cron de geração** (Minor, PR #603): Adicionado cron diário (03:15) no bot que renova a janela de 30 dias dos protocolos ativos e limpa pendentes de protocolos pausados há mais de 1 dia. Roda no processo Node persistente (sem consumir budget de funções Vercel). ADR-048.
- **dose_instances — motor em produção** (Minor, PR #604): Endpoint serverless dedicado `api/generate-doses.js` (cron-job.org 1×/dia) executa o motor de geração em produção, isolado do invoke de notificações (ADR-051) — geração não compromete o caminho crítico de lembretes. Geração passa a buscar apenas protocolos "due" no banco (escala) e elimina SELECT redundante de high-water-mark. Corrige o motor que só rodava em dev via node-cron (AP-182).
- **Segurança — auth de cron falha-fechado** (Patch, PR #604): Os validadores de cron (`api/generate-doses.js` e `api/notify.js`) agora rejeitam a requisição quando `CRON_SECRET` não está configurado. Sem a guarda, `CRON_SECRET` indefinido tornava a comparação `Bearer undefined`, permitindo que qualquer requisição com esse cabeçalho burlasse a autenticação (AP-183, reportado pelo Gemini no PR #604).
- **Correção — resolução ESM do locale do Zod** (Patch): Adicionada extensão `.js` explícita ao import `zod/v4/locales/pt` em `packages/core/src/zodSetup.js`. O exports glob do Zod não anexa extensão; Vite/vitest resolviam mesmo assim, mas o runtime serverless da Vercel (Node ESM estrito) falhava com `ERR_MODULE_NOT_FOUND`, derrubando o motor de geração de doses no primeiro invoke em produção (AP-184).
- **Process** (`no-user-impact`, PR #TBD): Padronizado o processo SQP para exigir classificação de impacto, versionamento, changelog estruturado em português e notas de loja deriváveis antes de novas entregas com alteração de código.
- **Deprecação de Gemini Reviews** (`no-user-impact`, PR #607): Decommissionados todos os endpoints da API Vercel de persistência e sincronização de reviews (`api/gemini-reviews.js` e diretório `api/gemini-reviews/`). Removido o script de upload para o Vercel Blob (`.github/scripts/upload-to-vercel-blob.cjs`) e desinstalada a dependência `@vercel/blob` do monorepo.
- **Workflow Actions** (`no-user-impact`, PR #607): Refatorado o workflow `.github/workflows/gemini-review.yml` para remover completamente os jobs `upload-to-blob`, `persist` e `create-issues`, simplificando o processo de feedback e mantendo a verificação de resoluções de forma 100% local no GitHub.

## [4.1.0] — 2026-04-28

### 📱 Mobile & Backend: Schema Alignment & Personalization
- **Complexity Override**: Usuários podem agora forçar o dashboard para modo "Simples" ou "Complexo", ignorando a heurística automática de quantidade de medicamentos.
- **Quiet Hours Toggle**: Adicionada opção para ativar/desativar o período de silêncio globalmente.
- **Backend Sync**: Dispatcher de notificações e repositório de preferências atualizados para respeitar as novas colunas `quiet_hours_enabled` e `complexity_override`.
- **Normalization**: Alinhamento total do app mobile com a tabela `user_settings` (colunas em inglês).


## [4.0.0] — 2026-04-09 — Santuário Terapêutico Complete ✨

### 🎨 **Major: Design System Overhaul**
- Santuário Terapêutico design (Waves 0-16) agora padrão em 100% das telas
- Nova paleta: Health Green (#006a5e) + Clinical Blue (#005db6)
- Tipografia moderna: Public Sans (display) + Lexend (body)
- Border radius: mínimo 0.75rem (healthcare-appropriate aesthetics)
- Shadow system: ambient (Material Design 3) em lugar de glows

### ♿ **Major: WCAG 2.1 AA Accessibility**
- Font weights ≥400 only (elderly users, geriatric compliance)
- Todos os ícones pareados com text labels
- Motion preferences respeitadas via `useReducedMotion()`
- Color contrast ratios verificados (4.5:1 minimum)
- Touch targets ≥44px, keyboard navigation completa

### 📱 **Major: Mobile Performance**
- Bundle: 989kB → 102.47kB gzip (89% reduction)
- Lazy loading em 13+ views com ViewSkeleton pattern
- Dashboard queries: 13+ → 1 (promise coalescence cache)
- Mobile FCP: ~500ms mais rápido
- Vite manualChunks: 8 vendor/feature chunks

### 🤖 **New: AI Chatbot Multi-Canal**
- Groq API com prompt caching
- Web + Telegram unified assistant
- Context-aware recomendações
- Safety guard + hallucination mitigations
- Active ingredient grounding (temperature 0.2)

### 🎛️ **New: Navigation Redesign**
- BottomNav (mobile) + Sidebar (desktop)
- Framer Motion page transitions (6 motion archetypes)
- Responsive layout with CSS Grid
- Keyboard-friendly navigation

### 📊 **Improvements: Dashboard & Insights**
- Adherence widgets redesigned
- Smart alerts (adherence, stock, protocols)
- Cost analysis view
- Health history com calendar navigation
- Ring gauge + sparkline visualizations

### 🏥 **Improvements: Clinical Features**
- Consultation mode (read-only medicines)
- Clinical PDF reports via jsPDF
- ANVISA drug database (819KB feature chunk)
- Therapeutic class field

### ✅ **Improvements: Protocol Management**
- Enhanced treatment wizard
- Titration schedule support
- Protocol reminders via Telegram bot
- Duration validation (start/end dates)

### 📦 **Improvements: Stock & Inventory**
- Four-tier system (CRITICAL/LOW/NORMAL/HIGH)
- FIFO inventory management
- Expiration tracking
- Cost analytics

### 🔧 **Technical: Architecture**
- Feature-based organization (src/features/)
- Zod validation everywhere
- Supabase RLS enforcement
- Telegram bot com message deduplication
- QueryCache + SWR adherence

### 🚀 **Infrastructure**
- 6/12 serverless functions: DLQ, Gemini, health, notify, share, telegram
- GitHub Actions + Gemini Code Assist review
- Vercel Hobby deployment (grátis)

### 🗑️ **Breaking Changes**
- Feature flag infrastructure removed (`RedesignContext`, `useRedesign`)
- Neon colors removed (`--neon-*` tokens)
- Legacy views deleted (Dashboard, Stock, HealthHistory, etc.)
- BottomNav replaced with BottomNavRedesign
- Old theme tokens (tokens.redesign.css) consolidated to sanctuary.css

### 📚 **Documentation**
- Complete redesign system docs
- Mobile performance standards
- Bot architecture guide
- Chatbot AI integration guide
- Release migration guide (v3.x → v4.0.0)

### 📊 **Metrics**
- Lighthouse Performance: ≥90
- Lighthouse Accessibility: ≥95
- Test coverage: 32 test files, 543+ tests
- Bundle size: 102.47kB gzip (main)

---

## [3.0.0] - 2026-02-18

### Protocol Start/End Dates for Accurate Adherence

#### ✨ Novas Funcionalidades
- **Campos `start_date` e `end_date` em protocolos**: Nova coluna para definir período de vigência
  - Cálculo de adesão agora considera apenas dias a partir da data de início
  - Corrige problema onde protocolos novos exibiam score artificialmente baixo
  - Usuários podem definir duração do protocolo ou deixar em aberto
- **Módulo `dateUtils.js`**: Funções compartilhadas para manipulação de datas
  - `parseLocalDate()` - Converte string para data em timezone local
  - `formatLocalDate()` - Formata data para string YYYY-MM-DD
  - `isProtocolActiveOnDate()` - Verifica se protocolo está ativo em uma data

#### 🔄 Mudanças
- **Cálculo de Adesão**: Refatorado para respeitar limites de data do protocolo
  - `effectiveDays` agora considera apenas dias entre `start_date` e data atual
  - Protocolos com `end_date` definido não são considerados após término
- **Manipulação de Datas**: Padronizada para timezone local (GMT-3 para Brasil)
  - Todas as comparações de data usam `new Date(dateStr + 'T00:00:00')`
  - Eliminada inconsistência entre UTC e timezone local

#### 🐛 Correções
- **Inconsistência de timezone em validação de datas**: `protocolSchema.js` agora usa timezone local
- **Bug de cálculo de effectiveDays**: Removido dia extra que era adicionado incorretamente
- **Duplicação de código**: Função `isProtocolActiveOnDate` centralizada em `dateUtils.js`

#### 📦 Commits Incluídos
- Criação de módulo `dateUtils.js` com funções compartilhadas
- Atualização de `adherenceService.js` para usar novas funções
- Atualização de `adherenceLogic.js` para re-exportar funções
- Correção de timezone em `protocolSchema.js` (3 arquivos)
- Migração SQL para adicionar colunas `start_date` e `end_date`

#### 📊 Estatísticas
- **3 arquivos novos**: `dateUtils.js`, migração SQL
- **5 arquivos modificados**: adherenceService, adherenceLogic, protocolSchema (x3)
- **166 testes passando**: Sem regressões

---

## [2.9.0] - 2026-02-17

### Telegram MarkdownV2 Escape System

#### ✨ Novas Funcionalidades
- **Função `escapeMarkdownV2()`**: Escape de 18 caracteres reservados do Telegram MarkdownV2
  - Caracteres: `_ * [ ] ( ) ~ \` > # + - = | { } . !`
  - Aplicado em todos os comandos, callbacks e tasks do bot
- **63 testes unitários**: Cobertura completa de edge cases
- **Documentação consolidada**: [`docs/architecture/NOTIFICATIONS.md`](docs/architecture/NOTIFICATIONS.md)

#### 🐛 Correções
- **Erro DLQ resolvido**: "Character '!' is reserved and must be escaped"
- **Unidade de dosagem dinâmica**: Mensagens de estoque insuficiente agora mostram mg/ml/U/mcg corretamente
- **Escape consistente**: Todos os textos de usuário agora escapados corretamente

#### 📦 Commits Incluídos
- PR #32: Criar função escapeMarkdownV2
- PR #36: Adicionar testes unitários (63 testes)
- PR #42: Atualizar tasks.js com escape
- PR #44: Atualizar comandos do bot com escape
- PR #47: Atualizar callbacks do bot com escape

---

## [2.8.1] - 2026-02-16

### Telegram Bot Reliability

#### 🐛 Correções Críticas
- **P0**: Removido import de `retryManager.js` inexistente que causava falha no deploy
- Simplificado `sendDoseNotification` para usar `bot.sendMessage()` diretamente
- Helper function `wrapSendMessageResult` para reduzir duplicação

#### ✨ Novas Funcionalidades
- **P1A - DLQ Admin Interface**: Interface administrativa para gerenciar notificações falhadas
  - API endpoints: GET `/api/dlq`, POST `/api/dlq/:id/retry`, POST `/api/dlq/:id/discard`
  - View em `/admin/dlq` com tabela, filtros e paginação
  - Modal de confirmação para ações destrutivas
- **P1B - Daily DLQ Digest**: Digest diário enviado às 09:00 (horário de Brasília)
  - Lista até 10 notificações falhadas (status: pending, retrying)
  - Mensagem formatada em MarkdownV2
  - Requer configuração de `ADMIN_CHAT_ID` na Vercel
- **P1C - Simple Retry**: Retry automático de 2 tentativas
  - Identificação de erros retryable (network, rate limit, HTTP 5xx)
  - Delay simples de 1 segundo entre tentativas
  - Helper `isRetryableError` para categorização

#### 📊 Estatísticas
- **4 PRs mergeados**: #26, #27, #28, #29
- **8 arquivos novos**: DLQ API endpoints, view admin, retryManager
- **162 testes passando**: 13 novos testes para retryManager

#### ⚙️ Configuração Necessária
Para ativar o digest diário, configure a variável de ambiente na Vercel:
```bash
ADMIN_CHAT_ID=123456789  # Obter via @userinfobot no Telegram
```

---

## [2.8.0] - 2026-02-12

### Phase 4: Distribuição e Navegação

#### 🚀 Added

**F4.1: Hash Router & Deep Linking**
- Hook `useHashRouter` para navegação baseada em hash
- Componente `HashRouter` com lazy loading de rotas
- 9 rotas implementadas:
  - `#/dashboard` - Dashboard principal
  - `#/medicamentos` - Lista de medicamentos
  - `#/medicamento/:id` - Detalhes do medicamento
  - `#/estoque` - Gestão de estoque
  - `#/historico` - Histórico completo
  - `#/historico/:periodo` - Histórico filtrado (7d/30d/90d)
  - `#/protocolos` - Lista de protocolos
  - `#/perfil` - Perfil e configurações
  - `#/onboarding` - Wizard de primeiros passos
- Suporte a deep links do Telegram
- Integração com histórico do navegador

**F4.2: PWA Infrastructure**
- Integração com `vite-plugin-pwa`
- `manifest.json` com metadados completos
- Ícones PWA em 8 tamanhos: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Service Worker com estratégias Workbox:
  - `CacheFirst` para JS/CSS/imagens (30 dias)
  - `StaleWhileRevalidate` para API Supabase (5 min)
  - `NetworkOnly` para operações de escrita
- Componente `InstallPrompt` para iOS e Android
- Utilitários `pwaUtils.js` para detecção de plataforma
- Meta tags para suporte Safari iOS

**F4.3: Push Notifications**
- Servidor de notificações push com VAPID
- API endpoints:
  - `POST /api/push-subscribe` - Gerenciamento de inscrições
  - `POST /api/push-send` - Envio de notificações
- Hook `usePushSubscription` para controle de inscrições
- Componente `PushPermission` para UI de permissões
- 3 tipos de notificações:
  - Lembretes de dose agendada
  - Alertas de dose atrasada (t+15min)
  - Alertas de estoque baixo (<= 3 dias)
- Rate limiting: máximo 10 pushes/dia/usuário
- Migração SQL: `008_push_subscriptions.sql`

**F4.4: Analytics PWA Integration**
- Extensão do `analyticsService` com eventos PWA
- 7 novos eventos trackados:
  - `pwa_installed` - App instalado
  - `pwa_install_prompt_shown/response/dismissed` - Interações com prompt
  - `push_opted_in/out` - Opt-in/opt-out de push
  - `push_permission_prompt_shown/dismissed` - UI de permissão
  - `offline_session` - Uso offline
  - `deep_link_accessed` - Navegação via deep links
  - `view_changed` - Navegação interna
- Privacy-first: sem PII, dados em localStorage apenas
- LGPD compliant

**F4.5: Bot Standardization**
- `server/bot/utils/messageFormatter.js` - Formatação MarkdownV2
- `server/bot/utils/errorHandler.js` - Tratamento de erros
- 49 testes unitários para utilitários do bot
- Refatoração de 10 handlers:
  - `start.js`, `hoje.js`, `estoque.js`, `historico.js`
  - `status.js`, `proxima.js`, `registrar.js`, `ajuda.js`
  - `adicionar_estoque.js`, `protocols.js`
- >30% redução de código duplicado
- Mensagens de erro padronizadas em português

**F4.6: Feature Organization**
- Nova estrutura de pastas:
  ```
  src/features/
  ├── adherence/       # Adesão: components, hooks, services, utils
  ├── dashboard/       # Dashboard: widgets e utilitários
  ├── medications/     # Medicamentos
  ├── protocols/       # Protocolos
  └── stock/           # Estoque

  src/shared/
  ├── components/      # UI, log, gamification, onboarding
  ├── hooks/           # useCachedQuery, useTheme, etc
  ├── services/        # cachedServices, migrationService
  ├── constants/       # Schemas Zod
  ├── utils/           # queryCache, supabase
  └── styles/          # CSS tokens e temas
  ```
- Path aliases no Vite:
  - `@` → `src/`
  - `@features` → `src/features/`
  - `@shared` → `src/shared/`
  - `@dashboard`, `@medications`, `@protocols`, `@stock`, `@adherence`
- 150+ arquivos migrados
- 100% backward compatible

#### 📊 Stats
- **Total de testes**: 140+ (93 críticos + 11 smoke + 36+ componentes)
- **Test coverage Phase 4**: 100%
- **Bundle size**: 762KB (gzipped: 219KB)
- **Build time**: ~9.5s
- **Lighthouse PWA score**: >= 90
- **Lighthouse Performance**: >= 90

---

## [2.7.0] - 2026-02-11

### Phase 3.6: Component Consolidation Wave

#### 🚀 Added
- Consolidation de 6 grupos de componentes (~783 linhas removidas)
- `MedicineForm` unificado com `FirstMedicineStep` via props de onboarding
- `ProtocolForm` com modos `full` e `simple`
- `Calendar` com features opcionais (lazyLoad, swipe, monthPicker)
- `AlertList` componente base para alertas
- `LogForm` UX padronizada
- 100% backward compatibility

---

## [2.6.0] - 2026-02-10

### Fase 3.5: Design Uplift

#### 🚀 Added
- Glassmorphism hierárquico (4 níveis)
- Gradientes temáticos
- Micro-interações e animações
- Tokens CSS completos
- `InsightCard` com 11 variantes
- Hooks `useAdherenceTrend` e `useInsights`
- Serviços `adherenceTrendService` e `insightService`

---

## [2.2.1] - 2026-01-31

### Correções do Bot Telegram

#### 🔧 Fixed
- Bot funciona com múltiplos usuários (removido MOCK_USER_ID)
- Cron jobs notificam todos os usuários com Telegram vinculado
- Sistema de logs estruturados (ERROR → TRACE)
- Health checks via comando `/health`
- Reconexão automática em erros de rede

#### 🚀 Added
- Validação de token do Telegram na inicialização
- Tratamento de erros nos comandos do bot
- Cache de protocolos por usuário
- Compatibilidade com cron-job.org

---

## [2.0.0] - 2026-01-15

### Multi-User Auth

#### 🚀 Added
- Autenticação segura via Supabase Auth
- Isolamento de dados com RLS
- Integração Telegram 2.0 com tokens temporários

---

## Notas de Versão

### Convenções de Versionamento

- **MAJOR**: Mudanças incompatíveis com versões anteriores
- **MINOR**: Novas funcionalidades, mantendo compatibilidade
- **PATCH**: Correções de bugs, sem novas funcionalidades

### Referências

- [Documentação Completa](./docs/)
- [Setup e Instalação](./docs/SETUP.md)
- [Guia de Contribuição](./docs/PADROES_CODIGO.md)
