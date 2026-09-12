import { describe, it, expect, afterEach, vi } from 'vitest'
import { captureServerEvent } from '../sentry.js'
import {
  classifyDose,
  logAnchorsProtocol,
  isCriticalLogRow,
  buildReport,
  shouldAlert,
  runCriticalDeliveryAudit,
  type CriticalDose,
  type DeliveryLogRow,
} from '../criticalDeliveryAudit.js'

vi.mock('../sentry.js', () => ({ captureServerEvent: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

const U = 'user-1'
const P = 'proto-1'

// Datas LOCAIS explícitas (AP-270): nada de derivar dia a partir de toISOString().
const AGENDADA = new Date(2026, 8, 10, 8, 0, 0)

function dose(overrides: Partial<CriticalDose> = {}): CriticalDose {
  return {
    id: 'dose-1',
    user_id: U,
    protocol_id: P,
    scheduled_for: AGENDADA.toISOString(),
    ...overrides,
  }
}

function log(overrides: Partial<DeliveryLogRow> = {}): DeliveryLogRow {
  return {
    user_id: U,
    protocol_id: P,
    status: 'enviada',
    created_at: AGENDADA.toISOString(),
    notification_type: 'dose_reminder',
    provider_metadata: { critical_alarm: true, protocolId: P },
    ...overrides,
  }
}

describe('âncora do protocolo (FR-007a — decisão (a+))', () => {
  it('casa pela coluna protocol_id (bloco de dose única)', () => {
    expect(logAnchorsProtocol(log(), P)).toBe(true)
  })

  it('🔴 casa por provider_metadata.protocolIds quando a coluna é NULL (bloco by_plan/misc)', () => {
    // Sem isto, todo bloco `misc` (30 linhas em 7 dias de prod, coluna NULL e plano NULL) seria
    // acusado de não-entrega TODO DIA — falso-positivo diário, contra o FR-010.
    const row = log({ protocol_id: null, provider_metadata: { critical_alarm: true, protocolIds: ['outro', P] } })
    expect(logAnchorsProtocol(row, P)).toBe(true)
  })

  it('não casa protocolo de outro paciente no mesmo bloco', () => {
    const row = log({ protocol_id: null, provider_metadata: { critical_alarm: true, protocolIds: ['outro'] } })
    expect(logAnchorsProtocol(row, P)).toBe(false)
  })

  it('linha sem marca de criticidade não conta como linha crítica', () => {
    expect(isCriticalLogRow(log({ provider_metadata: { critical_alarm: false } }))).toBe(false)
    expect(isCriticalLogRow(log({ provider_metadata: null }))).toBe(false)
  })
})

describe('classificação da dose (FR-007)', () => {
  it('entrega comprovada é só `enviada`', () => {
    expect(classifyDose(dose(), [log({ status: 'enviada' })])).toBe('entregue')
  })

  it('🔴 `suprimida_alarme` é dose COBERTA, não falha', () => {
    expect(classifyDose(dose(), [log({ status: 'suprimida_alarme' })])).toBe('coberta')
  })

  it('`sem_canal` e `falhou` são não-entrega; `silenciada` é bucket próprio', () => {
    expect(classifyDose(dose(), [log({ status: 'sem_canal' })])).toBe('sem_canal')
    expect(classifyDose(dose(), [log({ status: 'falhou' })])).toBe('falhou')
    expect(classifyDose(dose(), [log({ status: 'silenciada' })])).toBe('silenciada')
  })

  it('🔴 vocabulário LEGADO de sucesso não vira falha (o CHECK ainda aceita os 7 valores antigos)', () => {
    // Sem o mapeamento, `sucesso`/`entregue` cairiam no default e o operador receberia alerta de
    // não-entrega para dose que FOI entregue — falso-positivo sobre o histórico que o D2 preservou.
    expect(classifyDose(dose(), [log({ status: 'sucesso' })])).toBe('entregue')
    expect(classifyDose(dose(), [log({ status: 'entregue' })])).toBe('entregue')
  })

  it('`pendente` é entrega em curso, não falha', () => {
    expect(classifyDose(dose(), [log({ status: 'pendente' })])).toBe('sem_registro')
  })

  it('ausência de linha na janela é `sem_registro`', () => {
    expect(classifyDose(dose(), [])).toBe('sem_registro')
  })

  it('linha fora da janela (+31 min) não casa', () => {
    const tarde = new Date(AGENDADA.getTime() + 31 * 60 * 1000).toISOString()
    expect(classifyDose(dose(), [log({ created_at: tarde })])).toBe('sem_registro')
  })

  it('linha dentro da janela (+29 min) casa', () => {
    const dentro = new Date(AGENDADA.getTime() + 29 * 60 * 1000).toISOString()
    expect(classifyDose(dose(), [log({ created_at: dentro })])).toBe('entregue')
  })

  it('havendo várias linhas, a entrega comprovada vence a falha vizinha', () => {
    expect(classifyDose(dose(), [log({ status: 'falhou' }), log({ status: 'enviada' })])).toBe('entregue')
  })

  it('scheduled_for ilegível não explode', () => {
    expect(classifyDose(dose({ scheduled_for: 'nao-e-data' }), [log()])).toBe('sem_registro')
  })
})

describe('relatório', () => {
  const base = {
    windowStart: new Date(2026, 8, 9, 8, 0, 0),
    windowEnd: new Date(2026, 8, 10, 8, 0, 0),
    noChannel: [],
    noChannelAllTypes: 0,
  }

  it('🔴 quem REVOGOU o consentimento sai da lista de não-entrega (FR-010b)', () => {
    // Esse caminho retorna ANTES do log: não existe linha, e contar ausência de linha como
    // não-entrega produziria falso-positivo diário contra exatamente quem pediu para não receber.
    const r = buildReport({
      ...base,
      doses: [dose()],
      logs: [],
      revokedUserIds: new Set([U]),
    })
    expect(r.criticalNoDelivery.total).toBe(0)
    expect(r.consentRevokedSkipped).toBe(1)
    expect(shouldAlert(r)).toBe(false)
  })

  it('dose sem entrega entra na lista com paciente, protocolo, janela e motivo (PO-6)', () => {
    const r = buildReport({
      ...base,
      doses: [dose()],
      logs: [log({ status: 'sem_canal' })],
      revokedUserIds: new Set(),
    })
    expect(r.criticalNoDelivery.total).toBe(1)
    expect(r.criticalNoDelivery.items[0]).toEqual({
      userId: U,
      protocolId: P,
      scheduledFor: AGENDADA.toISOString(),
      outcome: 'sem_canal',
    })
  })

  it('quebra os pacientes sem canal por motivo (FR-008/PO-7)', () => {
    const r = buildReport({
      ...base,
      doses: [],
      logs: [],
      revokedUserIds: new Set(),
      noChannel: [
        { userId: 'a', reason: 'sem_aparelho_sem_telegram' },
        { userId: 'b', reason: 'so_telegram_sem_aparelho' },
      ],
      noChannelAllTypes: 28,
    })
    expect(r.noChannelPatients.total).toBe(1)
    expect(r.noChannelPatients.soTelegram).toBe(1)
    expect(r.noChannelAllTypes).toBe(28)
  })

  it('sem supressão por ambiguidade na janela, o silêncio residual é zero', () => {
    const r = buildReport({ ...base, doses: [], logs: [], revokedUserIds: new Set() })
    expect(r.residualSilence).toBe(0)
  })

  it('🔴 FR-012c: residualSilence CONTA as `suprimida_sem_prova` — não é mais literal', () => {
    // Nasceu `0` no Slice B (baseline declarado) porque a supressão que ele conta só passou a
    // existir no Slice C. Um número que nasce constante e nunca é religado é gate que reporta
    // sucesso sem executar (AP-325): o SC-002a estaria "medindo" um literal para sempre.
    // MUTAÇÃO DE CONTROLE: trocar `totals.nao_avisada` de volta por `0` em `buildReport` faz
    // este caso falhar.
    const r = buildReport({
      ...base,
      doses: [dose({ id: 'd1' }), dose({ id: 'd2', scheduled_for: new Date(2026, 8, 10, 20, 0, 0).toISOString() })],
      logs: [
        log({ status: 'suprimida_sem_prova' }),
        log({ status: 'suprimida_sem_prova', created_at: new Date(2026, 8, 10, 20, 0, 0).toISOString() }),
      ],
      revokedUserIds: new Set(),
    })

    expect(r.residualSilence).toBe(2)
    expect(r.totals.nao_avisada).toBe(2)
  })

  it('🔴 FR-012b: `suprimida_sem_prova` é NÃO-ENTREGA, nunca `coberta`', () => {
    // Se cair em `coberta`, a dose que ninguém avisou sai do relatório com carimbo de cobertura e
    // o dia não alerta — a família exata do defeito que abriu esta spec.
    const r = buildReport({
      ...base,
      doses: [dose()],
      logs: [log({ status: 'suprimida_sem_prova' })],
      revokedUserIds: new Set(),
    })

    expect(r.totals.coberta).toBe(0)
    expect(r.criticalNoDelivery.total).toBe(1)
    expect(r.criticalNoDelivery.items[0].outcome).toBe('nao_avisada')
    expect(shouldAlert(r)).toBe(true)
  })

  it('`suprimida_alarme` continua sendo dose COBERTA e não alerta (guard do Slice B)', () => {
    const r = buildReport({
      ...base,
      doses: [dose()],
      logs: [log({ status: 'suprimida_alarme' })],
      revokedUserIds: new Set(),
    })

    expect(r.totals.coberta).toBe(1)
    expect(r.residualSilence).toBe(0)
    expect(shouldAlert(r)).toBe(false)
  })

  it('🔴 caminho saudável NÃO alerta (FR-010, anti-ruído)', () => {
    const r = buildReport({
      ...base,
      doses: [dose()],
      logs: [log({ status: 'enviada' })],
      revokedUserIds: new Set(),
    })
    expect(r.totals.entregue).toBe(1)
    expect(shouldAlert(r)).toBe(false)
  })

  it('dose coberta pelo alarme não alerta', () => {
    const r = buildReport({
      ...base,
      doses: [dose()],
      logs: [log({ status: 'suprimida_alarme' })],
      revokedUserIds: new Set(),
    })
    expect(r.totals.coberta).toBe(1)
    expect(shouldAlert(r)).toBe(false)
  })
})

// --- integração com o banco (supabase mockado, honrando os filtros) -------------------------

interface Row { [k: string]: unknown }

function makeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const q: any = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          rows = rows.filter((r) => r[col] === val)
          return q
        },
        like: (col: string, pattern: string) => {
          const prefix = pattern.replace('%', '')
          rows = rows.filter((r) => String(r[col] ?? '').startsWith(prefix))
          return q
        },
        gte: (col: string, val: string) => {
          rows = rows.filter((r) => String(r[col]) >= val)
          return q
        },
        lte: (col: string, val: string) => {
          rows = rows.filter((r) => String(r[col]) <= val)
          return q
        },
        limit: (n: number) => {
          rows = rows.slice(0, n)
          return q
        },
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
          resolve({ data: rows, error: null }),
      }
      return q
    },
  }
}

