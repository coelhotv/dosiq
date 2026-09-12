import { describe, it, expect, vi, afterEach } from 'vitest'
import { addDays, parseISO } from '../../utils/dateUtils.js'
import {
  findInstancesWithAlarmEvidence,
  isUserAlarmCapable,
  ALARM_CAPABILITY_WINDOW_DAYS,
} from './criticalEventsRepository'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

/** Query builder encadeável mínimo: cada método devolve `this` e o terminal resolve o thenable. */
function makeClient(result: { data?: unknown; error?: unknown }, spy = vi.fn()) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'gte', 'limit']) {
    builder[m] = vi.fn((...args: unknown[]) => {
      spy(m, ...args)
      return builder
    })
  }
  // A última chamada da cadeia é aguardada: o builder precisa ser thenable.
  ;(builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve)
  return { from: vi.fn(() => builder), _spy: spy }
}

describe('findInstancesWithAlarmEvidence', () => {
  it('devolve os ids que têm alarm_scheduled', async () => {
    const client = makeClient({ data: [{ dose_instance_id: 'i1' }, { dose_instance_id: 'i3' }] })
    const set = await findInstancesWithAlarmEvidence(client, ['i1', 'i2', 'i3'])

    expect(set.has('i1')).toBe(true)
    expect(set.has('i3')).toBe(true)
    expect(set.has('i2')).toBe(false)
    expect(client._spy).toHaveBeenCalledWith('eq', 'event', 'alarm_scheduled')
  })

  it('🔴 lista vazia NÃO vai ao banco (`.in` com [] é ida para nada)', async () => {
    const client = makeClient({ data: [] })
    const set = await findInstancesWithAlarmEvidence(client, [])

    expect(set.size).toBe(0)
    expect(client.from).not.toHaveBeenCalled()
  })

  it('🔴 fail-open: erro de leitura devolve VAZIO (ninguém tem prova ⇒ o push sai)', async () => {
    // FR-013. Indisponibilidade do Postgres não pode virar dose crítica não avisada — e o retorno
    // tem de ser vazio, não parcial: um parcial faria a metade não lida ser suprimida em silêncio.
    const client = makeClient({ error: { message: 'connection reset' } })
    const set = await findInstancesWithAlarmEvidence(client, ['i1', 'i2'])

    expect(set.size).toBe(0)
  })

  it('não lança quando a linha volta com dose_instance_id nulo', async () => {
    const client = makeClient({ data: [{ dose_instance_id: null }, { dose_instance_id: 'i9' }] })
    const set = await findInstancesWithAlarmEvidence(client, ['i9'])

    expect(set.size).toBe(1)
    expect(set.has('i9')).toBe(true)
  })

  it('🔴 AP-186: lê em lotes, sem confiar no teto silencioso de 1000 do PostgREST', async () => {
    const client = makeClient({ data: [] })
    const ids = Array.from({ length: 450 }, (_, i) => `i${i}`)

    await findInstancesWithAlarmEvidence(client, ids)

    // 450 ids / 100 por lote = 5 leituras. Uma só significaria confiar no truncamento silencioso:
    // a dose cuja prova ficasse de fora receberia push à toa — ou deixaria de suprimir.
    expect(client.from).toHaveBeenCalledTimes(5)
  })

  it('🔴 o teto de LINHAS é independente do de IDs (a relação é 1:N — até 7 linhas por instância)', async () => {
    const client = makeClient({ data: [] })

    await findInstancesWithAlarmEvidence(client, ['i1'])

    // Teto igual ao tamanho do lote seria consumido pelas instâncias com muitos reagendamentos e
    // mataria em silêncio a prova das vizinhas do MESMO lote (achado do RC6 no PR #833).
    const limitCall = client._spy.mock.calls.find((c: unknown[]) => c[0] === 'limit')
    expect(limitCall?.[1]).toBe(1000)
  })

  it('🔴 teto de linhas BATIDO ⇒ fail-open (envia), não supressão com dado incompleto', async () => {
    // Não há como saber QUAIS instâncias ficaram de fora; suprimir com leitura truncada é push que
    // não sai em dose que talvez não esteja coberta.
    const client = makeClient({ data: Array.from({ length: 1000 }, () => ({ dose_instance_id: 'i1' })) })

    const set = await findInstancesWithAlarmEvidence(client, ['i1', 'i2'])

    expect(set.size).toBe(0)
  })
})

describe('isUserAlarmCapable', () => {
  it('usuário com evento na janela é capaz', async () => {
    const client = makeClient({ data: [{ id: 'e1' }] })
    expect(await isUserAlarmCapable(client, 'u1')).toBe(true)
  })

  it('🔴 usuário sem nenhum evento NÃO é capaz (a ausência de prova vira ambígua — D1)', async () => {
    const client = makeClient({ data: [] })
    expect(await isUserAlarmCapable(client, 'u1')).toBe(false)
  })

  it('🔴 fail-open: erro de leitura trata como CAPAZ (o ramo que envia)', async () => {
    const client = makeClient({ error: { message: 'timeout' } })
    expect(await isUserAlarmCapable(client, 'u1')).toBe(true)
  })

  it('a janela é a documentada e entra no filtro por created_at', async () => {
    const client = makeClient({ data: [] })
    const now = parseISO('2026-09-11T12:00:00.000Z')

    await isUserAlarmCapable(client, 'u1', now)

    const gteCall = client._spy.mock.calls.find((c: unknown[]) => c[0] === 'gte')
    expect(gteCall?.[2]).toBe(addDays(now, -ALARM_CAPABILITY_WINDOW_DAYS).toISOString())
    expect(ALARM_CAPABILITY_WINDOW_DAYS).toBe(7)
  })
})
