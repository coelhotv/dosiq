# Spec (draft) — Analytics Instrumentation · Fase 1 (mobile completo)

Feature Directory: `.agent/drafts/` (draft — **fora** de `plans/specs/NNN`; ver §Promoção)
Created: 2026-08-08 · Status: **draft** · **Tier**: 2 · Input: `docs/standards/TRACKING_PLAN.md` + [[CON-034]] + handoff de produto (Claude.ai, 2026-08-08)

> **Relação com o TRACKING_PLAN.** Este spec documenta **o que é o projeto** — problema, escopo,
> user stories, requisitos e critérios de sucesso. Ele **não** re-lista eventos: a taxonomia
> (catálogo evento→pergunta, propriedades, PII) é a fonte canônica em `docs/standards/TRACKING_PLAN.md`
> (contrato [[CON-034]]). Onde este spec disser "os eventos", leia-se "o catálogo de lá".

---

## Context

O Dosiq tem uma camada de analytics (PostHog via `productAnalytics.ts`, ADR-090) **bem construída e
subutilizada**. Não é dívida de arquitetura — é dívida de **cobertura**: 15 de 24 eventos declarados
nunca disparam, `dose_logged` não carrega a superfície de origem, e três famílias novas
(tratamento, biomarcador, IA/perfil) não existem no código.

**Por que importa (o driver de produto).** A base é a distinção de Berridge entre **querer** e
**gostar** (`dosiq-dopamina.md`). Três variáveis independentes, com direções ótimas diferentes:
querer a dose (alta), querer o app (decrescente), gostar do app (alta e estável). A consequência que
governa tudo: **um usuário que registra a dose pela notificação e nunca abre o app está no estado
ideal, não em churn.** Sem `surface` e sem os eventos de notificação, o PostHog leria esse "sucesso
silencioso" como usuário morrendo. Hoje essa distinção é **impossível de medir**.

**Fase 1 = fechar o mobile por completo.** Toda a instrumentação da superfície mobile: cabear os 15
órfãos, adicionar `surface` + `treatment_id` aos eventos existentes, migrar os 5 literais para o
catálogo, registrar a super property `mode`, e criar as famílias novas (ciclo de vida do tratamento,
biomarcador, assistente IA, perfil). **Independe** da 059/Política v0.4 — já coberta pelo
consentimento vigente (TRACKING_PLAN §6.1). Não toca UI, não muda schema de banco.

**Escopo — o que Fase 1 entrega e o que não.**

| Dentro (Fase 1) | Fora |
|---|---|
| Todos os eventos na superfície **mobile** | Web + bot (Fase 2 — gated pela Política v0.4) |
| `surface`, `treatment_id`, super property `mode` | Qualquer mecânica de recompensa nova |
| 15 órfãos cabeados + 5 literais migrados | `adherence_milestone_reached` (Fase 2 — sem gatilho no mobile, Decisão 2) |
| Ciclo de vida do tratamento, biomarcador, IA, perfil | Desmame / `weaning_terminal_date` (fase futura — Decisão 1) |
| `treatment_planned_end` (encerramento passivo `prescription_end`) | Religar session replay · feature flags · extração p/ `packages/core` (Decisão 3) |
| Verificação de cada evento via query direta PostHog | |

---

## US1 — Sucesso silencioso mensurável (P1)

Given uma dose registrada pelo botão de uma notificação **no celular**, When o evento `dose_logged`
é emitido, Then ele carrega `surface: push` (não `mobile`), permitindo separar registro por
app-aberto de registro por notificação/alarme.

```po PO-1
ac:     todo evento de dose (`dose_logged`/`dose_logged_bulk`) carrega `surface` com a origem correta da ação
proof:  posthog-cli api — consultar os últimos `dose_logged` e inspecionar a distribuição de `surface`
expect: `surface` presente em 100% da amostra; valores ∈ {mobile,push,alarm}; registro por push aparece como `push`
guard:  suíte `doseService.test` verde; nenhum call-site de dose emite sem `surface`
audit:  emissão de dose_logged → actor=paciente / evento clínico / no momento do registro / motivo=medir sucesso silencioso / evidência=amostra posthog-cli
evidence: linha de `surface` na saída do posthog-cli, sem PII
status: [ ] open
```

## US2 — Comportamento por tratamento, sem reescrever o passado (P1)

Given a espinha "tudo é sobre o tratamento" (TRACKING_PLAN §5.0), When qualquer evento de
comportamento clínico é emitido, Then ele carrega `treatment_id` obtido do **fato histórico**
(`dose_instance.protocol_id` / `resolveInstanceMedicine`), **nunca** de join com a entidade viva —
para que a evolução do protocolo (medicine_switch, edição) não reescreva o passado (R-299).

