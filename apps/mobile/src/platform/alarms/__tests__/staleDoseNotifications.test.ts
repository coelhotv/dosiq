// staleDoseNotifications.test.js — Jest (jest-expo)

const mockGetDisplayed = jest.fn()
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { getDisplayedNotifications: (...a) => mockGetDisplayed(...a) },
}))

const mockCancelAlarm = jest.fn()
jest.mock('../alarmService', () => ({
  ALARM_CHANNEL_ID: 'dose-alarm-v2',
  ALARM_CRITICAL_CHANNEL_ID: 'dose-alarm-critical-v2',
  cancelAlarm: (...a) => mockCancelAlarm(...a),
}))

const mockEndSurface = jest.fn()
jest.mock('@platform/doseActivity/doseActivitySurfaceService', () => ({
  DOSE_ACTIVITY_CHANNEL_ID: 'dose-activity-v2',
  endDoseActivity: (...a) => mockEndSurface(...a),
}))

import {
  isDoseNotificationOutOfWindow,
  evaluateDoseWindow,
  isAlarmNotification,
  pickPromotableAlarm,
  reconcileStaleDoseNotifications,
  OUT_OF_WINDOW_NOTICE_FLAG,
} from '../staleDoseNotifications'

const NOW = new Date(Date.UTC(2026, 6, 2, 12, 0, 0)) // 2026-07-02 12:00Z
const iso = (min) => new Date(NOW.getTime() + min * 60000).toISOString()

// 067 A2: o teto (comportamento original, ex-`isDoseNotificationStale`) segue idêntico.
describe('isDoseNotificationOutOfWindow — TETO (atrasado)', () => {
  it('além de scheduled+tolerância → fora da janela', () => {
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(-200), toleranceMinutes: '120' }, NOW)).toBe(true)
  })
  it('dentro da janela → não afirma', () => {
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(-30), toleranceMinutes: '120' }, NOW)).toBe(false)
  })
  it('futuro dentro do piso → não afirma', () => {
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(60), earlyWindowMinutes: '120' }, NOW)).toBe(false)
  })
  it('sem scheduledFor → não afirma (false)', () => {
    expect(isDoseNotificationOutOfWindow({}, NOW)).toBe(false)
  })
  it('usa tolerância default (120) quando ausente', () => {
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(-121) }, NOW)).toBe(true)
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(-119) }, NOW)).toBe(false)
  })
})

// 🔴 067 A2 (FR-001) — o lado que NÃO EXISTIA e por onde o incidente entrou.
describe('evaluateDoseWindow — PISO (adiantado)', () => {
  it('🔴 reproduz o incidente: dose 13:30 com alarme às 09:47 é fora da janela', () => {
    // 3h37 = 217min adiantado, piso de 90min (protocolo 6/6h).
    const v = evaluateDoseWindow(
      { scheduledFor: iso(217), toleranceMinutes: '120', earlyWindowMinutes: '90' },
      NOW
    )
    expect(v.outOfWindow).toBe(true)
    expect(v.direction).toBe('early')
    expect(v.deltaSeconds).toBe(-217 * 60) // negativo = adiantado
  })

  it('antes desta spec isto passava: só com teto, um disparo adiantado era "válido"', () => {
    // Sem `earlyWindowMinutes` o fallback é 120 (fail-closed) — 217min ainda é fora.
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(217), toleranceMinutes: '120' }, NOW)).toBe(true)
  })

  it('adiantado DENTRO do piso segue legítimo (não-regressão do caminho feliz)', () => {
    const v = evaluateDoseWindow({ scheduledFor: iso(10), earlyWindowMinutes: '90' }, NOW)
    expect(v.outOfWindow).toBe(false)
    expect(v.direction).toBeNull()
  })

  it('fronteira: exatamente no piso está DENTRO; um minuto além está fora', () => {
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(90), earlyWindowMinutes: '90' }, NOW)).toBe(false)
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(91), earlyWindowMinutes: '90' }, NOW)).toBe(true)
  })

  it('piso ausente/inválido → 120 FAIL-CLOSED, nunca 0 (FR-032)', () => {
    // Payload de app antigo: notificação já agendada sem o campo.
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(121) }, NOW)).toBe(true)
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(119) }, NOW)).toBe(false)
    // String vazia e lixo caem no mesmo default — não em NaN (que tornaria toda comparação falsa
    // e desligaria a guarda em silêncio).
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(121), earlyWindowMinutes: '' }, NOW)).toBe(true)
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(121), earlyWindowMinutes: 'abc' }, NOW)).toBe(true)
  })

  it('piso 0 (gap degenerado) desliga só o lado adiantado — teto segue valendo', () => {
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(5), earlyWindowMinutes: '0' }, NOW)).toBe(true)
    expect(isDoseNotificationOutOfWindow({ scheduledFor: iso(-200), earlyWindowMinutes: '0' }, NOW)).toBe(true)
  })

  it('soneca legítima nunca cai no piso (dispara DEPOIS do horário, por construção)', () => {
    const v = evaluateDoseWindow(
      { scheduledFor: iso(-4), toleranceMinutes: '120', earlyWindowMinutes: '90', snoozeAttempt: '1' },
      NOW
    )
    expect(v.outOfWindow).toBe(false)
  })

  it('scheduledFor inválido → não afirma nada', () => {
    expect(evaluateDoseWindow({ scheduledFor: 'não-é-data' }, NOW).outOfWindow).toBe(false)
  })
})

