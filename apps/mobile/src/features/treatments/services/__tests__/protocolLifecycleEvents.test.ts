// protocolLifecycleEvents.test.ts — casca de analytics do protocolService (spec 065 PR B / PO-3)
// Framework: Jest (jest-expo) — rodar em apps/mobile/

const mockLogEvent = jest.fn()
jest.mock('../../../../platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))

// O repo é criado no import do protocolService (antes do corpo do teste): vive DENTRO da factory.
jest.mock('@dosiq/core', () => {
  const repo = { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }
  // requireActual: o teste de completude importa o hook do form, que puxa outros repos do core.
  return { ...jest.requireActual('@dosiq/core'), createProtocolRepository: () => repo, __repo: repo }
})

jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}))

import { protocolService, buildChangeKinds, CHANGE_GROUPS, emitTitrationEdited } from '../protocolService'
import { buildInitialValues } from '../../hooks/useProtocolFormState'

const mockRepo = jest.requireMock('@dosiq/core').__repo

const ROW = {
  id: 'p-1',
  medicine_id: 'm-1',
  active: true,
  frequency: 'diário',
  interval_days: null,
  end_date: null,
  dosage_per_intake: 1,
  time_schedule: ['08:00'],
  titration_steps: [],
}

function eventsOf(name) {
  return mockLogEvent.mock.calls.filter(([n]) => n === name).map(([, props]) => props)
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('buildChangeKinds', () => {
  it('lista todos os grupos alterados, sem valor', () => {
    const kinds = buildChangeKinds(ROW, { ...ROW, dosage_per_intake: 2, time_schedule: ['08:00', '20:00'] })
    expect(kinds).toEqual(['dose', 'schedule'])
  })

  it('edição sem mudança real → lista vazia', () => {
    expect(buildChangeKinds(ROW, { ...ROW, dosage_per_intake: '1' })).toEqual([])
  })

  it('interval_days conta como frequency; end_date como dates', () => {
    expect(buildChangeKinds(ROW, { interval_days: 3, end_date: '2026-12-01' })).toEqual(['frequency', 'dates'])
  })

  it('sem previous: grupos cujas chaves vieram no payload', () => {
    expect(buildChangeKinds(null, { start_date: '2026-10-01' })).toEqual(['dates'])
    expect(buildChangeKinds(null, { active: false })).toEqual([])
  })
})

describe('completude dos grupos contra o form real (smoke PR B: critical_alarm sumia)', () => {
  // Fora dos grupos DE PROPÓSITO: `active` é pausa/retomada (evento próprio).
  const NOT_AN_EDIT = ['active']
  // Só o prefill da edição tem: unidade é do protocolo; densidade é do MEDICAMENTO (medicineService).
  const PREFILL_ONLY = ['intake_unit', 'units_per_ml']

  it('todo campo editável do form cai em algum grupo de change_kind', () => {
    const grouped = new Set(Object.values(CHANGE_GROUPS).flat())
    const formFields = Object.keys(buildInitialValues({ todayIso: '2026-09-25', presetPlanId: null }))
    const orphans = formFields.filter((k) => !grouped.has(k) && !NOT_AN_EDIT.includes(k))
    expect(orphans).toEqual([])
    expect(grouped.has('intake_unit')).toBe(true)
    expect(PREFILL_ONLY).toContain('units_per_ml')
  })

  it('só desligar o alerta crítico → change_kind alarm', () => {
    expect(buildChangeKinds({ ...ROW, critical_alarm: true }, { ...ROW, critical_alarm: false })).toEqual(['alarm'])
  })

  it('plano e nome/observações têm grupos próprios', () => {
    expect(buildChangeKinds(ROW, { treatment_plan_id: 'tp-1', notes: 'x' })).toEqual(['plan', 'details'])
  })
})

describe('titulação', () => {
  it("emitTitrationEdited → treatment_edited{change_kind:['titration']}", async () => {
    await emitTitrationEdited({ treatmentId: 'p-1', medicineId: 'm-1', surface: 'mobile' })
    expect(eventsOf('treatment_edited')).toEqual([
      { surface: 'mobile', treatment_id: 'p-1', medicine_id: 'm-1', change_kind: ['titration'] },
    ])
  })
})

describe('create', () => {
  it('emite treatment_created com entry_point, cadência e is_titration false', async () => {
    mockRepo.create.mockResolvedValue({
      ...ROW, frequency: 'intervalo_dias', interval_days: 3, end_date: '2026-12-31', treatment_plan_id: 'tp-1',
    })
    await protocolService.create({}, { surface: 'mobile', entryPoint: 'onboarding' })
    expect(eventsOf('treatment_created')).toEqual([
      {
        surface: 'mobile',
        entry_point: 'onboarding',
        treatment_id: 'p-1',
        medicine_id: 'm-1',
        is_titration: false,
        frequency: 'intervalo_dias',
        interval_days: 3,
        treatment_plan_id: 'tp-1',
        treatment_planned_end: '2026-12-31',
        schedule_preset: '1x',
      },
    ])
  })

  it('sem surface → evento SEM a chave (A-1: nunca mobile implícito); nulos fora do payload', async () => {
    mockRepo.create.mockResolvedValue(ROW)
    await protocolService.create({})
    const [props] = eventsOf('treatment_created')
    expect(props).not.toHaveProperty('surface')
    expect(props).not.toHaveProperty('interval_days')
    expect(props).not.toHaveProperty('treatment_planned_end')
  })

  it('repo lança → nada emitido e o erro propaga', async () => {
    mockRepo.create.mockRejectedValue(new Error('boom'))
    await expect(protocolService.create({}, { surface: 'mobile' })).rejects.toThrow('boom')
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

describe('update — pausa ≠ edição ≠ encerramento (PO-3)', () => {
  it('toggle active false → treatment_paused e NENHUM treatment_edited/ended', async () => {
    mockRepo.update.mockResolvedValue({ ...ROW, active: false })
    await protocolService.update('p-1', { active: false }, { surface: 'mobile' })
    expect(eventsOf('treatment_paused')).toEqual([{ surface: 'mobile', treatment_id: 'p-1', medicine_id: 'm-1' }])
    expect(eventsOf('treatment_edited')).toEqual([])
    expect(eventsOf('treatment_ended')).toEqual([])
  })

  it('toggle active true → treatment_resumed', async () => {
    mockRepo.update.mockResolvedValue(ROW)
    await protocolService.update('p-1', { active: true }, { surface: 'mobile' })
    expect(eventsOf('treatment_resumed')).toHaveLength(1)
    expect(eventsOf('treatment_edited')).toEqual([])
  })

  it('edição do form → treatment_edited com change_kind em lista; active igual não pausa', async () => {
    mockRepo.update.mockResolvedValue({ ...ROW, dosage_per_intake: 2 })
    await protocolService.update('p-1', { ...ROW, dosage_per_intake: 2 }, { surface: 'mobile', previous: ROW })
    expect(eventsOf('treatment_edited')).toEqual([
      { surface: 'mobile', treatment_id: 'p-1', medicine_id: 'm-1', change_kind: ['dose'], frequency: 'diário', schedule_preset: '1x' },
    ])
    expect(eventsOf('treatment_paused')).toEqual([])
  })

  it('edição sem mudança real → nenhum evento', async () => {
    mockRepo.update.mockResolvedValue(ROW)
    await protocolService.update('p-1', { ...ROW }, { surface: 'mobile', previous: ROW })
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

describe('schedule_preset (086 PO-8) — forma do horário SALVO, nunca os horários', () => {
  async function presetOf(row) {
    mockRepo.create.mockResolvedValue({ ...ROW, ...row })
    await protocolService.create({}, { surface: 'mobile' })
    return eventsOf('treatment_created')[0]
  }

  it('12/12 digitado à mão (sem chip) → 12h: deriva da linha, não da tela', async () => {
    expect((await presetOf({ time_schedule: ['20:00', '08:00'] })).schedule_preset).toBe('12h')
  })

  it('8/8 e 6/6 regulares → 8h / 6h', async () => {
    expect((await presetOf({ time_schedule: ['05:30', '13:30', '21:30'] })).schedule_preset).toBe('8h')
    jest.clearAllMocks()
    expect((await presetOf({ time_schedule: ['00:00', '06:00', '12:00', '18:00'] })).schedule_preset).toBe('6h')
  })

  it('irregular → manual', async () => {
    expect((await presetOf({ time_schedule: ['07:15', '12:00', '17:00'] })).schedule_preset).toBe('manual')
  })

  it('quando_necessário e horário vazio → chave AUSENTE', async () => {
    expect(await presetOf({ frequency: 'quando_necessário', time_schedule: ['08:00'] })).not.toHaveProperty('schedule_preset')
    jest.clearAllMocks()
    expect(await presetOf({ time_schedule: [] })).not.toHaveProperty('schedule_preset')
  })

  it('nenhum valor do payload carrega horário (INV-7)', async () => {
    const props = await presetOf({ time_schedule: ['07:00', '15:00', '23:00'] })
    expect(JSON.stringify(props)).not.toMatch(/\d{2}:\d{2}/)
  })

  it('edição também emite (treatment_edited)', async () => {
    mockRepo.update.mockResolvedValue({ ...ROW, time_schedule: ['08:00', '20:00'] })
    await protocolService.update('p-1', { ...ROW, time_schedule: ['08:00', '20:00'] }, { surface: 'mobile', previous: ROW })
    expect(eventsOf('treatment_edited')[0].schedule_preset).toBe('12h')
  })
})

describe('delete', () => {
  it("emite treatment_ended{reason:'deleted'}", async () => {
    mockRepo.delete.mockResolvedValue(undefined)
    await protocolService.delete('p-1', { surface: 'mobile', medicineId: 'm-1' })
    expect(eventsOf('treatment_ended')).toEqual([
      { surface: 'mobile', treatment_id: 'p-1', medicine_id: 'm-1', reason: 'deleted' },
    ])
  })

  it('repo lança → nada emitido', async () => {
    mockRepo.delete.mockRejectedValue(new Error('rls'))
    await expect(protocolService.delete('p-1', { surface: 'mobile' })).rejects.toThrow('rls')
    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

// 092 FR-001 / PO-1 — forma do medicamento a partir do embed que a ESCRITA devolve.
describe('092 — presentation em treatment_created/edited', () => {
  it('created leva presentation da linha escrita (row.medicine)', async () => {
    mockRepo.create.mockResolvedValue({ ...ROW, medicine: { id: 'm-1', presentation: 'injetavel' } })
    await protocolService.create({}, { surface: 'mobile' })
    expect(eventsOf('treatment_created')[0]).toMatchObject({ medicine_id: 'm-1', presentation: 'injetavel' })
  })

  it('edited re-emite a forma da linha escrita', async () => {
    mockRepo.update.mockResolvedValue({ ...ROW, dosage_per_intake: 2, medicine: { presentation: 'capsula' } })
    await protocolService.update('p-1', { dosage_per_intake: 2 }, { surface: 'mobile', previous: ROW })
    expect(eventsOf('treatment_edited')[0]).toMatchObject({ presentation: 'capsula' })
  })

  it.each([
    ['sem embed', undefined],
    ['forma nula', { presentation: null }],
    ['fora do enum do banco', { presentation: 'Injetável' }],
  ])('%s → chave omitida, nunca outro (INV-3)', async (_label, medicine) => {
    mockRepo.create.mockResolvedValue({ ...ROW, medicine })
    await protocolService.create({}, { surface: 'mobile' })
    expect(eventsOf('treatment_created')[0]).not.toHaveProperty('presentation')
  })
})
