// outOfWindowNotice.test.ts — 067 A2 / US2 / PO-4 (shape), PO-16 (coalescência), PO-SEC-4 (consentimento)
//
// O que este arquivo protege: quando a guarda barra um disparo, DUAS coisas não podem falhar em
// silêncio — a trilha (senão o defeito volta a ser invisível, como no incidente que precisou de
// arqueologia) e o aviso à paciente (senão alguém que ouviu o alarme acha que registrou a dose).
// E uma terceira não pode acontecer: vazar nome/dosagem do medicamento na trilha (FR-036).

const mockDisplayNotification = jest.fn((..._a: any[]) => Promise.resolve())
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { displayNotification: (...a: any[]) => mockDisplayNotification(...a) },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  AndroidVisibility: { PRIVATE: 0, PUBLIC: 1 },
}))

jest.mock('expo-device', () => ({ manufacturer: 'Xiaomi', modelName: 'Poco X6 Pro' }))

const mockEnqueue = jest.fn((..._a: any[]) => Promise.resolve())
jest.mock('@platform/audit/criticalAuditQueue', () => ({
  createCriticalAuditQueue: () => ({ enqueue: (...a: any[]) => mockEnqueue(...a) }),
}))

let mockStatus: string | null = 'pending'
let mockSelectError: unknown = null
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: mockStatus == null ? null : { status: mockStatus },
              error: mockSelectError,
            }),
        }),
      }),
    }),
  },
}))

const mockEnsureChannel = jest.fn((..._a: any[]) => Promise.resolve())
// 🔴 O id do canal vem do módulo REAL (`requireActual`), não de um literal escrito aqui.
// A primeira versão deste teste mockava `'dose-activity-v1'` e asseria esse MESMO literal: passava
// verde afirmando nada sobre o canal de verdade, que é `dose-activity-v2` (medido no device com
// `adb shell dumpsys notification`). Mock que inventa o valor e depois o confere é tautologia —
// a única asserção útil é contra a constante exportada pela fonte. Família AP-300.
jest.mock('@platform/doseActivity/doseActivitySurfaceService', () => {
  const actual = jest.requireActual('@platform/doseActivity/doseActivitySurfaceService')
  return {
    DOSE_ACTIVITY_CHANNEL_ID: actual.DOSE_ACTIVITY_CHANNEL_ID,
    ensureSurfaceChannel: () => mockEnsureChannel(),
  }
})

import {
  reportOutOfWindowAlarm,
  resetOutOfWindowNotices,
  shouldDropOnRevokedConsent,
  ALARM_OUT_OF_WINDOW_EVENT,
} from '../outOfWindowNotice'
import { OUT_OF_WINDOW_NOTICE_FLAG } from '../doseWindow'
import { DOSE_ACTIVITY_CHANNEL_ID } from '@platform/doseActivity/doseActivitySurfaceService'

const DATA = {
  doseInstanceId: 'inst-1',
  medicineName: 'Amoxicilina',
  scheduledFor: '2026-08-14T16:30:00.000Z',
  // Campos que NÃO podem vazar p/ a trilha:
  dosagePerPill: '500',
  dosageUnit: 'mg',
  treatmentPlanName: 'Pós-operatório',
}

beforeEach(() => {
  resetOutOfWindowNotices()
  mockStatus = 'pending'
  mockSelectError = null
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('trilha da anomalia (FR-007/FR-036)', () => {
  it('enfileira o evento com o literal exato do CHECK do banco (R-271)', async () => {
    await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -13020 })
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
    const [evt] = mockEnqueue.mock.calls[0] as unknown as [any]
    expect(evt.event).toBe('alarm_out_of_window')
    expect(ALARM_OUT_OF_WINDOW_EVENT).toBe('alarm_out_of_window')
    expect(evt.userId).toBe('user-1')
    expect(evt.doseInstanceId).toBe('inst-1')
    expect(evt.actor).toBe('system')
  })

  it('🔴 `detail` é ALLOWLIST FECHADA — nada de nome/dosagem/plano do medicamento', async () => {
    await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -13020 })
    const [evt] = mockEnqueue.mock.calls[0] as unknown as [any]
    expect(Object.keys(evt.detail).sort()).toEqual([
      'delta_seconds',
      'direction',
      'manufacturer',
      'model',
      'os_version',
    ])
    expect(evt.detail.delta_seconds).toBe(-13020)
    expect(evt.detail.direction).toBe('early')
    expect(evt.detail.manufacturer).toBe('Xiaomi')
    expect(evt.detail.model).toBe('Poco X6 Pro')
    // Farol explícito: se alguém trocar a allowlist por um spread, isto quebra.
    expect(JSON.stringify(evt.detail)).not.toMatch(/Amoxicilina|500|Pós-operatório/)
  })

  it('sem doseInstanceId → não enfileira nem notifica (evento órfão é proibido)', async () => {
    const res = await reportOutOfWindowAlarm({ data: {}, direction: 'early', deltaSeconds: -1 })
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockDisplayNotification).not.toHaveBeenCalled()
    expect(res).toEqual({ tracked: false, notified: false })
  })

  it('FAIL-OPEN: falha ao enfileirar não impede o aviso (FR-008)', async () => {
    mockEnqueue.mockRejectedValueOnce(new Error('AsyncStorage cheio'))
    const res = await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -100 })
    expect(res.tracked).toBe(false)
    expect(res.notified).toBe(true)
    expect(mockDisplayNotification).toHaveBeenCalledTimes(1)
  })

  it('FAIL-OPEN: falha ao notificar não propaga exceção', async () => {
    mockDisplayNotification.mockRejectedValueOnce(new Error('canal morto'))
    await expect(
      reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -100 })
    ).resolves.toEqual({ tracked: true, notified: false })
  })
})

