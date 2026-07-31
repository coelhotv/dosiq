# Changelog - Dosiq

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Documentação técnica reorganizada e expandida (spec 049, épico completo)

- **Docs** (`no-user-impact` — docs-only, sem alteração de código). Épico 049 (docs-revamp pós-040 TypeScript) concluído em 5 fases: F1 schema YAML + validador, F2 frontmatter em 54 docs, F3 atualização JS→TS em 58 docs, F4 limpeza estrutural (merge getting-started/setup, remoção guides/reports/releases), F5 criação de 14 docs novos + 2 rewrites cobrindo gaps de mobile, monorepo, TypeScript, server notifications, API endpoints, core schemas/repositories e Live Activities. INDEX.md regenerado com catálogo de 73 docs ativos. 73/73 docs validados pelo frontmatter validator.

### Preferência de estoque sobrevive offline (spec 044, 055-W1.7)

- **Fix** (JS-only, sem bump de `APP_VERSION` — elegível a OTA sobre o binário atual, R-221 §4).
  Antes, se o app abrisse sem conexão (modo avião, sinal ruim), a falha de rede era tratada como
  "nunca soube da preferência" e reativava o estoque por omissão — mesmo que o usuário tivesse
  desligado o controle de estoque explicitamente. Agora `useStockTracking` persiste a preferência
  (`enabled` + `pausedAt`) em cache local a cada leitura remota bem-sucedida e usa uma escada de
  3 degraus na falha: remoto → cache local → só então o default ativo original (que continua
  valendo na 1ª abertura, storage limpo — nunca esconde o estoque de quem nunca declarou nada).
  A tab bar também deixa de esperar a rede pra montar quando já existe cache: some o spinner à
  toa offline antes de cair no default. Preferência é invalidada no logout (não vaza entre
  contas no mesmo aparelho). Saldo de estoque continua 100% servidor (FIFO decidido pelo banco,
  AP-231) — o cache é só da política liga/desliga.

### Aplicação de OTA em sessão viva (spec 051-A, PR 1.6b)

- **Feature** (release OTA sobre `0.30.0` — **sem bump de `APP_VERSION`**, ADR-082: mudança
  JS-only, bumpar criaria `runtimeVersion` novo e tornaria o update órfão, nunca alcançando os
  binários `0.30.0` já instalados/publicados na loja). Identidade da release: `[0.30.0+ota.N]` +
  updateId + SHA da main, atualizado no publish real.

  O app passa a checar e baixar update do EAS Update também com o processo já vivo (`AppState` →
  `active`, throttle ~15min) — antes só o cold start (checagem nativa no launch, FR-005) acionava
  a checagem, e o padrão de uso brasileiro de deixar o app minimizado por dias deixava a
  alcançabilidade do ADR-088 pela metade.

  A aplicação continua exclusivamente por decisão do usuário: banner fixo "Atualização pronta ·
  Reiniciar" na aba Hoje, visível só quando a tela está ociosa (nenhum modal de registro de dose
  aberto, nenhum alarme na tela — reusa `useAlarmScreenActive` do PR 1.5b). `Updates.reloadAsync()`
  nunca dispara sozinho: recarregaria a árvore React inteira e apagaria formulário meio preenchido,
  tela de alarme ou fluxo de estoque em andamento.

  Banner reusa o COMPONENTE `NudgeBanner` (consistência visual, zero CSS novo), não o pipeline de
  `useNudges` — nudge é dado remoto (`in_app_nudges`), o estado de update pronto é local do device.
  Quem só fecha e reabre o app (cold start) continua recebendo o update sem ver banner nenhum — a
  FR-005 não muda.

### Atualizações OTA (EAS Update) no app mobile (spec 051-A, PR 1.6)

- **Feature** (`minor`, mobile `0.29.3 → 0.30.0`): o app passa a embutir o cliente `expo-updates`,
  tornando-se **a primeira versão alcançável por OTA**. A partir dela, uma correção JS-only chega à
  base instalada em minutos/horas, sem depender de revisão de loja — o custo que o incidente #755
  cobrou por inteiro.

  O bump para `0.30.0` (e não `0.29.4`) marca deliberadamente a fronteira de capacidade da Onda 1:
  Expo SDK 54, kill switch de versão mínima e canal OTA. Sob a política do ADR-082 o
  `runtimeVersion` **é** o `APP_VERSION`, então esta é a versão-raiz de todos os OTAs futuros:
  releases OTA sobre ela usam `[0.30.0+ota.N]` e **não** bumpam a versão.

  Inclui:
  - `runtimeVersion` = `APP_VERSION` como valor literal (não `{policy:'appVersion'}`, que aborta o
    build local por causa do `expo prebuild` — ver `docs/operations/GUIA_OTA_EAS_UPDATE.md` §1.2);
  - canal explícito nos 3 perfis de build + perfil `preview` novo, alvo do teste destrutivo
    anti-bricking (que nunca roda em `production`);
  - **code signing** (ADR-083): o cliente rejeita bundle não assinado pela chave do projeto;
  - `fallbackToCacheTimeout: 0` — o boot nunca espera rede, preservando o offline-first (AP-303);
  - identificação do bundle (`updateId` curto + canal) na tela de Perfil, porque com OTA a versão
    deixa de identificar o código em execução;
  - `update_id`/`channel`/`runtime_version` no Sentry e no PostHog — responde "esse crash veio de
    qual update?", a pergunta que decide reverter ou avançar o rollout.

  **Nota de loja:** o benefício não é retroativo. Esta versão precisa ir à loja uma vez; OTAs só
  fluem para quem instalar dela em diante.

### Kill switch de versão mínima — painel admin web (spec 051-A, PR 1.5c)

- **Feature** (`minor`, web `4.21.0 → 4.22.0`): painel `VersionGateAdmin` (`admin-version-gate`,
  atalho em Configurações → Administração) para editar as 2 linhas semeadas do gate (iOS/Android) —
  **edit-only** por desenho (RC3-2/F6): sem create/delete/lista, as linhas já existem desde a
  migração do PR 1.5a.
- **Segurança**: a guarda de raio de impacto (`acknowledge_affected_devices`, S-7) mora inteira no
  handler — a tela só **exibe** a contagem que o servidor devolve na recusa 4xx, nunca a calcula por
  conta própria (evita reintroduzir a divergência histórica do F3). Ativar exige o passo de
  confirmação explícita; desativar não exige cerimônia — destravar tem de ser imediato (PO-9).
- **PO-SEC-8** (ADR-091 D9, invariante NC6): confirmado por smoke com device real — com o gate
  Android ativo bloqueando o boot, o painel web (fora do escopo do gate por construção) continuou
  acessível e desativou sem exigir acknowledge.
- Sem mudança em `api/` (handler `versionGate` já existia desde o PR 1.5a).

### Kill switch de versão mínima — cliente mobile (spec 051-A, PR 1.5b)

- **Feature** (`patch`, mobile `0.29.2 → 0.29.3`; `@dosiq/core` `0.19.0 → 0.20.0`): o app passa a
  consultar `app_version_gate` (PR 1.5a) no boot e bloquear versões abaixo do piso configurado —
  overlay full-screen não-dismissível ("Atualize seu app para continuar") com CTA pra loja e saída
  honesta pra `https://dosiq.app` (dados de saúde continuam acessíveis pelo navegador, mesmo
  bloqueado — postura LGPD art. 18, ADR-091 D7).
- **Resolver puro** `resolveVersionGate` (novo, `@dosiq/core/utils`, CON-033 accepted): tabela-verdade
  do FR-018 — qualquer indeterminação (offline, timeout, erro do PostgREST, linha ausente,
  `is_active=false`, versão min/instalada inválida) **abre** o app; só bloqueia com comparação
  semântica válida abaixo do piso. `satisfiesSemver` deliberadamente não usado (fail-closed por
  design, inverteria a semântica no boot — AP-303).
- **Segurança**: `store_url` validado pela allowlist do core (`isAllowedStoreUrl`, mesma do PR
  1.5a) — fora dela cai pro fallback compilado por plataforma, nunca abre URL arbitrária; `message`
  remoto renderizado como `<Text>` puro, com cap, nunca vira link/markup; leitura como `anon`
  (antes de sessão existir), `error` do `supabase-js` inspecionado explicitamente, **sem cache**
  do estado de bloqueio (bricaria o offline pra sempre); reavaliação também no foreground
  (`AppState 'active'`), não só no mount — app minimizado por dias precisa ver o gate se ligar.
- **Obrigação clínica > bloqueio de update**: o overlay cede (`useAlarmScreenActive`) quando a
  tela cheia do alarme (`AlarmFullScreen`) é a rota atual — dose crítica nunca fica escondida
  atrás do aviso de versão.
- **Fix correlato** (achado no smoke desta PR, fora do escopo original mas mesma superfície de
  boot/navegação — AP-321/AP-322): `describeLoadFailure` (core) parava de vazar mensagem de erro
  crua em inglês (rede/JS) quando o fallback offline sem cache relançava o erro original;
  `useTreatments.ts` parava de coalescer `null`↔`[]` na fronteira hook→tela (offline com dados
  reais mostrava "sem tratamentos" em vez do aviso de conexão); `StockScreen.tsx` parava de
  ignorar o `error` real do hook com uma mensagem hardcoded; `AlarmSchedulerBridge.tsx` ganha
  retry (mesmo padrão de `usePushNotifications.ts`) pra `openAlarmScreen` não desistir quando o
  `NavigationContainer` ainda não montou no tap de notificação em cold start.

### Kill switch de versão mínima — superfície de configuração e autorização de admin (spec 051-A, PR 1.5a)

- **Feature** (`minor`, web `4.20.2 → 4.21.0`, `@dosiq/core` `0.18.0 → 0.19.0`; mobile **não**
  afetado — o cliente do gate é o PR 1.5b): nasce a tabela `public.app_version_gate` (uma linha por
  plataforma, ambas semeadas **desligadas**) e o endpoint admin que a escreve
  (`PATCH /api/admin?resource=versionGate`, dentro do router existente — sem função serverless nova).
  A partir daqui existe política de versão mínima acionável: é o mecanismo que encerra a Era 1 do
  ADR-088 (*"nenhum DROP, sem exceção"*), aberta pelo outage de 2026-07-22.
- **Segurança** (`minor`): a autorização de admin deixa de derivar de `telegram_chat_id` em
  `user_settings` e passa a comparar o `auth.users.id` autenticado com `ADMIN_USER_ID`
  (ADR-091 D10 / RC-SEC-2 S-6, CRITICAL). O modelo anterior era auto-atribuível — a policy de UPDATE
  de `user_settings` não restringe coluna e `authenticated` tem o privilégio nela, então qualquer
  conta podia se promover a admin escrevendo o chat_id do admin na própria linha. Fail-closed: env
  ausente nega todo acesso. ⚠️ **`ADMIN_USER_ID` precisa existir no ambiente** (já criada na Vercel em
  Preview+Production) — sem ela o painel admin devolve 401 em tudo, por desenho.
- **Segurança** (`minor`): acesso à tabela em **duas camadas independentes** — privilégio de escrita
  revogado de `anon`/`authenticated` (o `REVOKE ... FROM PUBLIC` não bastaria: os privilégios vêm de
  `ALTER DEFAULT PRIVILEGES` nomeando os roles) **e** RLS com uma única policy de `SELECT`, sem
  nenhuma policy de escrita. Leitura liberada para `anon` porque o gate roda no boot, antes de haver
  sessão. O grant de leitura é **column-scoped** nas 5 colunas do contrato: `select=*` devolve `42501`
  de propósito, para que o uuid do admin não vá ao cliente.
- **Guarda de raio de impacto**: ativar o gate exige `acknowledge_affected_devices` igual à contagem
  que o **servidor** faz da frota afetada (instalações da plataforma abaixo do piso). A recusa nomeia
  o número correto, então operar por `curl` passa pela mesma cerimônia que o painel. Desativar **não**
  exige confirmação — destravar a base tem de ser imediato.
- **Refactor**: a contagem de frota (união `notification_devices ∪ device_activity`, janela de 30
  dias, dedupe por `(user_id, platform)`) sai do heredoc de `scripts/fleet-versions.sh` e passa a
  viver em `@dosiq/core/utils`, consumida por script **e** handler — o acknowledge compara o número
  que o operador viu com o que o servidor conta, e duas implementações divergiriam em silêncio.
  Paridade verificada contra a implementação anterior sobre os dados reais de produção.
- **Testes**: `api/` ganha sua primeira suíte (o handler, 4 casos do acknowledge + validação +
  falhas de infraestrutura), e o `include` do vitest passa a cobrir `api/**` nos dois configs —
  sem isso o arquivo existiria sem nunca ser executado.
- Painel admin web fica no PR 1.5c; o kill switch no cliente, no PR 1.5b.

### Edge-to-edge Android 16 + keyboard-avoidance corrigida em 12 telas (spec 055, PR 1.4)

- **Fix** (`patch`, mobile `0.29.1 → 0.29.2`; **nota de loja relevante** — melhoria visível de UX):
  target API 36 força edge-to-edge no Android — o rodapé de ação fixo (`FormActions`, usado em
  12 telas de formulário) ficava sem respiro do gesture bar/home indicator. Corrigido com
  `useSafeAreaInsets` + zero-out condicional ao teclado (`useKeyboardVisible`, hook canônico).
- **Achado maior no smoke com o PO:** `KeyboardAvoidingView` com `behavior=undefined` no Android
  é NO-OP sob `edgeToEdgeEnabled` — `adjustResize` do AndroidManifest vira letra morta e o
  teclado cobria inputs/rodapé (2ª incidência do AP-288, agora promovido a **R-303**, hard rule).
  Migradas: `MedicineFormScreen`, `FeedbackScreen`, `ProfileEditScreen`, `ChangePasswordScreen`,
  `ProtocolFormScreen`, `TitrationFormScreen`, `StockAdjustmentScreen`, `PurchaseFormScreen`, os
  2 steps de onboarding (medicamento/tratamento) e os 2 sheets de busca (ANVISA/medicamento) —
  todos para `behavior='height'` no Android, sem `keyboardVerticalOffset` chutado (removido de
  todos; o componente mede a própria posição via `onLayout` interno).
- T040 (inventário via grep) confirmou alarme/Hoje/detalhe de tratamento já corretos de fixes
  anteriores (`ScreenContainer`, `RootTabs` R4-H01) — sem regressão nessas telas.
- Validado com screenshots antes/depois em Android (emulador API 36 + device físico com teclado)
  e iOS, múltiplas rodadas com o PO até o gap residual (offset chutado, depois zero-out
  duplicado no Android) ser eliminado nos dois SOs.

### Bump Expo SDK 53 → 54 (spec 055, PR 1.1)

