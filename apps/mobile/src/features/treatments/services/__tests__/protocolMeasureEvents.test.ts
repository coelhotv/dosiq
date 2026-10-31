// protocolMeasureEvents.test.ts — spec 100 B · FR-012: tracked_measure + measure_source nos eventos de tratamento.
const mockLogEvent = jest.fn()
jest.mock('../../../../platform/analytics/productAnalytics', () => ({
  logEvent: (...args) => mockLogEvent(...args),
}))
jest.mock('@dosiq/core', () => {
  const repo = { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }
  return { ...jest.requireActual('@dosiq/core'), createProtocolRepository: () => repo, __repo: repo }
})
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}))
import { protocolService, buildChangeKinds } from '../protocolService'

const mockRepo = jest.requireMock('@dosiq/core').__repo
const ROW = { id: 'p-1', medicine_id: 'm-1', active: true, frequency: 'diário', time_schedule: ['08:00'], titration_steps: [] }
const eventsOf = (name) => mockLogEvent.mock.calls.filter(([n]) => n === name).map(([, p]) => p)

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
})

describe('FR-012 — treatment_created / treatment_edited', () => {
  it('create leva a medida da LINHA gravada e a origem do save', async () => {
    mockRepo.create.mockResolvedValue({ ...ROW, tracked_measure: 'glicemia' })
    await protocolService.create({}, { surface: 'mobile', measureSource: 'inferred' })
    expect(eventsOf('treatment_created')[0]).toMatchObject({ tracked_measure: 'glicemia', measure_source: 'inferred' })
  })
  it('legado NULL salvo pela 1ª vez: change_kind measure + origem', async () => {
    mockRepo.update.mockResolvedValue({ ...ROW, tracked_measure: 'peso', frequency: 'semanal' })
    await protocolService.update('p-1', { tracked_measure: 'peso' }, { previous: { ...ROW, tracked_measure: null }, measureSource: 'inferred' })
    const [edited] = eventsOf('treatment_edited')
    expect(edited.change_kind).toEqual(['measure'])
    expect(edited).toMatchObject({ tracked_measure: 'peso', measure_source: 'inferred' })
  })
  it('edição que não mexe na medida não manda measure_source', async () => {
    mockRepo.update.mockResolvedValue({ ...ROW, name: 'x', tracked_measure: 'nenhum' })
    await protocolService.update('p-1', { name: 'x', tracked_measure: 'nenhum' }, { previous: { ...ROW, name: 'y', tracked_measure: 'nenhum' }, measureSource: 'chosen' })
    const [edited] = eventsOf('treatment_edited')
    expect(edited.change_kind).toEqual(['details'])
    expect(edited).not.toHaveProperty('measure_source')
    expect(edited.tracked_measure).toBe('nenhum')
  })
  it("'nenhum' → 'glicemia' é mudança de medida", () => {
    expect(buildChangeKinds({ tracked_measure: 'nenhum' }, { tracked_measure: 'glicemia' })).toEqual(['measure'])
  })
})