describe('isAlarmNotification', () => {
  it('canal de alarme (android) e categoria (ios)', () => {
    expect(isAlarmNotification({ android: { channelId: 'dose-alarm-critical-v2' } })).toBe(true)
    expect(isAlarmNotification({ ios: { categoryId: 'dose-alarm-v2' } })).toBe(true)
    expect(isAlarmNotification({ android: { channelId: 'outro' } })).toBe(false)
  })
})

describe('reconcileStaleDoseNotifications', () => {
  beforeEach(() => jest.clearAllMocks())

  it('cancela alarme VELHO (missed) e ignora dose fresca', async () => {
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: { android: { channelId: 'dose-alarm-critical-v2' }, data: { doseInstanceId: 'old', scheduledFor: iso(-300), toleranceMinutes: '120' } } },
      { notification: { android: { channelId: 'dose-alarm-critical-v2' }, data: { doseInstanceId: 'fresh', scheduledFor: iso(-10), toleranceMinutes: '120' } } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockCancelAlarm).toHaveBeenCalledWith('old')
    expect(mockEndSurface).toHaveBeenCalledWith('old')
    expect(mockCancelAlarm).not.toHaveBeenCalledWith('fresh')
  })

  it('cancela superfície 039 velha (flag __surface)', async () => {
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: { android: { channelId: 'dose-activity-v2' }, data: { doseInstanceId: 'surf', __surface: 'true', scheduledFor: iso(-400), toleranceMinutes: '120' } } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockEndSurface).toHaveBeenCalledWith('surf')
  })

  it('notif sem doseInstanceId ou não-dose → ignora', async () => {
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: { android: { channelId: 'outro-canal' }, data: { scheduledFor: iso(-400) } } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockCancelAlarm).not.toHaveBeenCalled()
  })

  it('🔴 067 A2: o AVISO informativo NÃO é cancelado (senão cancelaria a si mesmo)', async () => {
    // O aviso vive no canal da superfície e carrega doseInstanceId — passaria nos predicados de
    // dose, e é fora da janela POR DEFINIÇÃO. A exclusão é por CONTEÚDO (AP-327/R-309 §2).
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: {
          android: { channelId: 'dose-activity-v2' },
          data: { doseInstanceId: 'aviso', [OUT_OF_WINDOW_NOTICE_FLAG]: 'true', scheduledFor: iso(-400) },
        } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockCancelAlarm).not.toHaveBeenCalled()
    expect(mockEndSurface).not.toHaveBeenCalled()
  })

  it('067 A2: cancela notificação ADIANTADA além do piso (FR-004)', async () => {
    mockGetDisplayed.mockResolvedValueOnce([
      { notification: { android: { channelId: 'dose-alarm-critical-v2' }, data: { doseInstanceId: 'adiantada', scheduledFor: iso(217), toleranceMinutes: '120', earlyWindowMinutes: '90' } } },
    ])
    await reconcileStaleDoseNotifications(NOW)
    expect(mockCancelAlarm).toHaveBeenCalledWith('adiantada')
  })

  it('getDisplayedNotifications lança → best-effort, não propaga', async () => {
    mockGetDisplayed.mockRejectedValueOnce(new Error('boom'))
    await expect(reconcileStaleDoseNotifications(NOW)).resolves.toBeUndefined()
  })
})

