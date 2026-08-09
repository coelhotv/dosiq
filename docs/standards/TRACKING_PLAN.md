---
title: "Tracking Plan — Taxonomia de Analytics de Produto"
description: "Fonte de verdade da telemetria de produto do Dosiq: convenção de nomes, propriedades obrigatórias, política de PII e o catálogo evento→pergunta para mobile, web e bot."
version: "1.0.0"
status: active
category: standard
audience:
  - dev
  - agent
  - product
tags:
  - analytics
  - posthog
  - taxonomy
  - privacy
  - tracking-plan
created_at: "2026-08-08"
updated_at: "2026-08-08"
epic: "analytics-instrumentation"
---

# Tracking Plan — Taxonomia de Analytics de Produto

> **Fonte de verdade da telemetria de produto.** Qualquer evento emitido para o PostHog —
> mobile, web ou bot — obedece a este documento. O catálogo em código
> (`apps/mobile/src/platform/analytics/analyticsEvents.ts`) é a **implementação** desta
> taxonomia; quando divergirem, este plano é a intenção e o código é o bug a corrigir.
>
> **Regra-mãe (§4):** nenhum evento novo entra sem uma pergunta de produto declarada. A ausência
> dessa regra é a causa histórica dos 15 eventos declarados que nunca dispararam.

---

## 1. Fronteira e propósito (inegociável)

O PostHog no Dosiq é **só analytics de produto + métrica de adoção de frota**. Herdado de
**ADR-090** e da governance da **spec 051**:

- 🔴 **Proibido** usar feature flag do PostHog como gating de conteúdo OTA (governance 051 §125).
- 🔴 **Proibido** colocar PostHog no caminho do kill switch — que é boot-blocking e fail-open
  (AP-303).
