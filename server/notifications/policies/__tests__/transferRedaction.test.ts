import { describe, it, expect, afterEach, vi } from 'vitest'
import { isTransferRedacted, redactForNoTransfer, TRANSFER_NEUTRAL_KINDS } from '../transferRedaction.js'
import { buildNotificationPayload, kindSchema } from '../../payloads/buildNotificationPayload.js'

// Spec 096 T052 / PO-13 — contrato do modo sem B: para TODA kind (exceto as neutras por schema),
// nenhum valor de saúde sobrevive em título, corpo, pushBody ou metadata. Padrão do
// payloadPiiContract (mobile): marcador sentinela em todo campo de conteúdo, busca no JSON inteiro.

const SECRET = 'Losartana_SENTINELA'
const PLAN = 'Plano_Hipertensao_SENTINELA'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function payloadFor(kind: string) {
  return {
    title: `💊 ${SECRET}`,
    body: `Tomar *${SECRET}* 50 mg — ${PLAN}`,
    pushBody: `Tomar ${SECRET} 50 mg — ${PLAN} 87%`,
    deeplink: 'dosiq://today',
    actions: [{ id: 'take', label: '✅ Tomar', params: { protocolId: 'p1', dosage: 1 } }],
    metadata: {
      kind,
      builtAt: '2026-10-21T10:00:00Z',
      correlationId: 'c1',
      details: { medicine: SECRET },
      navigation: { screen: 'bulk-plan', params: { planId: 'pl1', treatmentPlanName: PLAN, at: '08:00' } },
      protocolId: 'p1',
      protocolIds: ['p1', 'p2'],
      medicineName: SECRET,
      planId: 'pl1',
      planName: PLAN,
      percentage: 87,
      nudge: `${SECRET} acabando`,
      critical_alarm: true,
      notificationLogId: 'log1',
    },
  }
}

describe('isTransferRedacted', () => {
  it('flag preenchida ⇒ não redige', () => {
    expect(isTransferRedacted({ international_transfer_granted_at: '2026-10-21T10:00:00Z' })).toBe(false)
  })
  it.each([
    ['settings null', null],
    ['settings undefined', undefined],
    ['flag NULL', { international_transfer_granted_at: null }],
    ['flag ausente', {}],
    ['flag vazia', { international_transfer_granted_at: '' }],
    ['leitura falhou (mesmo com flag)', { international_transfer_granted_at: '2026-10-21T10:00:00Z', _read_failed: true }],
  ])('%s ⇒ redige (fail-closed por usuário)', (_label, settings) => {
    expect(isTransferRedacted(settings)).toBe(true)
  })
})

describe('redactForNoTransfer — contrato por kind (PO-13)', () => {
  const redactable = kindSchema.options.filter((k) => !TRANSFER_NEUTRAL_KINDS.includes(k))

  it.each(redactable)('%s: nenhum valor de saúde em título/corpo/pushBody/metadata', (kind) => {
    const out = redactForNoTransfer(payloadFor(kind))
    const serialized = JSON.stringify({ title: out.title, body: out.body, pushBody: out.pushBody, metadata: out.metadata })
    expect(serialized).not.toContain(SECRET)
    expect(serialized).not.toContain(PLAN)
    expect(serialized).not.toContain('87')
    expect(serialized).not.toContain('50 mg')
  })

  it.each(redactable)('%s: alerta clínico intacto (kind, critical_alarm, ações, ids, navegação)', (kind) => {
    const original = payloadFor(kind)
    const out = redactForNoTransfer(original)
    expect(out.metadata).toMatchObject({
      kind,
      critical_alarm: true,
      protocolId: 'p1',
      protocolIds: ['p1', 'p2'],
      planId: 'pl1',
      notificationLogId: 'log1',
      navigation: { screen: 'bulk-plan', params: { planId: 'pl1', at: '08:00' } },
    })
    expect(out.actions).toEqual(original.actions)
    expect(out.deeplink).toBe(original.deeplink)
  })

  it('dose (inclusive crítica) = "💊 Hora do seu remédio" — o título não revela criticidade (Q-3)', () => {
    for (const kind of ['dose_reminder', 'dose_reminder_by_plan', 'dose_reminder_misc']) {
      expect(redactForNoTransfer(payloadFor(kind)).title).toBe('💊 Hora do seu remédio')
    }
  })

  it('body sai escapado p/ MarkdownV2 (Telegram) e pushBody em texto puro', () => {
    const out = redactForNoTransfer(payloadFor('dose_reminder'))
    expect(out.pushBody).toBe('Abra o dosiq para ver a dose.')
    expect(out.body).toBe('Abra o dosiq para ver a dose\\.')
  })

  it('kind desconhecida ⇒ genérico de fallback, nunca o original', () => {
    const out = redactForNoTransfer(payloadFor('kind_que_ainda_nao_existe'))
    expect(out.title).toBe('🔔 Aviso do dosiq')
    expect(JSON.stringify(out)).not.toContain(SECRET)
  })

  it('kinds neutras por schema passam intactas', () => {
    for (const kind of TRANSFER_NEUTRAL_KINDS) {
      const original = payloadFor(kind)
      expect(redactForNoTransfer(original)).toBe(original)
    }
  })

  it('não muta o payload recebido (a inbox guarda o original)', () => {
    const original = payloadFor('dose_reminder')
    const snapshot = JSON.stringify(original)
    redactForNoTransfer(original)
    expect(JSON.stringify(original)).toBe(snapshot)
  })

  it('payload REAL do builder (lembrete por plano) sai sem nome do plano nem do remédio', () => {
    const real = buildNotificationPayload({
      kind: 'dose_reminder_by_plan',
      data: {
        planId: 'pl1',
        planName: PLAN,
        scheduledTime: '08:00',
        hour: 8,
        doses: [{ protocolId: 'p1', medicineName: SECRET, dosagePerIntake: 1 }],
      },
    })
    expect(JSON.stringify(real)).toContain(PLAN) // premissa: o builder carrega o plano hoje
    const out = redactForNoTransfer(real)
    expect(JSON.stringify({ ...out, actions: undefined })).not.toContain(PLAN)
    expect(JSON.stringify(out)).not.toContain(SECRET)
  })
})
