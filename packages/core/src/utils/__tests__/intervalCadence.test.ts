// intervalCadence.test.ts — 085 Slice C1: cadência "a cada N dias" (D-2), teto de tolerância (D-3),
// janela por ocorrências (F-4), runway/aderência (PO-10), trava de rollout por usuária (H-1) e o
// cruzamento cadência × titulação (CON-032). Datas locais, nunca derivadas de toISOString (AP-270).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateInstances } from '../doseInstanceGenerator'
import {
  isProtocolActiveOnDate,
  isKnownFrequency,
  getIntervalDays,
  frequencyDailyFactor,
  getDailyDoseRate,
} from '../adherenceLogic'
import { isIntervalCadenceAvailable, INTERVAL_CADENCE_MIN_MOBILE_VERSION } from '../cadenceRollout'
import { computeWindowEnd, WINDOW_DAYS } from '../../services/doseInstancePlanner'
import { getEndOfDayISO, parseISO } from '../dateUtils'
import {
  SELECTABLE_FREQUENCIES,
  FREQUENCY_LABELS,
  frequencyOptionsFor,
  validateProtocolCreate,
  validateProtocolUpdate,
} from '../../schemas/protocolSchema'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const TZ = 'America/Sao_Paulo'
const localDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso)
  )

const monthly = {
  id: 'p-int',
  user_id: 'u1',
  frequency: 'intervalo_dias',
  interval_days: 30,
  time_schedule: ['08:00'],
  dosage_per_intake: 1,
  start_date: '2026-05-01',
  end_date: null,
  active: true,
  weekdays: [],
}

describe('085 PO-8 — intervalo_dias gera a cada N dias a partir do start_date', () => {
  it('N=30 numa janela de 70 dias: exatamente 3 ocorrências, 30 dias entre elas', () => {
    const out = generateInstances(monthly, '2026-05-01T00:00:00-03:00', '2026-07-09T23:59:59-03:00', TZ)
    expect(out.map((i) => localDay(i.scheduled_for))).toEqual(['2026-05-01', '2026-05-31', '2026-06-30'])
  })

  it('é frequência conhecida (não cai no fallback)', () => {
    expect(isKnownFrequency('intervalo_dias')).toBe(true)
  })

  it('FM-1: data anterior ao start_date nunca casa', () => {
    expect(isProtocolActiveOnDate(monthly, '2026-04-01')).toBe(false)
  })

  it('FM-2: N ausente ou fora da faixa erra para o lado AUDÍVEL (select sem a coluna)', () => {
    expect(isProtocolActiveOnDate({ ...monthly, interval_days: null }, '2026-05-02')).toBe(true)
    expect(isProtocolActiveOnDate({ ...monthly, interval_days: 1 }, '2026-05-02')).toBe(true)
    expect(getIntervalDays({ ...monthly, interval_days: 181 })).toBeNull()
    expect(getIntervalDays({ ...monthly, interval_days: 2.5 })).toBeNull()
  })

  it('FM-3: sem start_date mantém ativo (paridade com a alternância)', () => {
    expect(isProtocolActiveOnDate({ ...monthly, start_date: null }, '2026-05-02')).toBe(true)
  })

  it('estável através de virada de ano (conta dias de calendário)', () => {
    const p = { ...monthly, interval_days: 45, start_date: '2026-12-01' }
    expect(isProtocolActiveOnDate(p, '2027-01-15')).toBe(true) // +45
    expect(isProtocolActiveOnDate(p, '2027-01-16')).toBe(false)
  })

  it('N=7 é declarado: mesmo calendário do semanal quando o início cai no dia marcado', () => {
    const p = { ...monthly, interval_days: 7 } // 2026-05-01 é sexta
    const semanal = { ...monthly, frequency: 'semanal', interval_days: null, weekdays: ['sexta'] }
    for (const d of ['2026-05-08', '2026-05-15', '2026-05-09']) {
      expect(isProtocolActiveOnDate(p, d)).toBe(isProtocolActiveOnDate(semanal, d))
    }
  })
})

