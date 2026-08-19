// Desfecho retroativo de alarme crítico iOS derivado no foreground (ENG-1, spec 042 Slice B).
// PURA: recebe os alarmes já enriquecidos + estado de permissão; devolve payloads de auditoria
// prontos p/ criticalAuditService.emit (camelCase, reuso DRY). NÃO faz fetch/AsyncStorage.

const RESOLVED_STATUSES = new Set(['taken', 'skipped', 'completed', 'done'])

/**
 * @param {object} params
 * @param {Array}  params.alarms - [{ doseInstanceId, isCritical:boolean, nagAttempt:number, doseStatus:string }]
 * @param {boolean} params.permissionGranted - notificações permitidas no iOS
 * @param {string} params.userId - dono das doses (sessão viva no foreground)
 * @returns {Array} payloads { userId, doseInstanceId, event, platform:'ios', actor:'system', detail }
 */
export function deriveIosAlarmOutcome({ alarms, permissionGranted, userId }) {
  if (!userId || !Array.isArray(alarms) || alarms.length === 0) {
    return []
  }

  const payloads = []

  for (const alarm of alarms) {
    const { doseInstanceId, isCritical, nagAttempt, doseStatus } = alarm || {}

    if (!isCritical) continue
    if (RESOLVED_STATUSES.has(doseStatus)) continue

    let event
    let detail

    // NOTA (review #700): o ramo `suppressed` é RESERVADO. O caller atual (AlarmSchedulerBridge)
    // alimenta `alarms` a partir das notificações EXIBIDAS — com permissão bloqueada nada é exibido,
    // então na wiring de hoje este ramo não dispara (o suppressed iOS fica coberto pelo follow-up que
    // compara doses críticas AGENDADAS × exibidas). A função permanece pura/genérica: se um caller
    // passar um alarme agendado-mas-não-exibido com permissionGranted:false, o suppressed é correto.
    if (permissionGranted === false) {
      event = 'alarm_suppressed'
      detail = { captured_at_foreground: true, reason: 'permission_denied' }
    } else if (nagAttempt > 0) {
      event = 'nag_fired'
      detail = { captured_at_foreground: true }
    } else {
      event = 'alarm_fired'
      detail = { captured_at_foreground: true }
    }

    payloads.push({
      userId,
      doseInstanceId,
      event,
      platform: 'ios',
      actor: 'system',
      detail,
      // 067 C.2 (FR-015/FR-016) — iOS não roda JS no disparo (AP-257): este payload é derivado
      // no FOREGROUND, então a hora do fato é genuinamente desconhecida. `occurredAt: null` é a
      // resposta honesta; gravar o instante da derivação (o que `created_at` faz por default)
      // produzia a mediana de +143 min que a US5 investigou. O `captured_at_foreground: true` no
      // detail continua marcando POR QUE está nulo.
      occurredAt: null,
    })
  }

  return payloads
}
