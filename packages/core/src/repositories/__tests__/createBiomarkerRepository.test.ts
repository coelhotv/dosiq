import { describe, it, expect, vi } from 'vitest'
import { createBiomarkerRepository } from '../createBiomarkerRepository'

// 069 A2 — idempotência do create (PO 02/10): o passo 2 da dose reenvia com o MESMO id quando a
// resposta se perde ("Tentar de novo"). 23505 nesse id = a 1ª tentativa gravou → devolve a linha.

const USER = '11111111-1111-4111-8111-111111111111'
const ID = '22222222-2222-4222-8222-222222222222'
const getUserId = async () => USER

// Builder fluente: insert().select().single() e select().eq().eq().maybeSingle()
function makeClient({ insertResult, readResult = { data: null, error: null } }: any) {
  const calls: any[] = []
  const builder: any = {
    insert: vi.fn((rows) => { calls.push(['insert', rows]); return builder }),
    select: vi.fn(() => builder),
    eq: vi.fn((col, val) => { calls.push(['eq', col, val]); return builder }),
    single: vi.fn(() => Promise.resolve(insertResult)),
    maybeSingle: vi.fn(() => Promise.resolve(readResult)),
  }
  const client: any = { from: vi.fn(() => builder), _calls: calls }
  return client
}

const PESO = { type: 'peso', value: 82.5, unit: 'kg' }

describe('createBiomarkerRepository.create — id do cliente (idempotência)', () => {
  it('id UUID informado chega ao insert (não é descartado pelo Zod — AP-214)', async () => {
    const client = makeClient({ insertResult: { data: { id: ID }, error: null } })
    await createBiomarkerRepository({ client, getUserId }).create({ ...PESO, id: ID })
    const [, rows] = client._calls.find((c: any) => c[0] === 'insert')
    expect(rows[0]).toMatchObject({ id: ID, type: 'peso', value: 82.5, user_id: USER })
  })

  it('sem id: insert sem id (default do banco), como antes', async () => {
    const client = makeClient({ insertResult: { data: { id: 'x' }, error: null } })
    await createBiomarkerRepository({ client, getUserId }).create(PESO)
    const [, rows] = client._calls.find((c: any) => c[0] === 'insert')
    expect('id' in rows[0]).toBe(false)
  })

  it('id que não é UUID é rejeitado na validação', async () => {
    const client = makeClient({ insertResult: { data: null, error: null } })
    await expect(createBiomarkerRepository({ client, getUserId }).create({ ...PESO, id: 'abc' })).rejects.toThrow(/validação/)
  })

  it('23505 com id informado e linha própria visível → devolve a linha existente (retry não duplica)', async () => {
    const existing = { id: ID, type: 'peso', value: 82.5 }
    const client = makeClient({
      insertResult: { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "biomarkers_log_pkey"' } },
      readResult: { data: existing, error: null },
    })
    const out = await createBiomarkerRepository({ client, getUserId }).create({ ...PESO, id: ID })
    expect(out).toEqual(existing)
    expect(client._calls).toContainEqual(['eq', 'id', ID])
    expect(client._calls).toContainEqual(['eq', 'user_id', USER])
  })

  it('23505 mas a linha não é do usuário (não visível) → propaga o erro original', async () => {
    const err = { code: '23505', message: 'duplicate key' }
    const client = makeClient({ insertResult: { data: null, error: err }, readResult: { data: null, error: null } })
    await expect(createBiomarkerRepository({ client, getUserId }).create({ ...PESO, id: ID })).rejects.toBe(err)
  })

  it('23505 sem id informado → propaga (não é retry nosso)', async () => {
    const err = { code: '23505', message: 'duplicate key' }
    const client = makeClient({ insertResult: { data: null, error: err } })
    await expect(createBiomarkerRepository({ client, getUserId }).create(PESO)).rejects.toBe(err)
  })

  it('outro erro com id informado → propaga sem reler', async () => {
    const err = { code: '42501', message: 'permission denied' }
    const client = makeClient({ insertResult: { data: null, error: err } })
    await expect(createBiomarkerRepository({ client, getUserId }).create({ ...PESO, id: ID })).rejects.toBe(err)
    expect(client._calls.some((c: any) => c[0] === 'eq')).toBe(false)
  })
})
