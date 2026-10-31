// measurePrompt.measures.test.ts — spec 100 B · PO-2, PO-3, PO-4, PO-10 (glicemia, PA, rank, chave ausente).
// Datas de fixture sempre LOCAIS (AP-270): new Date(y, m, d, h), nunca toISOString p/ derivar dia.

const mockGetNow = jest.fn()
jest.mock('@dosiq/core', () => ({
  ...jest.requireActual('@dosiq/core'),
  getNow: () => mockGetNow(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

const mockCaptureMessage = jest.fn()
jest.mock('@sentry/react-native', () => ({ captureMessage: (...a: unknown[]) => mockCaptureMessage(...a) }))

const mockGetSession = jest.fn()
jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}))

const mockGetLatest = jest.fn()
const mockList = jest.fn()
jest.mock('@measures/services/measuresRepo', () => ({
  measuresRepo: {
    getLatest: (...a: unknown[]) => mockGetLatest(...a),
    list: (...a: unknown[]) => mockList(...a),
  },
}))

import AsyncStorageImport from '@react-native-async-storage/async-storage'
import {
  MEASURE_PROMPT_POLICIES,
  shouldAskMeasure,
  periodKeyOf,
  resolvePostDoseStep,
  measureOfItem,
} from '../measurePrompt'

const AsyncStorage = AsyncStorageImport as unknown as { getItem: jest.Mock; setItem: jest.Mock }
const GLI = MEASURE_PROMPT_POLICIES.glicemia
const PA = MEASURE_PROMPT_POLICIES.pressao_arterial

const item = (frequency: string, tracked_measure: unknown) => ({ protocol: { frequency, tracked_measure } })
const INSULINA = item('diário', 'glicemia')
const LOSARTANA = item('diário', 'pressao_arterial')
const GLP1 = item('semanal', 'peso')
const LEGADO_SEMANAL = item('semanal', null)
const NENHUM_SEMANAL = item('semanal', 'nenhum')

// Quinta 01/10/2026 (semana começa segunda 28/09)
const THU_AM = new Date(2026, 9, 1, 9, 0)
const THU_PM = new Date(2026, 9, 1, 15, 0)

function ctx(policy, over = {}) {
  return { items: [policy === GLI ? INSULINA : LOSARTANA], periodMarked: false, lastMeasuredAt: null, now: THU_AM, ...over }
}

beforeEach(() => {
  mockGetNow.mockReturnValue(THU_AM)
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } })
  mockGetLatest.mockResolvedValue(null)
  mockList.mockResolvedValue([])
  AsyncStorage.getItem.mockResolvedValue(null)
  AsyncStorage.setItem.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

describe('PO-2 — três estados × medida (escolha gravada prevalece)', () => {
  it('NULL segue a 069; medida gravada vale; nenhum desliga mesmo semanal', () => {
    expect(measureOfItem(LEGADO_SEMANAL)).toBe('peso')
    expect(measureOfItem(item('diário', null))).toBe('nenhum')
    expect(measureOfItem(INSULINA)).toBe('glicemia')
    expect(measureOfItem(NENHUM_SEMANAL)).toBe('nenhum')
  })
  it('escolha gravada vence a frequência: glicemia num GLP-1 semanal usa a política de glicemia', () => {
    expect(measureOfItem(item('semanal', 'glicemia'))).toBe('glicemia')
    expect(MEASURE_PROMPT_POLICIES.peso.appliesTo(item('semanal', 'glicemia'))).toBe(false)
  })
  it("'nenhum' num semanal não pede nada (nem peso)", async () => {
    expect(await resolvePostDoseStep({ items: [NENHUM_SEMANAL] })).toBeNull()
    expect(mockGetSession).not.toHaveBeenCalled()
  })
})