const loggerStub = { info: vi.fn(), error: vi.fn() }
const NOW = new Date(2026, 8, 10, 9, 0, 0)
const DENTRO = new Date(NOW.getTime() - 60 * 60 * 1000) // 1 h atrás, dentro da janela de 24 h

describe('runCriticalDeliveryAudit', () => {
  it('só considera dose crítica e respeita a regra CRÍTICA de canal (GAP-4)', async () => {
    // `resolveChannelsForUser` para crítica: device expo ativo ⇒ mobile_push; senão
    // telegram_chat_id ⇒ telegram; senão nenhum canal. As flags channel_*_enabled NÃO valem.
    const supabase = makeSupabase({
      dose_instances: [
        { id: 'd1', user_id: U, protocol_id: P, scheduled_for: DENTRO.toISOString(), critical_alarm: true },
        { id: 'd2', user_id: 'outro', protocol_id: 'p2', scheduled_for: DENTRO.toISOString(), critical_alarm: false },
      ],
      notification_log: [],
      protocols: [{ user_id: U, critical_alarm: true, active: true }],
      user_settings: [{ user_id: U, telegram_chat_id: null, consent_revoked_at: null }],
      notification_devices: [],
    })

    const report = await runCriticalDeliveryAudit({ supabase, logger: loggerStub, now: NOW })

    expect(report.criticalNoDelivery.total).toBe(1)
    expect(report.criticalNoDelivery.items[0].userId).toBe(U)
    expect(report.noChannelPatients.total).toBe(1)
    expect(report.noChannelPatients.items[0].reason).toBe('sem_aparelho_sem_telegram')
  })

  it('paciente com device expo ativo não entra na lista de sem canal', async () => {
    const supabase = makeSupabase({
      dose_instances: [],
      notification_log: [],
      protocols: [{ user_id: U, critical_alarm: true, active: true }],
      user_settings: [{ user_id: U, telegram_chat_id: null, consent_revoked_at: null }],
      notification_devices: [{ user_id: U, provider: 'expo', is_active: true }],
    })

    const report = await runCriticalDeliveryAudit({ supabase, logger: loggerStub, now: NOW })
    expect(report.noChannelPatients.total).toBe(0)
    expect(shouldAlert(report)).toBe(false)
  })

  it('erro de banco propaga (o runJob de api/notify.ts isola e captura)', async () => {
    const failing: any = {
      select: () => failing,
      eq: () => failing,
      like: () => failing,
      gte: () => failing,
      lte: () => failing,
      limit: () => failing,
      then: (resolve: (v: { data: null; error: { message: string } }) => unknown) =>
        resolve({ data: null, error: { message: 'relação inexistente' } }),
    }
    const supabase = { from: () => failing }
    await expect(
      runCriticalDeliveryAudit({ supabase, logger: loggerStub, now: NOW })
    ).rejects.toThrow(/dose_instances/)
  })
})