describe('085 D-3 — teto de tolerância da cadência longa', () => {
  const tolFor = (n: number, schedule = ['08:00']) =>
    generateInstances(
      { ...monthly, interval_days: n, time_schedule: schedule },
      '2026-05-01T00:00:00-03:00',
      '2026-05-01T23:59:59-03:00',
      TZ
    ).map((i) => [i.tolerance_minutes, i.early_window_minutes])

  it('N=30 → 3 dias (bula da Mesigyna); adiantamento segue com teto de 120', () => {
    expect(tolFor(30)).toEqual([[3 * 1440, 120]])
  })

  it('N=90 → 7 dias (teto), metade da graça do DMPA de propósito', () => {
    expect(tolFor(90)).toEqual([[7 * 1440, 120]])
  })

  it('N=14 → 10% (2016 min); N=180 → 7 dias', () => {
    expect(tolFor(14)[0][0]).toBe(2016)
    expect(tolFor(180)[0][0]).toBe(7 * 1440)
  })

  it('N<14 segue a regra do ADR-061 (metade do período, sem teto)', () => {
    expect(tolFor(10)[0][0]).toBe(5 * 1440)
    expect(tolFor(2)[0][0]).toBe(1440) // = dias_alternados (2880/2)
  })

  it('multi-dose no dia: o gap intra-dia vence o teto (sem sobrepor janelas)', () => {
    expect(tolFor(30, ['08:00', '20:00']).map(([t]) => t)).toEqual([360, 360])
  })

  it('N ausente: 120 fixo, o legado de período desconhecido', () => {
    const out = generateInstances(
      { ...monthly, interval_days: null },
      '2026-05-01T00:00:00-03:00',
      '2026-05-01T23:59:59-03:00',
      TZ
    )
    expect(out[0].tolerance_minutes).toBe(120)
  })

  it('guard: semanal de dose única segue sem teto (5040), como antes', () => {
    const out = generateInstances(
      { ...monthly, frequency: 'semanal', interval_days: null, weekdays: ['sexta'] },
      '2026-05-01T00:00:00-03:00',
      '2026-05-01T23:59:59-03:00',
      TZ
    )
    expect(out[0].tolerance_minutes).toBe(5040)
  })
})

describe('085 PO-8a / F-4 — a janela garante as 2 próximas ocorrências', () => {
  const base = parseISO('2026-05-01T12:00:00-03:00')
  const daysEnd = new Date(base.getTime() + WINDOW_DAYS * 86_400_000).toISOString()

  it('N=90: janela vai até o fim do dia da 2ª ocorrência (não os 30 dias)', () => {
    const p = { ...monthly, interval_days: 90 }
    expect(computeWindowEnd(p, base, TZ)).toBe(getEndOfDayISO('2026-07-30', TZ))
  })

  it('N=90 cadastrado HOJE já tem a próxima ocorrência materializada, não zero', () => {
    // Cadastro em 10/05, início 01/05: sem F-4 a janela [10/05, 09/06] não teria ocorrência (0).
    const now = parseISO('2026-05-10T12:00:00-03:00')
    const p = { ...monthly, interval_days: 90 }
    const out = generateInstances(p, now, computeWindowEnd(p, now, TZ), TZ)
    expect(out.map((i) => localDay(i.scheduled_for))).toEqual(['2026-07-30', '2026-10-28'])
  })

  it('guard: diário, semanal e alternados mantêm exatamente base + 30 dias', () => {
    for (const p of [
      { ...monthly, frequency: 'diário', interval_days: null },
      { ...monthly, frequency: 'semanal', interval_days: null, weekdays: ['sexta'] },
      { ...monthly, frequency: 'dias_alternados', interval_days: null },
      { ...monthly, interval_days: 10 },
    ]) {
      expect(computeWindowEnd(p, base, TZ)).toBe(daysEnd)
    }
  })

  it('FM-6: PRN (nunca casa) fica em base + 30 dias', () => {
    expect(computeWindowEnd({ ...monthly, frequency: 'quando_necessário', interval_days: null }, base, TZ)).toBe(daysEnd)
  })

  it('FM-7: end_date entre base+30 e a 2ª ocorrência — a janela segue a 2ª ocorrência dentro do fim', () => {
    // N=40: 01/05 e 10/06; end_date 20/06 ⇒ fim do dia 10/06 (depois de base+30, antes do fim).
    const p = { ...monthly, interval_days: 40, end_date: '2026-06-20' }
    expect(computeWindowEnd(p, base, TZ)).toBe(getEndOfDayISO('2026-06-10', TZ))
  })

  it('FM-7: 2ª ocorrência depois do end_date não existe (o motor respeita o período) ⇒ base+30', () => {
    const p = { ...monthly, interval_days: 90, end_date: '2026-06-15' }
    expect(computeWindowEnd(p, base, TZ)).toBe(daysEnd)
  })
})