describe('PO-10 — chave ausente falha fechado', () => {
  it('protocolo sem a chave ⇒ missing (≠ null), não pede, avisa o Sentry 1×', async () => {
    const semChave = { protocol: { frequency: 'semanal' } }
    expect(measureOfItem(semChave)).toBe('missing')
    expect(await resolvePostDoseStep({ items: [semChave] })).toBeNull()
    expect(await resolvePostDoseStep({ items: [semChave] })).toBeNull()
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
    expect(mockCaptureMessage).toHaveBeenCalledWith('measure_prompt_missing_tracked_measure', 'warning')
  })
  it('valor fora do enum ⇒ missing', () => {
    expect(measureOfItem(item('semanal', 'Peso'))).toBe('missing')
  })
  it('lote com 1 item sem chave e outro configurado: o configurado ainda concorre', async () => {
    const step = await resolvePostDoseStep({ items: [{ protocol: { frequency: 'semanal' } }, INSULINA] })
    expect(step?.policy.biomarkerType).toBe('glicemia')
  })
})

describe('PO-3 — glicemia: no máximo 1 por meio-período local', () => {
  it('11:59 é manhã, 12:00 é tarde (hora local)', () => {
    expect(periodKeyOf(GLI, new Date(2026, 9, 1, 11, 59, 59))).toBe('2026-10-01:am')
    expect(periodKeyOf(GLI, new Date(2026, 9, 1, 12, 0, 0))).toBe('2026-10-01:pm')
  })
  it('glicemia de manhã suprime outra manhã e libera a tarde', () => {
    const morning = new Date(2026, 9, 1, 7, 0).toISOString()
    expect(shouldAskMeasure(GLI, ctx(GLI, { lastMeasuredAt: morning, now: THU_AM }))).toBe(false)
    expect(shouldAskMeasure(GLI, ctx(GLI, { lastMeasuredAt: morning, now: THU_PM }))).toBe(true)
  })
  it('23:50 e 00:10 do dia seguinte são períodos diferentes', () => {
    const late = new Date(2026, 9, 1, 23, 50).toISOString()
    expect(shouldAskMeasure(GLI, ctx(GLI, { lastMeasuredAt: late, now: new Date(2026, 9, 2, 0, 10) }))).toBe(true)
  })
  it('3 doses no dia ⇒ no máximo 2 pedidos (manhã e tarde) quando cada um é resolvido', async () => {
    const asked: string[] = []
    const marks = new Set<string>()
    AsyncStorage.getItem.mockImplementation(async (k: string) => (marks.has(k) ? '1' : null))
    for (const now of [new Date(2026, 9, 1, 8, 0), new Date(2026, 9, 1, 13, 0), new Date(2026, 9, 1, 20, 0)]) {
      mockGetNow.mockReturnValue(now)
      const step = await resolvePostDoseStep({ items: [INSULINA] })
      if (step) {
        asked.push(step.periodKey)
        marks.add(`measurePrompt:user-a:glicemia:${step.periodKey}`) // dispensado = período resolvido
      }
    }
    expect(asked).toEqual(['2026-10-01:am', '2026-10-01:pm'])
  })
  it('pedido exibido e abandonado (sem marca nem registro) pode reaparecer no período (RC3 Q-1)', async () => {
    expect(await resolvePostDoseStep({ items: [INSULINA] })).not.toBeNull()
    expect(await resolvePostDoseStep({ items: [INSULINA] })).not.toBeNull()
  })
})