describe('emissão ao Sentry (FR-009/FR-010)', () => {
  it('🔴 dia saudável NÃO emite evento nenhum', async () => {
    const supabase = makeSupabase({
      dose_instances: [],
      notification_log: [],
      protocols: [],
      user_settings: [],
      notification_devices: [],
    })
    await runCriticalDeliveryAudit({ supabase, logger: loggerStub, now: NOW })
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it('emite UM evento agregado com contagens e IDs — nunca nome de medicamento (Constituição I)', async () => {
    const supabase = makeSupabase({
      dose_instances: [
        { id: 'd1', user_id: U, protocol_id: P, scheduled_for: DENTRO.toISOString(), critical_alarm: true },
      ],
      notification_log: [],
      protocols: [{ user_id: U, critical_alarm: true, active: true }],
      user_settings: [{ user_id: U, telegram_chat_id: null, consent_revoked_at: null }],
      notification_devices: [],
    })
    await runCriticalDeliveryAudit({ supabase, logger: loggerStub, now: NOW })

    expect(captureServerEvent).toHaveBeenCalledTimes(1)
    const [message, ctx] = vi.mocked(captureServerEvent).mock.calls[0]
    expect(message).toMatch(/sem entrega comprovada/i)
    expect(ctx?.job).toBe('critical_delivery_audit')
    expect(ctx?.extras?.criticalNoDelivery).toMatchObject({ total: 1 })
    // O payload inteiro não pode conter texto de domínio clínico — só ids, contagens e instantes.
    expect(JSON.stringify(ctx?.extras ?? {})).not.toMatch(/medicine|medicamento|protocolName|planName/i)
  })
})

describe('truncamento do PostgREST (AP-186)', () => {
  it('🔴 leitura que bate no teto vira alerta — nunca número parcial reportado como total', async () => {
    // O PostgREST corta em 1000 SEM erro: a apuração passaria a medir um pedaço da base e a
    // reportar o pedaço como se fosse o todo. É a mesma classe de silêncio que abriu a spec.
    const muitos = Array.from({ length: 1000 }, (_, i) => ({
      user_id: `u${i}`,
      telegram_chat_id: 'x',
      consent_revoked_at: null,
    }))
    const supabase = makeSupabase({
      dose_instances: [],
      notification_log: [],
      protocols: [],
      user_settings: muitos,
      notification_devices: [],
    })
    const report = await runCriticalDeliveryAudit({ supabase, logger: loggerStub, now: NOW })
    expect(report.truncatedReads).toContain('user_settings')
    expect(shouldAlert(report)).toBe(true)
  })
})