describe('085 PO-10 — runway e aderência consomem 1/N', () => {
  it('frequencyDailyFactor = 1/N', () => {
    expect(frequencyDailyFactor(monthly)).toBeCloseTo(1 / 30)
    expect(frequencyDailyFactor({ ...monthly, interval_days: 90 })).toBeCloseTo(1 / 90)
  })

  it('getDailyDoseRate (doses esperadas) = vezes/dia ÷ N', () => {
    expect(getDailyDoseRate({ ...monthly, time_schedule: ['08:00', '20:00'] })).toBeCloseTo(2 / 30)
  })

  it('FM-9: N ausente mantém o default de hoje (1)', () => {
    expect(frequencyDailyFactor({ ...monthly, interval_days: null })).toBe(1)
  })

  it('guard: frequências existentes inalteradas', () => {
    expect(frequencyDailyFactor({ frequency: 'diário' })).toBe(1)
    expect(frequencyDailyFactor({ frequency: 'semanal' })).toBeCloseTo(1 / 7)
    expect(frequencyDailyFactor({ frequency: 'dias_alternados' })).toBe(0.5)
    expect(frequencyDailyFactor({ frequency: 'quando_necessário' })).toBe(1)
  })
})

describe('085 CON-032 — cadência × titulação: a escada decide a dose, a cadência decide o dia', () => {
  it('só dias de cadência recebem instância, cada uma com a dose da etapa vigente naquela data', () => {
    const steps = [
      { position: 0, dose: 1, duration_days: 45, status: 'current', started_at: '2026-05-01T08:00:00.000Z' },
      { position: 1, dose: 2, duration_days: 90, status: 'upcoming', started_at: null },
    ]
    const out = generateInstances(monthly, '2026-05-01T00:00:00-03:00', '2026-07-09T23:59:59-03:00', TZ, steps)
    expect(out.map((i) => [localDay(i.scheduled_for), i.expected_dose])).toEqual([
      ['2026-05-01', 1],
      ['2026-05-31', 1],
      ['2026-06-30', 2], // etapa 1 vence em 15/06
    ])
  })
})