describe('PO-3 — PA: 1/dia local e 3/semana local', () => {
  it('PA hoje suprime outro pedido hoje', () => {
    const today = new Date(2026, 9, 1, 7, 0).toISOString()
    expect(shouldAskMeasure(PA, ctx(PA, { lastMeasuredAt: today }))).toBe(false)
  })
  it('PA ontem libera hoje', () => {
    const yesterday = new Date(2026, 8, 30, 21, 0).toISOString()
    expect(shouldAskMeasure(PA, ctx(PA, { lastMeasuredAt: yesterday }))).toBe(true)
  })
  it('teto semanal: 3 dias resolvidos bloqueiam, 2 liberam', () => {
    expect(shouldAskMeasure(PA, ctx(PA, { weekDaysUsed: 3 }))).toBe(false)
    expect(shouldAskMeasure(PA, ctx(PA, { weekDaysUsed: 2 }))).toBe(true)
  })
  it('conta dias com PA registrada ∪ dias dispensados; mesmo dia não conta 2×', async () => {
    mockList.mockResolvedValue([
      { measured_at: new Date(2026, 8, 28, 8, 0).toISOString() }, // seg
      { measured_at: new Date(2026, 8, 28, 20, 0).toISOString() }, // seg de novo
    ])
    AsyncStorage.getItem.mockImplementation(async (k: string) =>
      k === 'measurePrompt:user-a:pressao_arterial:2026-09-29' || k === 'measurePrompt:user-a:pressao_arterial:2026-09-30' ? '1' : null)
    expect(await resolvePostDoseStep({ items: [LOSARTANA] })).toBeNull() // seg + ter + qua = 3
    AsyncStorage.getItem.mockImplementation(async (k: string) =>
      k === 'measurePrompt:user-a:pressao_arterial:2026-09-29' ? '1' : null)
    expect(await resolvePostDoseStep({ items: [LOSARTANA] })).not.toBeNull() // seg + ter = 2
  })
  it('lista lida a partir da segunda local da semana', async () => {
    await resolvePostDoseStep({ items: [LOSARTANA] })
    expect(mockList).toHaveBeenCalledWith({ type: 'pressao_arterial', fromTs: new Date(2026, 8, 28, 0, 0).toISOString() })
  })
  it('segunda nova zera o teto (domingo 23:59 → segunda 00:00)', async () => {
    mockList.mockImplementation(async ({ fromTs }) =>
      fromTs === new Date(2026, 8, 28).toISOString()
        ? [28, 29, 30].map((d) => ({ measured_at: new Date(2026, 8, d, 9).toISOString() }))
        : [])
    mockGetNow.mockReturnValue(new Date(2026, 9, 4, 23, 59))
    expect(await resolvePostDoseStep({ items: [LOSARTANA] })).toBeNull()
    mockGetNow.mockReturnValue(new Date(2026, 9, 5, 0, 0))
    expect(await resolvePostDoseStep({ items: [LOSARTANA] })).not.toBeNull()
  })
  it('leitura da semana falha ⇒ conta 0 e pede (nunca bloqueia a dose)', async () => {
    mockList.mockRejectedValue(new Error('TypeError: Network request failed'))
    expect(await resolvePostDoseStep({ items: [LOSARTANA] })).not.toBeNull()
  })
})

describe('PO-4 — lote misto: menor frequência de pedido vence (peso > PA > glicemia)', () => {
  const pick = async (items) => (await resolvePostDoseStep({ items }))?.policy.biomarkerType ?? null
  it('peso + glicemia → peso; PA + glicemia → PA; peso + PA → peso', async () => {
    expect(await pick([INSULINA, GLP1])).toBe('peso')
    expect(await pick([INSULINA, LOSARTANA])).toBe('pressao_arterial')
    expect(await pick([LOSARTANA, GLP1])).toBe('peso')
  })
  it('ordem do lote não desempata', async () => {
    expect(await pick([GLP1, INSULINA])).toBe('peso')
    expect(await pick([LOSARTANA, INSULINA])).toBe('pressao_arterial')
  })
  it('medida bloqueada sai da disputa: peso pesado ontem ⇒ glicemia', async () => {
    mockGetLatest.mockImplementation(async (type: string) =>
      type === 'peso' ? { measured_at: new Date(2026, 8, 30, 9).toISOString(), value: 80 } : null)
    expect(await pick([GLP1, INSULINA])).toBe('glicemia')
  })
  it('tudo bloqueado ⇒ null', async () => {
    AsyncStorage.getItem.mockResolvedValue('1')
    expect(await pick([GLP1, INSULINA, LOSARTANA])).toBeNull()
  })
})

describe('FR-012 — origem da medida no passo', () => {
  it('escolha gravada ⇒ configured; legado NULL ⇒ fallback', async () => {
    expect((await resolvePostDoseStep({ items: [GLP1] }))?.measureSource).toBe('configured')
    expect((await resolvePostDoseStep({ items: [LEGADO_SEMANAL] }))?.measureSource).toBe('fallback')
  })
})

