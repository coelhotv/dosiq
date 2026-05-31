# Changelog - Dosiq

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### Web/PWA
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
- **Adesão ← dose_instances + âncora de registro** (Minor, PR-F3.3 S3.6+S3.6.2, mobile 0.6.3→0.7.0): o anel de adesão do "Hoje" (`AdherenceRing`/`AdherenceDayCard`) passa a **consumir** as ocorrências materializadas (`dose_instances`) por status — adesão = `taken/(taken+missed)`, `skipped_*` neutro — em vez de **inferir** sobre logs ±2h. Janela de 7 dias (atual vs. 7d anteriores p/ a tendência); cap 0-100. **Correção crítica (AP-193):** o registro de dose no mobile (FAB `registerDose` + lote `registerDoseMany`) agora **ancora o log à ocorrência** (snap por tolerância, escopo `protocol_id`, marca `taken` + elo bidirecional) — antes o mobile inseria o log e parava, deixando-o avulso → a ocorrência ficava `pending` → o sweep diário a marcava `missed` → **falso "perdida"** que derrubava streak e adesão. Best-effort (R-245/R-246): falha de âncora não bloqueia o registro nem o estoque. Paridade com web (`logService`) e bot (`doseActions`). **Os percentuais podem mudar** — passam a refletir doses realmente perdidas. ADR-054, R-248.
- **Modal** (Minor, PR #601): Simplificada a label de quantidade no DoseRegisterModal para se adequar dinamicamente à unidade genérica "unidades".
- **Labels** (Minor, PR #601): Refatorada a label `"Dose por unidade"` para `"Concentração"` nas telas de Onboarding, Detalhes e Formulário para clareza em relação à dosagem da tomada.
- **Warning Alert** (Minor, PR #601): Adicionados alertas visuais de aviso correspondentes no Onboarding e Formulário completo de medicamentos quando a concentração for maior que `1` com unidade `'un.'`.

### Shared/Core
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