- **Chore** (`minor`, mobile `0.28.5 → 0.29.0`; `patch`, web `4.20.1 → 4.20.2`): bump estrutural do
  Expo SDK 53→54 via `expo install --fix` — 23 módulos nativos e `react`/`react-native` sobem
  (`react-native 0.79.6 → 0.81.5`, `react 19.0.0 → 19.1.0`). `react`/`react-dom` vivem na RAIZ do
  monorepo (arquivo de deps de facto do web, que não os declara em separado) — o bump muda o React
  do web também, mesmo sem tocar componentes. `npm ls react react-dom` confirma uma única versão
  `19.1.0` resolvida em toda a árvore (mobile, web, root), sem duplicata — duplicata de `react` em
  RN vira `Invalid hook call` em runtime, silencioso até o crash.
- Devdep `jest-expo` sobe `~53.0.0 → ~54.0.17` (tag `sdk-54` não existe no npm; versão pinada
  manualmente pela última `54.x.x` estável, já que o SDK 54 não tem dist-tag dedicada).
  `react-test-renderer` alinhado a `19.1.0` (deve casar com `react` exatamente).
- `expo install --fix` não conseguiu escrever plugins novos no config dinâmico (`app.config.js`):
  `expo-secure-store` e `expo-web-browser` adicionados manualmente ao array `plugins`.
- Escopo desta entrega é SOMENTE o bump estrutural (RC3/F2 — structural ≠ behavioral): migração de
  `expo-file-system` p/ API nova, target API 36 explícito e edge-to-edge ficam para PRs seguintes
  (1.2/1.3/1.4) da mesma spec.
- **Achados do gate (mesmo bump):** `expo-file-system` removeu a API legada do export default no
  SDK 54 — `ExportSheet.tsx` (LGPD, spec 008) importava `cacheDirectory`/`EncodingType` de lá;
  corrigido trocando o import para `expo-file-system/legacy` (mesmo comportamento, só o caminho do
  módulo muda — a migração de verdade p/ `File`/`Paths` é o PR 1.2). `react-native-safe-area-context`
  tinha `overrides` pinando `5.4.0` sem justificativa documentada no repo; `expo install --fix` pede
  `~5.6.0` p/ SDK 54 — override subido pra `5.6.0` (alinhamento de versão, não é o edge-to-edge do PR
  1.4). `@notifee/react-native` sinalizado "unmaintained" pelo checker de metadata do
  `expo-doctor` (advisory, não é problema de versão) — adicionado a
  `expo.doctor.reactNativeDirectoryCheck.exclude` no `apps/mobile/package.json`.
- 🔴 **Débito conhecido (achado ao vivo via PO, pós-abertura do PR, não estava no plano
  original):** `npx expo run:ios` local (Xcode 26.3) quebra em DUAS classes de erro do
  `@react-native-firebase` v21 sob o toolchain mais estrito do SDK 54 — (1) include não-modular de
  headers React em módulos de framework (mitigado neste PR via `withFirebasePodfileFix.js`, config
  plugin novo que injeta `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES=YES` só nos Pods,
  sem mudar comportamento) e (2) macro `RCT_EXPORT_METHOD` do submódulo `analytics` vira erro fatal
  `-Wimplicit-int` (`RNFBAnalyticsModule.m` — **NÃO mitigado**; decisão do PO: não suprimir warning
  de C às cegas, resolver na raiz). Android **não é afetado** (`npx expo run:android` local rodou
  limpo). Bump de `@react-native-firebase` (v21→ versão compatível, medido em 25.x disponível no npm)
  vira item **obrigatório do PR 1.3** desta spec (registrado no PLAYBOOK) — até lá, `expo run:ios`
  local segue quebrado nesta branch de integração; nenhum dos gates automatizados (`expo-doctor`,
  `tsc`, `lint`, `jest`) cobre `xcodebuild`, então isso não aparece em CI/gate — só em build real.

### `expo-file-system`: migração para API nova (spec 055, PR 1.2)

- **Fix** (`patch`, mobile `0.29.0 → 0.29.1`): `ExportSheet.tsx` (exportação LGPD de dados de
  saúde, spec 008) migrado de `expo-file-system/legacy` (`writeAsStringAsync`/`cacheDirectory`,
  shim adotado no PR 1.1) para a API nova `File`/`Paths` do SDK 55+. A legada **lança** em runtime
  no 55 (`legacyWarnings.ts:56`) — não é aviso de depreciação — e o teste antigo mockava o módulo
  inteiro, mantendo a suíte verde com o recurso quebrado (mesma classe do R-295, agravada por ser
  direito legal de portabilidade).
- Duas armadilhas de semântica pagas: `File.create()` **lança** se o arquivo já existe — o filename
  do core é determinístico, então um 2º export na mesma sessão colidiria sem `{ overwrite: true }`
  (teste negativo T020a prova a re-exportação); `File.write()` é **síncrono** (retorna `void`, não
  `Promise`) — confirmado que o erro segue caindo no `try/catch` existente (teste negativo T020b).
- Mock de teste reescrito para a FORMA do módulo novo (`File`/`Paths` como classes/getter reais,
  não string) — uma próxima breaking change no pacote quebra o teste, não só o runtime.
- Decisão do PO (2026-07-21): migrar para a API nova em vez de manter o shim `/legacy` (que existe
  e seria 1 linha) — o smoke do fluxo de exportação era obrigatório nos dois caminhos e havia folga
  de prazo (~40 dias) para pagar a dívida agora em vez de sob pressão quando o `/legacy` sair.

### Firebase sai; observabilidade vira Sentry + PostHog (spec 055, PR 1.3b, ADR-090)

- **Chore** (`minor`/comportamental, mobile — `APP_VERSION` permanece `0.29.1`, já bumpada no PR 1.1;
  não há mudança visível de tela, mas troca o provedor de crash e de analytics): removidos
  `@react-native-firebase/{app,analytics,crashlytics}` e adicionados `@sentry/react-native` (crash) +
  `posthog-react-native` (analytics de produto) + `expo-localization` (peer do PostHog).