describe('pickPromotableAlarm', () => {
  // O `data` do alarme é sempre string (notifee serializa) — fixtures espelham o device.
  const alarme = (id, min = -5) => ({
    notification: {
      android: { channelId: 'dose-alarm-critical-v2' },
      data: { doseInstanceId: id, scheduledFor: iso(min), toleranceMinutes: '120' },
    },
  })
  // O RESUMO do auto-grupo do Android: mesmo canal, SEM data. É o bug de 2026-08-02 — vinha
  // primeiro na lista e o `find(isAlarmNotification)` o devolvia no lugar do alarme real.
  const resumoDoAutoGrupo = () => ({
    notification: { android: { channelId: 'dose-alarm-critical-v2' }, data: {} },
  })
  const superficie = () => ({
    notification: {
      android: { channelId: 'dose-activity-v2' },
      data: { doseInstanceId: 'dose-sup', __surface: 'true' },
    },
  })

  it('🔴 ignora o resumo do auto-grupo e devolve o alarme real (regressão takeover)', () => {
    const escolhido = pickPromotableAlarm([resumoDoAutoGrupo(), alarme('dose-1'), superficie()], NOW)
    expect(escolhido?.data?.doseInstanceId).toBe('dose-1')
  })

  it('não promove a superfície (canal diferente) nem alarme vencido', () => {
    expect(pickPromotableAlarm([superficie()], NOW)).toBeUndefined()
    expect(pickPromotableAlarm([alarme('dose-velha', -200)], NOW)).toBeUndefined()
  })

  it('entre um vencido e um válido, devolve o válido', () => {
    const escolhido = pickPromotableAlarm([alarme('dose-velha', -200), alarme('dose-viva', -5)], NOW)
    expect(escolhido?.data?.doseInstanceId).toBe('dose-viva')
  })

  it('🔴 067 A2: não promove alarme ADIANTADO além do piso (FR-003)', () => {
    const adiantado = {
      notification: {
        android: { channelId: 'dose-alarm-critical-v2' },
        data: { doseInstanceId: 'adiantada', scheduledFor: iso(217), toleranceMinutes: '120', earlyWindowMinutes: '90' },
      },
    }
    expect(pickPromotableAlarm([adiantado], NOW)).toBeUndefined()
  })

  it('067 A2: o aviso informativo nunca vira takeover', () => {
    const aviso = {
      notification: {
        android: { channelId: 'dose-alarm-critical-v2' },
        data: { doseInstanceId: 'aviso', [OUT_OF_WINDOW_NOTICE_FLAG]: 'true', scheduledFor: iso(-5) },
      },
    }
    expect(pickPromotableAlarm([aviso], NOW)).toBeUndefined()
  })

  it('lista vazia ou entrada inválida → undefined (nunca lança)', () => {
    expect(pickPromotableAlarm([], NOW)).toBeUndefined()
    expect(pickPromotableAlarm(null, NOW)).toBeUndefined()
    expect(pickPromotableAlarm([{}, { notification: null }], NOW)).toBeUndefined()
  })
})
