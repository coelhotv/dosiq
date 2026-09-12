---
title: "Entrega de notificação — desfechos e gate por evidência"
description: "O que cada status de notification_log significa, como a supressão do push crítico é decidida, e como ler a série antes e depois do corte de 2026-09-10."
version: "1.0.0"
status: active
category: architecture
audience:
  - dev
  - agent
tags:
  - notifications
  - dose-critica
  - observabilidade
  - notification-log
created_at: "2026-09-11"
updated_at: "2026-09-11"
---

# 📬 Entrega de notificação — desfechos, gate por evidência e a série

> Documento de fecho da spec 082 (FR-019). Responde a três perguntas que antes só o código
> respondia: **o que cada status significa**, **quando o push de dose crítica deixa de ser enviado**
> e **por que a série tem um antes e um depois**.

---

## 1. O defeito que originou tudo

Durante um mês, doses críticas deixaram de ser notificadas e **o painel dizia que estava tudo bem**.
Dois erros independentes se somavam:

1. **O registro mentia.** `notification_log.status` só tinha dois desfechos úteis — `enviada` e
   `falhou` — e os dois estavam errados em direções opostas. Push omitido de propósito (o alarme do
   celular cobria a dose) era gravado como **falha**: 145 registros em 30 dias. Pior: paciente
   **sem nenhum canal ativo** era gravado como **`enviada`** — 930 linhas, 27 pessoas, nada
   entregue a lugar nenhum.
2. **A supressão olhava o sinal errado.** O push crítico era omitido para todo aparelho com
   `native_alarm_enabled = true`. Essa flag nasce `true` no registro do device e estava `true` em
   **9 de 9** aparelhos ativos: ela significa "o app abriu uma vez", não "o alarme desta dose está
   armado". Quem ficava dias sem abrir o app não tinha alarme agendado — e mesmo assim o push era
   suprimido. Ninguém avisava.

O primeiro erro **escondia** o segundo: a falha de entrega não tinha como aparecer num número.

---

## 2. O status descreve a ENTREGA FÍSICA (ADR-100)

`notification_log.status` **não** descreve a notificação — a notificação é a linha na inbox
(ADR-047) e continua visível com qualquer valor daqui. O status descreve **o que aconteceu com a
entrega**.

| status | significado | é falha? |
|---|---|---|
| `enviada` | ao menos um canal aceitou a mensagem | não |
| `falhou` | ao menos um canal tentou e errou (`mensagem_erro` preenchida) | **sim** |
| `sem_canal` | o paciente não tem nenhum canal físico ativo — **nada foi entregue** | **sim** |
| `suprimida_alarme` | push omitido de propósito: **há prova** de que o alarme local cobre a dose | não — dose **coberta** |
| `suprimida_sem_prova` | push omitido **sem** prova de alarme, porque o usuário não é capaz de produzi-la | **sim** — ninguém avisou |
| `silenciada` | suprimida por política (quiet hours / consentimento revogado) | não |

**As duas supressões são desfechos opostos em risco e por isso têm nomes diferentes.** Com prova, a
paciente *vai* ser avisada pelo alarme do aparelho. Sem prova e sem capacidade de produzi-la,
ninguém a avisou — é o silêncio residual que o SC-002a mede. Colapsar as duas faria a dose não
avisada sair do relatório diário carimbada como cobertura: a mesma família do defeito do §1.

Duas regras que o ADR-100 fixa e que valem para qualquer canal novo:

- **O canal informa o motivo, o dispatcher decide o status** (R-200). O canal devolve um `reason`
  (`native_alarm` · `no_alarm_evidence` · `no_devices` · `no_chat` · `not_configured`); quem
  converte motivo em status é `determineOverallStatus`.
- **Resultado sem tentativa não é sucesso.** `attempted: 0` deixou de ser descartado antes de
  compor o status — era exatamente ali que as 930 linhas nasciam.