describe('aviso informativo (FR-019/FR-026 · copy da Decisão 9)', () => {
  it('usa o canal SILENCIOSO existente e marca o payload p/ não se autocancelar', async () => {
    await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -13020 })
    const [notif] = mockDisplayNotification.mock.calls[0] as unknown as [any]
    // Contra a constante da FONTE, não contra um literal — se o canal for bumpado (R-261), este
    // teste acompanha em vez de virar mentira verde.
    expect(notif.android.channelId).toBe(DOSE_ACTIVITY_CHANNEL_ID)
    expect(DOSE_ACTIVITY_CHANNEL_ID).toBe('dose-activity-v2') // valor medido no device
    expect(notif.data[OUT_OF_WINDOW_NOTICE_FLAG]).toBe('true')
    expect(mockEnsureChannel).toHaveBeenCalled()
  })

  it('copy verbatim: motivo + horário real + "nada foi registrado", sem CTA', async () => {
    await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -13020 })
    const [notif] = mockDisplayNotification.mock.calls[0] as unknown as [any]
    expect(notif.title).toBe('Alarme fora de hora')
    expect(notif.body).toContain('Amoxicilina')
    expect(notif.body).toContain('nada foi registrado')
    expect(notif.body).toMatch(/Sua dose é às \d{2}:\d{2}/)
    // Sem ações: qualquer CTA reabriria o caminho de registro que a guarda acabou de fechar.
    expect(notif.android.actions).toBeUndefined()
    expect(notif.android.ongoing).toBe(false)
  })

  it('sem nome do medicamento cai num rótulo neutro (nunca "undefined")', async () => {
    await reportOutOfWindowAlarm({
      data: { doseInstanceId: 'inst-1', scheduledFor: DATA.scheduledFor },
      direction: 'early',
      deltaSeconds: -100,
    })
    const [notif] = mockDisplayNotification.mock.calls[0] as unknown as [any]
    expect(notif.body).toContain('sua dose')
    expect(notif.body).not.toMatch(/undefined/)
  })

  it('scheduledFor inválido → corpo sem horário, ainda avisando (nunca "às NaN:NaN")', async () => {
    await reportOutOfWindowAlarm({
      data: { doseInstanceId: 'inst-1', medicineName: 'X', scheduledFor: 'lixo' },
      direction: 'early',
      deltaSeconds: -100,
    })
    const [notif] = mockDisplayNotification.mock.calls[0] as unknown as [any]
    expect(notif.body).toContain('nada foi registrado')
    expect(notif.body).not.toMatch(/NaN/)
  })
})

describe('coalescência (FR-039 / PO-16)', () => {
  it('🔴 3 disparos tortos na MESMA dose ⇒ 1 aviso (mas 3 eventos na trilha)', async () => {
    for (let i = 0; i < 3; i++) {
      await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -13020 })
    }
    expect(mockDisplayNotification).toHaveBeenCalledTimes(1)
    // A trilha registra TODOS: a recorrência é justamente o que a US2 quer medir.
    expect(mockEnqueue).toHaveBeenCalledTimes(3)
  })

  it('coalescência é POR DOSE, não global — 2 doses distintas ⇒ 2 avisos', async () => {
    await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -100 })
    await reportOutOfWindowAlarm({
      data: { ...DATA, doseInstanceId: 'inst-2' },
      direction: 'early',
      deltaSeconds: -100,
    })
    expect(mockDisplayNotification).toHaveBeenCalledTimes(2)
  })

  it('dose já `taken` não recebe aviso (FR-039) — mas a anomalia é registrada', async () => {
    mockStatus = 'taken'
    const res = await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -100 })
    expect(mockDisplayNotification).not.toHaveBeenCalled()
    expect(res).toEqual({ tracked: true, notified: false })
  })

  it('dose já `missed` também não recebe aviso', async () => {
    mockStatus = 'missed'
    await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -100 })
    expect(mockDisplayNotification).not.toHaveBeenCalled()
  })

  it('🔴 falha ao consultar o status AVISA de todo jeito — silêncio é o defeito, não o default', async () => {
    mockSelectError = { message: 'offline' }
    await reportOutOfWindowAlarm({ data: DATA, direction: 'early', deltaSeconds: -100 })
    expect(mockDisplayNotification).toHaveBeenCalledTimes(1)
  })
})

describe('gate de consentimento no flush (FR-035 / Decisão 8 / PO-SEC-4)', () => {
  it('🔴 consentimento revogado DESCARTA a anomalia', () => {
    expect(shouldDropOnRevokedConsent({ event: 'alarm_out_of_window' }, true)).toBe(true)
  })

  it('consentimento vigente GRAVA a anomalia', () => {
    expect(shouldDropOnRevokedConsent({ event: 'alarm_out_of_window' }, false)).toBe(false)
  })

  it('os demais eventos do trail seguem drenando MESMO com consentimento revogado', () => {
    // Já ocorreram (base de segurança); retenção é do prune 90d / exclusão de conta.
    for (const event of ['alarm_fired', 'snoozed', 'resolved', 'alarm_suppressed', 'push_sent']) {
      expect(shouldDropOnRevokedConsent({ event }, true)).toBe(false)
    }
  })

  it('evento malformado não derruba o predicado', () => {
    expect(shouldDropOnRevokedConsent(null, true)).toBe(false)
    expect(shouldDropOnRevokedConsent({}, true)).toBe(false)
  })
})
