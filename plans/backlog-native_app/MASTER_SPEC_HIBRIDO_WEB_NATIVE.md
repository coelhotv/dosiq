# Exec Spec Definitivo: Estrategia Hibrida Web + Native

> **Status:** Documento autoritativo para a evolucao dual stack do projeto
> **Data:** 2026-03-30
> **Escopo:** Meus Remedios v3.3.0
> **Supersede:** `plans/archive_old/native_app/analise-migracao-pwa-para-react-native.md`, `plans/archive_old/native_app/PLANO_EXECUTIVO_REACT_NATIVE.md`, `plans/archive_old/native_app/ARQUITETURA_RN_MONOREPO.md`, `plans/archive_old/native_app/EXEC_SPEC_RN_FASE1_CORE.md`, `plans/archive_old/native_app/EXEC_SPEC_RN_FASE2_MOBILE.md`

---

## 1. Objetivo

Definir, sem ambiguidade, como o projeto evoluira da aplicacao atual React + Vite + Supabase para um ecossistema hibrido com:

- `web`: a aplicacao atual, que continua sendo produto principal durante toda a transicao
- `mobile native`: um novo app Expo/React Native, entregue incrementalmente
- `shared packages`: apenas o que for comprovadamente compartilhavel entre plataformas

Este documento existe para impedir que agentes futuros:

- tentem fazer uma migracao "big bang"
- movam a web inteira para `apps/web` cedo demais
- coloquem codigo browser-dependent dentro do core compartilhado
- assumam que o projeto ja possui PWA completa com service worker e web push ativos
- substituam Telegram por push nativo antes da arquitetura de notificacao estar desacoplada

> **Addenda normativos complementares:** esta master spec agora deve ser lida em conjunto com `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`, `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`, `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md` e `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`.

### Mapa documental oficial

Os documentos oficiais e ativos deste projeto hybrid/native passam a ser:

