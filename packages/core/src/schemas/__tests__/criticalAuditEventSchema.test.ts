import { describe, it, expect } from 'vitest'
import { criticalAuditEventSchema } from '../criticalAuditEventSchema'

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
