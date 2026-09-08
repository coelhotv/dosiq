// doseService.test.js — testes do adaptador mobile doseService
// Framework: Jest (jest-expo) — rodar em apps/mobile/

const mockLogEvent = jest.fn()
jest.mock('../../../../platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

jest.mock('../../../../platform/analytics/analyticsEvents', () => ({
  EVENTS: {
    DOSE_LOGGED: 'dose_logged',
    DOSE_LOGGED_BULK: 'dose_logged_bulk',
    DOSE_SKIPPED: 'dose_skipped',
  },
  SURFACES: { MOBILE: 'mobile', PUSH: 'push', ALARM: 'alarm' },
}))

jest.mock('@shared/utils/debugLog', () => ({
  debugLog: jest.fn(),
}))

const mockCancelAlarm = jest.fn()
jest.mock('../../../../platform/alarms/alarmService', () => ({
  cancelAlarm: (...a) => mockCancelAlarm(...a),
}))

const mockGetUser = jest.fn()
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}))

const mockRegisterDose = jest.fn()
const mockUndoDose = jest.fn()
const mockUpdateOrphanLog = jest.fn()
const mockDeleteOrphanLog = jest.fn()
const mockRegisterDoseMany = jest.fn()
const mockGetById = jest.fn()

jest.mock('@dosiq/core', () => {
  const actual = jest.requireActual('@dosiq/core')
  return {
    ...actual,
    createDoseLogService: jest.fn(() => ({
      registerDose: (...args) => mockRegisterDose(...args),
      undoDose: (...args) => mockUndoDose(...args),
      updateOrphanLog: (...args) => mockUpdateOrphanLog(...args),
      deleteOrphanLog: (...args) => mockDeleteOrphanLog(...args),
      registerDoseMany: (...args) => mockRegisterDoseMany(...args),
    })),
    createDoseInstanceRepository: jest.fn(() => ({
      getById: (...args) => mockGetById(...args),
    })),
  }
})

import {
  registerDose,
  undoDose,
  updateOrphanLog,
  deleteOrphanLog,
  registerDoseMany,
} from '../doseService'
import { EVENTS } from '../../../../platform/analytics/analyticsEvents'

const PID = '11111111-1111-4111-8111-111111111111'
const MID = '22222222-2222-4222-8222-222222222222'
const LOG = { id: 'log-1', taken_at: '2026-05-30T08:00:00.000Z', quantity_taken: 1, medicine_id: MID, protocol_id: PID }
const INPUT = { protocol_id: PID, medicine_id: MID, taken_at: '2026-05-30T08:00:00.000Z', quantity_taken: 1 }