- `plans/backlog-native_app/MASTER_SPEC_HIBRIDO_WEB_NATIVE.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE0_GUARDRAILS.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE1_WORKSPACES.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE2_CORE_PURO.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE3_ADAPTERS_SHARED_DATA.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE4_MOBILE_SCAFFOLD.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE5_MVP_PRODUTO.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE6_PUSH_BETA_INTERNO.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE7_MIGRACAO_WEB_APPS_WEB.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

Regra:

- tudo que estiver em `plans/archive_old/native_app/` e historico
- o maintainer e os agentes devem preferir sempre os docs de `plans/backlog-native_app/`
- em caso de conflito, a precedence correta e: `MASTER_SPEC` -> `EXEC_SPEC_FASE_*` -> `ADDENDUM_*` aplicavel

---

## 2. Decisao Executiva

### 2.1. O que este projeto vai fazer

O projeto **NAO** vai abandonar a web para "virar native".

O projeto **VAI**:

1. manter a web viva e entregando valor continuamente
2. criar um segundo cliente mobile native em paralelo
3. compartilhar apenas regras de negocio, schemas, validacoes e partes selecionadas da camada de dados
4. adiar a migracao estrutural pesada da web para depois que os adapters e o shared core estiverem estabilizados

### 2.2. Interpretacao correta da oportunidade

React Native faz sentido aqui como **expansao de superficie de produto**, nao como reescrita total imediata.

O racional valido continua sendo:

- App Store / Google Play
- push nativo confiavel
- biometria
- integracoes nativas futuras

Mas a execucao correta para este repositorio e:

- **curto prazo:** preparar arquitetura, criar app mobile MVP, manter web intacta
- **medio prazo:** beta interno/TestFlight, push nativo, distribuicao inicial
- **longo prazo:** HealthKit/Google Fit, biometria avancada, capacidades nativas adicionais

---

## 3. Baseline Real Validada do Repositorio

### 3.1. Fatos validados no codigo em 2026-03-29

- O projeto esta em `v3.3.0`, nao `v3.1.0`
- A app web atual e uma **SPA view-based**, sem router web formal
- A navegacao atual depende de `setCurrentView` e shell central em `src/App.jsx`
- A base atual possui aproximadamente:
  - `120` componentes JSX
  - `39` views
  - `128` arquivos CSS
  - `60` arquivos de services
  - `20` hooks
  - `17` schemas
  - `8` utils globais
- O projeto usa `framer-motion` em muitos componentes visuais
- O cliente Supabase atual depende de `import.meta.env`
- O cache atual depende de `window.localStorage`
- Existem servicos que dependem diretamente de `document`, `navigator`, `window`, `localStorage`
- O cron de notificacoes atual esta acoplado a Telegram

### 3.2. Inconsistencias documentais importantes

As premissas abaixo aparecem em docs antigos, mas **nao refletem fielmente o repo atual**:

- "PWA completa com Workbox/Service Worker/Web Push" -> nao foi encontrada implementacao correspondente no entrypoint atual
- "Migrar Web Push para Expo Push" -> hoje o canal operacional real e Telegram, nao Web Push
- "Mover tudo para `apps/web` logo de inicio" -> muito arriscado para a base atual

### 3.3. Leitura correta do estado atual

O projeto atual ja tem muito valor entregue, mas ainda **nao esta modularizado o suficiente** para uma extracao direta de `40-50%` do codigo sem refactor preparatorio.

O percentual realista e:

- **reutilizavel agora com baixo risco:** schemas, utils puros, parte pequena da logica de dominio
- **reutilizavel depois de adapters/refactor:** partes selecionadas de services e cache
- **nao reutilizavel:** UI web, CSS, animacoes web, PWA utils, share/export/report browser-based

---

## 4. Principios Nao-Negociaveis

Os itens abaixo sao obrigatorios. Nenhum agente deve relativiza-los.

### P-001. Web e native terao UIs separadas

- Nao portar HTML/CSS diretamente para React Native
- Nao tentar reaproveitar componentes React web em mobile
- Nao misturar `framer-motion` com stack native

### P-002. Shared core minimo e puro

Tudo que entrar em pacote compartilhado deve ser:

- livre de `window`
- livre de `document`
- livre de `navigator`
- livre de `localStorage`
- livre de `import.meta.env`
- livre de `react-dom`
- livre de `react-native`
- livre de `expo-*`

### P-003. A web continua produto principal durante a transicao

- `npm run dev`, `npm run build`, `npm run validate:agent` precisam continuar funcionando na web durante as fases iniciais
- o projeto nao pode exigir mobile para continuar evoluindo

### P-004. Nao combinar multiplas migracoes estruturais

Durante a iniciativa web+native, e proibido combinar com:

- migracao para TypeScript
- troca global de lint stack
- reescrita massiva de design system web
- troca de framework de backend
- troca de Supabase

### P-005. Notificacao nao e mais "Telegram ou nada"

Mas tambem nao e "substituir Telegram por Expo Push".

O caminho correto e:

- manter Telegram funcional
- adicionar push native como novo canal
- criar arquitetura multicanal real

### P-006. Dados de device nao vivem em `profiles`

**Nao** adicionar `expo_push_token` diretamente em `profiles`.

O projeto precisa suportar:

- mais de um device por usuario
- mais de uma plataforma por usuario
- invalidacao de tokens por device

Isso exige tabela dedicada de devices/endpoints.

### P-007. Async first para armazenamento compartilhado

O contrato compartilhado de storage deve ser assinado como assincorno.

Motivo:

- `localStorage` e sincronico
- `AsyncStorage` e assincorno
- `SecureStore` e assincorno

Se o contrato compartilhado nascer sincronico, a web dita a arquitetura e o mobile vira excecao. Isso e proibido.

### P-008. MMKV nao entra no MVP inicial

No curto prazo, adotar:

- `expo-secure-store` para auth/session sensivel
- `@react-native-async-storage/async-storage` para persistencia geral leve

MMKV so entra depois de medicao de gargalo real.

### P-009. NativeWind nao e obrigatorio no MVP

Para reduzir ambiguidade e fragilidade de setup, o MVP native deve usar:

- `StyleSheet`
- tokens JS/JSON
- componentes base explicitos

NativeWind so deve entrar se houver ADR explicita aprovando a troca.

### P-010. A mudanca para `apps/web` e tardia, nao inicial

Nao mover `src/`, `public/`, `index.html` e `vite.config.js` no primeiro grande PR.

Primeiro:

- workspaces
- pacotes compartilhados
- adapters
- mobile scaffold

Depois:

- mover web para `apps/web`, se e somente se os gates previos estiverem verdes

---

## 5. Arquitetura Alvo Recomendada

## 5.1. Arquitetura de transicao obrigatoria

### Etapa A - Arquitetura transicional

```text
meus-remedios/
├── src/                       # web continua na raiz
├── public/
├── index.html
├── vite.config.js
├── api/
├── server/bot/
├── apps/
│   └── mobile/               # novo app Expo
├── packages/
│   ├── core/                 # puro
│   ├── shared-data/          # compartilhado com injecao de dependencias
│   ├── storage/              # contratos e implementacoes de persistencia
│   └── config/               # leitura de env/config por plataforma
└── package.json              # root com scripts retrocompativeis
```

### Etapa B - Arquitetura alvo tardia

```text
meus-remedios/
├── apps/
│   ├── web/
│   └── mobile/
├── packages/
│   ├── core/
│   ├── shared-data/
│   ├── storage/
│   └── config/
├── api/
└── server/bot/
```

**Regra:** Etapa B so pode comecar apos a Etapa A estar estabilizada e validada.

## 5.2. Responsabilidade de cada pacote

### `packages/core`

Conteudo permitido:

- `schemas/`
- `domain/`
- `utils/` puros
- constantes puras
- formatadores puros
- calculos de adesao, estoque, datas, titracao

Conteudo proibido:

- criacao de cliente Supabase
- acesso a env
- cache persistido
- hooks React
- qualquer API browser/native

### `packages/shared-data`

Conteudo permitido:

- repositorios/factories que recebem dependencias injetadas
- query cache com contrato de storage injetado
- services compartilhados que usam `supabase`, `storage`, `logger`, `clock` por parametro

Conteudo proibido:

- `import.meta.env`
- `window.localStorage`
- importar singleton global de Supabase da web
- importar componentes React

### `packages/storage`

Conteudo:

- contratos de storage
- implementacao web
- implementacao native
- helpers de serializacao

### `packages/config`

Conteudo:

- contratos de configuracao
- loader web
- loader native
- normalizacao de chaves

---

## 6. Contratos Obrigatorios de Plataforma

## 6.1. Storage contract

Todo acesso compartilhado a persistencia deve usar o contrato abaixo.

```js
export async function getItem(key) {}
export async function setItem(key, value) {}
export async function removeItem(key) {}
export async function getJSON(key, fallback = null) {}
export async function setJSON(key, value) {}
```

Regras:

- sempre assincorno
- sem hidratar storage no import do modulo
- toda hidratacao deve ser feita por funcao `init*()` chamada explicitamente no bootstrap

## 6.2. Config contract

Nenhum pacote compartilhado pode ler `import.meta.env` ou `process.env` diretamente.

Todo pacote compartilhado deve receber config por injecao:

```js
createSupabaseDependencies({
  url,
  anonKey,
  storage,
  detectSessionInUrl,
})
```

## 6.3. Supabase contract

O cliente Supabase deve ser criado em camada de plataforma, nunca em `packages/core`.

Bootstrap web:

- usa `persistSession: true`
- usa `detectSessionInUrl: true`
- usa wrapper web storage

Bootstrap native:

- usa `persistSession: true`
- usa `detectSessionInUrl: false`
- usa `expo-secure-store` para sessao
- controla auto refresh com `AppState`

## 6.4. Notifications contract

A camada de notificacao precisa separar:

- preferencia do usuario
- devices registrados
- canal de entrega
- payload de dominio

Contrato minimo:

```js
dispatchNotification({
  userId,
  kind,
  payload,
  channels,
})
```

Onde:

- `kind` = tipo de notificacao de dominio
- `payload` = mensagem normalizada
- `channels` = `['telegram']`, `['mobile_push']`, `['telegram', 'mobile_push']`

## 6.5. Share/export contract

Tudo que depende de DOM, download por `<a>`, clipboard web ou `navigator.share` deve ficar fora do compartilhado.

Criar adapters separados por plataforma para:

- compartilhar texto/link
- abrir PDF
- copiar link
- baixar arquivo

---

## 7. Matriz Prescritiva de Extracao

## 7.1. Pode ir para compartilhado agora

Mover primeiro para `packages/core`:

- `src/schemas/**`
- `src/utils/**`
- `src/features/protocols/utils/**`

Mover depois de pequeno refactor para `packages/core`:

- funcoes puras atualmente dentro de `src/features/*/services/` que nao tocam storage, env, DOM ou singleton Supabase

## 7.2. Compartilhavel somente apos adapters

Mover para `packages/shared-data` somente depois de refactor por injecao:

- `src/shared/utils/queryCache.js`
- `src/shared/hooks/useCachedQuery.js` -> preferencialmente quebrar em:
  - `packages/shared-data/queryCache`
  - hook web/local permanece na app que o consome
- services de features que hoje usam singleton Supabase da web

## 7.3. Nao pode entrar no compartilhado sem reescrita

Arquivos/classes nessa categoria devem permanecer na plataforma atual ou ser reescritos por adapter:

- `src/shared/utils/supabase.js`
- `src/features/emergency/services/emergencyCardService.js`
- `src/features/protocols/services/reminderOptimizerService.js`
- `src/features/chatbot/services/chatbotService.js`
- `src/features/dashboard/services/analyticsService.js`
- `src/features/dashboard/services/milestoneService.js`
- `src/features/dashboard/services/insightService.js`
- `src/features/export/services/exportService.js`
- `src/features/reports/services/chartRenderer.js`
- `src/features/reports/services/shareService.js`
- `src/features/reports/services/pdfGeneratorService.js`

## 7.4. Nunca compartilhar

- `src/views/**`
- `src/shared/components/**`
- `src/features/*/components/**`
- todos os arquivos `.css`
- `src/shared/components/pwa/**`
- qualquer UX baseada em `framer-motion`

---

## 8. Modelo de Dados Recomendado

## 8.1. Decisao de modelo

Preferencias continuam em `user_settings`.

Dispositivos/tokens vao para tabela nova dedicada.

### Motivo

O projeto atual ja usa `user_settings` como casa de:

- `telegram_chat_id`
- `verification_token`
- `timezone`
- `onboarding_completed`

Logo, a decisao correta e:

- **preferencias e canal default** -> `user_settings`
- **tokens/dispositivos** -> nova tabela `notification_devices`

## 8.2. Campos novos em `user_settings`

Adicionar:

```sql
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS notification_preference text DEFAULT 'telegram';

ALTER TABLE user_settings
ADD CONSTRAINT user_settings_notification_preference_check
CHECK (notification_preference IN ('telegram', 'mobile_push', 'both', 'none'));
```

## 8.3. Nova tabela `notification_devices`

Criar:

```sql
CREATE TABLE IF NOT EXISTS notification_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_kind text NOT NULL CHECK (app_kind IN ('native', 'pwa')),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  provider text NOT NULL CHECK (provider IN ('expo', 'webpush')),
  push_token text NOT NULL,
  device_name text,
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, push_token)
);
```

## 8.4. O que esta proibido

Esta proibido:

- salvar token unico em `profiles`
- sobrescrever token de um device com o de outro
- misturar preferencia do usuario com registro de device na mesma coluna

---

## 9. Arquitetura de Notificacoes Necessaria

## 9.1. Situacao atual

Hoje o `api/notify.js` e o `server/bot/tasks.js` estao organizados para Telegram.

Isso **nao** deve ser remendado com `if (expo) ... else telegram`.

## 9.2. Arquitetura alvo obrigatoria

Criar camada dedicada:

```text
server/notifications/
├── dispatcher.js
├── channels/
│   ├── telegramChannel.js
│   └── expoPushChannel.js
├── policies/
│   └── resolveChannelsForUser.js
└── payloads/
    └── buildNotificationPayload.js
```

## 9.3. Sequencia correta

1. cron/task gera evento de dominio
2. dispatcher resolve canais do usuario
3. cada canal tenta entrega
4. falhas vao para observabilidade/DLQ
5. Telegram continua funcionando mesmo se push native falhar

## 9.4. Regra de rollout

Push native entra como **novo canal**.

Telegram so pode deixar de ser default quando:

- token registration estiver estavel
- invalidacao de token estiver pronta
- tracking de falha estiver pronto
- beta interno em iOS e Android estiver aprovado

---

## 10. Stack Recomendada para o MVP Native

## 10.1. Escolhas obrigatorias

- Runtime: `Expo`
- Navegacao: `React Navigation 7`
- Estilos: `StyleSheet`
- Auth storage: `expo-secure-store`
- Persistencia geral: `@react-native-async-storage/async-storage`
- Notificacoes: `expo-notifications`
- Testes mobile: `Jest` + `@testing-library/react-native`

## 10.2. Escolhas proibidas no MVP

- `NativeWind`
- `MMKV`
- `Expo Router`
- `TypeScript migration`
- `HealthKit`
- `Google Fit`
- `react-native-web` como estrategia de compartilhamento de UI

## 10.3. Escolhas adiadas para pos-MVP

- biometria
- MMKV
- HealthKit/Google Fit
- PDF nativo refinado
- chatbot native
- emergency QR compartilhado entre plataformas

---

## 11. Escopo do MVP Native

## 11.1. MVP obrigatorio

O primeiro beta interno deve conter somente:

1. autenticacao
2. persistencia de sessao nativa
3. shell de navegacao mobile
4. tela "Hoje" / dashboard enxuto
5. registro de dose a partir da tela principal
6. leitura de tratamentos/protocolos
7. leitura de estoque
8. perfil/configuracoes basicas
9. vinculo Telegram
10. capacidade de push native completada na Fase 6

## 11.2. Fora do MVP

- exportacao PDF
- compartilhamento complexo
- modo consulta medica
- chatbot IA
- calendario completo
- emergency card avancado
- admin DLQ
- todas as views redesign web

## 11.3. Justificativa

O MVP existe para provar:

- arquitetura compartilhada
- auth/session
- navegacao
- consumo de dados reais
- push native

Leitura correta da sequencia:

- Fase 5 entrega o MVP de produto sem push nativo operacional
- Fase 6 completa o item de push native, permissao, token registration e beta interno

O MVP **nao** existe para atingir paridade total da web.

---

## 12. Fases Executaveis

## Fase 0 - Alinhamento e Guardrails

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE0_GUARDRAILS.md`

### Objetivo

Criar o terreno correto para a execucao. Nenhum codigo native de produto entra aqui.

### Entregaveis obrigatorios

- este documento definitivo
- ADR curta definindo:
  - por que a web fica na raiz primeiro
  - por que `user_settings + notification_devices`
  - por que `StyleSheet + AsyncStorage` no MVP
- inventario de extracao com allowlist/denylist de arquivos
- nota de supersessao nos docs RN antigos

### Gates

- zero impacto em `npm run build`
- zero impacto em `npm run validate:agent`
- nenhum arquivo de app foi movido ainda

## Fase 1 - Workspaces sem mover a web

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE1_WORKSPACES.md`

### Objetivo

Adicionar estrutura de monorepo sem quebrar o fluxo atual da web.

### Implementacao obrigatoria

- adicionar `workspaces` no root
- adicionar `turbo` se desejado, mas manter scripts retrocompativeis
- criar `apps/mobile/`
- criar `packages/core/`, `packages/shared-data/`, `packages/storage/`, `packages/config/`

### Implementacao proibida

- mover `src/` para `apps/web`
- mover `public/`
- mover `vite.config.js`
- reescrever todos os aliases da web

### Gates

- `npm run dev` continua abrindo a web atual
- `npm run build` continua buildando a web atual
- `npm run validate:agent` continua verde

## Fase 2 - Extracao do core puro

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE2_CORE_PURO.md`

### Objetivo

Extrair somente o que e de baixo risco.

### Ordem obrigatoria

1. `src/schemas/**`
2. `src/utils/**`
3. utils puros de features
4. testes dos modulos extraidos
5. adaptacao dos imports da web

### Regra

Se o modulo exigir `window`, `document`, `navigator`, `localStorage`, `import.meta.env` ou singleton Supabase, ele **nao** entra nesta fase.

### Gates

- web compila
- testes criticos passam
- nenhum service browser-dependent foi extraido por engano

## Fase 3 - Adapters e shared-data

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE3_ADAPTERS_SHARED_DATA.md`

### Objetivo

Criar contratos compartilhados para storage, config, query cache e acesso a dados.

### Entregaveis obrigatorios

- `packages/storage`
- `packages/config`
- nova versao de query cache sem hidratacao em import
- factories de repositorio/servico com injecao de:
  - `supabase`
  - `storage`
  - `logger`
  - `clock`

### Gates

- web usa adapters novos sem regressao
- mobile ainda nao consome features de produto
- nao existe mais dependencia estrutural de `localStorage` dentro do compartilhado

## Fase 4 - Scaffold mobile

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE4_MOBILE_SCAFFOLD.md`

**Addenda obrigatorios desta fase:**

- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

### Objetivo

Subir o app Expo com auth, sessao, navegacao e tela de smoke.

### Entregaveis obrigatorios

- `apps/mobile` criado
- `app.config.js` e `eas.json` criados
- React Navigation configurado
- cliente Supabase native configurado
- `SecureStore` para auth
- `AsyncStorage` para persistencia nao sensivel
- tela de smoke consumindo schema real do pacote compartilhado

### Gates

- app abre em iOS simulator
- app abre em Android emulator
- login funciona
- sessao persiste ao reabrir
- `scheme` `meusremedios://` esta configurado
- `development` e `preview` existem como build profiles

## Fase 5 - MVP de produto mobile

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE5_MVP_PRODUTO.md`

**Addenda obrigatorios desta fase:**

- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md`

### Objetivo

Entregar as telas do MVP e provar consumo real da camada compartilhada.

### Ordem sugerida obrigatoria

1. shell + tabs
2. Hoje / Dashboard
3. registrar dose
4. Tratamentos
5. Estoque
6. Perfil / Settings
7. vinculo Telegram
8. stale states e politica online-first coerentes
9. routing interno minimo coerente com o shell MVP

### Gates

- fluxos principais validados manualmente
- teste unitario de componentes criticos mobile
- zero dependencia de componentes web
- escrita offline continua bloqueada nesta etapa

## Fase 6 - Push native e beta interno

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE6_PUSH_BETA_INTERNO.md`

**Addenda obrigatorios desta fase:**

- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

### Objetivo

Adicionar notificacao nativa com arquitetura multicanal correta.

### Entregaveis obrigatorios

- migration de `notification_devices`
- preferencia em `user_settings`
- dispatcher multicanal
- registro de device no login/app open
- invalidacao/refresh de token
- UX de permissao de notificacao
- tratamento de foreground/background/cold start
- roteamento seguro ao tocar na notificacao
- beta interno/TestFlight

### Gates

- Telegram continua funcionando
- push native funciona em iOS
- push native funciona em Android
- falhas sao observaveis
- tap em notificacao leva para rota segura

## Fase 7 - Mover web para `apps/web` se necessario

**Exec spec detalhada:** `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_FASE7_MIGRACAO_WEB_APPS_WEB.md`

**Addenda obrigatorios desta fase:**

- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`
- `plans/backlog-native_app/EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

### Objetivo

So agora executar a migracao estrutural pesada da web.

### Pre-condicoes

- Fases 1-6 concluidas
- imports compartilhados estabilizados
- pipeline de testes verde
- owner humano concorda com a mudanca estrutural
- `apps/mobile/app.config.js` e `apps/mobile/eas.json` estaveis

### Gates

- Vite build web identico ou melhor
- scripts documentados e atualizados
- Vercel configurado para novo root
- tooling de release do mobile continua intacto

## Fase 8 - Pos-MVP native

**Status da documentacao:** ainda sem exec spec detalhada propria. Ate la, esta fase permanece apenas como placeholder estrategico nesta master spec.

- biometria
- MMKV
- HealthKit/Google Fit
- PDF native
- emergency card avancado
- chatbot native

## 12.1. Addenda normativos de consumo transversal

Os addendums abaixo nao substituem as fases. Eles complementam as fases com regras operacionais transversais.

### `EXEC_SPEC_HIBRIDO_ADDENDUM_RELEASE_ENGINEERING.md`

Consumido obrigatoriamente por:

- Fase 4
- Fase 6
- Fase 7

### `EXEC_SPEC_HIBRIDO_ADDENDUM_DEEPLINKS_E_ROUTING.md`

Consumido obrigatoriamente por:

- Fase 4
- Fase 5
- Fase 6

### `EXEC_SPEC_HIBRIDO_ADDENDUM_OFFLINE_SYNC.md`

Consumido obrigatoriamente por:

- Fase 5
- Fase 6

### `EXEC_SPEC_HIBRIDO_ADDENDUM_PRIVACY_PERMISSIONS_COMPLIANCE.md`

Consumido obrigatoriamente por:

- Fase 4
- Fase 6
- Fase 7

---

## 13. PR Slicing Obrigatorio

Agentes futuros nao devem abrir uma PR "migracao RN" gigante.

A divisao correta e:

1. PR 1 - docs, ADRs, inventario, supersessao
2. PR 2 - workspaces e estrutura vazia
3. PR 3 - `packages/core` com schemas e utils puros
4. PR 4 - adapters (`storage`, `config`, query cache)
5. PR 5 - `apps/mobile` scaffold e auth smoke
6. PR 6 - navegacao e shell mobile
7. PR 7 - dashboard + dose register
8. PR 8 - tratamentos + estoque + perfil
9. PR 9 - notificacoes + beta interno
10. PR 10 - mover web para `apps/web` se aprovado

Regra:

- cada PR precisa ser validavel isoladamente
- nenhuma PR pode misturar fase estrutural com muita feature de produto

---

## 14. Checklist do Arquiteto

Antes de instruir coders, o agente arquiteto deve especificar:

1. quais diretorios entram em cada pacote
2. quais arquivos sao allowlist, denylist e rewrite-required
3. o contrato exato de storage
4. o contrato exato de config
5. o bootstrap web do Supabase
6. o bootstrap native do Supabase
7. o schema SQL final de `notification_devices`
8. a estrategia de dispatcher multicanal
9. a navegacao do MVP mobile
10. o que fica fora do MVP
11. quais addendums transversais sao obrigatorios para a fase corrente

Se algum desses itens nao estiver especificado, o trabalho de codigo **nao esta pronto para implementacao**.

---

## 15. Checklist do Coder

Todo agente coder deve seguir a ordem abaixo:

1. ler este documento inteiro
2. validar se a tarefa pertence a uma unica fase
3. confirmar se os arquivos tocados pertencem ao escopo daquela fase
4. manter a web compilando o tempo todo
5. nao mover web para `apps/web` antes da fase correta
6. nao colocar browser APIs em pacote compartilhado
7. nao colocar native APIs em pacote compartilhado
8. nao criar token de push em `profiles`
9. nao quebrar Telegram durante push native
10. validar com testes adequados da fase
11. ler os addendums transversais aplicaveis antes de implementar detalhes operacionais

### Validacao minima por PR

Na web:

- `npm run lint`
- `npm run test:critical`
- `npm run build`

No mobile, quando existir:

- teste manual de boot
- teste manual de login
- teste manual de persistencia de sessao
- testes unitarios dos modulos novos

---

## 16. Definicao de Sucesso

Esta iniciativa sera considerada bem-sucedida quando:

1. a web continuar entregando normalmente
2. existir um app native funcional em beta interno
3. regras de negocio compartilhadas estiverem centralizadas e puras
4. notificacoes tiverem arquitetura multicanal
5. nao houver schema drift entre plataformas
6. o projeto puder evoluir web e mobile sem duplicar logica de dominio

---

## 17. Decisoes Congeladas por Este Documento

As decisoes abaixo ficam congeladas ate nova revisao explicita:

- estrategia dual stack, nao migracao total
- web permanece na raiz nas fases iniciais
- `packages/core` e puro
- `packages/shared-data` usa injecao de dependencias
- `user_settings` guarda preferencia
- `notification_devices` guarda tokens/dispositivos
- `StyleSheet + AsyncStorage` no MVP
- `apps/web` so depois de estabilizacao

Qualquer agente que queira alterar uma dessas decisoes deve abrir uma ADR nova e justificar por que este documento deixou de ser a melhor opcao.