⚠️ `ChannelResult.success` **não** mudou de semântica (continua "o canal não lançou exceção"). Fazer
`attempted:0 ⇒ success:false` pareceria mais honesto e quebraria a deduplicação do alerta de
receita, que grava sua âncora sob `if (result?.success)` — o alerta passaria a repetir todo dia
justamente para o paciente sem canal. A verdade nova viaja no `reason`. Ver AP-351.

---

## 3. Gate por evidência: quando o push crítico não sai

A supressão exige **prova daquela ocorrência** — um evento `alarm_scheduled` em
`dose_critical_events` para aquele `dose_instance_id`.

```
reminder (tem o instanceId de cada dose)
  ├─ lê evidência EM LOTE para as doses críticas do ciclo
  ├─ lê capacidade do USUÁRIO (emitiu alarm_scheduled nos últimos 7 dias)
  ▼
decide POR BLOCO:
   todas as doses com prova          → suprime  → status suprimida_alarme   (dose COBERTA)
   alguma sem prova + usuário capaz  → ENVIA
   alguma sem prova + não capaz      → suprime  → status suprimida_sem_prova (silêncio residual)
  ▼
dispatcher → metadata.suppress_push_reason → o canal obedece, não decide
```

**Três eixos que não coincidem** — tratá-los como um só foi a ambiguidade que a spec teve de
desfazer:

| eixo | granularidade | onde vive |
|---|---|---|
| evidência | por **OCORRÊNCIA** | `dose_critical_events.dose_instance_id` |
| capacidade | por **USUÁRIO** | emitiu `alarm_scheduled` na janela de 7 dias |
| envio | por **APARELHO** | `notification_devices` |

Não é hipotético: um paciente é capaz e tem **zero** aparelho (só Telegram); o maior consumidor
crítico tem **6** aparelhos.

### Regras que não são negociáveis

- **Bloco (R-191):** sai **um** push por bloco de N doses, mas a evidência é por dose. Suprime só se
  **todas** as doses do bloco têm prova; qualquer uma sem ⇒ envia. O lado conservador é enviar.
- **Suprimir é não entregar, nunca deixar de registrar (FR-013a).** Toda supressão passa pelo
  dispatcher e grava linha. Supressão que não registra é silêncio disfarçado — e a dose cairia no
  relatório diário como não-entrega.
- **Fail-open (FR-013).** Qualquer erro de leitura devolve o resultado que **envia** o push.
  Indisponibilidade do Postgres não pode virar dose não avisada.
- **Dose adiada não é dose coberta (AP-353).** O app **não** re-emite `alarm_scheduled` ao adiar —
  medido: 11 de 12 doses adiadas em 60 dias. A prova que existe descreve o alarme do horário
  ORIGINAL, que já passou. `snoozed_until` preenchido ⇒ conta como sem prova.
- **Supressão sem aparelho não existe.** Se o usuário tem zero device expo, o desfecho é
  `sem_canal`, não supressão: não havia push a suprimir, e o problema é falta de canal.
- **Dose não-crítica não passa pelo gate** (FR-014, R-191 intacto).

### `dose_critical_events` é 1:N — e isso é um contrato

Até **7** linhas `alarm_scheduled` para a mesma dose (média 1,45 sobre 587 instâncias): o app
re-emite a cada reagendamento. Quem lê essa tabela dimensiona o teto de LINHAS pela cardinalidade,
**nunca** pelo número de ids consultados — senão uma instância com muitos reagendamentos consome o
teto e apaga em silêncio a prova das vizinhas do mesmo lote (AP-186). Teto batido ⇒ fail-open.

---

## 4. A apuração diária

Uma vez por dia, às 08:00 (SP), no cron já existente de `api/notify.ts` — **nenhuma função nova**
(R-090). Confere as doses críticas das últimas 24 h contra o `notification_log` e emite **um** evento
agregado ao Sentry (projeto `dosiq-server`), só quando há o que reportar.