describe('doseService adapter tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockCancelAlarm.mockResolvedValue(undefined)
  })

  describe('registerDose', () => {
    it('sucesso → chama core, cancela alarme e loga no analytics', async () => {
      mockRegisterDose.mockResolvedValueOnce(LOG)

      const res = await registerDose(INPUT, { instanceId: 'inst-1' })

      expect(res).toEqual({ success: true, data: LOG })
      expect(mockRegisterDose).toHaveBeenCalledWith(
        expect.objectContaining({ protocol_id: PID, medicine_id: MID }),
        { instanceId: 'inst-1' }
      )
      expect(mockCancelAlarm).toHaveBeenCalledWith('inst-1')
      // 065/US2: `treatment_id` vem do FATO devolvido pela RPC (`LOG.protocol_id`), não do input.
      expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED, {
        medicine_id: MID,
        treatment_id: PID,
      })
    })

    it('falha de validação Zod → retorna erro e não chama core', async () => {
      const invalidInput = { ...INPUT, quantity_taken: -1 }

      const res = await registerDose(invalidInput)

      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
      expect(mockRegisterDose).not.toHaveBeenCalled()
      expect(mockCancelAlarm).not.toHaveBeenCalled()
    })

    it('erro de rede → retorna _ERR_OFFLINE', async () => {
      mockRegisterDose.mockRejectedValueOnce(new Error('Failed to fetch data'))

      const res = await registerDose(INPUT, { instanceId: 'inst-1' })

      expect(res.success).toBe(false)
      expect(res.error).toContain('Sem ligação à internet')
      expect(mockCancelAlarm).not.toHaveBeenCalled()
    })

    it('erro de estoque insuficiente → retorna erro de estoque', async () => {
      mockRegisterDose.mockRejectedValueOnce(new Error('Estoque insuficiente para esta operação'))

      const res = await registerDose(INPUT)

      expect(res).toEqual({ success: false, error: 'Estoque insuficiente para registrar esta dose.' })
    })

    it('erro generico → propaga a mensagem de erro', async () => {
      mockRegisterDose.mockRejectedValueOnce(new Error('Algum erro interno'))

      const res = await registerDose(INPUT)

      expect(res).toEqual({ success: false, error: 'Algum erro interno' })
    })

    it('P0001 (ocorrência já registrada/indisponível) → no-op idempotente, limpa superfície, sem erro', async () => {
      const err: any = new Error('Ocorrência já registrada ou indisponível')
      err.code = 'P0001'
      mockRegisterDose.mockRejectedValueOnce(err)

      const res = await registerDose(INPUT, { instanceId: 'inst-1' })

      expect(res).toEqual({ success: true, alreadyResolved: true })
      expect(mockCancelAlarm).toHaveBeenCalledWith('inst-1') // superfície/alarme velho limpo
    })

    it('mensagem "já registrada" sem code também é tratada como no-op', async () => {
      mockRegisterDose.mockRejectedValueOnce(new Error('Ocorrência já registrada ou indisponível'))

      const res = await registerDose(INPUT, { instanceId: 'inst-1' })

      expect(res.success).toBe(true)
      expect(res.alreadyResolved).toBe(true)
    })
  })

  describe('undoDose', () => {
    it('sucesso → cancela dose no core e loga no analytics', async () => {
      mockGetById.mockResolvedValueOnce({ id: 'inst-1', medicine_id: MID })
      mockUndoDose.mockResolvedValueOnce(undefined)

      const res = await undoDose('inst-1')

      expect(res).toEqual({ success: true })
      expect(mockGetById).toHaveBeenCalledWith('inst-1')
      expect(mockUndoDose).toHaveBeenCalledWith('inst-1')
      expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED, { action: 'undo', medicine_id: MID })
    })

    it('erro de sessao → retorna erro', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Sessão expirada') })

      const res = await undoDose('inst-1')

      expect(res.success).toBe(false)
      expect(res.error).toContain('Sessão expirada')
      expect(mockUndoDose).not.toHaveBeenCalled()
    })

    it('instancia nao encontrada → retorna erro de registro', async () => {
      mockGetById.mockResolvedValueOnce(null)

      const res = await undoDose('inst-1')

      expect(res).toEqual({ success: false, error: 'Registro não encontrado.' })
      expect(mockUndoDose).not.toHaveBeenCalled()
    })

    it('erro de rede → retorna offline error', async () => {
      mockGetById.mockResolvedValueOnce({ id: 'inst-1', medicine_id: MID })
      mockUndoDose.mockRejectedValueOnce(new Error('network error'))

      const res = await undoDose('inst-1')

      expect(res.success).toBe(false)
      expect(res.error).toContain('Sem ligação à internet')
    })
  })

  describe('updateOrphanLog', () => {
    it('sucesso → atualiza no core e loga analytics', async () => {
      mockUpdateOrphanLog.mockResolvedValueOnce(LOG)

      const res = await updateOrphanLog('log-1', { quantity_taken: 2 })

      expect(res).toEqual({ success: true })
      expect(mockUpdateOrphanLog).toHaveBeenCalledWith('log-1', { quantity_taken: 2 })
      // 065/US2: o log avulso atualizado devolve o protocolo do FATO — vai como treatment_id.
      expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED, {
        action: 'update_orphan',
        medicine_id: MID,
        treatment_id: PID,
      })
    })

    it('erro de rede → retorna offline error', async () => {
      mockUpdateOrphanLog.mockRejectedValueOnce(new Error('TypeError: fetch failed'))

      const res = await updateOrphanLog('log-1', { quantity_taken: 2 })

      expect(res.success).toBe(false)
      expect(res.error).toContain('Sem ligação à internet')
    })
  })

  describe('deleteOrphanLog', () => {
    it('sucesso → remove no core e loga analytics', async () => {
      mockDeleteOrphanLog.mockResolvedValueOnce(undefined)

      const res = await deleteOrphanLog('log-1')

      expect(res).toEqual({ success: true })
      expect(mockDeleteOrphanLog).toHaveBeenCalledWith('log-1')
      expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED, { action: 'delete_orphan' })
    })

    it('erro de rede → retorna offline error', async () => {
      mockDeleteOrphanLog.mockRejectedValueOnce(new Error('network connection lost'))

      const res = await deleteOrphanLog('log-1')

      expect(res.success).toBe(false)
      expect(res.error).toContain('Sem ligação à internet')
    })
  })

  describe('registerDoseMany', () => {
    it('sucesso → chama core, cancela alarmes e loga bulk analytics', async () => {
      const logs = [
        { ...INPUT, instance_id: 'inst-a' },
        { ...INPUT, instance_id: 'inst-b' },
      ]
      mockRegisterDoseMany.mockResolvedValueOnce([
        { success: true, instanceId: 'inst-a', data: { id: 'log-a', medicine_id: MID } },
        { success: true, instanceId: 'inst-b', data: { id: 'log-b', medicine_id: MID } },
      ])

      const res = await registerDoseMany(logs)

      expect(res.success).toBe(true)
      expect(res.results).toHaveLength(2)
      expect(mockRegisterDoseMany).toHaveBeenCalledWith([
        { ...INPUT, notes: null, injection_site: null, instanceId: 'inst-a' },
        { ...INPUT, notes: null, injection_site: null, instanceId: 'inst-b' },
      ])
      expect(mockCancelAlarm).toHaveBeenCalledWith('inst-a')
      expect(mockCancelAlarm).toHaveBeenCalledWith('inst-b')
      expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED_BULK, { count: 2 })
    })

    it('lista vazia → retorna erro', async () => {
      const res = await registerDoseMany([])
      expect(res).toEqual({ success: false, results: [], error: 'Nenhuma dose selecionada.' })
    })

    it('validacao falha em um dos logs → retorna erro', async () => {
      const res = await registerDoseMany([
        { ...INPUT },
        { ...INPUT, quantity_taken: -1 },
      ])
      expect(res.success).toBe(false)
      expect(res.error).toBeDefined()
      expect(mockRegisterDoseMany).not.toHaveBeenCalled()
    })

    it('erro de rede → retorna offline error', async () => {
      mockRegisterDoseMany.mockRejectedValueOnce(new Error('fetch error'))
      const res = await registerDoseMany([{ ...INPUT }])
      expect(res.success).toBe(false)
      expect(res.error).toContain('Sem ligação à internet')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 065 PR A — origem (`surface`) e tratamento (`treatment_id`) nos eventos de dose
// ─────────────────────────────────────────────────────────────────────────────
describe('065 — surface e treatment_id', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mockCancelAlarm.mockResolvedValue(undefined)
  })

  // T016 — a única barreira contra o modo de falha silencioso da US1: com um default `'mobile'`
  // no service, TODO registro por notificação passaria a parecer app-aberto e a tese ficaria
  // impossível de medir, com aparência de estar medida.
  it('AUSÊNCIA DE DEFAULT: emissor sem origem informada NÃO carrega surface', async () => {
    mockRegisterDose.mockResolvedValueOnce(LOG)

    await registerDose(INPUT, { instanceId: 'inst-1' })

    const [, props] = mockLogEvent.mock.calls[0]
    expect(props).not.toHaveProperty('surface')
    expect(Object.keys(props)).toEqual(expect.not.arrayContaining(['surface']))
  })

  it('AUSÊNCIA DE DEFAULT no batch: registerDoseMany sem opções não carrega surface', async () => {
    mockRegisterDoseMany.mockResolvedValueOnce([{ success: true, instanceId: 'inst-1' }])

    await registerDoseMany([INPUT])

    const [event, props] = mockLogEvent.mock.calls[0]
    expect(event).toBe(EVENTS.DOSE_LOGGED_BULK)
    expect(props).not.toHaveProperty('surface')
    expect(props).toEqual({ count: 1 })
  })

  it.each([
    ['push', 'registro pelo botão da notificação'],
    ['alarm', 'registro pela tela cheia do alarme'],
    ['mobile', 'registro com o app aberto'],
  ])('surface "%s" (%s) viaja no payload', async (surface) => {
    mockRegisterDose.mockResolvedValueOnce(LOG)

    await registerDose(INPUT, { instanceId: 'inst-1', surface })

    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED, {
      medicine_id: MID,
      surface,
      treatment_id: PID,
    })
  })

  it('batch propaga surface e NÃO inventa treatment_id (o lote atravessa tratamentos)', async () => {
    mockRegisterDoseMany.mockResolvedValueOnce([
      { success: true, instanceId: 'inst-1' },
      { success: true, instanceId: 'inst-2' },
    ])

    await registerDoseMany([INPUT, INPUT], { surface: 'mobile' })

    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED_BULK, {
      count: 2,
      surface: 'mobile',
    })
  })

  // T017 — R-299: o evento descreve o FATO. O id sai do retorno da RPC (o valor gravado em
  // `medicine_logs` na transação), nunca da entidade viva que o call-site tinha em mãos.
  it('treatment_id vem do FATO devolvido pela RPC, não do protocolo vivo do call-site', async () => {
    const PID_VIVO = '33333333-3333-4333-8333-333333333333'
    mockRegisterDose.mockResolvedValueOnce(LOG) // RPC devolve PID (o fato)

    // O call-site manda o protocolo VIVO, que já mudou (medicine_switch/edição).
    await registerDose({ ...INPUT, protocol_id: PID_VIVO }, { instanceId: 'inst-1', surface: 'mobile' })

    const [, props] = mockLogEvent.mock.calls[0]
    expect(props.treatment_id).toBe(PID)
    expect(props.treatment_id).not.toBe(PID_VIVO)
  })

  it('dose sem protocolo (avulsa/órfã) sai SEM treatment_id — ausência > valor errado', async () => {
    mockRegisterDose.mockResolvedValueOnce({ ...LOG, protocol_id: null })

    await registerDose({ medicine_id: MID, taken_at: INPUT.taken_at, quantity_taken: 1 }, { surface: 'mobile' })

    const [, props] = mockLogEvent.mock.calls[0]
    expect(props).not.toHaveProperty('treatment_id')
    expect(props.surface).toBe('mobile')
  })

  it('undoDose tira o treatment_id da INSTÂNCIA (fato agendado) e propaga surface', async () => {
    mockGetById.mockResolvedValueOnce({ id: 'inst-1', medicine_id: MID, protocol_id: PID })
    mockUndoDose.mockResolvedValueOnce(undefined)

    await undoDose('inst-1', { surface: 'mobile' })

    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED, {
      action: 'undo',
      medicine_id: MID,
      surface: 'mobile',
      treatment_id: PID,
    })
  })

  it('deleteOrphanLog propaga surface e não inventa medicine/treatment', async () => {
    mockDeleteOrphanLog.mockResolvedValueOnce(undefined)

    await deleteOrphanLog('log-1', { surface: 'mobile' })

    expect(mockLogEvent).toHaveBeenCalledWith(EVENTS.DOSE_LOGGED, {
      action: 'delete_orphan',
      surface: 'mobile',
    })
  })
})