- **Por quê:** sob Xcode 26.3 / RN 0.81 (SDK 54) o `@react-native-firebase` **não compila** com
  `useFrameworks: 'static'` — o clang recusa a declaração concorrente de `RCTBridgeModule`
  (`must be imported from module 'RNFBApp.RNFBAppModule'`) e a macro `RCT_EXPORT_METHOD` cascateia
  `-Wimplicit-int` fatal. Bug upstream sem fix (invertase #8988/#8827, expo #39607); o bump v21→v25
  reproduz o MESMO erro e `useFrameworks: 'dynamic'` só troca de buraco (quebra o link do
  `react-native-netinfo`). Era o único blocker de `npx expo run:ios` — sem isso nenhum build iOS sai.
- O wrapper de analytics mantém a **mesma API exportada** (`logEvent`/`setUserId`/`setUserProperty`/
  `logScreenView`), então os 8 call sites não mudaram: só o arquivo foi renomeado
  `firebaseAnalytics.ts` → `productAnalytics.ts`. `ErrorBoundary` passou a `Sentry.captureException`
  (+ breadcrumb com o `componentStack`); `cold_start` (loading time) virou evento PostHog.
- Config: `useFrameworks: 'static'` volta **limpo** — os dois config plugins que só existiam por causa
  do firebase (`withFirebaseFix.js`, `withFirebasePodfileFix.js`) foram deletados. `google-services.json`
  e `GoogleService-Info.plist` **ficam**: o push Android usa o transporte FCM via `expo-notifications`,
  que não depende do pacote RNFB.
- Sem chave configurada (`EXPO_PUBLIC_SENTRY_DSN` / `EXPO_PUBLIC_POSTHOG_API_KEY`) ambos viram no-op
  silencioso e o app sobe normal — observabilidade nunca bloqueia boot. Host PostHog é o **US**
  (US-Virginia): app é brasil-only e o backbone bra/us é maior que bra/eu.
- **Identificação de usuário corrigida na largada (achado do smoke do PO):** o `identify` só era
  chamado no login EXPLÍCITO (`LoginScreen`) — herança do Firebase, mesmo furo. Como o uso diário
  entra por sessão RESTAURADA do SecureStore, todo esse tráfego ficava anônimo e cada device virava
  uma "pessoa" distinta, inflando a contagem de usuários (visto no dashboard: 2 devices = 2 pessoas
  com os mesmos eventos). A identificação passou para o `useAuthSession` (`Navigation.tsx`), que
  cobre login e restauração no MESMO ponto, e o call site do `LoginScreen` saiu — a regra ganhou um
  dono só. Adicionado `resetUser()` no `SIGNED_OUT`: sem ele, num device compartilhado os eventos do
  próximo usuário seriam atribuídos à pessoa anterior — misturar dado de saúde entre pessoas é pior
  que o anonimato. Os dois andam juntos. O mesmo UUID vai para o `Sentry.setUser` (crash sem dono
  não cruza com relato de suporte). R-042 respeitada: só UUID interno, nunca PII. A consolidação dos
  eventos anônimos pré-login é nativa do PostHog (`identify` mescla o `distinct_id` corrente) — não
  há código de merge do nosso lado.
- **Host do PostHog: endpoint PÚBLICO (`us.i.posthog.com`), não o privado.** A doc do PostHog separa
  por tipo de endpoint: público (ingestão de evento com project API key, que é o nosso caso) vs
  privado (`us.posthog.com`, API de query/sourcemap com personal API key). O
  `eas integrations:posthog:connect` escreve o privado em `.env.local` porque scaffolda o error
  tracking junto — que aqui está desligado (crash é Sentry). Divergência silenciosa: os dois hosts
  respondem, então o evento não some com erro, só vai pro caminho errado.
- 🔴 **Fronteira com a spec 051 (OTA):** PostHog entra só como analytics de produto + métrica de adoção
  de frota. Continua **proibido** usar feature flag do PostHog como gating de conteúdo OTA (governance
  051 §125) ou colocá-lo no caminho do kill switch `min_app_version` (boot-blocking, fail-open — AP-303).
- Perde-se o console Firebase (histórico de crash/analytics); frota de ~25 ativos, perda baixa. Session
  replay do PostHog fica DESLIGADO e o autocapture também (as telas já são registradas explicitamente
  por `logScreenView`) — os dois queimariam cota do free tier à toa.

### Heartbeat de atividade do device, independente de push (spec 057, ADR-089)

- **Feat** (`no-user-impact` — telemetria de infra, nada muda visível pro usuário): a única fonte de
  `app_version`/`platform`/atividade real no banco (`notification_devices`) só é populada quando o
  usuário ACEITA push (R-239 — pedido apenas em pontos de intenção, nunca no 1º load). Usuário que
  usa o app sem nunca aceitar push era invisível a qualquer query de frota/engajamento — mesmo furo
  que o ADR-088/AP-314 (outage de 22/07) documentou como "piso, não retrato". Tabela nova dedicada
  `device_activity` (mobile-only, decisão RC3 — o risco que motivou a spec, DROP quebrando app
  instalado desatualizado, não se aplica a web) + RPC `upsert_device_activity` (`SECURITY DEFINER`,
  deriva o dono de `auth.uid()`, nunca aceita `user_id` como parâmetro) + client
  `syncDeviceActivity.ts` (throttle local de 24h por device via AsyncStorage, best-effort — erro de
  rede nunca lança, espírito AP-303) disparado em `AppState` → `active` (cold start + volta de
  background) dentro de `useAuthSession()`, ao lado de `usePushNotifications`.
- **Achado ao vivo (recorrência de AP-278):** a auditoria pós-migração (`has_function_privilege`)
  achou `anon` com `EXECUTE` na RPC nova, apesar do `REVOKE ALL FROM PUBLIC` no texto da migração —
  este projeto tem `ALTER DEFAULT PRIVILEGES` no schema `public` que concede `EXECUTE` DIRETO a
  `anon`/`authenticated`/`service_role` na criação da função, e um `REVOKE` de `PUBLIC` não atinge
  um grant direto. Corrigido ao vivo (`REVOKE ... FROM PUBLIC, anon`) e reverificado
  (`anon.can_exec=false`). `docs/migrations/20260723_device_activity.sql` já nasce com o `REVOKE`
  explícito de `anon` para não depender do estado do default privilege do ambiente.
- **`scripts/fleet-versions.sh`** passa a cruzar `device_activity` além de `notification_devices`
  (união, nunca substituição — FR-005). Provado com uma linha real inserida/removida em prod: total
  subiu de 27→28 instalações (25→26 usuários) para um usuário sem `notification_devices`, confirmando
  união genuína (não apenas "sem mudança porque a fonte está vazia").
- **Débito conhecido (PO-1/PO-3):** a prova manual de "zero prompt de permissão disparado" e "sinal
  sem escrita de domínio" depende de smoke num device real — aguardando validação do PO antes do
  merge.

### Grafia de mililitro padronizada no formatador central — Slice B (053, fecha o épico)

- **Refactor** (`patch`, web `4.20.0 → 4.20.1`; `patch`, mobile `0.28.4 → 0.28.5`; `patch`, server `4.1.0 → 4.1.1`; `minor`, core `0.17.0 → 0.18.0`): varredura de call sites que ainda montavam rótulo de unidade fora dos formatadores do core (PO-3). O inventário congelado do Slice A (expressão E1, 4 emissões reais) cobria só concatenação de TEXTO LITERAL — um segundo levantamento achou **12 sites adicionais** que interpolavam a VARIÁVEL crua (`` `${qty} ${unit}` ``, sem literal "ml"/"mg" no molde), invisíveis ao grep por desenho, mais **3 textos de copy** hardcoded com "ml" minúsculo ("Geralmente 100 UI por ml"/"20 gotas por ml"). Todos os 19 sites (web: `ConsultationSections`, `EmergencyQRCode`, `consultationPdfDataBuilder`, `DoseEventCard`, `HistoryLogCard`, `TreatmentWizardStep1/2`, `ProtocolFormDosesSection`; mobile: `PurchaseCard`, `PurchaseFormScreen`, `StockAdjustmentScreen`, `alarmService`, `DoseRegisterModal`, `DoseListItem`, `DoseHistoryList`, `DoseActionSheet`; bot/server: `notificationHelpers`, `conversational.ts`, `buildNotificationPayload`) passam a traduzir valor→rótulo via `formatConcentration`/`formatDose`/`DOSAGE_UNIT_LABELS`/`INTAKE_UNIT_LABELS` do core — call site nunca mais concatena unidade à mão. `isLiquidDosageUnit` novo no core (export aditivo) consolida 4 cópias locais de `isLiquidUnit` (a 4ª, em `TreatmentWizardStep1`, não estava catalogada no plano original).
- **Achado de cobertura** (mesmo bump): `InitialBalanceForm.test.tsx` já estava quebrado desde o Slice A — o componente renderizava `stockUnitLabel()` = `'mL'`, mas o teste ainda esperava `'ml'`. Ficou invisível porque testes de COMPONENTE do web não rodam em `npm run validate:agent`/`vitest.critical.config.js` (só services/utils/hooks) — só apareceu ao rodar a suíte completa (`npx vitest run`). Corrigido; gate do agente segue sem cobrir componentes web (registrado para avaliação futura).
- Gate `scripts/unit-label-gate.sh`: allowlist `PENDING_SLICE_B` esvaziada (as 4 emissões do Slice A já foram varridas). PO-3 fecha com E1 = 0 emissões reais (7 hits residuais, todos comentário/JSDoc/copy-já-correta).
- Épico 053 fecha nesta entrega (Slice A #767 + Slice B).

### Grafia de mililitro padronizada no formatador central — Slice A (053)

- **Refactor** (`minor`, core `0.16.0 → 0.17.0`): três grafias diferentes de mililitro coexistiam no mesmo arquivo do core (`0,5ml`, `0,5 mL`, `2,5 ml`) porque nenhum teste fixava a grafia da unidade, só o número — o JSDoc prometia `mL` e a implementação divergia em silêncio (AP-306). Grafia canônica `mL` (ANVISA) agora sai de um único ponto (`DOSAGE_UNIT_LABELS`/`INTAKE_UNIT_LABELS`, lado direito apenas — as CHAVES são valor com CHECK do banco e continuam byte a byte intocadas, AP-299/R-295); `formatDose`/`formatLiquidConcentration`/`stockUnitLabel` traduzem valor→rótulo via mapa em vez de ecoar a string crua. Call sites continuam passando VALORES; o rótulo é terminal.
- **Achado fora do escopo original** (mesmo bump): 3 call sites (web `InitialBalanceForm`, mobile `StockInitialBalanceScreen` e `useStockInitialBalance`) comparavam o retorno de `stockUnitLabel` contra a string `'ml'` para decidir comportamento (esconder hint, montar aria-label) — a mudança de grafia teria quebrado essas 3 superfícies **em silêncio**, sem estourar tsc/lint (só um dos três tinha teste cobrindo o ramo). Corrigidos no mesmo PR.
- **Farol anti-regressão**: `scripts/unit-label-gate.sh` (novo), integrado a `npm run lint`/CI, acusa concatenação nova de unidade fora dos formatadores do core (allowlist nomeada para as 4 emissões que o Slice B ainda vai varrer). PO-5/PO-6 fechados com evidência: violação sintética reprovada pelo gate; mutação `mL→ml` quebra 28 testes em 6 arquivos.
- Slice B (próximo PR) varre os call sites restantes fora do core e fecha PO-3.

### Hotfix de produção: o DROP do 029 derrubou quem não atualizou a app

- **Fix — outage** (`patch`, mobile `0.28.3 → 0.28.4`; `minor`, core `0.15.0 → 0.16.0`): o DROP das 4 colunas de titulação N1, entregue logo acima, **quebrou as abas Hoje e Tratamentos em todo aparelho que não atualizou a app**. O mobile v0.27.0, que está publicado e instalado, nomeia `titration_status` no `select()` de dois serviços; sem a coluna, isso vira `42703` permanente — retry não cura, wifi não cura, reabrir não cura. Estoque e Perfil seguiam carregando porque não tocam `protocols`, o que fez o problema parecer bug de tela e não interrupção de serviço. Corrigido no banco (`20260722_restore_protocol_titration_n1_legacy_clients.sql`): as 4 colunas voltam **inertes**, com os defaults que a própria migração do DROP mediu em produção (`'estável'` / `'[]'` / `0` / `NULL`, byte-idênticos nas 68 linhas) — o cliente antigo voltou a ler exatamente o que lia antes, sem precisar atualizar nada. Nenhum código novo lê ou escreve essas colunas, e as guardas anti-reintrodução do F6 seguem valendo.
- **O que o gate do 029 não viu**: ele provou `grep` zero nas 4 colunas em `apps/ packages/ server/ api/`, executou os 7 selects alterados contra o PostgREST real, varreu views, funções, constraints e policies no banco, e mediu o conteúdo antes de dropar. Tudo isso era verdade. Mas **`grep` mede o código que vai rodar, e o que quebra é o código que já está rodando** — esse não está no repositório, está compilado dentro do aparelho do usuário. É um ponto cego herdado da web, onde o browser baixa o bundle novo no reload e o cliente antigo deixa de existir em minutos; app instalada, sem update forçado, continua chamando a API por tempo indeterminado. Registrado como AP-314, com a regra: antes de `DROP`/`RENAME`/aperto de tipo, `git grep` **versão a versão em campo**, não só `HEAD`.
- **Fix — diagnóstico** (mesmo bump): a tela mentia sobre a causa. Os três hooks offline-first (`useTodayData`, `useTreatments`, `useStock`) tentam rede → caem no cache → e exibiam **sempre** o erro do fallback, descartando o erro original. O usuário via *"Cache expirado (> 24h)"* com wifi funcionando, e uma quebra de schema ficou indistinguível de "você está offline há mais de um dia". Agora `describeLoadFailure` (core) dá precedência ao erro de servidor e **mostra o código** (`42703`, `42501`…) quando o PostgREST respondeu — se o servidor respondeu, o problema não é conectividade e nenhuma ação do usuário resolve. Erro de rede de verdade continua reportando o cache, como antes.

### A titulação sai das colunas do tratamento e vira entidade — fim do épico 029 (F6)

- **Refactor + BREAKING no banco** (`minor`, web `4.19.0 → 4.20.0`; `patch`, mobile `0.28.2 → 0.28.3`; core `0.14.0 → 0.15.0`): as 4 colunas de titulação N1 de `protocols` (`titration_schedule`, `titration_status`, `current_stage_index`, `stage_started_at`) foram **removidas do banco**. A escada já era `titrations` + `titration_steps` (ADR-084) desde os slices anteriores; o que caiu aqui é o esqueleto do modelo antigo, que continuava sendo lido — e escrito — em silêncio. **Nada muda para o paciente**: é deprecação, não entrega.
- **Por que o risco era alto e como foi contido**: coluna dropada + código que ainda a pede = `42703` em produção, que foi exatamente como web, mobile e cron caíram em 2026-07-16 (#750) — passando por tsc, lint, 2068 testes, review interno e externo, porque `select()` é string e o client de teste está sempre mockado. Por isso **o DROP e a limpeza vieram no mesmo PR**, nessa ordem: repontar tudo → provar `grep` zero → **executar cada select alterado contra o PostgREST real** → só então dropar. Os 7 selects deram `200` antes e depois; um select de controle pedindo `titration_status` devolve `42703`, provando que o gate pega o que ninguém tinha no #750.
- **Dois escritores vivos que teriam quebrado todo cadastro de tratamento**: `createProtocolRepository.create()` gravava 3 das colunas em web e mobile, e havia `select()` explícitos citando `titration_status` em **dois** serviços mobile — o inventário herdado enxergava só um. Com os escritores mortos, saíram também os 4 campos do `protocolSchema`, os 2 refines que os cruzavam e o `titrationStageSchema`/`validateTitrationStage`, que não tinham **nenhum** consumidor de produção (a forma exata do AP-301: código que aparenta uma capacidade inexistente).
- **A leitura foi repontada, não apagada**: card, checklist, timeline, badge e o PDF de consulta da web passam a derivar de `titration_steps` pelas **mesmas funções do core que o mobile usa** (`getEvolutionBadge`, `calculateTitrationData`) — um tratamento em evolução tem que se parecer com um tratamento em evolução nas duas telas. O `/status` do Telegram também: ele não quebraria (o `select('*')` o protegia), apenas **perderia a linha de titulação em silêncio**, que é o tipo de perda que ninguém percebe até alguém sentir falta.
- **Fix** (mesmo bump): o badge do checklist de doses **parou de afirmar "Estável"**. Ele lia `titration_status`, coluna que estava `'estável'` em 100% das linhas de produção — ou seja, dizia "Estável" inclusive para quem estava em plena evolução. E os tratamentos daquela tela vêm da lista do plano, que não carrega a escada: sem dado, agora não afirma nada. Ausência é visível; afirmação sem lastro é indistinguível da verdade. Mesma correção feita no mobile em #763.
- **Fix — LGPD** (mesmo bump, achado durante o slice): o export de portabilidade levava as 4 colunas e **não tinha nenhuma seção de escada**. Sem intervenção, o DROP teria removido a titulação inteira do pacote do titular em silêncio — dado de saúde (art. 18). O export ganhou a seção `titrations`, com a escada **completa** e o medicamento **de cada etapa** (derivar do tratamento faria a etapa de julho exibir o remédio de hoje — o passado mudando sozinho, R-299). Vale em JSON e em CSV.
- **O que o banco disse e o inventário não sabia**: o levantamento herdado descrevia "70 protocolos com escada declarada e relógio nunca setado". Metade era verdade. As 68 linhas de produção são **byte-idênticas** nas 4 colunas (`estável` / `[]` / `0` / `NULL`): nunca existiu uma escada N1 em produção. Não era dado zumbi, era **coluna zumbi** — o DROP não perdeu nada recuperável, e o backup lógico ficou como evidência.
- **Débito declarado**: o push real das 08:00 (T030) segue sem prova de execução — as escadas de smoke terminaram em etapa contínua, que nunca vence, então o cron não dispara. Decisão do PO: fica fora deste slice, registrado como o único item da 029 sem prova.

### Titulação com executor ÚNICO — um tratamento que evolui, não N tratamentos empilhados (052 Slice C)

- **Feat** (`minor`, web `4.18.1 → 4.19.0`; `patch`, mobile `0.28.1 → 0.28.2`): trocar de concentração numa titulação **continua sendo o mesmo tratamento**. Até aqui, cada `medicine_switch` criava um `protocols` novo e encerrava o anterior: a lista virava uma pilha de tratamentos finalizados e "meu Mounjaro" não tinha uma história só — tinha três. A RPC `confirm_titration_switch` agora **muta o executor vigente** (`medicine_id`, `dosage_per_intake`, `intake_unit`), exatamente como o `dose_change` já fazia; os dois tipos de transição colapsam numa escrita só, e o tipo vira rótulo de auditoria. O slice **remove mais código do que adiciona**: saíram o `INSERT` de protocolo, o bloco de encerramento (`active=false`/`paused_at`/`end_date`) e o `skipped_paused` das futuras.
- **Por que só agora**: criar um protocolo por medicamento nunca foi modelagem — era necessidade. Com a identidade da dose resolvida por join, mutar `protocols.medicine_id` reescreveria o histórico agendado inteiro. Os Slices A e B congelaram `dose_instances.medicine_id` e moveram a leitura para esse snapshot; o `UPDATE` só virou inócuo para o passado por causa deles. Provado no banco real: após a transição, a instância anterior mantém medicamento e dose da época (PO-8, com o PO-1 re-executado como guard).
- **Fix** (mesmo bump): a **janela de 24h do "pausado"** morreu por construção. Ela existia porque a transição gravava `end_date = hoje` e `resolveTreatmentStatus` só finaliza com `end_date < hoje` — o tratamento recém-encerrado caía por um dia na aba Pausados, onde o botão **Retomar** (toggle genérico de `active`, sem consciência de titulação) reativaria a etapa antiga com a nova já ativa: dois executores da mesma escada mandando lembrete das duas concentrações. Sem `end_date` gravado pela transição, o estado deixa de ser representável, e o desvio de navegação que contornava a armadilha saiu junto. O `<` estrito de `resolveTreatmentStatus` **fica**: `end_date` é o último dia de vigência, e `<=` mataria a última dose de todo tratamento com fim marcado pelo usuário — o `<` nunca foi o defeito, o defeito era a titulação inventar um `end_date`. Fecha a pendência herdada da 029 F5.5.
- **Fix** (mesmo bump — escada órfã, bug REAL de prod em 2026-07-20): apagar etapas futuras podia fazer a evolução inteira **sumir da tela**. O fio escada↔tratamento vivia em `titration_steps.protocol_id`, `NULL` na maioria das linhas (medido: 6 de 15); apagar o sufixo levava junto a única etapa que o carregava, `getLadderForProtocol` devolvia `[]` e o detalhe desenhava "sem escada" — lista vazia é indistinguível de "não há escada", então **nada acusava**. Agora toda etapa nasce vinculada ao executor único (`buildLadderRows`) e a RPC vincula a escada inteira: apagar qualquer subconjunto deixa o vínculo de pé. Provado com a repro literal do bug, comparando baseline (0 vínculos, o bug) contra o fluxo novo (3 vínculos). Ver AP-311.
- **Fix** (`minor` web): o **relatório de adesão parava de mentir sobre o período**. `_protocolScore` rotulava um agregado de 30/90 dias com `protocol.medicine.name` — o medicamento do protocolo VIGENTE. Enquanto "um protocolo = um medicamento" era invariante isso era inócuo; com executor único, uma janela que atravessa uma troca atribuiria o período inteiro ao medicamento atual — a mesma falsificação que a 052 existe para matar, apenas migrada de `dose_instances` para o agregador. O rótulo agora sai do snapshot de cada ocorrência (`resolveInstanceMedicine`) e uma janela que cruza a troca mostra os dois nomes.
- **Fix** (`patch` mobile): no histórico, um evento **passado** exibia a dose **atual** do protocolo — `_getDosagePerIntake` consultava `proto.dosage_per_intake` antes de `p.expectedDose`, com a precedência invertida entre fonte viva e fonte congelada (família AP-310). Já queimava antes deste slice (o `dose_change` sempre mutou a dose do vigente); o executor único agravaria. O snapshot passa a vir primeiro.
- **Chore** (mesmo PR): `buildLadderRows` perde a regra do "run same-med" — vínculo só enquanto o `medicine_id` batia, primeira etapa de outro medicamento nascendo `NULL`. Ela existia apenas porque o executor era por medicamento; deixar a regra morta no lugar seria dívida para o próximo. CON-032 atualizado (quebra coberta por ADR-085): `protocol_activated` é sempre o executor vigente, `protocol_paused` é sempre `null`, e `titration_steps.protocol_id` perde o estado `NULL` transitório. O invariante 1 do contrato também caiu: o filtro por `protocol_id` nunca foi a salvaguarda contra adotar a dose de outro medicamento — quem protege é o motor, que para no `medicine_switch` e marca `pending_confirmation` sem executar.
- **Nota de dados**: sem migração de linhas. Trocas anteriores ao slice teriam deixado protocolos separados, mas a contagem em prod foi refeita antes de codar (RC3 #4) e deu **zero duplicados** — os 3 do smoke já tinham sido apagados pelo PO.

### Mobile — badge "Estável" sobre tratamento em evolução (029, achado de smoke)

- **Fix** (`patch`, mobile `0.28.0 → 0.28.1`, PR #763): na listagem, um tratamento com escada em curso exibia **"Estável"** — enquanto o detalhe do MESMO tratamento dizia "Em evolução". Causa: a listagem lia a escada pelo embed `titration_steps` resolvido pela FK `protocol_id`, e esse campo marca o **executor vigente** — fica `NULL` na maioria das etapas (medido em prod: 6 de 15 etapas sem, e **1 das 4 vigentes sem**). O recorte quase nunca continha a etapa `current`, então o badge caía no default "Estável". O detalhe acertava porque lê pela `titration_id`, que é a identidade real da escada. Agora a listagem monta a escada COMPLETA por titulação (uma query, sem N+1) e o contrato do `getEvolutionBadge` foi invertido no JSDoc: as etapas DEVEM ser a escada inteira, **nunca** o recorte por `protocol_id` — era exatamente o que ele mandava antes. Best-effort (R-245): se a query falhar, a listagem mantém o embed e segue de pé.
- **Chore** (mesmo PR): `getEvolutionBadge` passa a derivar a vigente de `resolveCurrentStep` em vez de `find(status === 'current')` — o banco não impede resíduo `current` numa posição anterior, e o `find` decidiria o badge pela etapa errada em silêncio (terceiro lugar onde essa mesma armadilha aparece: timeline, bolas do form e agora o badge).

### Mobile — correções do RC6 sobre o card da Evolução (029, PR #763)

- **Fix** (`patch`, mesmo bump, PR #763): em escada longa, **a bola da etapa vigente sumia**. O corte era `slice(0, 8)` — sempre as 8 primeiras — mas o índice da vigente era absoluto, então com a etapa atual além da 8ª posição nenhuma bola era marcada, enquanto o rótulo de acessibilidade seguia anunciando "Etapa 10 de 11". Visual e texto discordando **em silêncio**, na própria tela criada para tornar a escada legível — e escada de GLP-1 chega a 11 etapas. A janela agora acompanha a vigente (centrada, presa nas bordas, "+N" nos dois lados) e a marcação é por `id`, não por índice: elimina a classe de descasamento janela-vs-absoluto em vez de só este sintoma.
- **Chore** (mesmo PR): titulação **órfã** virou observável. Uma titulação cujas etapas não carregam `protocol_id` em nenhuma linha é inatribuível — o tratamento cai de volta no embed incompleto e o badge volta a mentir, exatamente o furo corrigido acima, de novo sem sinal. Não é corrigível na leitura (o vínculo não existe no dado; some por construção no Slice C / ADR-085), mas agora emite alerta. O sinal **não** é `protocols.titration_status`: verificado no banco, é `text` nullable, sem CHECK, default `'estável'`, e as 68 linhas de prod estão **todas** em `'estável'` — inclusive tratamentos com escada em curso. Coluna nunca escrita, inútil como evidência (ver AP-311).

### Mobile — o card da Evolução deixa de passar despercebido (029, achado de smoke)

- **Fix** (`patch`, mobile `0.28.0 → 0.28.1`, PR #763): no form de tratamento, a entrada da Evolução era uma linha de 48px logo abaixo do seletor de horários — que é alto, denso e visualmente pesado. Num scan da tela o olho ia direto para os horários e **a titulação simplesmente não era vista**: uma feature inteira, entregue em cinco fases, dependia de um elemento que ninguém notava (achado do PO no smoke e2e). O card agora tem duas metades: a chamada em cima e, embaixo, **as bolas da escada** — uma por etapa, mostrando quantas existem e em qual o tratamento está. Deixa de ocupar espaço e passa a informar. As bolas espelham a `TitrationTimeline` (concluída teal soft · vigente cheia com miolo · futura anel vazado): mesma escada em duas telas, um só significado. Sem etapa cadastrada, duas interrogações (`circle-question-mark`) no lugar das bolas — bolas vazias sugeririam etapas que não existem. Escada longa não estoura a linha (teto de 8 + "+N"), e a borda passa a teal para o card ganhar presença sem virar alerta.
- **Chore** (mesmo PR — a etapa vigente vem de `resolveCurrentStep`, nunca de `findIndex`): o banco não impede um resíduo `status='current'` numa posição anterior da escada, e o `findIndex` pegaria o resíduo — a bola cheia apareceria na etapa errada, em silêncio. É o mesmo achado que o RC6 fez na 029 F4 e que a timeline já respeitava; o card nasce respeitando também, com teste que trava exatamente esse cenário (um teste que só contasse bolas passaria com o bug).
- **Chore** (mesmo PR — dois mocks que faltavam no `jest-setup`): o mock da `lucide-react-native` era uma **lista fixa de 5 ícones**, então qualquer componente que usasse um sexto quebrava no render com `Element type is invalid: ... got: undefined` — erro que não cita o ícone nem o mock, e que na prática desencorajava escrever teste de componente. Virou `Proxy` que resolve qualquer ícone sob demanda (com `__esModule: true`, obrigatório: sem ele o interop do Babel copia as chaves próprias para montar o namespace do `import * as`, e um Proxy sobre `{}` não enumera nada — o namespace chegava vazio). O `@react-native-community/datetimepicker` não tinha mock nenhum, derrubando todo teste que renderizasse o form de tratamento.

### Histórico clínico imutável — a leitura canônica e o cadeado (052 Slice B)

- **Fix** (`minor` core `0.13.0 → 0.14.0` · sem bump de superfície — o histórico passa a exibir o que sempre deveria ter exibido, sem mudança de layout, PR #TBD): o Slice A fez a dose **guardar** o medicamento; este faz o app **ler** o que foi guardado. Enquanto a leitura continuasse resolvendo a identidade por `protocol_id → protocols.medicine_id`, o snapshot existia sem servir para nada — a tela seguiria mostrando o medicamento de hoje sobre a dose de junho. Agora existe **um único lugar** autorizado a responder "que medicamento é esta dose": `resolveInstanceMedicine` (`@dosiq/core`), que lê o congelado e **nunca pergunta ao protocolo qual é a identidade** — o protocolo entra só como fonte do registro, e apenas quando aponta para o **mesmo** medicamento. Quando o registro não está em mãos, o helper devolve o id certo com o nome vazio: **não exibir o nome é melhor do que exibir o errado** — a alternativa é falsificação silenciosa no dado que vai ao médico.
- **Fix** (mesmo PR — cutover dos leitores): o inventário mediu **5 leitores em duas naturezas diferentes**, e a distinção não era cosmética. Três resolviam a identidade **no SQL** (cron de lembrete e os dois dispatchers de Live Activity): o embed `medicine:medicines(...)` desceu do protocolo para a própria ocorrência, via a FK nova. Dois resolviam **em memória** (`timelineService` e `doseZones`) — e é aí que estava a alavanca: `buildDoseItemsFromInstances` alimenta **quatro superfícies** (dashboard web, alarmes mobile, DoseActivityBridge e DoseLiveActivityBridge), todas migradas por um único ponto no core. Três itens que o plano listava como leitores **não eram** (só faziam `UPDATE status` ou liam `select('id,status')`) — medido antes de tocar, não presumido.
- **Chore** (mesmo PR — o cadeado, `SET NOT NULL`): com o backfill em 100% e todos os leitores migrados, instância sem `medicine_id` deixa de ser representável no banco. Não é formalidade: um writer novo que esqueça a coluna não falha na escrita, falha meses depois no relatório do médico (**AP-301**), e o banco é o único lugar onde essa classe morre por construção em vez de por vigilância. Provado por `BEGIN..ROLLBACK` contra o banco real (5/5 — o `ALTER` roda dentro da transação de teste e é revertido junto, então o cadeado foi provado **antes** de instalado): `INSERT` sem a coluna → `23502`, `UPDATE` anulando → `23502`, caminho legítimo intacto. Com o gate ativo, o fallback ao protocolo **foi removido** do helper — mantê-lo seria deixar viva a porta pela qual o bug voltaria.

### Histórico clínico imutável — `dose_instances.medicine_id` (052 Slice A)

- **Fix** (`minor` core `0.12.0 → 0.13.0` · sem bump de superfície — correção clínica de calendário, sem mudança visual, PR #TBD): a dose agendada passa a **guardar o medicamento**, em vez de resolvê-lo por join no momento da leitura. Antes, a identidade de toda dose vinha de `protocol_id → protocols.medicine_id` — e **61% das instâncias em prod (3.085 de 5.068) dependiam 100% desse join**. Consequência: mudar o medicamento de um tratamento **reescrevia o passado**. Doses de junho que foram Mounjaro 2,5 mg passariam a renderizar como 15 mg no histórico e no relatório do médico. O bug **não é da titulação**: editar o medicamento de um tratamento normal já cai nele há muito tempo; a escada (029) só o tornou frequente, porque cada `medicine_switch` cria um `protocols` novo. A tabela já sabia disso pela metade — `expected_dose` existe desde sempre, alguém já concluiu que a **dose** varia no tempo e precisa ser congelada; faltava aplicar a mesma lógica ao **medicamento**, que só não variava antes. Agora a instância congela `medicine_id` do **step vigente em `scheduled_for`** (`titrationStage?.medicine_id ?? protocol.medicine_id`), pela mesma resolução temporal da dose: dose e medicamento saem sempre da MESMA etapa — uma instância futura gerada antes da troca nasce com o medicamento da etapa que vai reger aquela data, nunca com o de hoje. Coluna nullable + FK `ON DELETE CASCADE` + índice (migração aditiva, deploy neutro; `SET NOT NULL` fica para o Slice B, após o backfill).
- **Fix** (mesmo PR, **risco clínico em produção**): o `dose_change` automático da escada — o caminho **normal** do avanço, no cron — deixava as doses futuras já materializadas com a **dose antiga**. `_applyTitrationPlan` mutava `protocols.dosage_per_intake` com SQL cru, fora do repositório, e por isso escapava do `syncInstancesOnWrite` (wipe + regeneração da janela). Segunda instância viva do **AP-308**: a 029 F5.5 fechou a primeira (a RPC, do lado do cliente) e esta, no servidor, seguia queimando a cada avanço. O tratamento dizia uma dose e o lembrete entregava outra — pior que a ausência de dose. Agora o cron chama `resyncProtocolWindow` (o mesmo helper da F5.5, não um segundo), best-effort: falhar não derruba o tick nem repete o push.
- **Fix** (mesmo PR — invalidação do futuro, FR-007): congelar o medicamento **inverte um acerto acidental**. Antes, o join deixava as doses futuras "certas de graça" quando o usuário trocava o medicamento na UI; congeladas, elas ficariam presas no medicamento antigo. Então `medicine_id` entra em `SCHEDULING_FIELDS` (editar o tratamento reprojeta o futuro pendente) e `saveLadderEdit` passa a reprojetar a janela ao editar etapas futuras da escada — ela escreve direto em `titration_steps`, fora do `update()` do protocolo, e também escapava do hook. **O passado permanece intocável por construção**: `wipeFuturePending` nunca alcança dose passada nem `taken`/`missed`.
- **Chore** (mesmo PR — guard de regressão): teste de **contrato de embed** que varre os 6 selects que alimentam o gerador e falha se algum que carrega `dose` esquecer `medicine_id`. Um select do PostgREST é string: campo declarado no tipo mas ausente do select chega `undefined` em runtime, e nem tsc, nem lint, nem teste com client mockado enxergam (**AP-300**). Era exatamente o buraco que o C1.5 desta spec encontrou antes de escrever código — o `medicine_id` do step não existia em nenhuma das três camadas (tipo, resolvedor, embeds), então implementar o plano ao pé da letra teria recriado o bug **por escrita**, em silêncio e permanente. Também corrigido: `AdherenceProtocol.medicine_id` declarava `string` para uma coluna que o banco define como nullable.

### Correção de SQP — `@dosiq/core` `0.11.0 → 0.12.0` (dívida da 029 F5.5)

- **Chore** (`minor` em `@dosiq/core`, sem impacto de comportamento): a F5.5 (#760) adicionou **três exports públicos** ao core — `resolveManualNextStep`, `resolveCurrentStep` e `resyncProtocolWindow` — e o SQP (R-221) do PR classificou apenas a superfície Mobile (`0.27.4 → 0.28.0`), deixando o pacote compartilhado sem bump. API pública que cresce é `minor` por SemVer, independentemente de quem consome hoje. Corrigido fora do PR original porque o merge já tinha ocorrido; nenhum código muda. Farol para o próximo SQP: **um diff que toca `packages/` exige classificar o pacote, não só a app que o consome.**

### Evolução do tratamento — sair da etapa contínua com gatilho manual (029 F5.5)

- **Feature** (`minor`, mobile `0.27.4 → 0.28.0`, PR #TBD): o paciente em **manutenção** (etapa contínua) cujo médico sobe a dose não conseguia registrar isso pelo app — as duas portas fechavam juntas: o formulário sumia quando a última etapa gravada era contínua (*"a evolução já chegou ao fim"*) e a contínua, sendo a vigente, é congelada. **Contínua não é borda, é o destino normal de uma escada GLP-1**: todo paciente do wedge chega lá. Diagnóstico: o gatilho de avanço da escada é uma **data**, e numa contínua não existe data — existe um **evento clínico**. Não faltava dado no modelo, faltava gatilho manual. Agora: (1) o form mostra *"A etapa contínua vale até seu médico mudar a prescrição."* + `[+ Adicionar etapa]`, e o builder **só abre no toque** (builder sempre aberto sugeriria a todo paciente em manutenção que a escada está incompleta — convite a titular sem indicação médica, ADR-062); (2) a etapa gravada nasce `pending_confirmation`, **uma por escada** (a segunda edição não cria uma 2ª pendente); (3) banner **teal** na tela do tratamento — *"Etapa N cadastrada · Comece quando seu médico indicar"* + `[Iniciar etapa N]`; (4) a timeline rotula essa etapa como **"aguardando você iniciar"**, nunca "prevista" (que sugeriria um automatismo inexistente). **Zero SQL novo**: reaproveita a RPC `confirm_titration_switch` e o CON-032, ambos inalterados. Invariantes preservadas e cobertas por teste de regressão: o **Hoje segue silencioso** (`resolvePendingSwitch` continua devolvendo `null` com vigente contínua — sem card, sem push, sem nag, R-239), a etapa cadastrada é **inerte** até o toque (`resolveTitrationAdvance` → `null`, o cron nunca reivindica) e o `duration_days` da contínua permanece **NULL para sempre** — a timeline já deriva o span de `started_at`..`ended_at`, e gravar a duração real falsificaria a **prescrição** ("prescrito 68 dias" ≠ "era contínua e durou 68 dias"). Helper novo `resolveManualNextStep` no core (puro): "pendência **sem prazo**" é conceito distinto de "pendência **vencida**", e misturá-los no mesmo resolvedor devolveria o card ao Hoje. **UX pós-troca** (smoke do PO): num `medicine_switch` o app agora leva ao tratamento **novo** (`replace`, sem deixar o antigo no back stack) — ficar na tela anterior mostrava, por 24h, o tratamento recém-encerrado rotulado *"pausado"* (a RPC grava `end_date = hoje` e `resolveTreatmentStatus` só finaliza com `end_date < hoje`), convidando ao **Retomar** — toggle genérico de `active`, sem consciência de titulação, que reativaria a etapa antiga com a nova já ativa: dois executores da mesma escada emitindo lembrete das duas concentrações. A janela de 24h em si fica para a **spec 052**: antecipá-la aqui (`end_date <= hoje`) reclassificaria como "finalizado" quem pausa um tratamento no último dia por vontade própria.

### Mobile — Hotfix 044: excluir medicamento no modo dose-only

- **Fix** (`patch`, mobile `0.27.3 → 0.27.4`, PR #TBD): no modo **dose-only** (controle de estoque desligado), excluir um medicamento que tivesse saldo de estoque caía num **beco sem saída** (Constituição IX): o botão `[Apagar]` vinha desabilitado e o sheet dizia "Desative ou exclua as dependências abaixo" com a **lista vazia** — o usuário lia uma acusação sem réu. Causa: a 044 F3 escondeu o card de estoque do sheet quando o controle está desligado, mas o pré-check (`useMedicineDelete`) continuou bloqueando por `stockUnits > 0` sem consultar `stockTrackingEnabled`. A web já tinha o guard desde a F3 (`Medicines.tsx`); só o mobile ficou de fora. Correção: estoque só conta como dependência com o controle **ligado** — nenhum ajuste de saldo é necessário, porque `stock_medicine_id_fkey` é `ON DELETE CASCADE` (verificado no banco), então apagar o medicamento já limpa os lotes. Bloqueios por **tratamento** e por **etapa da Evolução do tratamento** seguem valendo nos dois modos (o FK `titration_steps_medicine_id_fkey` é `NO ACTION`). O default do parâmetro é `true` (fail-safe AP-277: ausência de dado nunca desliga o estoque por omissão). Matrix de cache (R-236) atualizada: a exclusão passa a invalidar `@dosiq/stock-snapshot`, já que o CASCADE apaga lotes que podiam estar no snapshot. Hook ganhou os primeiros testes (5).

### Evolução do tratamento — CTA de troca de etapa, push com ações e estados de erro (029 F5)

- **Feat** (`minor` core `0.10.1 → 0.11.0` · `patch` mobile `0.27.2 → 0.27.3` · `patch` web `4.18.0 → 4.18.1`, PR #TBD): a troca de medicamento da Evolução do tratamento passa a ser **acionável pelo paciente**, nas duas superfícies.
  - **Card no Hoje** (abaixo da Adesão): "Etapa N começa hoje" + medicamento + dose, com `[Iniciar etapa]` e `[Ainda não]`. Quem adia vê, a partir do dia seguinte, **1 linha neutra sem botões** — e no 3º dia ela ganha uma frase de contexto dizendo em qual medicamento os lembretes continuam. Sem push repetido, sem cobrança (R-239).
  - **Sheet de transparência** após confirmar: lista o que o app fez mecanicamente (tratamento pausado, tratamento ativo, lembretes reapontados) e diz que **o estoque do medicamento anterior fica guardado como está — nada é apagado**.
  - **Push do `medicine_switch`** agora é *time-sensitive* e **carrega as mesmas 2 ações** do card. Isso exigiu 4 peças que não existiam: `categoryId` no canal Expo, registro da categoria no app, handler das ações e o gate de *time-sensitive* por tipo — sem elas o payload era válido e o push chegava **sem botão nenhum** no aparelho.
  - **Copy reescrita** (Decisões §8): sai a copy legada da titulação N1, que dizia **"caneta"** e chamava a entidade de "Titulação"; entra a copy factual da Evolução do tratamento, dirigida pelo tipo de transição — cobre dose única e troca de medicamento pela mesma porta. `dose_change` segue informativo, **sem botões**.
  - **Estados de erro** (Constituição IX): etapa vencida há N dias vira banner âmbar **contido** com duas saídas (`[Iniciar etapa N]` / `[Ajustar duração]`) — o app nunca estende a duração sozinho; etapa com medicamento excluído vira card corrigível com `[Editar etapa N]`, nunca beco sem saída.
  - **Exclusão de medicamento** passa a ser bloqueada quando ele é usado por uma etapa da escada. Antes, um medicamento usado só por uma etapa futura (sem tratamento e sem estoque) passava no pré-check e a exclusão morria num erro cru de banco.
  - **Sem fila offline** (decisão do PO): o registro clínico é online-first: sem conexão, o app diz que a etapa **não foi iniciada** e que nada mudou, em vez de fingir sucesso local.
  - **Estoque por etapa** (PO-4) provado por teste de integração contra o banco (9/9): a transição preserva o saldo anterior intacto, não transfere nada, e a dose seguinte debita o medicamento da etapa vigente pelo FIFO. Modo dose-only não gera movimentação.
  - Web: pill "Titulando" → **"Em evolução"** (só a palavra).

- **Fix** (mesmo PR): a troca de etapa agora **ENCERRA** o tratamento anterior em vez de pausá-lo (migração `20260718_titration_switch_end_date`). A etapa que sai não está em pausa — ela terminou e outra começou. Como "pausado" anuncia retomável, o tratamento caía na aba **Pausados** com o botão Retomar, que é um toggle genérico sem consciência de titulação: retomá-lo com a nova etapa já ativa colocaria **dois tratamentos da mesma escada gerando doses em paralelo**, e o paciente receberia lembrete de duas concentrações do mesmo medicamento. O executor que sai passa a receber `end_date` (dia local do dono) **depois** de ser desativado; o que entra tem `end_date` limpo, para o caso de uma escada voltar a uma concentração já usada. Prova ao vivo 7/7 contra o banco.

- **Fix** (mesmo PR — correções vindas do smoke do PO):
  - **Nomes de medicamento passam a identificar o cadastro** (`formatMedicineFullName` no core): numa escada os cadastros compartilham o nome de propósito, então "A próxima etapa usa Mounjaro" era verdade para **todas** as etapas. As duas linhas do sheet pós-confirmação chegavam a sair idênticas. Agora todo aviso mostra nome + concentração, na leitura do rótulo da caneta.
  - **Avisos de estoque somem no modo dose-only** (044): quem desligou o controle de estoque lia "Você ainda não tem estoque cadastrado dela" sobre um cadastro que, para ele, não existe.
  - **Push com ação duplicada**: o listener era registrado dentro de um setup assíncrono, e a cada renovação de sessão sobrava um listener órfão — um toque em `[Iniciar etapa]` chamava a RPC N vezes. A idempotência por estado da RPC segurou o dado, mas o log denunciava.
  - **Card do Hoje atualiza** após a ação do push (que resolve sem abrir o app), ao focar a tela e ao voltar do background — antes só em cold start, então ele seguia anunciando pendência já resolvida.
  - **Ancoragem do "aguardando desde"**: a etapa vigente considerada passa a ser a **adjacente** à pendente, não a primeira encontrada — o banco não impede duas etapas vigentes na mesma escada, e a data saía silenciosamente errada.
  - **Navegação entre abas** deixa de prender a aba destino na sub-tela (helper `navigateCrossTab`; 5 call sites, incluindo 3 fora da 029).
  - **Controle de iniciar a etapa sempre disponível** na tela do tratamento (antes sumia no dia 0 depois de "Ainda não", deixando o paciente sem saída até o dia seguinte), e sem o botão `[Ajustar duração]`, que prometia editar a etapa vigente — impossível, ela é congelada desde o F4.

### Core — Hotfix: update parcial de tratamento não zera mais campos que o usuário não tocou

- **Fix** (`patch`, core `0.10.0 → 0.10.1`, PR #TBD): pausar um tratamento (ou qualquer edição parcial via `protocolRepository.update`) **apagava dados que o usuário não editou** — o caso pego no smoke foi um tratamento **semanal** perder o dia da semana (`weekdays`) ao ser desligado, e o dia **não voltar** ao reativar. Causa: `protocolUpdateSchema = protocolSchema.partial()` torna os campos opcionais mas **não remove os `.default()`** — parsear um update parcial (ex.: `{ active: false }`) **injeta** os defaults dos campos ausentes (`weekdays: []`, `titration_status: 'estável'`, `titration_schedule: []`, `current_stage_index: 0`, `critical_alarm: false`), e o repositório gravava `validation.data` cru → sobrescrevia `weekdays` com `[]` (e reescrevia colunas N1 deprecadas). Correção: o `update` persiste **apenas as chaves que o chamador enviou** (com o valor já validado/transformado pelo Zod), nunca os defaults injetados — a validação de tipos permanece, mas a intenção é o `updates` cru. Vale para web e mobile (write-path compartilhado no core). Bug **anterior à 029**. Ver `AP-304`.

### Mobile — Hotfix 046: consentimento offline não trava mais o app

- **Fix** (`patch`, mobile `0.27.0 → 0.27.1`, PR #TBD): a entrega do gate de consentimento LGPD (Spec 046) introduziu uma **regressão que quebrava o offline-first** — valor central e prometido nas landings. Quando o app abria sem conexão (4G/3G instável é a norma no Brasil), a leitura da trilha de consentimento falhava, caía no estado `indeterminate` e o `NavigationTree` **travava o app inteiro** numa tela de erro ("Não foi possível verificar suas preferências de privacidade… tente de novo") — impedindo navegar doses, estoque e as ações offline que depois sincronizam. A decisão pura (`resolveConsentGate`) já dizia o certo (`indeterminate → locked: false`: não libera nem bloqueia), mas o guard a **ignorava** com um early-return de erro. Removido: sob indeterminação o app **renderiza normalmente** (graça offline); a trava real (revogado → bloqueio) é reaplicada quando a rede volta, pelo `refresh()` do listener `AppState 'active'`. **Segurança preservada:** indeterminação nunca escreve nem conta sessão de prompt (proteção mora na leitura → `state: null`, não em barrar a renderização — renderizar offline não materializa consentimento). **Relevante para notas de loja:** corrige app inacessível offline. Ver `AP-303`.

### Mobile — Spec 029 F4: Evolução do tratamento (cadastro + timeline)

- **Added** (mobile `0.27.1` → `0.27.2`, PR #TBD): a **Evolução do tratamento** (titulação) passa a existir no app. No form de tratamento, a linha opcional "A dose muda ao longo do tempo?" salva o tratamento e abre a **tela de cadastro da escada** (builder medicamento + dose + duração + "Etapa contínua", modelo "Gravar etapa" com card-resumo e "Duplicar etapa anterior"). No detalhe do tratamento, a **timeline** "Evolução do tratamento" mostra etapas passadas/vigente/futuras com datas previstas e badge "Em evolução"/"Estável"/"Tratamento pausado". Reabrir a escada já cadastrada entra em **modo edição**: as etapas concluídas (cadeado) e a etapa em curso são histórico read-only (§4.3), e as etapas **futuras** podem ser editadas, removidas ou acrescentadas — o salvamento reconcilia só o futuro (a vigente nunca é tocada; o `protocol_id` do vínculo same-med é recalculado). A etapa vigente nasce ativada (`current` + relógio setado) — corrige a classe de bug que mantinha a titulação N1 dormente por 6 meses (AP-301). O tipo de transição (`dose_change` same-med / `medicine_switch` multi-med) é derivado pela escolha do medicamento, sem toggle na UI (ADR-080). **Relevante para notas de loja** (funcionalidade nova visível ao usuário). A confirmação da troca de medicamento (F5) e a superfície web (F6) seguem em fases posteriores.

### Tooling — Spec 034: substituição do revisor Gemini (sunset 2026-07-17)

- **Chore** (`no-user-impact`, sem bump de produto, PR #TBD): o `gemini-code-assist[bot]` — revisor independente dos PRs — foi descontinuado pelo Google. Substituto em camadas (ADR-069, aceito): revisor IA independente **RC6** roda local (`ai-review.sh` na skill devflow, quota OAuth ~$0, sandbox sem ferramentas — diff é insumo não-confiável) e publica no PR; o CI ganha o gate **soft** `ai-review-gate.yml` (sem LLM, lê a severidade do payload, nunca bloqueia — merge é decisão humana R-060). Workflow morto `gemini-review.yml` (~34K) removido. Hook `post-push` de exemplo em `scripts/git-hooks/` dispara o RC6 em dry-run quando há PR aberto. **Sem relevância para notas de loja** (processo interno).
- **Chore** (`no-user-impact`, PR #753): camada determinística L0 — duas regras ESLint novas: enum de banco em inglês ou sem acento dentro de `z.enum()` (a classe do AP-299, que derrubou o read-path de protocols em produção) e `res.json(body)` sem `res.status()` (lição do Sprint 7). Zero falso-positivo na base; 8 testes garantem que as regras continuam no config. Smoke validou o revisor RC6 de ponta a ponta (Critical citando AP-231 em bypass sintético) — e expôs+corrigiu degradação silenciosa do motor com contexto >160KB. **Sem relevância para notas de loja.**

### Core + Web — Spec 029 Slice F3.1: demolição do andaime e a trava que faltava

- **Refactor** (`minor`, core `0.9.0 → 0.10.0` · web `patch`, PR #TBD): **A titulação nunca funcionou em produção — em 6 meses.** Descoberto ao investigar por que nenhuma escada jamais avançou. O status dizia "titulando"; o relógio que faz a escada andar (`stage_started_at`) **nunca era setado** pelo caminho que as pessoas de fato usam (criar o tratamento e depois editar para somar a escada). Sem relógio, o motor não tem de onde contar — então nada acontecia. Sem erro, sem log, sem alerta: a tela mostrava a escada bonita, ela só não andava. A feature tinha **zero usuários**.
  - **A trava que faltava desde o início.** O banco aceitava representar a contradição "ligada, mas sem relógio". Agora não aceita mais: um CHECK torna o estado **impossível**, em criação e em edição. Esquecer de iniciar o relógio virou um erro na cara de quem programa, em vez de uma feature morta em silêncio.
  - **A web parou de fabricar tratamento quebrado.** O assistente de titulação e o seletor "Status Manual" deixavam marcar "titulando" na mão sem nunca iniciar o relógio — eram a **origem** do problema. Saíram. A **evolução do tratamento passa a ser criada e gerenciada no aplicativo**; a web continua **mostrando** a escada (etapa, progresso, PDF de consulta), agora lendo o modelo novo. Editar um tratamento pela web segue funcionando normalmente — só não cria mais escada.
  - **Fim do andaime de migração.** Como não havia nada a migrar, caiu tudo o que existia para proteger a migração: a chave de troca de fonte, as funções antigas, a suíte que provava "equivalência com o comportamento legado" (equivalência com um cadáver) e o rastro `migrated_from_protocol_id`. As etapas passam a ser a **fonte única** — menos código, menos caminho para divergir.
  - **Código morto que aparentava capacidade.** Três camadas empilhadas: um campo que nenhum lugar do sistema jamais escrevia, o aviso de transição que dependia dele (e por isso nunca aparecia, além de não estar montado em tela alguma) e a função de avanço que só aquele aviso chamaria. Removidas. Era isso que dava a impressão de que a titulação existia.
  - **Sem impacto para o usuário final:** nenhum tratamento em produção estava em titulação (verificado: 0 de 70). O que muda é que a web deixa de oferecer um caminho que só produzia dado inválido. **Sem relevância para notas de loja.**


### Core + Server — Spec 029 Slice F3: o motor da Evolução do tratamento (avanço + confirmação + cutover)

- **Feat** (`minor`, core `0.8.0 → 0.9.0` · server `minor`, PR #TBD): **A escada da titulação ganhou motor: ela agora anda sozinha quando é seguro, e pede permissão quando não é.** É o coração do épico — e, de quebra, conserta um avanço que estava morto em produção sem ninguém saber.
  - **Duas transições, uma regra de segurança.** `dose_change` (mesmo medicamento — só muda a quantidade) acontece **automático na data**, exatamente como o comportamento que os usuários de metoprolol já tinham. `medicine_switch` (troca de medicamento, o caso GLP-1) **nunca acontece sozinho**: a próxima etapa fica pendente e a etapa vigente **continua regendo os lembretes** até o usuário confirmar. Trocar o medicamento de alguém sem que a pessoa saiba — e possivelmente sem a caneta nova ter chegado — é risco clínico, não conveniência.
  - **A etapa vence pelo dia do usuário, não pelo relógio do servidor** (R-253/R-254). O motor legado somava `duração × 24h` sobre o horário de início: uma escada iniciada às 22h só virava às 22h do dia do vencimento, com a dose antiga valendo o dia quase inteiro. Agora vira na virada do dia **no fuso do dono**.
  - **Confirmar é um comando atômico e idempotente** (`confirm_titration_switch`): a decisão de quem chegou primeiro é do banco (`UPDATE ... WHERE status = 'pending_confirmation'`), não de um `if` em JavaScript. Tocar duas vezes no botão, dois aparelhos ao mesmo tempo ou o reenvio de uma confirmação offline caem todos no **mesmo caminho**: uma transição, um protocolo ativado, um evento de auditoria — e uma resposta honesta ("já iniciada") em vez de erro na cara do usuário. Confirmação obsoleta é **recusada**, não fingida. O dono sai da própria linha (`auth.uid()`), nunca do payload; `anon` não executa. Provado com 18/18 casos **contra o banco real, sem mockar o primitivo de concorrência** (R-288 — a lição do 043).
  - **A transição preserva o que é do usuário:** o protocolo anterior é pausado (e as doses futuras dele param de lembrar, na mesma transação — senão o app cobraria o medicamento antigo), o histórico passado fica intocado, e o **estoque não é tocado** ("fica guardado como está — nada é apagado"; o tratamento de estoque por etapa é o F5).
  - **🔴 O auto-avanço de titulação nunca funcionou em produção** (AP-298). Desde 06/05/2026, o cron filtrava por uma coluna que não existe (`protocols.status`; o certo é `active`) e **descartava o erro** do banco: a varredura inteira virava um "não há trabalho" silencioso. Ninguém percebeu porque a **dose exibida sempre esteve certa** — ela vem do gerador puro, que caminha a escada em memória; o que não acontecia era o avanço da linha e o push de etapa. Corrigido.
  - **Cutover atrás de flag, sem mudar nada hoje.** Os consumidores (gerador de doses, cron, alarmes do app) passam a receber as etapas da entidade nova **filtradas pelo tratamento** — filtro estrutural, sem consulta extra. A fonte segue em `n1` por padrão: **este merge não altera o comportamento de nenhum usuário**; ligar `TITRATION_SOURCE=n2` é um passo separado, reversível por variável de ambiente, sem deploy.
  - **Sem impacto de usuário nesta entrega** (nenhuma superfície de UI — o CTA e a timeline são F4/F5; a única escada em produção está dormente). **Sem relevância para notas de loja.**

### Core — Spec 029 Slice F2: repository + adapter dual-read + migração de dados N1→N2

- **Feat** (`minor`, core `0.7.0 → 0.8.0`, PR #TBD): **A escada da titulação ganhou acesso de dados e a ponte para o motor N2 — ainda sem tocar em nenhum usuário.** Três peças puramente internas sobre a fundação da F1:
  - **`createTitrationRepository`** (`@dosiq/core`, nível A strict): CRUD parametrizado por plataforma (`{client, getUserId}`, o mesmo padrão de `createTreatmentPlanRepository`) da escada e das etapas. O `user_id` das etapas é **sempre derivado do dono autenticado, nunca do payload** (AP-293) — a FK composta `titration_steps(titration_id, user_id) → titrations(id, user_id)` da F1 rejeita qualquer etapa cujo dono não bata com o da escada-pai, então a coerência é estrutural, não uma checagem que dá para esquecer.
  - **Adapter strangler-fig (dual-read):** `resolveTitrationStageAtFromSteps` / `calculateTitrationDataFromSteps` são o gêmeo **puro/clock-free** das funções N1, lendo `titration_steps` em vez do jsonb. As assinaturas das funções originais ficam **intactas** — os consumers (gerador de dose, cron, consulta/PDF, leitura web) **não são tocados nesta fase**; o cutover é a F3, atrás da flag `TITRATION_SOURCE` (default `n1`). A regra de paridade espelha o `titration_status` legado: etapa vigente com duração finita rege a dose (titulando → devolve dose); etapa vigente contínua (`duration_days` NULL) ou nenhuma etapa vigente devolvem null (alvo_atingido/pausado → a dose de manutenção vive no protocol, como antes).
  - **Migração de dados N1→N2** (`docs/migrations/20260716_titrations_data_migration.sql`, **NÃO aplicada em prod** — aguarda aprovação do PO): para cada protocol com `titration_schedule`, cria uma `titration` (`migrated_from_protocol_id` p/ auditoria) + etapas com o **mesmo `medicine_id`** (N1 é intra-medicamento por construção). Normaliza o fallback legado `days`→`duration_days` **na migração**, não no motor novo. Mapa de estados: `titulando`→etapa vigente `current` · `alvo_atingido`→última etapa contínua `current` · `pausado`→sem etapa vigente própria (acompanha o protocol). jsonb N1 **read-only** (dropado só na F6). Idempotente (`NOT EXISTS` por `migrated_from_protocol_id`).
  - **Provas fechadas:** PO-SEC-4 (`BEGIN..ROLLBACK` no banco real, 9/9: contagens, mapa de estados, jsonb byte-idêntico, `intake_unit` sólido→`cp`, idempotência; `RAISE` força rollback — zero rastro, confirmado `users_leak=0 titr_leak=0`) e PO-5 (paridade legado vs N2 em 3 datas para os 3 estados; 52 testes core verdes; `validate:agent` 2045/2045). **Sem impacto de usuário** (nenhuma superfície UI; jsonb N1 intacto). **Sem relevância para notas de loja.**

### Core — Spec 029 Slice F1: modelo da Evolução do tratamento (titulação N2)

- **Feat** (`minor`, core `0.6.0 → 0.7.0`, PR #TBD): **Fundação de dados da titulação em nível de tratamento (ADR-080).** Duas tabelas novas em prod — `titrations` (escada / orquestrador) e `titration_steps` (etapas: medicamento + dose + unidade + duração, `duration_days` NULL = etapa contínua) — com o template de segurança da casa: RLS `user_id = auth.uid()`, grants mínimos (nunca `anon`), FK `user_id → auth.users ON DELETE CASCADE` (R-287) e CHECK em toda coluna de domínio finito (R-271). Schema Zod `titrationSchema` no `@dosiq/core` sincronizado com os CHECKs. É o que permite a escada SALTAR de medicamento (caso GLP-1: semaglutida 0,25 → 0,5 → 1 mg), o que o jsonb N1 intra-protocolo não fazia. **Sem impacto de usuário** (nenhuma superfície UI ainda — motor, migração N1→N2 e telas vêm em F2–F5); jsonb N1 dos `protocols` intacto. PO-SEC-1 fechado com BEGIN..ROLLBACK 16/16 contra o banco real. **Sem relevância para notas de loja.**

### Web + Mobile — Spec 046 Slice B: consentimento no cadastro, trava do app e suspensão de lembretes

- **Feat** (`minor`, web `4.17.0 → 4.18.0` · mobile `0.26.0 → 0.27.0` · core `0.5.0 → 0.6.0`, PR #TBD): **O consentimento de dado de saúde virou superfície de usuário.** O Slice A construiu a trilha; aqui ela ganha as três portas por onde o titular passa: o cadastro, a trava e a retirada. **Relevante para as notas de loja** (consentimento específico e destacado, art. 11 da LGPD).
  - **Cadastro só sai com autorização explícita.** Um bloco de opt-in **destacado** — separado do aceite genérico de Termos/Privacidade, como a lei exige — nasce desmarcado (consentimento pré-marcado não é consentimento) e barra o envio do formulário. No app, o bloqueio vive também dentro do serviço de cadastro, não só na tela: nenhum outro caminho de código chega ao `signUp` sem opt-in.
  - **A intenção do cadastro não é a prova.** Com confirmação de e-mail ligada não existe sessão no momento do cadastro, então a escolha viaja no `user_metadata` — que é **escrito pelo cliente** e serve apenas de carona. Quem grava o evento é a RPC no servidor, no primeiro login, derivando titular, versão e hash. Forjar o metadata só permite conceder um consentimento legítimo a si mesmo, que é o que o checkbox já faz.
  - **Retirar o consentimento trava o app na tela de resolução** (exportar · excluir · voltar a consentir). A trava usa **allowlist** de rotas, nunca denylist: rota nova nasce trancada, e liberar é um ato deliberado. No app isso é estrutural — com a trava de pé, o navegador registra só a resolução, o hub de privacidade e a exclusão; as demais telas literalmente não existem. Uma denylist esqueceria uma rota e prenderia o titular numa tela sem export e sem exclusão — justamente os direitos que a revogação deveria tornar *mais* acessíveis.
  - **Contas antigas (sem consentimento registrado) são perguntadas, não presumidas.** Não existe consentimento retroativo. O pedido é dispensável nas três primeiras sessões e passa a bloquear na quarta. "Sessão" só conta com intervalo maior que 30 min entre aberturas — sem isso, um refresh de tela queimaria a cortesia do titular em segundos.
  - **Falha de leitura da trilha não decide nada.** Se o app não consegue *ler* o consentimento, ele não libera nem bloqueia: mostra erro com "tentar de novo", **não conta sessão e não escreve nada**. Tratar "não consegui ler" como "nunca consentiu" faria uma oscilação de rede ressuscitar um consentimento **revogado** — um erro de infra virando uma decisão que o titular nunca tomou.
  - **Quem revoga para de receber lembretes — e o problema de um paciente não vira o problema de todos.** O filtro vive no dispatcher, o funil por onde toda notificação passa (um tipo novo de notificação já nasce coberto), e decide com a linha **daquele** usuário: o estado revogado virou uma coluna em `user_settings`, escrita na **mesma transação** que grava a trilha, e lida no fetch que o dispatcher **já fazia**. Nenhuma consulta nova, nenhuma leitura global. Se a linha de um usuário não puder ser lida, **só ele** deixa de ser notificado (não sabemos se ele revogou, então não enviamos) — o lembrete de dose dos outros pacientes segue intacto. A trilha continua sendo a prova; a coluna é só o índice operacional derivado dela, e o titular **não consegue** limpá-la para voltar a receber push (a coluna é do controlador, protegida por trigger).
  - Migração aplicada em prod: `20260714_consent_revoked_flag.sql` (coluna `consent_revoked_at`, triggers de proteção, `consent_write` mantendo o flag na txn, backfill dos revogados — 0 hoje).

- **Publicação da política v0.3 e ativação do gate (T019a/T019b, mesmo minor):** o gate ficou represado em `draft` de propósito para estrear já sobre a política completa — a base consente **uma vez**, sobre a v0.3, sem um aceite intermediário em v0.2 virando `stale` no dia seguinte.
  - **`policy_version` subiu para `0.3` nos três lugares que têm que bater** (é contrato): a constante `CURRENT_POLICY_VERSION` (`@dosiq/core`), a versão impressa nos dois HTMLs (`apps/web/public/politica-de-privacidade.html` · `termos-de-uso.html`) e a linha de `public.consent_policy` que as RPCs carimbam no `consent_log`. Divergir aqui registraria o aceite de uma versão que ninguém consegue exibir — trilha inauditável. Migração `20260715_consent_policy_v03.sql` aplicada em prod.
  - **Política de privacidade e Termos de Uso publicados em HTML** (`apps/web/public/`, servidos estáticos): DPO pessoa física nomeado (art. 5º LGPD), foro São Paulo/SP, e-mail dedicado `privacidade@dosiq.app`, classificação 16+ com racional documentado (art. 14). O RIPD é interno e **não** vai para `public/`.
  - **Auto-declaração de idade (16+) embutida no próprio opt-in** (art. 14 LGPD): a frase "…e declaro ter 16 anos ou mais" entra no mesmo `label` que o titular já marca — mesmo clique, mesmo evento `granted`, prova de diligência nascida correlacionada ao ato, sem checkbox nem tela nova. A política cita esse texto **verbatim** (se divergir, o titular consentiu com uma redação e a política descreve outra).
  - **O nudge de "política nova" não pede novo aceite sem dar como ler.** Web e app ganharam um link "Ler a nova política" e o botão "Aceitar" fica **travado até o titular abrir a política**. No app, a trava só solta quando a webview é fechada (leitura real); na web, ao abrir a política em nova aba (o navegador não avisa o fechamento de aba — o proxy honesto é "abriu para ler").
  - **Hub de privacidade do app, seção Transparência:** a linha da política passa a mostrar a **versão publicada vigente** ("Versão vigente: v0.3", fonte síncrona `CURRENT_POLICY_VERSION`, independe de o titular ter aceito) em vez de "Aceito em … · vX" — essa informação de aceite já vive na seção Consentimento, sem duplicar.
  - **Landing web (seção privacidade):** ganhou link para a política publicada (não existia) e a cópia foi ajustada — "inacessível a qualquer pessoa, incluindo nossa equipe" era forte demais para RLS (não é E2E; `service_role` lê), trocada por "isolamento por RLS que restringe o acesso a cada registro ao seu próprio dono".

### Backend/infra — Spec 046 Slice A: trilha probatória de consentimento (LGPD art. 11) + recibo de exclusão

- **Feat** (`minor`, core `0.4.0 → 0.5.0` · backend/infra, PR #TBD): **A base do consentimento auditável.** Sem superfície de usuário ainda (o opt-in e os guards chegam no Slice B) — o que entra aqui é a trilha que torna o consentimento *provável*, e a garantia de que excluir a conta deixa um recibo. **Não relevante para as notas de loja** (nada muda para quem usa o app hoje).
  - **`consent_log`: uma trilha que o próprio auditado não consegue forjar.** O usuário logado tem **SELECT e nada mais** — nem INSERT. Toda escrita passa pelas RPCs `consent_grant` / `consent_revoke` (`SECURITY DEFINER`), que derivam o titular de `auth.uid()` e carimbam a versão da política e o hash **no servidor**. Dar INSERT ao dono tornaria a trilha forjável por quem ela deveria auditar (consentimento retroativo, versão falsa, recibo de exclusão fabricado) — e uma prova forjável não é prova. `subject_hash` e `user_id` ficam **fora do grant de coluna**: o hash é o identificador da trilha do controlador, e expô-lo criaria um oráculo gratuito de pares e-mail↔hash.
  - **A exclusão de conta agora deixa recibo.** Ela apagava 100% dos dados do titular (verificado: varredura dinâmica de todas as tabelas com `user_id` → zero linhas), mas não deixava nenhum registro de que tinha acontecido. O evento `account_deleted` passa a ser gravado **dentro da transação de exclusão**, antes do `DELETE FROM auth.users` — é a última chance de ler o e-mail para derivar o hash, e emitir depois abriria a janela "apagou e morreu antes de registrar".
  - **A trilha sobrevive ao titular** (`user_id ON DELETE SET NULL`, nunca cascade). Assimetria deliberada com o hotfix T000, onde os dados clínicos cascateiam: o dado de saúde tem que sumir (art. 16), a **prova da base legal**, não. O elo remanescente é o `subject_hash` = HMAC-SHA256 do e-mail, **irreversível de propósito**: o fluxo jurídico é *verificar* um titular nomeado num requerimento (recalcula-se o HMAC, acham-se as linhas), não *listar* excluídos — listar exigiria guardar o e-mail, isto é, não excluir.
  - **Pipeline único de exclusão**: `delete_user_account_by_id(uuid)` (só `service_role`) para o prune automático e `delete_user_account()` para o botão do titular convergem no mesmo núcleo. O bloqueio de "tratamento ativo" **fica só no caminho do titular** — é regra de UX. Herdá-lo no caminho automático faria a conta de quem revogou o consentimento nunca ser apagada: obrigação legal descumprida em silêncio, com o job passando verde.
  - **Pepper no Vault, sem fallback.** O script de ataque derrubou a ideia de aceitar o pepper via GUC (`app.consent_pepper`): GUC não tem ACL, e qualquer usuário logado o lia com um `SELECT current_setting(...)` — com o pepper vazado, todo `subject_hash` vira reversível por dicionário (e-mail tem entropia baixíssima). Ausente o segredo, a função **falha alto** e a exclusão aborta: melhor não apagar do que apagar deixando um recibo reidentificável.
  - Prova (`20260708_consent_log.test.sql`, `BEGIN..ROLLBACK` contra o banco real): **26/26 asserts**, cobrindo INSERT direto forjado, `account_deleted` fabricado, UPDATE/DELETE do próprio evento, leitura cross-user, linha órfã, `anon`, IDOR de exclusão de conta (inclusive com o GRANT forçado, simulando um escorregão em migração futura), vazamento do pepper, grant de coluna, e a prova do PO-6 ponta a ponta.
  - Migrações aplicadas em prod: `20260708_consent_log.sql`, `20260708_consent_rpcs.sql`, `20260708_delete_user_account_receipt.sql`.

### Web + Mobile — Spec 008: Exportação completa de dados (LGPD) + hub "Privacidade e dados"

- **Feat** (`minor`, web `4.16.0 → 4.17.0` · mobile `0.25.0 → 0.26.0` · core `0.3.0 → 0.4.0`, PR #TBD): **Exportação de dados chegou ao app** e o export web passou a incluir o que faltava. **Relevante para as notas de loja** (portabilidade de dados, art. 18 da LGPD).
  - **Novo hub "Privacidade e dados"** no Perfil do app (antes, o item abria direto a webview da política): exportar dados, política de privacidade e exclusão de conta num lugar só. A exclusão **saiu de Configurações** — o hub é o lar único (a rota interna e o fluxo de exclusão continuam intactos). O aviso "exporte seus dados antes de excluir" deixou de ser texto morto: agora leva ao export.
  - **Export nativo** (JSON ou CSV) via compartilhamento do sistema, com seleção do que entra no pacote e aviso de que o arquivo contém dados de saúde antes de compartilhar.
  - **Web: o pacote estava incompleto.** Passam a sair as **medidas e biomarcadores** (glicemia, peso, pressão — incluindo a pressão diastólica, que ficava de fora) e uma seção nova de **perfil e configurações** (sem tokens nem segredos). Medicamentos e tratamentos passam a exportar as colunas reais do schema: o inventário pedia campos que **não existem no banco** (`dosage_mg`, `pill_count`, `times`), então esses valores saíam vazios em silêncio — agora saem a dosagem, a unidade, os horários, os dados de líquidos/injetáveis (apresentação, unidades/ml, volume, validade após abertura) e os campos de titulação.
  - **Prova de atendimento** no pacote: o cabeçalho passa a registrar o titular (id + e-mail), o escopo pedido e o período.
  - Inventário e formatação (JSON/CSV, sanitização anti-fórmula do CSV) foram para o `@dosiq/core`: **uma implementação só** para web e app — a paridade do que é exportado deixa de depender de duas listas de colunas mantidas à mão.
  - Auditoria LGPD: as 22 tabelas com `user_id` receberam decisão explícita de exportar/não exportar (8 exportam), documentada na spec. Tokens de push, filas de notificação e trilhas técnicas ficam fora por decisão registrada.

### Web + Mobile — Épico 044: Modo Dose-Only (controle de estoque opcional)

- **Feat** (`minor`, web `4.15.4 → 4.16.0` · mobile `0.24.7 → 0.25.0` · core `0.2.3 → 0.3.0`, PRs #735 #736 #738 #739 #740 #TBD): **O controle de estoque virou opcional.** Quem só quer registrar doses não precisa mais informar caixas, quantidades ou compras — a resposta direta ao feedback dos beta testers Android, que abandonavam o cadastro no passo de estoque. **Relevante para as notas de loja.**
  - **Escolha no onboarding** (novo passo, web + mobile): "só registrar doses" ou "controlar o estoque também". O default do banco é `true` (`user_settings.stock_tracking_enabled NOT NULL DEFAULT true`) — **nenhuma conta existente muda de comportamento, zero backfill** (FR-009).
  - **Em modo dose-only, o estoque some por inteiro** — 18 superfícies mapeadas e cobertas: aba Estoque, campos de compra no cadastro de medicamento, pills e alertas de saldo, badge da agenda, insight de estoque, `/repor` do bot (com convite de ativação em vez de erro), export e PDF de consulta (imprime "Estoque: não controlado"). Registrar dose continua criando log + instância normalmente: as 3 RPCs atômicas (CON-026) leem a preferência **dentro da transação** e curto-circuitam o estoque, com assinaturas inalteradas.
  - **Desligar congela, nunca destrói** (toggle em Ajustes → Estoque): o saldo é carimbado (`stock_paused_at`) e preservado. Religar em menos de 30 dias retoma o saldo como estava, em silêncio. Depois de 30 dias, o app pergunta o que fazer com um saldo provavelmente defasado: retomar como está ou começar do zero — e "começar do zero" grava um **ajuste** (`legacy_unrecoverable`), sem apagar uma linha sequer do histórico de compras (append-only, R-226).
  - **Ligar depois liga o FIFO daqui pra frente** (tela de saldo inicial, com opção de pular por medicamento): as doses já registradas em modo dose-only **não são retro-consumidas** — o histórico fica intacto.
  - **Card de convite (não-modal)** na tela Hoje depois de 20 doses ou 14 dias de uso, dispensável de vez, para quem quiser experimentar o estoque. Sem cron novo.
  - **Alertas de estoque pulam quem está em dose-only** (o filtro entra no mesmo `select` do pipeline, sem query extra) — ninguém recebe aviso de saldo baixo de um saldo que não mantém.
  - Segurança/dados: migrações `20260709_stock_tracking_preference.sql` e `20260711_stock_fn_hardening.sql` (aplicadas em prod) — `restore_stock_for_log` ganhou `p_user_id` + guard de IDOR, as 3 RPCs de dose passaram a repassar o `user_id`, `search_path=''` em todas, `EXECUTE` de `anon` revogado (AP-278) e `medicines.type` com default que respeita o próprio CHECK.
  - Prova: PO-1..PO-5 fechados com evidência (`plans/specs/044-dose-only-mode/spec.md`) — zero mutação de estoque com o modo off (11/11 asserts `BEGIN..ROLLBACK` contra o banco real), sem retro-consumo na ativação, os 3 caminhos de reativação e o filtro de alertas.

- **Fix** (`no-user-impact`, PR #TBD): 8 suites de teste do mobile **não carregavam** (`Cannot find module './contracts.js'`) e a cobertura delas era silenciosamente zero — entre elas `TodayScreen`, `StockScreen` e `alarmService`. O `moduleNameMapper` do Jest não resolvia a extensão `.js` que o R-282 exige nos imports relativos de `packages/` (mesma classe do AP-263). Com o mapper corrigido: 325 → **384 testes**, 46 suites, zero vermelho novo.

### Backend/Infra
- **Feat** (`no-user-impact`, server `4.1.0` — mesmo trem de release do Slice A, sem bump novo, PR #TBD): Cutover do `daily_digest` para a outbox (043 T023b). O digest passa a ser enfileirado por **janela** `[digest_time, +10min)` no fuso do usuário, em vez do gatilho de minuto exato (`HH:MM === digest_time` — família AP-259: um tick que pulasse o minuto perdia o digest do dia inteiro); a idempotência sai do dedupe em memória e passa a ser a UNIQUE `(user_id, kind, period_key)`. O conteúdo é construído **no envio** (SEC-1) e revalida o modo no DB: quem saiu de `digest_morning` entre o enqueue e o drain não recebe. Payload extraído para um builder ÚNICO (`_buildDigestPayload`), consumido tanto pelo caminho legado quanto pelo da outbox — durante a transição não existem duas implementações do mesmo texto para divergir. Ativação por env (`OUTBOX_KINDS`), rollback por env; ausente = legado → **deploy neutro**. **`stock_alert` NÃO migrou** (a T023b previa os dois): ele é fan-out (1 alerta por medicamento + `stock_expiry_alert` por lote) e a UNIQUE atual só expressa 1 linha por usuário/dia — enfileirar o 2º medicamento seria recusado pela constraint e o alerta sumiria **em silêncio**. Precisa de `subject_id` no modelo → spec própria. O legado do estoque segue rodando e já carrega o filtro dose-only (044).
- **Fix** (`no-user-impact`, PR #TBD): O gate `validate:agent` **não executava nenhum teste de `server/`** — os globs de `vitest.critical.config.js` cobriam `src/**` e `packages/core/**`, mas não `server/**`. Na prática, a suíte da outbox (043) e o filtro dose-only dos alertas (044/PO-4) tinham teste e ficavam fora do gate que o agente roda antes de todo commit. Corrigido: **114 → 142 suites, 1609 → 1900 testes**, zero vermelho novo. Mesma classe do AP-289 (um gate verde que não roda o que promete proteger).
- **Feat** (`no-user-impact`, server `4.0.1 → 4.1.0`, PR #TBD): Outbox de notificações (043 Slice A, ADR-078, trilha de confiabilidade). Nova tabela `notification_outbox` (só referências user+kind+period_key — SEM payload/token, SEC-1/LGPD; RLS + zero grants authenticated/anon; UNIQUE(user_id,kind,period_key) = idempotência por constraint; prune 90d pg_cron) + drenador genérico no tick (`FOR UPDATE SKIP LOCKED` LIMIT 25, pool paralelo limitado R-281, deadline ~40s, retomada K/N, `channel_results` sem tokens). `api/notify.ts`: **reminders reordenados p/ primeiro + cada job isolado por try/catch** (falha de relatório não derruba o tick — PO-1; ADR-057 intacto). Cutover kind-a-kind atrás de `OUTBOX_KINDS` (csv env; ausente = legado → **deploy neutro**, rollback por env). Kinds migrados: `daily_adherence`, `weekly_adherence`, `monthly_report` (builders puros reusando a computação de adesão legada; enqueue por RANGE mata a fatia minuto-exato AP-259). `daily_digest`/`stock_alert` = cutover futuro no mesmo mecanismo. Health check da fila como resource de `api/admin.ts` (`/api/health/notifications` → `degraded` se há pendências além do limite; zero função serverless nova — R-090). Migração `20260707_notification_outbox.sql`. Coordenações: precede 046 Slice B (`api/notify.ts` compartilhado); hook `revoked` do enqueue marcado p/ 046.
- **Feat** (`no-user-impact`, PR #TBD): Higiene de `notification_devices` (043 Slice B, trilha de confiabilidade). Nova função `deactivate_stale_notification_devices(ttl_days default 30)` (SECURITY DEFINER, `search_path=''`, EXECUTE só `service_role`) desativa (`is_active=false`, **nunca DELETE**) devices sem atividade (`last_seen_at`) além do TTL; agendada via pg_cron diário (`30 3 * * *`) + one-shot retroativo na mesma migração. Corrige o acúmulo de rows ativos por aparelho físico (AP-208): revisor de loja com 24 devices ativos (1 aparelho × 10 versões, tokens Expo rotacionados) recebia 24 pushes idênticos por notificação. TTL=30d aplicado em prod desativou 11 rows históricos (reviewer 24→19; colapso completo é gradual — SC-002). Guard validado: 0 devices recentes (<30d) desativados; todos os rows preservados p/ auditoria. Migração `20260706_notification_device_hygiene.sql`. RPC `upsert_notification_device` intacta.
- **Fix** (`no-user-impact`, PR #TBD): FK `ON DELETE CASCADE` de `user_id` → `auth.users` em `dose_instances`, `dose_critical_events` e `dose_adherence_monthly`. A exclusão de conta (e o prune via Admin API) agora elimina o dado clínico do titular junto com a conta — atende LGPD art. 16. Corrige furo latente: as 3 tabelas tinham `user_id` sem FK e ficavam fora do pipeline de exclusão (`delete_user_account()` não as deletava). 0 órfãos em prod. Migração `20260708_dose_tables_fk_cascade.sql`, validada com `BEGIN..ROLLBACK` (pre[1,1,1]→post[0,0,0]) antes de aplicar. Sem mudança de comportamento no cliente.

### Mobile
- **Feat** (`patch`, 0.24.6 → 0.24.7, PR #TBD): Registro de device (`syncNotificationDevice`) não gera mais row novo por bump de versão do mesmo aparelho — `appVersion` sai da identidade (`device_fingerprint`) e segue como atributo atualizável (`p_app_version`). Raiz do AP-208; complementa a higiene de TTL server-side acima (FR-006). Sem impacto visível na UI.

### Shared/Core
- **Process** (`no-user-impact`, PR #TBD): Reorganização de arquivos e limpeza estrutural de diretórios da documentação oficial do Dosiq (Fase 4).

---

## Web v4.15.4 · Core v0.2.3 — 2026-07-08 — Refactor (040 F6): fechamento da migração TypeScript

> **Bump:** web `4.15.3 → 4.15.4` + core `0.2.2 → 0.2.3` (patch). **Plataformas:** web + packages (core). Sem mudança de comportamento nem migração de dados. Sem relevância para notas de loja.

### ♻️ Refactor

- **Queima da dívida strict do épico 040** (5 lotes — PRs #726-#730): contadores baseline → final por bucket: nível-B transitivo 535 → 73 (packages 444→0 · mobile 18→0 · congelados: web 37 + server 36) · testes A 483 → 0 (core 353→0 · server/notifications 119→0 · mobile 11→0) · programas consumidores (api/server/mobile) 134 → 0
- **D1**: `@dosiq/core` passa a emitir `.d.ts` no dist (`tsconfig.declarations.json` + condition `types` no `exports`) — elimina TS2305 no build da Vercel
- **D2**: novo helper `parseISOOrNull()` no core para call-sites nullable; assinatura de `parseISO` preservada (evita data clínica fantasma de `new Date(null)`)
- **D3**: props opcionais de form shared mobile com default `= undefined` (`FormAutocomplete`, `OnboardingHeader`) + remoção dos remendos `prop={undefined}` nos consumers
- **Triagem MATA/TIPA de testes**: testes mock-contra-mock/snapshot morto deletados; mocks stale do backlog F4 zerados (Profile, Treatment, StockForm, ProtocolForm, TitrationWizard, EmergencyCardForm, ProtocolChecklistItem)
- **Tooling**: 4 configs vitest web migradas de `poolOptions` deprecated (Vitest 4); 3 testes `.js` residuais do mobile renomeados; sweep `baseUrl` nos tsconfigs

### 🐛 Correções (dentro da fase)

- **Validação de dose aceitava 0** (`protocolFormUtils`, `n < 0` → `n <= 0`) — bug clínico real achado na triagem de teste "quebrado"
- **Guard `taken_at` pré-`parseISO`** + divisão por zero em `titrationUtils` (review Gemini #730)
- **`aria-describedby` de `dosage_per_pill` nunca apontava pro erro** (`MedicineFormDosageInfo` — argumento `errors` omitido na chamada de `getFieldDescribedBy`)
- **Fixture com `toISOString()` flaky pós-21h BRT** (SparklineAdesao) — datas em teste sempre locais

---

## Mobile v0.24.6 — 2026-07-06 — Refactor (040 F5): migração TypeScript de apps/mobile

> **Bump:** mobile `0.24.5 → 0.24.6` (patch, `APP_VERSION` canônico). **Plataforma:** mobile (Expo/RN). Sem mudança de comportamento nem migração de dados. Sem relevância pra notas de loja. **Plataforma:** mobile (Android). Sem mudança de comportamento clínico nem migração de dados. Sem relevância para notas de loja (apenas correção de compatibilidade em emuladores e camadas de tradução).

### ♻️ Refactor

- **apps/mobile/src 100% TypeScript** (8 lotes — PRs #716-#724): shared (hooks clínicos nível A no strict island — lote 5.1), components/services/styles/utils, todas as features (treatments, dose, medications, stock, dashboard, history, measures, profile, onboarding, chatbot, notifications, _dev), screens, navigation, platform, `App.tsx`/`index.ts`. Configs Expo permanecem `.js` (FR-010)
- **Tooling**: `apps/mobile/tsconfig.json` adicionado aos `CONSUMERS` do `strict-island.sh`; sweep preventivo de globs js-only (AP-265)

### 🐛 Correções (dentro da fase)

- **ASI hazard em cast statement-position** (AP-267): `(obj as any)` após statement sem `;` vira chamada de função em runtime, invisível ao tsc — 2 ocorrências em `navigation.navigate` + mocks silenciosamente quebrados (AP-266, fix getUserTime/getHours no HeroDoseCard com teste de regressão)
- **`presentation: 'fullScreenModal'` inválido no JS stack** — `as any` mascarava bug real; corrigido pra `'modal'` (lote 7)
- **DevHubScreen**: `SafeAreaView` de RN → `react-native-safe-area-context` (`edges` era ignorado)
- **Gate F5**: mocks desatualizados em `TodayScreen.test`/`TreatmentsScreen.test` (namespace lucide, `createNavigationContainerRef`, texto de empty state) + `.claude/**` no ignores do eslint (worktree morto gerava centenas de erros fantasmas)
- **Android**: Correção de falha de carregamento da biblioteca nativa `libreactnative.so` no `MainApplication` ao forçar a propriedade `useLegacyPackaging=true` nas propriedades do build nativo (AGP). As bibliotecas nativas agora são comprimidas no APK e extraídas no sistema de arquivos durante a instalação, o que permite o correto funcionamento de camadas de tradução binária (Houdini) em emuladores e arquiteturas híbridas.


---

## Web v4.15.3 — 2026-07-05 — Refactor (040 F4): migração TypeScript de apps/web

> **Bump:** web `4.15.2 → 4.15.3` (patch). **Plataforma:** web. Sem mudança de comportamento nem migração de dados. Sem relevância pra notas de loja.

### ♻️ Refactor

- **apps/web/src 100% TypeScript** (~400 arquivos, 10 lotes — PRs #705-#714): utils, schemas, shared, services, todas as features (protocols, medications, measures, stock, export, adherence, reports, consultation, dashboard, calendar, chatbot, emergency, notifications, prescriptions, profile, settings), views, App/main. Zero `.js/.jsx` restante
- **Nível A**: `src/shared/hooks` (dados clínicos) tipados e promovidos ao strict island (lote 4.2)
- **vite.config**: refs de `manualChunks` atualizadas pra `.ts/.tsx` no mesmo commit do lote 4.10; bundle principal 82.9 kB gzip (baseline 102 kB preservado)

### 🐛 Correções (dentro da fase)

- `no-undef` de tipos `React.*` sem import em `ChatWindow.tsx` — tipos `MouseEvent`/`KeyboardEvent` importados de `react` (gate F4)

---

## Server v4.0.1 (backend) — 2026-07-04 — Refactor (040 F3): migração TypeScript de api/ e server/

> **Bump:** server `4.0.0 → 4.0.1` (patch). **Plataforma:** backend (Vercel serverless + bot Telegram). Sem mudança de comportamento nem migração de dados. Sem relevância pra notas de loja.

### ♻️ Refactor

- **api/ e server/ 100% TypeScript**: 7 entries + 6 handlers de `api/`, `server/notifications/` (nível A — contratos de canal tipados, zero `any` público, entra no strict island), `server/bot/` + services/utils/index (nível B). Scripts `start`/`dev` do server migrados pra `tsx`
- **vercel.json**: 17 refs `api/*.js → *.ts` + remoção de rewrite fantasma `/api/gemini-reviews`
- **Ratchet cross-program** (`scripts/strict-island.sh`): além do strict island, compila `api/` e `server/` sob flags próprias (non-strict) — erro de fonte é bloqueante; fecha o gap "strict-limpo ≠ limpo em todo programa que inclui o core"

### 🐛 Correções (dentro da fase)

- **Runtime Node ESM Vercel**: extensão `.js` obrigatória em imports relativos de `api/*.ts` (F3.1) e `server/notifications/` (gate) — extensionless passa no tsc local (bundler) e no tsx, mas quebra `ERR_MODULE_NOT_FOUND` na Vercel; preview revalidado com 11/11 rotas OK
- **Repos inline de api/ alinhados aos contratos tipados**: `deactivateByToken` ausente causava `TypeError` em runtime quando Expo retorna `DeviceNotRegistered`; `quiet_hours_enabled` ausente no settings; `originalNotificationId` movido pra `context.details`
- **Core sob non-strict**: `value` explícito no insert de `createBiomarkerRepository` (inferência Zod sem `strictNullChecks` marcava opcional e quebrava o tipo Insert gerado do Supabase — erro latente da F2)

---

## Core v0.2.1 (packages) — 2026-07-04 — Refactor (040 F2): migração TypeScript do core

> **Bump:** core `0.2.0-phase3 → 0.2.1` (patch). **Plataforma:** packages/ (web+mobile consomem fonte — sem mudança de comportamento). Sem migração de dados. Sem relevância pra notas de loja.

### ♻️ Refactor

- **packages/ 100% TypeScript** (203 arquivos): shared-data, config, design-tokens, storage e todo `packages/core/src` (repositories, services, schemas, utils, chatbot, markdown, types). Zero `.js` restante em `packages/core/src`
- **Nível A real**: repositories tipados com `SupabaseClient<Database>` (`database.types.ts` gerado do Supabase), schemas exportando `z.infer<>`, `types/` novo com branded types (`PatientUid`/`CaregiverUid`) e `ActiveContext`
- **Ratchet strict redesenhado** (`scripts/strict-island.sh`, R-283): fonte nível A strict-limpa é bloqueante; nível B transitivo + testes = dívida contada (TODO 040-strict, queima na F6). 152 erros de fonte A zerados no gate

### 🐛 Correções (dentro da fase)

- Runtime Node ESM de api/server restaurado — extensão `.js` em imports relativos (AP-260/R-282, commits 434144e→4808b6ca)
- Exports órfãos de config/design-tokens/storage/core/shared-data apontados pra `.ts` (AP-261) — lint global (`import-x/no-cycle`) desbloqueado
- `parseISO` tipado na assinatura (`string | number | Date`) eliminando casts nos call-sites; retorno de `register_dose_atomic` tipado na fronteira do RPC (review Gemini PR #703)

---

## App v0.24.5 (mobile) + Backend — 2026-07-03 — Fix (041): janela do push-to-start + push_failed + dedupe token_captured

> **Bump:** mobile `0.24.4 → 0.24.5` (patch). **Plataforma:** Mobile + Backend. Sem migração. Fixes server redeployam no merge; o dedupe mobile exige o novo build.

### 🐛 Correções

- **Push-to-start da Live Activity (iOS) pega doses de curto prazo (server):** a janela era uma fatia de **1 minuto em T−60min** exato — uma dose criada/editada para tocar em **<60min** (ou um minuto de cron pulado) nunca casava, e a LA não iniciava com o app fechado. Agora a janela é o **intervalo `[now, now+lead]`**: qualquer dose crítica pendente entrando no horizonte de 60min, ainda sem start, é disparada no próximo tick. Idempotência preservada por `la_push_started_at`.
- **Falha de push da LA agora é auditada (`push_failed`, server):** o ciclo de vida (update/end) só registrava sucesso (`surface_transitioned`) — se o push falhava (ex.: token de simulador rejeitado pelo APNs), o trail ficava silencioso. Agora emite `push_failed` com `phase`/`status`/`reason` (sem PII), tornando visível *por que* a LA não transicionou.
- **`token_captured` sem rajada de duplicatas (mobile):** o sync do token da LA rodava a cada foreground/derive e re-emitia o mesmo `token_captured` (observado 4× em 40s no device real). Agora só emite quando o token **muda de fato** (nova Activity / rotação), cortando o ruído no trail sem perder a captura genuína.

---

## Backend — 2026-07-03 — Chore (042): views de debug do audit trail

> **Bump:** nenhum (no-user-impact — tooling de debug DB). **Plataforma:** Backend/DB. Aditivo, reversível.

### 🧱 Interno

- Duas views sobre `dose_critical_events` para inspeção do trail sem app: `v_dose_critical_summary` (1 linha/dose — trajetória compacta, duração, flags) e `v_dose_critical_trace` (linha-a-linha com `seq`/`elapsed`). `security_invoker=on` → herdam a RLS da tabela (cada usuário vê só as próprias doses). SQL em `docs/migrations/20260703_dose_critical_trace_views.sql`.

---

## App v0.24.4 (mobile) — 2026-07-02 — Feat (042 Slice B): beacon de dose crítica no device + fila offline

> **Bump:** mobile `0.24.3 → 0.24.4` (patch — feature aditiva, sem UI). **Plataforma:** Mobile. Sem migração (tabela nasceu no Slice A). Instrumentação de observabilidade — sem impacto para o usuário final.

### ✨ Novidades (interno / observabilidade)

- **Beacon no disparo do alarme crítico (Android):** o handler headless do Notifee agora registra `alarm_fired`/`nag_fired` — ou `alarm_suppressed` quando as notificações/canal estão bloqueados — junto de um **snapshot de permissão** (sem PII). Fecha a lacuna "o alarme não tocou e não há rastro" sem depender do simulador conectado.
- **Fila offline resiliente:** os eventos do disparo são enfileirados em AsyncStorage e **drenados no foreground** (zero perda quando o device está offline no momento do alarme). Cap de 200 itens com descarte FIFO + contador de overflow; um item só sai da fila após o insert confirmar (retry no próximo foreground).
- **iOS (ENG-1):** como o iOS não roda JS no disparo, o desfecho (`alarm_fired`/`alarm_suppressed`) é **derivado no foreground** a partir das notificações ainda exibidas + permissão (`captured_at_foreground: true`).
- **`token_captured`:** registra a captura do push-token da Live Activity (iOS) — **sem gravar o valor do token** (SEC-3).

### 🔒 Segurança / Privacidade

- `detail` dos eventos nunca contém token, rótulo de medicamento ou segredo (teste `criticalAuditDetailShape`). Emits fail-open: jamais quebram alarme/registro/push.

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