```po PO-2
ac:     `dose_logged`/`dose_skipped`/`stock_*`/`titration_*` carregam `treatment_id` derivado do fato, não do protocolo vigente
proof:  MANUAL — inspecionar o call-site: `treatment_id` sai da instância/fato; um teste com protocolo evoluído após a dose mantém o `treatment_id` original
expect: o `treatment_id` do evento histórico não muda quando o protocolo é editado depois
guard:  teste de regressão R-299 (identidade congelada) verde; nenhum call-site deriva `treatment_id` de `protocol.id` vivo
audit:  emissão com treatment_id → actor=sistema/paciente / vínculo clínico / no registro / motivo=segmentar por tratamento / evidência=teste de congelamento
evidence: assert do teste mostrando treatment_id estável
status: [ ] open
```

## US3 — Ciclo de vida do tratamento visível → retenção honesta (P1)

Given que tratamento é a entidade central, When o usuário cria/edita/pausa/retoma/encerra um
tratamento, Then cada transição emite seu evento próprio (`treatment_created`/`edited`/`paused`/
`resumed`/`ended`), permitindo separar **churn de alta** (fim de prescrição, desmame) de **churn de
abandono** (delete) e de **pausa reversível** (`active: true→false`).

```po PO-3
ac:     as 5 transições de tratamento emitem o evento correto; pausa (`active=false`) é `treatment_paused`, não `treatment_ended`
proof:  posthog-cli api — exercitar criar/pausar/retomar/encerrar e conferir os eventos + `reason`/`active`
expect: pausa → `treatment_paused`; delete → `treatment_ended{reason:deleted}`; nenhum `manual_stop` fabricado
guard:  teste dos handlers de tratamento verde; `treatment_edited` NÃO dispara no toggle de pausa
audit:  transição de tratamento → actor=paciente / mudança de plano / no momento / motivo=retenção honesta / evidência=amostra posthog-cli
evidence: sequência de eventos na saída do posthog-cli
status: [ ] open
```

## US4 — Segmentação por persona sem misturar as duas (P1)

Given que Carlos (complex) e Dona Maria (simple) têm funções de utilidade opostas, When a sessão
identifica o perfil, Then `mode` é registrado como **super property** (via `register`) e acompanha
todos os eventos seguintes — resolvendo o valor efetivo quando `complexity_override` é `null`.

```po PO-4
ac:     `mode` (simple|complex) acompanha os eventos como super property; `null` é resolvido ao valor efetivo, nunca registrado como null
proof:  posthog-cli api — amostrar eventos pós-login e conferir `mode` presente e ∈ {simple,complex}
expect: `mode` presente nos eventos após o profile carregar; sem valor `null`
guard:  teste do registro de super property verde; eventos pré-profile (login/cold_start) não quebram por ausência de mode
status: [ ] open
```

## US5 — Cobertura completa: órfãos cabeados + literais no catálogo (P2)

Given 15 eventos declarados sem call-site e 5 literais fora do catálogo, When Fase 1 conclui, Then
todos estão emitindo do lugar certo, com o nome vindo de `EVENTS`, e cada um verificado chegando ao
PostHog.

```po PO-5
ac:     os 15 órfãos emitem do call-site correto e os 5 literais usam `EVENTS.*` (zero string literal fora do catálogo)
proof:  rtk grep — nenhum literal de evento fora de `analyticsEvents.ts`; posthog-cli confirma chegada de cada nome
expect: grep sem literais órfãos; cada evento aparece na amostra do posthog-cli
guard:  regra do topo de `analyticsEvents.ts` respeitada; lint verde
status: [ ] open
```

## US6 — Famílias novas sem vazar PII (P1)

Given biomarcador, assistente IA e perfil, When esses eventos são emitidos, Then só a **ação** e no
máximo um **tipo/enum** entram no payload — **nunca** valor de biomarcador, texto/resposta do chatbot
ou PII de perfil (a maior superfície de PII do app).

```po PO-6
ac:     `biomarker_logged` carrega só `biomarker_type` (peso|glicemia|pressao_arterial), nunca o valor; `ai_assistant_*` sem texto; `profile_updated` sem PII
proof:  posthog-cli api — amostrar os três e varrer o payload por valores/texto/PII
expect: zero valor de biomarcador, zero texto de chatbot, zero nome/nascimento/cidade/telefone na amostra
guard:  teste que falha se o payload contém chave de valor/texto proibida
audit:  emissão de família nova → actor=paciente / dado de saúde ou PII / no registro / motivo=adoção da feature / evidência=varredura de payload sem PII
evidence: saída do posthog-cli mostrando só tipo/enum
status: [ ] open
```

