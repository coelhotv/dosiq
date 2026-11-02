import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { criticalAuditEventSchema, CRITICAL_AUDIT_EVENTS } from '../criticalAuditEventSchema'

// 042 Slice A — criticalAuditEventSchema. Espelha CHECKs SQL de dose_critical_events.

const VALID = {
  userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  doseInstanceId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  event: 'alarm_fired',
  platform: 'ios',
  actor: 'system',
  detail: { reason: 'scheduled' },
}

describe('criticalAuditEventSchema', () => {
  it('aceita evento válido', () => {
    const r = criticalAuditEventSchema.safeParse(VALID)
    expect(r.success).toBe(true)
  })

  it('rejeita event fora do enum', () => {
    const r = criticalAuditEventSchema.safeParse({ ...VALID, event: 'evento_invalido' })
    expect(r.success).toBe(false)
  })

  it('rejeita platform inválido', () => {
    const r = criticalAuditEventSchema.safeParse({ ...VALID, platform: 'windows' })
    expect(r.success).toBe(false)
  })

  it('rejeita actor inválido', () => {
    const r = criticalAuditEventSchema.safeParse({ ...VALID, actor: 'admin' })
    expect(r.success).toBe(false)
  })

  it('aceita detail null', () => {
    const r = criticalAuditEventSchema.safeParse({ ...VALID, detail: null })
    expect(r.success).toBe(true)
  })

  it('aceita detail ausente', () => {
    const { detail, ...rest } = VALID
    const r = criticalAuditEventSchema.safeParse(rest)
    expect(r.success).toBe(true)
  })

  it('aceita doseInstanceId null (nullable)', () => {
    const r = criticalAuditEventSchema.safeParse({ ...VALID, doseInstanceId: null })
    expect(r.success).toBe(true)
  })

  it('rejeita userId não-uuid', () => {
    const r = criticalAuditEventSchema.safeParse({ ...VALID, userId: 'not-a-uuid' })
    expect(r.success).toBe(false)
  })
})

// 082 D2 (PO-D2-5 · R-271): o array do Zod tem de ser VERBATIM o CHECK da migração mais recente que
// redefine `dose_critical_events_event_check`. Valor só de um lado = insert que morre em runtime (23514)
// ou evento que o client se recusa a emitir — nenhum dos dois aparece em teste com mock.
describe('CRITICAL_AUDIT_EVENTS × CHECK do banco (R-271)', () => {
  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../docs/migrations')

  const latestCheck = (): string[] => {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && !f.endsWith('.test.sql'))
      .sort()
      .filter((f) => /ADD CONSTRAINT dose_critical_events_event_check/.test(fs.readFileSync(path.join(migrationsDir, f), 'utf8')))
    const sql = fs.readFileSync(path.join(migrationsDir, files[files.length - 1]), 'utf8')
    const block = sql.split('ADD CONSTRAINT dose_critical_events_event_check')[1].split(']));')[0]
    return [...block.replace(/--.*$/gm, '').matchAll(/'([^']+)'::text/g)].map((m) => m[1])
  }

  it('o enum do Zod é idêntico (valor, caixa e ordem) ao CHECK da última migração', () => {
    expect([...CRITICAL_AUDIT_EVENTS]).toEqual(latestCheck())
  })

  it('aceita device_capability sem doseInstanceId (capacidade é do USUÁRIO)', () => {
    const r = criticalAuditEventSchema.safeParse({
      ...VALID,
      event: 'device_capability',
      doseInstanceId: null,
      platform: 'android',
      detail: { capable: false, critical_expected: 2, critical_armed: 0 },
    })
    expect(r.success).toBe(true)
  })
})
