# Changelog - Dosiq

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### Mobile (0.14.0 → 0.15.0)
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
