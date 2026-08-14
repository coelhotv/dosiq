# Draft Idea: alarme crítico disparando fora de hora (OEM Android)

**Created**: 2026-08-14
**Status**: CONSUMIDO → `plans/specs/067-critical-alarm-window-guard/spec.md` (2026-08-14).
Reenquadrado na avaliação arquitetural: não é incidente OEM, é guarda ausente (`isDoseNotificationStale`
só tem limite superior). Backfill mediu 1 única ocorrência ⇒ item 3 (dual-channel) cortado; itens 4 e 5
viraram follow-up fora da spec. Escopo novo não previsto aqui: semântica de `alarm_fired` em iOS.
**Suggested Tier**: 2 (toca client mobile de dose crítica — liability clínica; possível novo evento em `dose_critical_events`, spec 042)
**Origem**: relato do PO — alarme de dose crítica da esposa (usuária real, Xiaomi Poco X6 Pro) tocou
às ~9:30 pra dose agendada 13:30.

## Contexto

Investigação usou o audit trail construído em spec 042 ([[draft_idea_critical-dose-audit-trail]]) —
primeira vez que o trail foi usado pra debugar um incidente real reportado por usuária, fora do
dev/PO. Confirma a premissa original do wedge (trajetória > estado final), mas expôs um caso que o
trail documenta bem porém não **previne**: alarme nativo Android disparando fora da janela esperada.

## Evidência (banco, 2026-08-14)

Dose: `dose_instances.id = 85a677b3-ec77-421c-8bac-3164a2d3b39c` (Amoxicilina + Clavulanato,
`protocols.time_schedule = ["05:30","13:30","21:30"]`, `titration_status: estável`, sem edição
recente do protocolo — descarta reagendamento por mudança de schedule).

| campo | valor |
|---|---|
| `scheduled_for` | 2026-08-14 16:30 UTC = **13:30 local** (bate com `time_schedule`) |
| `tolerance_minutes` | 120 |
| status final | `skipped_user` |
| `notified_at` | 2026-08-14 12:52:05 UTC = 09:52 local |

Trace (`dose_critical_events`, join direto por `dose_instance_id` — confirmado, não é dose trocada):

1. `alarm_scheduled` (system) — 2026-08-13 00:58:47.731927 UTC
2. `snoozed` (user) — 2026-08-14 12:47:32 UTC = **09:47 local**
3. `alarm_fired` (system) — 2026-08-14 12:52:57 UTC = **09:52 local**

Disparo real **~3h37min antes** do horário agendado. Sem `alarm_fired` registrado antes do snooze —
gap no log (alarme já tocava quando ela interagiu; primeiro toque não ficou registrado).

**Correlação**: `alarm_scheduled` desta dose e da dose irmã do mesmo remédio (slot 05:30, id
`60ea2c76`) têm o MESMO timestamp (diff ~190ms) → confirma que foi um único `syncAlarms()` em lote
reagendando as próximas 72h de uma vez. Não é bug de escrita duplicada nem corrida entre schedulers.

## Investigação de código (mobile, read-only)

Arquivos: `apps/mobile/src/platform/alarms/alarmService.ts`, `useAlarmScheduler.ts`,
`AlarmSchedulerBridge.tsx`, `packages/core/src/utils/dateUtils.ts`, `doseZones.ts`.

- Conversão `scheduled_for` → trigger: `parseISO(scheduledFor).getTime()` (`alarmService.ts:343`) —
  epoch direto de timestamptz, **tz-agnóstico**. Sem offset fixo, sem parse ambíguo.
- `tolerance_minutes`: usado só como cutoff *futuro* em `scheduleNag` (`alarmService.ts:413-416`) e
  em `classifyInstanceDay` (`doseZones.ts:317-322`) pra carry-over/look-ahead — nunca subtraído do
  horário de disparo.
- `syncAlarms()` (`useAlarmScheduler.ts:164-233`): `cancelAll()` (linha 184) + reagenda tudo da
  janela de 72h num loop, dispara em mount e a cada `AppState → 'active'`. Usa `scheduled_for` cru do
  banco a cada sync — não cacheia horário velho.

**Conclusão do code review: sem bug de lógica encontrado** (tz, tolerância e batch-scheduling
corretos). Root cause está fora do código investigado — nível OEM/device.

## Hipóteses (rankeadas)

1. **Trigger antigo sobrevivendo ao `cancelAll()`** — se `notifee.cancelTriggerNotifications()`
   falhar silenciosamente (comum em restrição agressiva de bateria), um trigger de agendamento
   anterior (com fireAt desatualizado) pode coexistir com o novo e disparar no horário velho.
2. **Comportamento nativo Xiaomi/HyperOS** — device confirmado: **Poco X6 Pro**. Código já trata
   restrições Xiaomi (`alarmService.ts:118-126`); MIUI/HyperOS é conhecido por antecipar/atrasar
   `AlarmManager` sob Doze/otimização de bateria agressiva, ou por drift de relógio do device.
3. **`scheduled_for` alterado no banco sem novo sync** — descartado nesta instância (protocolo
   estável, `time_schedule` bate), mas fica como classe de risco geral pra outros casos.

## Soluções propostas (não decididas — para retomar)

Ordem de prioridade discutida com o PO:

1. **[P0 — guardrail clínico, resolve liability independente da causa raiz]** Antes de permitir
   ação do usuário (tomar/pular) sobre um alarme disparado, validar `now() vs scheduled_for ±
   tolerance` no client. Fora da janela → não mostra CTA de ação; mostra estado "alarme antecipado,
   dose ainda não é agora" e reagenda silenciosamente. Impede registro de dose fora de hora mesmo
   que o SO dispare torto — é o único item que elimina o erro clínico, já que a causa raiz (OEM)
   não é 100% controlável pelo app.
2. **Novo evento de anomalia no audit trail** — `alarm_fired_early` (ou `alarm_anomaly`) quando o
   delta observado no fire está fora da tolerância. Hoje o gap no log (sem `alarm_fired` antes do
   snooze) mostra que o trail tem furo nesse caso; dá visibilidade agregada pra detectar recorrência
   por fabricante.
3. **Redundância dual-channel** — avaliar push server-side como fallback pra dose crítica (canal já
   existe pra outros fluxos — `notification_log`), menos preciso em timing mas não depende de
   Doze/OEM.
4. **Revalidação periódica de triggers agendados** — job leve (WorkManager / on resume) que confere
   triggers pendentes vs `scheduled_for` atual no banco e mata zumbi/duplicata (mitiga hipótese 1).
5. **Onboarding OEM-specific** — reforçar o fluxo já existente de detecção Xiaomi com prompt guiado
   (autostart, bateria sem restrição, lock em recents). Reduz incidência, não zera.

## Decisão

Pendente — aguardando retomada com o PO. Nenhuma solução implementada ainda.

## Next Action (quando retomar)

Rodar `/devflow specifying` sobre o item P0 primeiro (guardrail clínico) — é o único que não depende
de causa raiz confirmada e fecha o risco de liability imediatamente. Itens 2-5 podem virar specs
separadas ou entrar no mesmo Tier 2 conforme escopo definido na sessão de specifying.
