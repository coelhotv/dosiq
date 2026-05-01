# Notifications Architecture — Vision & Long-Term Roadmap

> **Audiencia**: Time tecnico do Dosiq (atual e futuro). Stakeholders interessados em entender **para onde** vamos com notificacoes.
> **Status**: Documento vivo. Atualizar quando decisoes arquiteturais materializarem ou quando triggers de revisao atingirem.
> **Data**: 2026-04-30
> **Origem**: Discussao de design pos-survey arquitetural durante planejamento da Wave de Consolidacao (ver `notifications_architecture_consolidation_plan.md`).

---

## TL;DR

A arquitetura atual e **3-camadas** (Business → Presentation → Delivery) com modelo **scheduler-pull** (cron dispara) e **dual-string payload** (`body` rich Markdown + `pushBody` plain). Funciona bem para os 2 canais ativos (Telegram + Expo Push) e o leitor passivo (Inbox web/mobile).

**E suficiente para hoje, e fundacao correta para o futuro.** Mas existem 5 evolucoes naturais ja mapeadas, ordenadas por ROI. Nenhuma conflita com a base atual — todas sao aditivas.

---

## Onde Estamos (Estado Pos-Consolidacao)

```
┌──────────────────────────────────────────────────────────────────────┐
│  L1: BUSINESS LOGIC (cron-driven)                                    │
│  • server/bot/tasks.js + api/notify.js                               │
│  • Calcula dados crus de dominio                                     │
│  • Output: { kind, data, context }                                   │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  L2: PRESENTATION                                                    │
│  • server/notifications/payloads/buildNotificationPayload.js         │
│  • Switch por kind, owna formatacao + actions[]                      │
│  • Output: { title, body, pushBody, deeplink, actions, metadata }    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  L3: DELIVERY                                                        │
│  • server/notifications/channels/{telegram,expoPush}Channel.js       │
│  • dispatcher resolve canais, aplica suppression, loga inbox         │
│  • Mapeia actions[] → affordance nativa por canal                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Fortalezas atuais**:
- Separacao limpa de responsabilidades (apos consolidacao).
- Schemas Zod por kind validam contratos L1→L2.
- Suppression centralizada (Quiet Hours, Mode R-200).
- DLQ com retry e auditavel.
- `actions[]` semanticas desacoplam intencao de affordance nativa.

**Limitacoes conscientes** (decisoes registradas em ADRs):
- Modelo dual-string nao escala para 4+ canais com formatos divergentes — ver ADR-037.
- Cron-driven; sem bus de eventos de dominio — ver ADR-038.
- Switch unico em L2 acomoda ate ~15 kinds — ver ADR-039.

---

## Para Onde Vamos (Roadmap Estrategico)

Ordem por **ROI esperado** + **trigger de execucao**. Nenhuma das 5 evolucoes e prematura — todas tem trigger objetivo.

### 1. Inbox Markdown Renderer (proximo — incluido na wave atual)
**Trigger**: Imediato (ja no plano, GATE 5.5).
**O que**: Web e mobile inbox parseiam MarkdownV2 do `body` para HTML/React. Hoje exibem texto literal com escapes (`*bold*`, `\\!`).
**ROI**: Alto e visivel — bug visual eliminado; paridade com Telegram.
**Custo**: ~1 dia.

### 2. Per-kind Builder Modules (refactor cosmetico futuro)
**Trigger**: `kindSchema.options.length` >= 15 (hoje: 10).
**O que**: Split do switch em `payloads/builders/<kind>Builder.js` + registry.
**ROI**: Medio — facilita manutencao e onboarding de devs.
**Custo**: ~1h via agente quando trigger atingir.
**Referencia**: ADR-039.

### 3. Per-kind Channel Preferences (feature de produto)
**Trigger**: Demanda de produto ("quero dose reminders so por Push, nao Telegram").
**O que**: Tabela `user_kind_channel_preferences` + UI em settings + `resolveChannelsForUser` usa preferencia por kind.
**ROI**: Alto para usuarios que ja sentiram fadiga de notificacao; medio em geral.
**Custo**: ~3-5 dias (DB + L3 dispatcher + UI).
**Pre-requisito**: Nenhum — arquitetura atual ja suporta drop-in.

### 4. Content Tree + Format Adapters (refactor estrutural futuro)
**Trigger**: 4o canal real materializar (Email, SMS, WhatsApp).
**O que**: L2 emite `content: [{ type: 'heading' }, { type: 'list' }, ...]`. Adapters em `payloads/renderers/` (`toMarkdownV2`, `toPlainText`, `toHTML`, `toSMS`). Canais escolhem adapter.
**ROI**: Alto quando 4o canal entra — sem isso, 4o canal forca duplicacao de formatacao.
**Custo**: ~5-7 dias (re-render de todos os builders + adapters + testes).
**Precedentes**: Slack Block Kit, MS Teams Adaptive Cards, MJML.
**Referencia**: ADR-037.

### 5. Domain Event Bus (evolucao para event-driven hibrido)
**Trigger**: Primeiro caso real-time (nao-cron) entrar no roadmap. Candidatos plausiveis: feature de cuidador, integracao com wearable, registro reativo de dose.
**O que**: Adicionar bus acima de L1. Producers: cron (existente) + handlers de eventos (novo). Mesma pipeline L2/L3.
**ROI**: Alto quando habilita feature real-time; zero antes disso.
**Custo**: ~7-10 dias (escolha de bus + handlers + replay/ordering + testes).
**Candidatos de implementacao**: in-process EventEmitter, Supabase Realtime, Vercel Queues, Inngest.
**Referencia**: ADR-038.

### 6. Templating Engine + i18n (longe — so com white-label/multilingua)
**Trigger**: Roadmap de white-label ou expansao para mercado nao-pt-BR.
**O que**: Templates Mustache/Handlebars por kind + locale. L2 vira renderizador de template em vez de switch.
**ROI**: Critico para multi-tenant; zero antes.
**Custo**: Significativo (refactor + traducao + tooling).

---

## Discussao Arquitetural — Perguntas Provocativas

Esta secao captura a conversa que originou os ADRs. Util para:
- Onboarding de novos devs ("por que nao fizemos X?")
- Reabrir decisao quando contexto mudar
- Compartilhar com stakeholders nao-tecnicos

### Pergunta 1: Modelo dual-string (`body` rich + `pushBody` plain) e o melhor para multiplos canais?

**Diagnostico do problema atual**:
- `body` (MarkdownV2) e gravado no Inbox mas o renderer Inbox **nao parseia Markdown** — usuario ve texto literal com escapes.
- Telegram e Inbox compartilham `body` por coincidencia ("ambos suportam strings longas"), nao por design.
- Adicionar 4o canal com formato diferente (Email HTML, SMS plano) explode o schema (`htmlBody`, `smsBody`) ou suja L3 com string-stripping.
- `pushBody` e construido a mao pela L2; facil divergir do `body`.

**Tres caminhos avaliados**:

| Caminho | Custo | Cobertura | Quando faz sentido |
|---|---|---|---|
| **1. Inbox aprende Markdown** | ~1 dia | 2 canais + Inbox passivo | **Hoje** (resolve bug visual sem refactor) |
| **2. Triplo campo (`body`, `pushBody`, `inboxBody`)** | ~1-2 dias | 3-4 canais | Tatica intermediaria; nao recomendada |
| **3. Content tree + adapters** | ~5-7 dias | N canais | Quando 4o canal real materializar |

**Decisao**: Caminho 1 agora (GATE 5.5), Caminho 3 quando trigger atingir (ADR-037).

**Por que nao Caminho 3 agora**: YAGNI. 2 canais ativos + Inbox como leitor passivo nao justificam abstracao. ROI negativo no curto prazo.

**Precedentes da industria** (Caminho 3):
- **Slack Block Kit**: blocos JSON declarativos; clientes renderizam.
- **MS Teams Adaptive Cards**: AST de UI cross-platform.
- **MJML**: tags semanticas → HTML responsivo de email.
- **Knock**: notification templates com payload neutro + channel-specific renderers.

### Pergunta 2: Essa arquitetura 3-camadas e a melhor para notificacoes **event-based**?

**Resposta curta**: Sim como fundacao, nao como destino final. O gap esta em L1, nao em L2/L3.

**O que falta para ser genuinamente event-based**:

1. **L1 e scheduler-pull disfarcado**. Cron dispara, calcula, envia. "Evento" e implicito.
2. **Sem fan-out**. 1 trigger → 1 notificacao. Adicionar "alerta para cuidador" requer logica nova.
3. **Sem preferencia de canal por kind por usuario**. `resolveChannelsForUser` e global.
4. **Switch gigante em L2**. Para 10 kinds tudo bem; para 30+ vira inferno.
5. **Sem templating + i18n**. Strings hardcoded em pt-BR.

**Pergunta-chave**: Esses gaps sao **defeitos arquiteturais** ou **evolucoes naturais**?

**Resposta**: Evolucoes naturais. A 3-camadas atual nao **impede** nada disso — ela **habilita**. Quando primeiro caso real-time emergir:

```
Domain Event (NEW) → Subscriber (NEW) → produces { kind, data } → L2 (existente) → L3 (existente)
                          │
                  Cron continua coexistindo
