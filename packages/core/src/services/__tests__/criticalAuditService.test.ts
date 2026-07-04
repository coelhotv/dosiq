import { describe, it, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import { createCriticalAuditService } from '../criticalAuditService'

// 042 Slice A — criticalAuditService. Fail-open: nunca lança, sempre { ok: bool }.

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const DOSE_INSTANCE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12'

function makeClient(insertImpl?: () => Promise<{ error: unknown }>) {
  const insert = vi.fn(insertImpl ?? (async () => ({ error: null })))
  const from = vi.fn(() => ({ insert }))
  return { client: { from } as unknown as SupabaseClient<Database>, insert, from }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('createCriticalAuditService — emit', () => {
  it('evento válido com getUserId → insere 1x com user_id correto, retorna ok:true', async () => {
    const { client, insert, from } = makeClient()
    const getUserId = async () => USER_ID
    const service = createCriticalAuditService({ client, getUserId })

    const result = await service.emit({
      doseInstanceId: DOSE_INSTANCE_ID,
      event: 'alarm_fired',
      platform: 'ios',
      actor: 'system',
    })

    expect(result).toEqual({ ok: true })
    expect(from).toHaveBeenCalledWith('dose_critical_events')
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, dose_instance_id: DOSE_INSTANCE_ID, event: 'alarm_fired' })
    )
  })

  it('server sem getUserId, com evt.userId presente (SEC-2) → insere com esse userId', async () => {
    const { client, insert } = makeClient()
    const service = createCriticalAuditService({ client }) // sem getUserId — cenário server

    const result = await service.emit({
      userId: USER_ID,
      doseInstanceId: DOSE_INSTANCE_ID,
      event: 'push_sent',
      platform: 'server',
      actor: 'server',
    })

    expect(result).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: USER_ID }))
  })

  it('sem getUserId e sem evt.userId → não insere, retorna ok:false (evento órfão evitado)', async () => {
    const { client, insert } = makeClient()
    const service = createCriticalAuditService({ client })

    const result = await service.emit({
      event: 'alarm_fired',
      platform: 'server',
      actor: 'server',
    })

    expect(result).toEqual({ ok: false })
    expect(insert).not.toHaveBeenCalled()
  })

  it('insert do client rejeita (throw) → retorna ok:false, não lança (fail-open)', async () => {
    const { client } = makeClient(async () => {
      throw new Error('network error')
    })
    const getUserId = async () => USER_ID
    const service = createCriticalAuditService({ client, getUserId })

    await expect(
      service.emit({ event: 'alarm_fired', platform: 'ios', actor: 'system' })
    ).resolves.toEqual({ ok: false })
  })

  it('evento inválido (event fora do enum) → não insere, ok:false', async () => {
    const { client, insert } = makeClient()
    const getUserId = async () => USER_ID
    const service = createCriticalAuditService({ client, getUserId })

    const result = await service.emit({
      event: 'evento_invalido',
      platform: 'ios',
      actor: 'system',
    })

    expect(result).toEqual({ ok: false })
    expect(insert).not.toHaveBeenCalled()
  })
})