- **Granularidade (FR-007a):** `notification_log` **não tem** `dose_instance_id` e o R-191 grava uma
  linha por BLOCO. A apuração aproxima por **`user_id` + protocolo + janela** — promete paciente,
  tratamento e horário, nunca a ocorrência.
- **A âncora do protocolo não vem só da coluna:** blocos `by_plan`/`misc` gravam `protocol_id` NULL
  e carregam os protocolos em `provider_metadata.protocolIds`. Ignorar isso acusaria todo bloco
  `misc` de não-entrega **todo dia**.
- **Ausência de linha ≠ não-entrega (FR-010b):** quem revogou o consentimento retorna antes do log.
  Fica fora da lista de falha, em bucket próprio.
- **Vocabulário legado ainda existe (AP-352):** o CHECK foi AMPLIADO, não trocado, e o histórico não
  foi reclassificado (D2). Todo leitor novo mapeia `sucesso`/`entregue` explicitamente — cair no
  `default` faria o alerta acusar de não-entrega justamente as doses entregues.
- **O payload não carrega dado clínico** (Constituição I): só ids opacos, contagens e instantes.
  Quem recebe resolve os nomes no banco. Listas viajam **no topo** do `extra` — aninhadas, o
  `normalizeDepth` do SDK as achata em `"[Object]"` e o alerta perde justamente o encaminhamento.

---

## 5. A série tem um antes e um depois

**Data de corte: 2026-09-10.** A migração `20260910_notification_log_status_vocab.sql` ampliou o
domínio do CHECK; `20260911_notification_log_suprimida_sem_prova.sql` acrescentou o 6º valor.
**Nenhuma linha histórica foi reescrita** (decisão D2).

| período | como ler |
|---|---|
| **antes de 2026-09-10** | `enviada` significa "o dispatcher rodou", **não** "algo foi entregue". Inclui as ~930 linhas de pacientes sem canal algum e não distingue supressão de falha. |
| **depois** | cada desfecho tem nome próprio. `enviada` significa entrega aceita por um canal. |

Baseline do dia da migração, para quem for comparar volumes: `enviada` 8.061 · `falhou` 472 ·
`silenciada` 4.

O banco ainda **aceita** o vocabulário legado (`pendente`, `sucesso`, `falha`, `entregue`) porque o
CHECK só cresceu. Nenhum escritor novo o emite; todo leitor novo tem de mapeá-lo.

⚠️ **`cleanupOldNotificationLogs` apagaria esta série.** A rotina remove `notification_log` com mais
de 7 dias e está **morta** (nenhum chamador) — é por isso que a série existe e que o diagnóstico do
§1 foi possível. Religá-la destrói o histórico que o D2 preservou de propósito e o antes/depois
desta seção. Se um dia for religada, precisa de política de retenção decidida, não de um `delete`
por idade (RC3/F7).

---

## 6. Onde mexer

| quero mudar | arquivo |
|---|---|
| o vocabulário de status | `packages/core/src/schemas/notificationLogSchema.ts` **+ migração do CHECK** (andam juntos — R-271) |
| motivo → status | `server/notifications/dispatcher/_dispatchHelpers.ts` |
| motivo de um canal | `server/notifications/utils/normalizeChannelResults.ts` |
| a decisão de suprimir | `server/bot/reminders/doseReminders.ts` |
| a leitura de evidência | `server/notifications/repositories/criticalEventsRepository.ts` |
| a apuração diária | `server/observability/criticalDeliveryAudit.ts` |
| o que pode sair no evento | `EXTRA_ALLOWLIST` em `server/observability/sentry.ts` |

**Referências:** ADR-100 (vocabulário) · ADR-101 (Sentry no backend) · ADR-056 (alarme nativo) ·
ADR-047 (inbox-first) · CON-019 · CON-031 · R-191 · R-200 · R-271 · R-295 · AP-351 · AP-352 ·
AP-353 · spec 082 (`plans/specs/082-critical-dose-delivery-truth/`, local-only, não versionado).