- 🔴 **Session replay desligado** por decisão de custo (ADR-090). Não religar sem decisão explícita.
- **Sentry ⊥ PostHog:** configuração independente (`sentryDsn` ≠ `posthogApiKey`). Instrumentação
  nova nunca acopla os dois — um early-return por client PostHog ausente não pode pular o
  `Sentry.setUser` (RC6, PR #773).

### O que a telemetria existe para medir

A base teórica está em `dosiq-dopamina.md` (distinção de Berridge entre **querer** e **gostar**).
Operacionalmente, três variáveis **independentes**, com direções ótimas diferentes:

| Alvo | Direção ótima |
|---|---|
| Querer a dose (aderência ao tratamento) | Alta |
| Querer o app (impulso de abrir) | **Decrescente ao longo do tempo** |
| Gostar do app (satisfação) | Alta e estável |

**Consequência que governa toda a instrumentação:** um usuário que registra a dose pela
notificação e nunca abre o app está no **estado ideal**, não em churn. Sem `surface` no
`dose_logged` (§3) e sem os eventos de notificação (§5), o PostHog leria "sucesso silencioso"
como usuário morrendo. É por isso que `surface` é obrigatório.

> **Nota de método (42 usuários, todos UTC-3):** nenhum A/B test de mecânica tem poder
> estatístico nesta escala. Esta taxonomia serve para **leitura descritiva e segmentação por
> persona**, não para experimentação. Não prometer experimentos.

---

## 2. Convenção de nomes

- **Formato:** `snake_case`, padrão `objeto_verbo_no_passado` — `dose_logged`, nunca `log_dose`;
  `medicine_added`, nunca `add_medicine`.
- **Sem PII no nome** (ver §6).
- **Um evento, um fato.** Variações do mesmo fato vão em propriedade (`action`, `source`), não em
  nome novo.

### 2.1 Nomes legados congelados (exceção permanente)

Renomear um evento **já emitido** quebra a continuidade da série no PostHog (vira duas séries
sem junção). Portanto os nomes abaixo violam a convenção mas ficam **congelados como estão**. Não
renomear; não replicar o padrão deles em eventos novos.

| Nome em produção | Violação | Motivo do congelamento |
|---|---|---|
| `login` | não é `_no_passado` | emitido desde o início; série viva |
| `sign_up` | idem | reservado do Firebase, mapeia funil de conversão |
| `onboarding_start` / `onboarding_skip` | verbo no infinitivo/substantivo | catálogo original |
| `stock_opt_in` / `stock_opt_out` | idem | série da spec 044 (SC-004) |
| `stock_upsell_shown` / `stock_upsell_dismissed` / `stock_upsell_conversion` | idem | série da spec 044 |
| `stock_onboarding_choice` | idem | série da spec 044 |

Tudo que **ainda não é emitido** (os órfãos da §5) deve ser cabeado com o nome atual do catálogo
**se** ele já respeita a convenção; se não respeitar e ainda não houver série, corrigir o nome no
catálogo **antes** do primeiro disparo.

### 2.2 Literais fora do catálogo (a corrigir na Fase 1)

Regra do topo de `analyticsEvents.ts`: **nunca usar string literal fora do catálogo.** Violações
vivas hoje, a migrar para `EVENTS`:

`titration_transition_confirmed`, `titration_transition_postponed`, `cold_start`,
`consent_health_declined`, `dev_smoke_event` (este último é de DevHub — pode permanecer literal se
marcado como não-produção).

---

## 3. Propriedades obrigatórias em todo evento

| Propriedade | Valores | Como é anexada | Responde |
|---|---|---|---|
| `surface` | `mobile` · `web` · `bot` · `push` · `alarm` · `system` | **por chamada** (varia por evento) | de onde a ação nasceu |
| `app_version` | ex. `0.30.1` | super property / `bundleTags()` no mobile | métrica de adoção de frota (ADR-090) |
| `mode` | `simple` · `complex` | **super property** via `register` (§3.2) | segmentação por persona |

> **Três níveis, não um.** `surface` é a única **por chamada** — obrigatória em todo evento.
> `app_version`/`mode` são **super properties**: anexadas automaticamente depois de definidas na
> sessão (eventos antes do profile carregar — `login`, `cold_start` — podem não ter `mode`; §3.2).
> Eventos de **comportamento clínico** carregam ainda `treatment_id` — obrigatória **condicional**,
> não universal (§5.0).

### 3.1 Semântica de `surface` (crítico para "sucesso silencioso")

`surface` é a **origem da ação**, não a plataforma do binário:

- `mobile` / `web` — ação originada na **UI em foreground** do app naquela plataforma.
- `push` — ação a partir de uma **notificação** (ex.: registrar dose pelo botão do push). Uma
  dose registrada pelo push **no celular** é `surface: 'push'`, **não** `mobile` — essa
  distinção é o insumo da métrica de sucesso silencioso.
- `alarm` — alarme de dose crítica.
- `bot` — Telegram.
- `system` — **reservado** para evento materializado sem ação de usuário. Sem emissor no baseline:
  o encerramento passivo é **derivado analiticamente**, não emitido (ver §5.3.1). Existe no
  vocabulário para o caminho opcional de materialização dentro do PostHog.

A plataforma do dispositivo continua disponível pelas propriedades nativas do SDK PostHog
(`$os`, `$lib`); não duplicar.

### 3.2 `mode` como super property (não passar por chamada)

`mode` mapeia a coluna `profiles.complexity_override` (`'simple' | 'complex' | null`; `null` =
densidade adaptativa, Wave 10A). Ele **não** está acessível na maioria dos pontos de emissão
(ex.: `doseService`), então **não** deve ser passado call a call. Definir uma vez por sessão via
`register` quando o profile carrega — assim acompanha todos os eventos seguintes. Quando
`complexity_override` for `null`, resolver para o valor efetivo do threshold adaptativo antes de
registrar (não registrar `null`).

**Por que importa:** as personas têm funções de utilidade **opostas** — sessão longa é bom sinal
para o Carlos (complex) e mau sinal para a Dona Maria (simple). Média global sem `mode` mistura os
dois e esconde os dois.

---

## 4. Regra-mãe: nenhum evento sem pergunta

Todo evento no catálogo da §5 declara **qual pergunta de produto responde**. Um evento que não
consegue nomear sua pergunta não entra — foi exatamente esse vazio que produziu 15 eventos
escritos de uma vez e nunca cabeados. Adicionar evento ⇒ adicionar linha na §5 com pergunta,
`surface` esperada e critério de "chegou certo" verificável (§7).

---

## 5. Catálogo evento → pergunta

Status: **✅ emitido** · **🔌 órfão** (declarado, 0 call sites) · **🔤 literal** (emitido fora do
catálogo) · **🆕 novo** (proposto aqui, ainda sem declaração no catálogo).

> **Baseline verificado no PostHog — `posthog-cli`/HogQL, 2026-08-09** (janela real de dados:
> **2026-07-24 → 2026-08-09, ~16 dias**; 30 `person_id` distintos; 2824 eventos). "Cabeado no
> código" (✅/🔤) **≠** "observado chegando" — são eixos diferentes:
>
> - **Observados chegando** (com volume): `cold_start`, `dose_logged_bulk`, `dose_logged`, `login`,
>   `consent_health_declined`, `stock_upsell_shown`, `stock_upsell_dismissed` (+ `dev_smoke_event` de teste).
> - **Cabeados mas com ZERO chegada na janela**: `titration_transition_confirmed`/`postponed`,
>   `stock_onboarding_choice`, `stock_opt_in`, `stock_opt_out`, `stock_upsell_conversion`. **Não é
>   prova de emit quebrado** — a janela de 16 dias + baixa frequência (titulação, onboarding de
>   usuário novo raro nesta base madura) explica a ausência. Mas **refuta** o "9 eventos chegam" do
>   handoff: só **7** de produto chegam de fato. Disambiguar quebra vs. no-uso exige janela maior ou
>   gatilho manual (parte da verificação da Fase 1, §7).
> - **PII: LIMPO.** As únicas props customizadas enviadas são `channel`/`update_id`/`runtime_version`/
>   `duration_ms`/`count`/`method`/`medicine_id`(UUID)/`action`/`platform`/`source`. Zero nome, e-mail,
>   valor clínico. `$geoip_*` (cidade/região por IP) vem por default do PostHog, não do app.
> - **`surface` e `treatment_id`: ausentes** em 100% dos eventos — o gap central deste plano é real.

### 5.0 Princípio da espinha: tudo é sobre o tratamento

No fundo, **todo comportamento no Dosiq é sobre um tratamento** — dose, adesão, titulação, consumo
de estoque, encerramento. O tratamento é a **espinha** que costura o stream de eventos; medicamento,
usuário e superfície são contexto ao redor dele. Consequência de instrumentação:

- **Todo evento de comportamento carrega `treatment_id`** (o UUID do protocolo/tratamento), não só
  `medicine_id`. É a chave que permite perguntar "adesão _deste tratamento_", "estoque _deste
  tratamento_", "o usuário que abandonou _qual tratamento_". Sem ela, os eventos ficam soltos e a
  entidade central some da análise.
- **O vínculo vem do fato histórico, nunca de join com a entidade viva (R-299).** O `treatment_id`
  de uma dose sai da `dose_instance` que a originou (via `protocol_id`/`resolveInstanceMedicine`,
  `@dosiq/core`), não do protocolo atual — a entidade evolui e o passado mudaria junto.
- `treatment_id` é UUID opaco: pseudonimizado, sob o consentimento existente, sem conteúdo clínico
  (§6) — mesma classe de `medicine_id`.

Eventos de **uso puro do software** (login, sessão, push, onboarding) não têm tratamento associado
e não carregam `treatment_id` — a espinha vale para o comportamento clínico, não para a telemetria
de plataforma.

### 5.1 Autenticação e sessão

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `login` | ✅ | login efetivo | `method: email\|google`, `surface` | quantas sessões vivas / por método |
| `logout` | 🔌 | logout explícito | `surface` | troca de conta em device compartilhado |
| `sign_up` | 🔌 | cadastro novo | `method`, `surface` | topo do funil de ativação |
| `cold_start` | 🔤 | boot do app | `duration_ms`, bundle tags | perf de inicialização / adoção de frota |

### 5.2 Onboarding (funil de ativação — hoje inexistente)

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `onboarding_start` | 🔌 | início do onboarding | `surface` | time to first value: entrou |
| `onboarding_complete` | 🔌 | conclusão | `surface` | ativação: chegou ao valor |
| `onboarding_skip` | 🔌 | pulou | `surface` | fricção / abandono precoce |

### 5.3 Tratamento (entidade central) e medicamento (setup)

**O tratamento é a entidade central do Dosiq** — define **o quê** (`medicine_id`), **quando**
(frequência/agenda) e **quanto** (dose). O cadastro de medicamento é o **passo de setup anterior**:
a fricção necessária para gerar o "ingrediente" do tratamento, não o valor em si. A instrumentação
segue essa hierarquia — o funil de ativação culmina em `treatment_created`, **não** em
`medicine_added`.

**Ciclo de vida do tratamento (o centro):**

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `treatment_created` | 🆕 | tratamento definido e ativado (`active=true`) | `surface`, `treatment_id`, `medicine_id`, `is_titration`, `treatment_planned_end?` | **ativação real** (time to first value) |
| `treatment_edited` | 🆕 | dose/agenda/frequência/datas alteradas (**não** o toggle de pausa) | `surface`, `treatment_id`, `medicine_id`, `change_kind`, `treatment_planned_end?` (re-emite) | manutenção vs. instabilidade do plano |
| `treatment_paused` | 🆕 | usuário pausa (`active: true→false`) | `surface`, `treatment_id`, `medicine_id` | **pausa reversível ≠ abandono** — desliga notificação/geração de dose, sai da adesão |
| `treatment_resumed` | 🆕 | usuário retoma (`active: false→true`) | `surface`, `treatment_id`, `medicine_id` | recuperação de pausa (pausa→retoma vs. pausa→abandono) |
| `treatment_ended` | 🆕 | encerramento (`deleted` ativo; `prescription_end`/`weaning_complete` derivados — §5.3.1) | `surface`, `treatment_id`, `medicine_id`, `reason` | **churn de alta vs. abandono** |
| `titration_transition_confirmed` | 🔤 | confirma etapa de titulação (evolução do tratamento) | `treatment_id`, `step_id`, `surface`, `outcome` | avanço de titulação |
| `titration_transition_postponed` | 🔤 | adia etapa | `treatment_id`, `step_id`, `surface` | fricção na titulação |

**Setup do medicamento (passo anterior, secundário):**

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `medicine_added` | 🔌 | medicamento cadastrado | `surface`, `medicine_id` (**UUID, nunca nome**) | passou pela fricção de setup? (passo do funil, **não** ativação) |
| `medicine_edited` | 🔌 | medicamento editado | `surface`, `medicine_id` | manutenção do cadastro |
| `medicine_deleted` | 🔌 | medicamento removido | `surface`, `medicine_id` | limpeza de cadastro (≠ fim de tratamento) |

> **Pausa é estado real, não derivado.** `protocols.active` (bool, default `true`) **é** o estado
> de pausa, definido ativamente pelo usuário: `true` = ativo (gera instâncias de dose agendadas,
> habilita notificações, conta na adesão); `false` = **pausado** (para a geração de dose futura,
> desliga notificações, sai do cálculo de adesão). O toggle é ação deliberada com efeito clínico
> real → `treatment_paused`/`treatment_resumed` são eventos de primeira classe, **não**
> `treatment_edited`. (O comentário *"paused acompanha o tratamento (sem estado próprio)"* em
> `ProtocolDetailScreen` é sobre o **badge de UI**, que apenas segue `active` — não sobre o
> tratamento.) O único status **derivado** é "finalizado" (`end_date` vencida) — esse não tem
> evento próprio (§5.3.1). `change_kind` de `treatment_edited` ∈ `dose`·`schedule`·`frequency`·
> `dates`, **sem o valor** da dose (§6).
>
> **`treatment_planned_end`** e **`weaning_terminal_date`** viajam em `treatment_created`/
> `treatment_edited` (re-emitidas na edição) — as propriedades que tornam o encerramento passivo
> derivável sem scan (§5.3.1). São datas de agenda (dado relacionado à saúde sob consentimento
> existente), nunca conteúdo clínico.

#### 5.3.1 `treatment_ended` — o que torna a retenção legível

Sem separar **churn de alta** (o tratamento acabou porque devia acabar) de **churn de abandono**
(a pessoa largou), retenção é ruído. A separação tem **duas naturezas — e só uma precisa de evento
em tempo real:**

| `reason` | Origem | Como entra no analytics | Sinal |
|---|---|---|---|
| `deleted` | usuário deleta tratamento/medicamento em curso | **evento em tempo real** (`surface: mobile`·`web`) | provável abandono |
| `prescription_end` | `end_date` da prescrição atingida | **derivado** (ver abaixo) | alta esperada |
| `weaning_complete` | desmame chega ao passo terminal | **derivado** (ver abaixo) | alta esperada |

> **Pausa não é encerramento.** `active: true→false` é reversível → é `treatment_paused` (§5.3),
> não um `reason` de `treatment_ended`. A distinção pausa/fim/abandono é justamente o que dá
> retenção honesta.

**Encerramento ativo** (`deleted`) é ação do usuário → emite `treatment_ended` na hora, como
qualquer evento de UI. Trivial.

**Encerramento passivo** (`prescription_end`/`weaning_complete`) **não precisa de scan.** O fim é
determinístico e já conhecido no momento da escrita: `end_date` é fixo até o usuário editar
ativamente. Então, em vez de emitir `treatment_ended` (o tratamento ainda não acabou — a data está
no futuro, e ele pode ser editado/deletado antes), o `end_date` planejado — e a
`weaning_terminal_date`, computável das durações das etapas — viaja como **propriedade** nos
eventos de escrita do tratamento, **re-emitida na edição** (o novo valor supersede o anterior).
O coorte "chegou ao fim e o usuário ficou/saiu" vira uma **query analítica** cruzando essa
propriedade com a atividade — sem scan, sem `surface: system`, sem evento fabricado antes da hora.

> **Trade-off explícito (decisão, não default silencioso):** a via analítica dá o coorte de alta
> sem infra nova, mas o PostHog ancora retention/funnel em **eventos**, não em "propriedade-data-
> passou". Se a análise nativa de retenção sobre "tratamento encerrado" for necessária,
> **materializar** um `treatment_ended` a partir da propriedade — feito **dentro do PostHog**
> (cohort/scheduled), não com código de scan nosso. `surface: system` fica reservado para esse
> caminho.

**Ponto de design em aberto (não trava o contrato) — detecção do desmame (`weaning_complete`).**
A direção **não é campo armazenado**: em N2 o tipo é derivado (ADR-080, `titrationSchema.ts`). Um
desmame é inferido da sequência de `titration_steps.dose` ordenada por `position` que **decresce**
rumo à etapa terminal. Dois guardas contra falso positivo, verificados no schema: (a) `dose > 0` é
CHECK → nunca há passo "dose 0"; o desmame termina na última etapa decrescente + cessação; (b)
`duration_days: NULL` = **manutenção contínua sem fim previsto** — escada que termina em manutenção
**não encerra**, e marcar `weaning_complete` ali é bug. A `weaning_terminal_date` só existe quando
esse predicado é verdadeiro.

### 5.4 Doses e adesão (métrica central)

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `dose_logged` | ✅ | dose registrada | **`treatment_id`** (do fato — §5.0), `medicine_id`, `action?`, **`surface` (a adicionar)** | querer a dose + **sucesso silencioso** por `surface`; adesão por tratamento |
| `dose_logged_bulk` | ✅ | registro em lote | `count`, **`treatment_id?`**, **`surface` (a adicionar)** | catch-up de doses atrasadas |
| `dose_skipped` | 🔌 | dose marcada como pulada | **`treatment_id`**, `surface`, `medicine_id?` | aderência honesta (pulo ≠ esquecimento) |
| `adherence_milestone_reached` | 🆕 | cruzamento de **marco/limiar** de adesão (não o score contínuo) | `treatment_id`, `milestone`, `surface` | **gostar** (celebrar progresso). Mede a gamificação hoje **não medida**; no mobile é Fase 1, a UI web (`BadgeDisplay`/`MilestoneCelebration`) é Fase 2 |

> **O score de adesão em si NÃO é evento.** É **derivado** de `dose_logged`/`dose_skipped` (que
> carregam `treatment_id`) — emitir "score mudou" é contínuo, alto-cardinalidade e queima cota.
> Instrumenta-se só o **cruzamento de marco** (esparso, com pergunta declarada). Mesmo pattern do
> encerramento passivo (§5.3.1): estado contínuo deriva-se, transições discretas emitem-se.

### 5.5 Notificações (proxies de gostar vs. querer)

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `notification_permission_granted` | 🔌 | permissão do OS concedida | `surface` | cobertura do canal de cue |
| `notification_permission_denied` | 🔌 | permissão negada | `surface` | usuários sem cue externo |
| `notification_preference_changed` | 🔌 | muda preferência de notificação | `new_preference`, `surface` | **push desligado + uso mantido = gostar alto** (sinal mais forte) |
| `push_notification_tapped` | 🔌 | abriu por push | `kind: dose_reminder\|stock_alert`, `surface: push` | **abertura espontânea ÷ pós-push = razão gostar/querer** |

### 5.6 Estoque (spec 044 — série viva, não mexer nos nomes)

| Evento | Status | Props | Pergunta |
|---|---|---|---|
| `stock_onboarding_choice` | ✅ | `mode: dose_only\|stock` | escolha de modo no onboarding |
| `stock_opt_in` / `stock_opt_out` | ✅ | `source: onboarding\|settings\|upsell` | adoção do controle de estoque |
| `stock_upsell_shown` / `stock_upsell_conversion` / `stock_upsell_dismissed` | ✅ | — | eficácia do upsell (SC-004) |
| `stock_added` | 🔌 | **`treatment_id`**, `medicine_id`, `surface` | reposição de estoque **deste tratamento** (consumo é sobre o tratamento — §5.0) |
| `stock_low_viewed` | 🔌 | **`treatment_id`**, `surface`, `kind` | atenção ao alerta de estoque baixo por tratamento |

> **Escopo da série de estoque:** os 6 eventos de opt-in/upsell da spec 044 (`stock_*` acima) são
> escolhas de **configuração do recurso**, não comportamento clínico — por isso **não** carregam
> `treatment_id`. Já `stock_added`/`stock_low_viewed` são consumo/reposição de um tratamento
> concreto → carregam a espinha (§5.0).

### 5.7 Biomarcadores

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `biomarker_logged` | 🆕 | usuário registra uma medida | `surface`, **`biomarker_type`** | adoção do acompanhamento **por tipo**; correlação com adesão/retenção |

> **`biomarker_type` é necessário para interpretar, não opcional.** Valores verbatim hoje (enum de
> 3 — usar exatos, R-021): `peso` · `glicemia` · `pressao_arterial`. Cada tipo tem cadência natural
> diferente: **`pressao_arterial` pode ter várias medidas/dia** por protocolo, `glicemia` idem em
> diabético, `peso` ~1/dia. Contar `biomarker_logged` bruto como "engajamento" leria um dia normal
> de PA como pico de entusiasmo — ou de erro. Sem o tipo, a métrica é ruído; por isso ele entra.
> Regra de leitura: **normalizar por tipo** (baseline por biomarcador), nunca somar tipos.
>
> 🔴 **NUNCA o valor** (glicemia=180 é a medida clínica bruta — §6). O tipo, colado ao `identify`,
> é **dado sensível de saúde (art. 11)** — não por identificar (o UUID já faz), mas por revelar a
> condição (`glicemia`→diabetes; `pressao_arterial`→hipertensão; `peso` é o mais fraco). Não é
> ilegal: está coberto pelo consentimento existente (biomarcadores, Política §3.2/§4). A questão é
> de **postura**: diferente de `medicine_id` (UUID opaco), o tipo é a **única propriedade do plano
> que expõe categoria clínica legível ao operador** PostHog. **Decisão (PO, 2026-08-08): aceitar o
> valor legível** no evento — 3 buckets grossos, sob consentimento; a alternativa de código opaco
> (`bt_0x`, com tabela do nosso lado) fica registrada caso a postura mude. Biomarcador não é
> escopado a tratamento → **sem `treatment_id`**.

### 5.8 Assistente IA (Groq)

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `ai_assistant_opened` | 🆕 | abre o assistente | `surface` | adoção da feature |
| `ai_assistant_message_sent` | 🆕 | envia uma mensagem | `surface`, `message_index?` | engajamento; correlação com retenção |
| `ai_assistant_error` | 🆕 | falha na resposta | `surface`, `error_kind` | confiabilidade do Groq |

> 🔴 **Só meta-eventos.** O **texto** da pergunta e a **resposta** do Groq **jamais** entram no
> payload (§6) — é a maior fonte de PII do app. Uso de software → **sem `treatment_id`**.

### 5.9 Perfil e configurações

| Evento | Status | Dispara quando | Props | Pergunta |
|---|---|---|---|---|
| `profile_updated` | 🆕 | perfil criado/editado | `surface`, `field?` (enum, **nunca valor**) | investimento/ativação (preencheu perfil?) |
| `mode_changed` | 🆕 | muda `complexity_override` (densidade) | `surface`, `mode: simple\|complex` | troca de persona; **re-registra a super property `mode`** (§3.2) |

> **Nunca** nome/data de nascimento/cidade/telefone (§6) — só que a *ação* ocorreu, no máximo o
> `field` alterado como enum. Settings de notificação já vivem em `notification_preference_changed`
> (§5.5); **evitar** um `settings_changed` genérico — vira balde de ruído e fere a regra-mãe (§4).

### 5.10 Consentimento e dev

| Evento | Status | Props | Pergunta |
|---|---|---|---|
| `consent_health_declined` | 🔤 | `{}` (sem PII, FR-008) | recusa de consentimento de saúde |
| `dev_smoke_event` | 🔤 | `source`, `platform` | **não-produção** (DevHub); excluir de dashboards |

### 5.11 Faseamento e cobertura

**O faseamento é por superfície, não por evento.** Um mesmo evento (ex.: `dose_logged`) é Fase 1 na
superfície **mobile** e Fase 2 na **web** — não são eventos diferentes, é a mesma taxonomia em outra
superfície.

- **Fase 1 — mobile completo.** **Todos** os eventos emitidos no mobile, não só "cabear os órfãos":
  inclui `surface` + `treatment_id` (§5.0) + super property `mode`, a migração dos 5 literais
  (§2.2), o ciclo de vida do tratamento (§5.3), `adherence_milestone_reached`, `biomarker_logged`,
  `ai_assistant_*`, `profile_updated`/`mode_changed`. **Independe** da 059/v0.4 — já coberta pelo
  consentimento vigente (§6.1).
- **Fase 2 — web + bot.** As mesmas famílias de evento nas superfícies web e bot. **Gated** pela
  Política v0.4 (§6.1/§6.2). Inclui a UI de gamificação web (`BadgeDisplay`/`MilestoneCelebration`)
  e os eventos server-side do bot.

| Grupo | Eventos | Fase (mobile) |
|---|---|---|
| Já emitidos | `login`, `dose_logged(_bulk)`, `stock_*` (044), `cold_start`, `consent_health_declined`, `titration_transition_*` | Fase 1 (+ `surface`/`treatment_id` a adicionar) |
| Órfãos a cabear | `logout`, `sign_up`, `onboarding_*`, `medicine_*`, `dose_skipped`, `notification_*`, `push_notification_tapped`, `stock_added`, `stock_low_viewed` | Fase 1 |
| Novos deste plano | `treatment_created`/`edited`/`paused`/`resumed`/`ended`, `adherence_milestone_reached`, `biomarker_logged`, `ai_assistant_*`, `profile_updated`, `mode_changed` | Fase 1 |
| Decisão pendente do DPO | mecanismo do opt-in web — bloqueante vs. aviso (§6.2) | — |

---

## 6. Política de PII (herda R-042 — inegociável)

- `identify` e propriedades **só com UUID opaco interno**. Nunca e-mail, nome, telefone, cidade,
  nome de medicamento, dose legível ou qualquer dado clínico.
- `medicine_id` como **UUID** é aceitável; o **nome** do medicamento não é, em nenhuma propriedade.
- `identify` em **toda sessão viva** (login novo E sessão restaurada), não só no login explícito —
  senão o uso diário fica anônimo e cada device vira uma "pessoa", inflando a contagem.
- `resetUser` no logout, **junto** com `Sentry.setUser(null)`. Ligar um sem o outro mistura dado
  de saúde entre pessoas em device compartilhado.
- **Princípio IX (Transparência Radical com o Paciente)** tem poder de veto e supersede este plano:
  nenhum evento que o usuário ficaria irritado em descobrir. `dosiq.app` afirma que nem a equipe
  acessa o histórico — nenhum evento pode contradizer isso.
- **CON-021:** o wrapper (`logEvent` e qualquer wrapper novo de web/bot) **nunca lança** e é no-op
  sem chave. Analytics jamais quebra o fluxo do usuário.
- **Restrição publicada (Política v0.3 §6):** o evento *"não inclui conteúdo de doses/medicamentos"*.
  Isso é texto legal vigente, não só preferência interna — qualquer propriedade com nome de
  medicamento ou dose legível viola a política publicada, além do R-042.
- **Pseudonimização ≠ anonimização.** Um `medicine_id` UUID ligado à conta é **dado pessoal
  pseudonimizado** — o controlador re-identifica por join (`medicine_id → medicines → nome`); LGPD
  art. 5º III só considera anônimo o irreversível. A salvaguarda dos UUIDs é reduzir a **exposição
  ao operador** (o PostHog nunca lê conteúdo clínico), **não** desclassificar o dado. Consequência
  dura: **nunca** adicionar propriedade que *reconstrua* conteúdo clínico — quantidade de dose,
  frequência legível, classe do fármaco, valor de biomarcador. Relações entre UUIDs, timestamps e
  contagens: ok.
- **Eventos de comportamento de tratamento são dado relacionado à saúde** (art. 11), mesmo sem
  nome: `dose_logged`, `dose_skipped`, `treatment_ended` revelam padrão de adesão → inferência
  sobre saúde. Eventos de **uso puro do software** (`push_notification_tapped`,
  `notification_preference_changed`, onboarding, sessão) são telemetria comum, fora do art. 11. A
  base legal difere entre os dois grupos — ver §6.2.
- 🔴 **Nunca instrumentar conteúdo ou valor de entrada do usuário — a maior superfície de PII do
  app.** Proibido no payload, em qualquer forma (nem hasheado): **texto da conversa** com o
  assistente IA e a resposta do Groq; **valor** de biomarcador (glicemia/peso/pressão); **PII de
  perfil** (nome, data de nascimento, cidade, telefone). Instrumenta-se que a *ação* ocorreu
  (`ai_assistant_message_sent`, `biomarker_logged`, `profile_updated`) e, no máximo, um **tipo/enum**
  — nunca o valor nem o texto livre. O texto do chatbot em particular é a maior fonte de PII de todo
  o app: fica no caminho do Groq (Política §6), fora do analytics.

### 6.1 Cobertura legal por superfície (o gate real da Fase 2)

A captura de analytics **já está no aceite vigente** — a Política v0.3 (§6) nomeia o PostHog como
operador. Mas a redação atual **restringe o escopo a "só no app do celular"** (idem para o Sentry).
O gate da Fase 2 é, portanto, publicar a **Política v0.4** removendo esse escopo — e essa v0.4 é
**entregue como parte da Fase 2 deste projeto**, não da spec 059 (que não toca nem é tocada por
esta instrumentação).

| Superfície | Situação legal | Ação necessária antes de emitir |
|---|---|---|
| **mobile** (Fase 1) | ✅ coberta — Política v0.3 §6 já autoriza PostHog "no app do celular" | nenhuma; pode cabear já |
| **web** (Fase 2) | ⚠️ a política diz "só no app do celular" → ligar PostHog no web **contradiz o texto publicado** | **amendment da política → v0.4** removendo o escopo "só celular" |
| **bot / server-side** (Fase 2) | ⚠️ o inventário §6 não cobre analytics de produto originado no bot | v0.4 adiciona a linha ao inventário de operadores |

**Regra de merge:** nenhum evento de `surface: web` ou `bot` sobe para produção antes de a Política
de Privacidade v0.4 estar publicada removendo a restrição "só no celular". Confirmar com o PO (que
também é o Controlador/DPO — Política §2). Isto **não** bloqueia a Fase 1. **Como** esse aditivo
chega ao usuário é governado pela §6.2 — não é re-consent global.

### 6.2 Consentimento é escopado por superfície (sem re-consent global)

O aditivo v0.4 que habilita analytics de web/bot é **material apenas para quem usa essas
superfícies**. Forçar re-consentimento no usuário **mobile-only** — que já aceitou a v0.3 — é
fricção sem contrapartida e **risco ativo de churn/revogação**: o modal reabre a decisão inteira e
parte dos usuários felizes revoga em vez de ignorar. Num app de saúde onde o consentimento já é
pesado, o risco é assimétrico.

**O escopo por superfície não é mecanismo novo — a infra já existe.** A trilha de consentimento
(Política v0.3 §5) já registra **a superfície** ("se foi pelo computador ou pelo celular") e **a
versão da política** aceita. Usa-se o que já está lá.

Mecânica:

| Coorte | O que muda para ele na v0.4 | Ação |
|---|---|---|
| **mobile-only** (aceitou v0.3) | nada — a v0.3 continua descrevendo fielmente a superfície dele | **notificar** a atualização (transparência, Princípio IX); **nunca bloquear** |
| **usa web** | passa a haver captura na web | **opt-in incremental** no ponto de ativação do analytics web, gravado na trilha com `surface=web` + versão v0.4 |
| **vincula o bot** | captura server-side no bot | consentimento pega carona no **momento de vínculo do Telegram** (já é ação iniciada pelo usuário — Política §4), mesmo princípio de escopo |

**Contrato de implementação (Fase 2):** o wrapper web/bot é **fail-closed** — no-op até o
consentimento **daquela superfície** ser concedido, *além* do no-op sem chave (CON-021). Ausência
de flag de consentimento de superfície ⇒ zero captura, em silêncio, sem quebrar fluxo.

**Base legal (fundamento correto, não reclassificação):** o analytics no **mobile já está coberto**
— não por "não ser dado de saúde", mas porque a Política §5 (consentimento específico de saúde:
*"registrar meu histórico e calcular minha adesão"*) **+** §6 (PostHog nomeado como operador que
recebe *"ações realizadas"*, sem conteúdo clínico) já autorizam esse processamento, com operador e
limite de conteúdo declarados. **Não** existe categoria nova de "consentimento de analytics": os
eventos de dose/tratamento (art. 11) rodam sob o consentimento de saúde existente; os de uso puro,
sob a divulgação de operador. Web/bot herdam a **mesma** base, estendida pela v0.4 (remove "só
celular"), escopada por superfície (§6.2). **Tentar apoiar dose/tratamento em "legítimo interesse
por não ser saúde" é erro** — pseudonimizado ≠ não-saúde (ver §6) — e enfraqueceria a proteção.

**A confirmar com o Controlador/DPO (Política §2):** apenas o **mecanismo** do passo web — opt-in
bloqueante vs. aviso destacado — dado que a base já existe. Recomendação deste plano: **opt-in
explícito e granular na web**, coerente com a Transparência Radical (Princípio IX).

---

## 7. Verificação (o evento não vale sem confirmação)

Instrumentar sem verificar recria exatamente a divergência atual entre catálogo e realidade.
Depois de cabear cada evento, **confirmar com `posthog-cli api`** que ele chega, com as
propriedades certas e **sem PII**:

1. `posthog-cli api --agent-help` (uma vez por sessão) para o guia completo.
2. Consultar os eventos recentes do nome cabeado e inspecionar as propriedades.
3. Checar ausência de PII na amostra (nenhum nome de medicamento, e-mail, etc.).

Um evento novo/alterado só conta como **feito** quando executado e verificado — mesma disciplina do
gate de saída de `select` (R-295), aplicada à telemetria.

---

## 8. Governança de mudança

- **Adicionar evento:** linha na §5 (pergunta + `surface` + props) → entrada em `EVENTS` → cabear →
  verificar (§7). Sem pergunta declarada, não entra (§4).
- **Renomear evento emitido:** proibido (§2.1) — quebra a série. Se inevitável, tratar como evento
  novo e documentar a descontinuidade.
- **Nova superfície** (web, bot): o wrapper espelha o contrato do mobile — mesmo `identify` por
  UUID, mesma falha silenciosa (CON-021), mesma fronteira ADR-090. Considerar extrair o catálogo
  para `packages/core` ou `packages/config` para não viver dentro de `apps/mobile`.
- **Ampliação de coleta (web + bot, Fase 2):** o gate é a publicação da **Política de Privacidade
  v0.4** removendo o escopo "só no app do celular" (§6.1), **entregue dentro da própria Fase 2**
  deste projeto — independente da spec 059. **Confirmar com o PO/DPO antes de mergear a Fase 2.**

---

## Referências

- `apps/mobile/src/platform/analytics/productAnalytics.ts` — wrapper canônico (CON-021, R-042).
- `apps/mobile/src/platform/analytics/analyticsEvents.ts` — catálogo `EVENTS`.
- **ADR-090** — PostHog substitui Firebase Analytics; fronteira de escopo; session replay off.
- **R-042** — identify/propriedades só com UUID, nunca PII.
- **CON-021** — `logEvent` nunca lança.
- **AP-303** — kill switch boot-blocking/fail-open; PostHog fora dele.
- **Spec 044** (SC-004) — série de eventos de estoque.
- **Política de Privacidade v0.3** §6 (`docs/legal/POLITICA_DE_PRIVACIDADE_v0.3.md`) — PostHog como operador, escopo "só no app do celular", cláusula "não inclui conteúdo de doses/medicamentos". A **v0.4** (que remove o escopo "só celular") é entregável da Fase 2 deste projeto.
- **ADR-080** — modelo N2 de titulação (`titrations` + `titration_steps`), base da detecção de desmame.
- **Spec 050** — infra de fila/scan reusável para o `treatment_ended` server-side.
- `dosiq-dopamina.md` — base teórica (querer vs. gostar).
