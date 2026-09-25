/**
 * 085 Slice C2 — superfícies da cadência `intervalo_dias`: oferta por usuária e rótulo dinâmico.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  SELECTABLE_FREQUENCIES,
  FREQUENCY_LABELS,
  frequencyOptionsFor,
  formatFrequencyLabel,
  parseIntervalDaysInput,
  getIntervalDaysError,
} from '../protocolSchema'
import { fetchIntervalCadenceAvailability } from '../../utils/cadenceRollout'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('frequencyOptionsFor com a trava por usuária (085 C2)', () => {
  it('trava fechada ⇒ não oferece intervalo_dias', () => {
    expect(frequencyOptionsFor('diário')).not.toContain('intervalo_dias')
    expect(frequencyOptionsFor('diário', { intervalAvailable: false })).toEqual([...SELECTABLE_FREQUENCIES])
  })

  it('trava aberta ⇒ oferece uma vez, logo depois de semanal', () => {
    const opts = frequencyOptionsFor('diário', { intervalAvailable: true })
    expect(opts.filter((f) => f === 'intervalo_dias')).toHaveLength(1)
    expect(opts.indexOf('intervalo_dias')).toBe(opts.indexOf('semanal') + 1)
  })

  it('FM-4: trava fechada mas o tratamento JÁ é intervalo_dias ⇒ continua na lista (FR-004)', () => {
    expect(frequencyOptionsFor('intervalo_dias')).toContain('intervalo_dias')
  })

  it('FM-5: trava aberta e valor atual intervalo_dias ⇒ sem duplicar', () => {
    const opts = frequencyOptionsFor('intervalo_dias', { intervalAvailable: true })
    expect(opts.filter((f) => f === 'intervalo_dias')).toHaveLength(1)
  })
})

describe('formatFrequencyLabel (085 C2)', () => {
  it('intervalo_dias com N legível ⇒ número no rótulo', () => {
    expect(formatFrequencyLabel('intervalo_dias', 30)).toBe('A cada 30 dias')
    // Smoke C2 (PO): rótulo genérico usa "X", como o brasileiro lê a variável.
    expect(FREQUENCY_LABELS.intervalo_dias).toBe('A cada X dias')
    expect(formatFrequencyLabel('intervalo_dias', 2)).toBe('A cada 2 dias')
    expect(formatFrequencyLabel('intervalo_dias', 180)).toBe('A cada 180 dias')
  })

  it('FM-1: N ausente ou fora da faixa ⇒ rótulo genérico, nunca "null"', () => {
    for (const n of [null, undefined, 1, 181, 30.5, Number.NaN]) {
      expect(formatFrequencyLabel('intervalo_dias', n as number)).toBe(FREQUENCY_LABELS.intervalo_dias)
    }
  })

  it('FM-2: frequência desconhecida ⇒ valor cru; vazia ⇒ string vazia', () => {
    expect(formatFrequencyLabel('quinzenal')).toBe('quinzenal')
    expect(formatFrequencyLabel(null)).toBe('')
  })

  it('FM-3 (guard T042): as frequências antigas devolvem o texto do mapa da superfície', () => {
    for (const f of ['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário']) {
      expect(formatFrequencyLabel(f, null)).toBe((FREQUENCY_LABELS as Record<string, string>)[f])
      expect(formatFrequencyLabel(f, 30)).toBe((FREQUENCY_LABELS as Record<string, string>)[f])
    }
    const mobile = { diário: 'Todos os dias' }
    expect(formatFrequencyLabel('diário', null, mobile)).toBe('Todos os dias')
  })
})

describe('fetchIntervalCadenceAvailability (085 C2, FM-6)', () => {
  const now = new Date('2026-09-24T12:00:00-03:00')
  const recent = '2026-09-20T12:00:00-03:00'

  function mockClient(results: Record<string, { data: unknown; error: unknown }>) {
    const calls: string[] = []
    const client = {
      from: (table: string) => {
        calls.push(table)
        const chain = {
          select: () => chain,
          eq: () => chain,
          limit: () => Promise.resolve(results[table]),
        }
        return chain
      },
    }
    return { client: client as never, calls }
  }

  it('aparelho recente atualizado ⇒ true, consultando as duas tabelas', async () => {
    const { client, calls } = mockClient({
      notification_devices: { data: [{ platform: 'ios', app_version: '0.33.3', is_active: true, last_seen_at: recent }], error: null },
      device_activity: { data: [], error: null },
    })
    await expect(fetchIntervalCadenceAvailability(client, 'u1', now)).resolves.toBe(true)
    expect(calls.sort()).toEqual(['device_activity', 'notification_devices'])
  })

  it('aparelho antigo ao lado do novo ⇒ false', async () => {
    const { client } = mockClient({
      notification_devices: { data: [{ platform: 'ios', app_version: '0.33.3', is_active: true, last_seen_at: recent }], error: null },
      device_activity: { data: [{ platform: 'android', app_version: '0.33.1', last_seen_at: recent }], error: null },
    })
    await expect(fetchIntervalCadenceAvailability(client, 'u1', now)).resolves.toBe(false)
  })

  it('erro em qualquer tabela ⇒ false', async () => {
    const { client } = mockClient({
      notification_devices: { data: null, error: { message: 'boom' } },
      device_activity: { data: [{ platform: 'ios', app_version: '0.33.3', last_seen_at: recent }], error: null },
    })
    await expect(fetchIntervalCadenceAvailability(client, 'u1', now)).resolves.toBe(false)
  })

  it('resposta do tamanho do teto (truncada) ⇒ false', async () => {
    const row = { platform: 'ios', app_version: '0.33.3', last_seen_at: recent }
    const { client } = mockClient({
      notification_devices: { data: [], error: null },
      device_activity: { data: Array.from({ length: 200 }, () => row), error: null },
    })
    await expect(fetchIntervalCadenceAvailability(client, 'u1', now)).resolves.toBe(false)
  })

  it('sem userId ⇒ false sem consultar; exceção ⇒ false', async () => {
    const { client, calls } = mockClient({})
    await expect(fetchIntervalCadenceAvailability(client, null, now)).resolves.toBe(false)
    expect(calls).toHaveLength(0)
    const throwing = { from: () => { throw new Error('offline') } } as never
    await expect(fetchIntervalCadenceAvailability(throwing, 'u1', now)).resolves.toBe(false)
  })
})

describe('entrada de N no formulário (085 C2, FM-7)', () => {
  it('parse: vazio ⇒ null, vírgula normalizada, lixo ⇒ null', () => {
    expect(parseIntervalDaysInput('')).toBeNull()
    expect(parseIntervalDaysInput('  ')).toBeNull()
    expect(parseIntervalDaysInput(null)).toBeNull()
    expect(parseIntervalDaysInput('30')).toBe(30)
    expect(parseIntervalDaysInput(' 30 ')).toBe(30)
    expect(parseIntervalDaysInput('30,5')).toBe(30.5)
    expect(parseIntervalDaysInput('abc')).toBeNull()
    expect(parseIntervalDaysInput(45)).toBe(45)
  })

  it('erro: vazio, fora da faixa e não inteiro recusados; 2 e 180 aceitos', () => {
    expect(getIntervalDaysError('')).toMatch(/quantos dias/)
    for (const bad of ['1', '181', '30,5', '0', '-3', 'x']) {
      expect(getIntervalDaysError(bad)).not.toBeNull()
    }
    // Smoke C2 (PO): sem jargão — "número inteiro" não aparece para o consumidor.
    expect(getIntervalDaysError('181')).toBe('Escolha de 2 a 180 dias')
    expect(getIntervalDaysError('1')).toBe('Escolha de 2 a 180 dias')
    expect(getIntervalDaysError('30,5')).toBe('Use dias completos, sem vírgula')
    for (const bad of ['1', '181', '30,5', '0', '-3', 'x', '']) {
      expect(getIntervalDaysError(bad) ?? '').not.toMatch(/inteiro/)
    }
    for (const ok of ['2', '30', '90', '180', 180]) {
      expect(getIntervalDaysError(ok)).toBeNull()
    }
  })
})