```

E o padrao **hibrido scheduler-pull + event-driven** que sistemas em producao usam (Knock, Courier, SendGrid Notify, Inngest patterns):
- Scheduler-pull para recorrencias (digests, reports, lembretes agendados).
- Event-driven para reacoes (welcome, achievement, alertas criticos disparados por acao).

**Mesma pipeline L2/L3**.

**Decisao**: Mantemos scheduler-pull. Bus entra com primeiro use case real (ADR-038).

---

## Mapa de Decisoes (ADRs)

| ADR | Decisao | Trigger de revisao |
|---|---|---|
| **ADR-037** | Adiar content-tree + adapters ate 4o canal | 4o canal real entra no roadmap |
| **ADR-038** | Manter scheduler-pull; bus quando emergir caso real-time | 1a PRD de feature real-time |
| **ADR-039** | Switch unico em L2 ate 15 kinds | `kindSchema.options.length` >= 15 |

---

## Como Adicionar Coisas (guia rapido)

### Adicionar novo kind (caso comum)
1. Adicionar string ao `kindSchema` em `buildNotificationPayload.js`.
2. Definir `<kind>DataSchema` Zod.
3. Adicionar `case` no switch com formatacao + `actions[]`.
4. Adicionar caller em `tasks.js` ou outro produtor L1.
5. Adicionar label em `apps/web/src/services/api/dlqService.js` (frontend mirror).
6. Test: smoke local + assertion na suite.

### Adicionar novo canal (drop-in apos consolidacao)
1. Criar `server/notifications/channels/<canal>Channel.js`.
2. Implementar `send<Canal>Notification({ userId, payload, context, ... })` retornando shape canonico.
3. Mapear `payload.actions[]` para affordance nativa.
4. Registrar canal em `dispatcher/dispatchNotification.js` + `policies/resolveChannelsForUser.js`.
5. Se canal exige formato divergente de Markdown/plain → **gatilho de ADR-037**: avaliar mover para content-tree.

### Adicionar trigger real-time (novo caso de uso)
1. Avaliar se cron resolve. Se sim: adicionar runner em `tasks.js`. Acabou.
2. Se nao (precisa reagir a acao): **gatilho de ADR-038**. Abrir RFC para introducao de event bus.

---

## Referencias Externas

- **Knock** (notification infrastructure): https://knock.app/docs
- **Courier** (multichannel notifications): https://www.courier.com/docs
- **Slack Block Kit**: https://api.slack.com/block-kit
- **MS Teams Adaptive Cards**: https://adaptivecards.io
- **MJML** (email AST): https://mjml.io
- **Inngest** (event-driven patterns): https://www.inngest.com/blog/event-driven-architecture
- **SendGrid Notify**: https://docs.sendgrid.com/api-reference/transactional-notifications

---

## Historico de Atualizacoes

| Data | Autor | Mudanca |
|---|---|---|
| 2026-04-30 | Discussao tecnica (coelhotv + Claude Opus 4.7) | Documento inicial. Captura de discussao arquitetural durante planejamento da Wave de Consolidacao. ADRs 037, 038, 039 registrados. |