describe('085 schema — vocabulário aceito, oferta desligada (H-1)', () => {
  const valid = {
    medicine_id: '8d2a01f0-0000-4000-8000-000000000001',
    name: 'Injetável mensal',
    frequency: 'intervalo_dias',
    interval_days: 30,
    time_schedule: ['08:00'],
    dosage_per_intake: 1,
    start_date: '2026-05-01',
  }

  it('create aceita intervalo_dias com N na faixa', () => {
    expect(validateProtocolCreate(valid).success).toBe(true)
  })

  it('create rejeita N fora da faixa e incoerência nos dois sentidos (espelha o CHECK)', () => {
    expect(validateProtocolCreate({ ...valid, interval_days: 1 }).success).toBe(false)
    expect(validateProtocolCreate({ ...valid, interval_days: 181 }).success).toBe(false)
    expect(validateProtocolCreate({ ...valid, interval_days: null }).success).toBe(false)
    expect(validateProtocolCreate({ ...valid, frequency: 'diário' }).success).toBe(false)
    expect(validateProtocolCreate({ ...valid, frequency: 'diário', interval_days: null }).success).toBe(true)
  })

  it('update: coerência conferida quando a frequência é enviada (RC6 #837)', () => {
    expect(validateProtocolUpdate({ frequency: 'intervalo_dias', interval_days: 30 }).success).toBe(true)
    expect(validateProtocolUpdate({ frequency: 'intervalo_dias' }).success).toBe(false)
    expect(validateProtocolUpdate({ frequency: 'diário', interval_days: 30 }).success).toBe(false)
    expect(validateProtocolUpdate({ frequency: 'diário' }).success).toBe(true)
    expect(validateProtocolUpdate({ interval_days: 45 }).success).toBe(true) // só N: o banco guarda o par
    expect(validateProtocolUpdate({ name: 'x y' }).success).toBe(true)
  })

  it('não é oferecida no C1 — mas o protocolo que já a carrega exibe o próprio valor (FR-004)', () => {
    expect(SELECTABLE_FREQUENCIES).not.toContain('intervalo_dias')
    expect(frequencyOptionsFor('intervalo_dias')).toContain('intervalo_dias')
    expect(FREQUENCY_LABELS.intervalo_dias).toBeTruthy()
  })
})

describe('085 H-1 — trava de rollout por usuária', () => {
  const now = parseISO('2026-10-01T12:00:00Z')
  const seen = '2026-09-28T12:00:00Z'
  const stale = '2026-07-01T12:00:00Z'
  const ok = INTERVAL_CADENCE_MIN_MOBILE_VERSION

  it('libera quando todo aparelho mobile recente está na versão mínima ou acima', () => {
    expect(
      isIntervalCadenceAvailable(
        [{ platform: 'ios', app_version: ok, updated_at: seen, is_active: true }],
        [{ platform: 'android', app_version: '9.0.0', last_seen_at: seen }],
        now
      )
    ).toBe(true)
  })

  it('bloqueia com UM aparelho antigo, mesmo ao lado de um novo da mesma plataforma', () => {
    expect(
      isIntervalCadenceAvailable(
        [],
        [
          { platform: 'ios', app_version: ok, last_seen_at: seen },
          { platform: 'ios', app_version: '0.33.1', last_seen_at: seen },
        ],
        now
      )
    ).toBe(false)
  })

  it('sem nenhum registro mobile ⇒ NÃO libera (celular pré-telemetria é invisível)', () => {
    expect(isIntervalCadenceAvailable([], [], now)).toBe(false)
    expect(isIntervalCadenceAvailable(null, { error: 'x' }, now)).toBe(false)
    expect(isIntervalCadenceAvailable([], [{ platform: 'web', app_version: '4.26.0', last_seen_at: seen }], now)).toBe(false)
  })

  it('ignora aparelho fora da janela de 30 dias e device de push inativo', () => {
    expect(
      isIntervalCadenceAvailable(
        [{ platform: 'android', app_version: '0.6.0', updated_at: seen, is_active: false }],
        [
          { platform: 'ios', app_version: '0.30.0', last_seen_at: stale },
          { platform: 'ios', app_version: ok, last_seen_at: seen },
        ],
        now
      )
    ).toBe(true)
  })

  it('versão ilegível conta como NÃO atualizada', () => {
    expect(isIntervalCadenceAvailable([], [{ platform: 'ios', app_version: 'dev', last_seen_at: seen }], now)).toBe(false)
  })
})