## US7 — Garantias preservadas: fail-silent, sem rede em teste, Sentry desacoplado (P1)

Given que `logEvent` nunca pode quebrar o fluxo (CON-021) e nenhum teste pode depender de rede,
When a chave do PostHog está ausente (ex.: ambiente de teste), Then analytics é no-op silencioso e o
`Sentry.setUser` continua independente do client PostHog (RC6 PR #773).

```po PO-7
ac:     sem `POSTHOG_API_KEY`, todo o pipeline é no-op e nenhum teste toca a rede; `setUserId` seta o Sentry mesmo sem client PostHog
proof:  rtk npm run validate:agent — suíte roda sem rede; teste específico de no-op + de desacoplamento Sentry
expect: suíte verde offline; `Sentry.setUser` chamado com client PostHog ausente
guard:  `afterEach` limpa mocks/timers (AP-270); nenhum novo teste depende de rede
status: [ ] open
```

---

## Functional Requirements

- **FR-1** — Adicionar `surface` (origem da ação, não plataforma) a `dose_logged`/`dose_logged_bulk`
  e a todos os eventos novos/órfãos, conforme o catálogo (TRACKING_PLAN §3.1).
- **FR-2** — Adicionar `treatment_id` a todo evento de comportamento clínico, derivado do **fato
  histórico** (R-299), nunca da entidade viva (§5.0).
- **FR-3** — Registrar `mode` como super property via `register`, resolvendo `complexity_override`
  `null` ao valor efetivo (§3.2).
- **FR-4** — Cabear os 15 eventos órfãos nos call-sites corretos (§5).
- **FR-5** — Migrar os 5 literais (`titration_transition_*`, `cold_start`, `consent_health_declined`,
  `dev_smoke_event`) para `EVENTS` (`dev_smoke_event` pode ficar literal se marcado não-produção).
- **FR-6** — Emitir o ciclo de vida do tratamento: `treatment_created`/`edited`/`paused`/`resumed`/
  `ended` (com `reason`), respeitando pausa≠encerramento. Encerramento passivo cobre **só**
  `prescription_end` via `treatment_planned_end` (Decisão 1); `weaning_*` fica diferido.
- **FR-7** — Emitir as famílias novas mobile: `biomarker_logged` (com `biomarker_type` legível —
  decisão PO 2026-08-08), `ai_assistant_*` (só meta), `profile_updated`/`mode_changed`.
  (`adherence_milestone_reached` **não** entra — Decisão 2, sem gatilho no mobile.)
- **FR-8** — Garantir a política de PII (R-042 + Política §6): nenhum evento carrega nome de
  medicamento, valor de biomarcador, texto de chatbot ou PII de perfil.
- **FR-9** — Preservar as garantias do wrapper: `logEvent` nunca lança, no-op sem chave, Sentry ⊥
  PostHog (CON-021, RC6 #773).
- **FR-10** — Verificar **cada** evento cabeado/alterado via `posthog-cli api` (chega, props certas,
  sem PII) — um evento só conta como feito quando executado e verificado (TRACKING_PLAN §7).

## Success Criteria

- **SC-1** — 100% dos ACs têm PO fechado (status `[x]`) ao fim do C-mode.
- **SC-2** — 100% dos eventos mobile do catálogo (existentes + órfãos + novos) verificados chegando
  ao PostHog com `surface` correto, `treatment_id` onde aplicável, e **zero PII** na amostra.
- **SC-3** — Zero string literal de evento fora de `analyticsEvents.ts` (grep limpo).
- **SC-4** — Zero dívida nova de lint / strict-island (`./scripts/strict-island.sh` — nível A limpo,
  catraca não sobe); `tsc` do web permanece ZERO erros.
- **SC-5** — `rtk npm run validate:agent` verde **offline** (nenhum teste depende de rede).
- **SC-6** — Nenhuma mudança de UI e nenhuma alteração de schema de banco.

## Edge Cases (Tier 2)

- **`treatment_id` ausente no fato** (dose_instance sem `protocol_id`): **omitir** o campo, nunca
  fabricar por join com o protocolo vivo (R-299). Instância órfã ⇒ evento sem `treatment_id`, de
  propósito.
- **`mode` antes do profile carregar** (`login`, `cold_start`): eventos saem sem `mode`; aceitável
  (super property só existe após o `register`; §3).
- **Offline / sem chave**: pipeline inteiro é no-op; nenhum evento, nenhuma exceção, nenhum teste de
  rede (CON-021).
- **Bulk dose** (`LogForm` retorna array vs objeto): checar `Array.isArray()` antes de emitir
  `dose_logged` vs `dose_logged_bulk` (convenção do CLAUDE.md).
- **Ações de dose não-registro** (`undo`/`update_orphan`/`delete_orphan`): já emitem `dose_logged`
  com `action`; adicionar `surface`/`treatment_id` sem quebrar o shape existente.
- **Encerramento passivo só por `prescription_end`**: `treatment_planned_end` é emitido; o desmame
  (`weaning_*`) está **diferido** (Decisão 1) — nenhum código de Fase 1 tenta derivá-lo.
- **Device compartilhado**: `resetUser` no logout deve limpar PostHog **e** Sentry juntos (§6).

## Key Entities

- **Eventos** — catálogo canônico em `analyticsEvents.ts` / TRACKING_PLAN (não reduplicar).
- **`dose_instances`** — fonte do `treatment_id` histórico (via `protocol_id` /
  `resolveInstanceMedicine`, `@dosiq/core`); a instância congela a identidade (R-299).
- **`protocols`** — o tratamento; `active` (bool) = estado de pausa; `start/end_date` = período.
- **`profiles.complexity_override`** — origem do `mode` (`simple|complex|null`).
- **`biomarkers_log`** — `type` ∈ {peso, glicemia, pressao_arterial} (CON-025); só o tipo entra no
  evento, nunca `value`/`value_secondary`.

## Assumptions / Open Questions

- **Baseline verificado no PostHog (posthog-cli/HogQL, 2026-08-09)** — janela real de dados
  **~16 dias** (2026-07-24→08-09), **30** `person_id` distintos (não 42 — ajustar denominador),
  2824 eventos. **PII limpo** hoje (só UUIDs/enums/contagens; `medicine_id` é UUID) → Fase 1 é
  **aditiva**, sem vazamento pré-existente a remediar. `surface`/`treatment_id` **ausentes** em 100%
  (gap confirmado). O "9 eventos chegam" do handoff é **falso**: só **7** de produto chegam;
  `titration_transition_*` e 4 eventos de estoque estão cabeados mas com **zero** chegada na janela
  (provável baixa-frequência/no-uso, não quebra — disambiguar é tarefa de verificação, ver PO-5/§7).
- **Assumption** — Fase 1 roda sob o consentimento vigente (Política v0.3 §5/§6); nenhum gate
  jurídico bloqueia o mobile (TRACKING_PLAN §6.1).
- **Assumption** — a verificação usa `posthog-cli api` num ambiente **não-produção** (Princípio I —
  proibido mutar dado de usuário real em teste); eventos de smoke ficam fora de dashboards.
- **Decisão 1 (era NC-1) — desmame diferido.** Fase 1 emite **apenas** `treatment_planned_end` na
  escrita do tratamento. A detecção de desmame (`weaning_complete` / `weaning_terminal_date`) fica
  **diferida para fase futura**: pode exigir alterar o engine de titulação para representar **dose 0
  na etapa terminal** (hoje `dose > 0` é CHECK; §5.3.1 do TRACKING_PLAN). Enquanto isso, o
  encerramento passivo por `prescription_end` (via `treatment_planned_end`) cobre a alta esperada.
- **Decisão 2 (era NC-2) — `adherence_milestone_reached` sai da Fase 1.** Verificado no código
  (2026-08-09): **não há gatilho de marco/celebração no mobile** — só KPIs passivos de display
  (`adherence30d`/`streak` em `useHistoryData`/`DoseHistoryKpis`, sem cruzamento de limiar). A
  celebração é **web-only** (`MilestoneCelebration`/`BadgeDisplay`). Logo o evento é **Fase 2 (web)**;
  criar um gatilho no mobile seria **mecânica de recompensa nova → fora de escopo** (regra do handoff).
- **Decisão 3 (era NC-3) — catálogo permanece em `apps/mobile`.** `EVENTS` fica em
  `apps/mobile/src/platform/analytics/analyticsEvents.ts` enquanto só o mobile é servido. A
  **primeira fase que expandir** para outra superfície (Fase 2, web/bot) porta o catálogo para
  `packages/core`.

---

## ✅ PROMOVIDO (2026-08-12) — este draft está SUPERSEDED

Fonte de verdade agora: **`plans/specs/065-analytics-instrumentation-mobile/spec.md`**
(Tier 2, status `specified`). S0/S2/S5/S6 executados; linha registrada em `plans/specs/README.md`.

Não editar este arquivo — qualquer mudança vai na spec 065.
