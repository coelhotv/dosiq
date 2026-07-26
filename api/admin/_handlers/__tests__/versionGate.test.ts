import { describe, it, expect, afterEach, vi } from 'vitest'
import { handleUpdateVersionGate, handleGetVersionGate } from '../versionGate.js'

/**
 * Handler admin do kill switch de versão mínima (spec 051 / RC3-2 F4 · PO-SEC-5).
 *
 * ⚠️ Este é o PRIMEIRO teste em `api/` do projeto (`find api -name '*test*'` era vazio até 2026-07-25).
 * O `include` de `../../api/**` foi adicionado a `vitest.config.js` E `vitest.critical.config.js` no
 * mesmo PR — sem isso o arquivo existiria e NUNCA seria coletado, e `validate:agent` ficaria verde
 * sem rodar o que promete proteger (classe AP-289).
 *
 * O que os 4 casos do acknowledge protegem: a guarda de raio de impacto mora no SERVIDOR, não na
 * tela. Um `PATCH` por curl tem de passar pela mesma cerimônia que o painel — controle que só existe
 * na UI é sugestão.
 */

const ADMIN_UID = 'b0c9746c-c4d9-4954-a198-59856009be26'

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

function makeRes() {
  const res: any = {
    statusCode: null,
    body: null,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
  }
  return res
}

/**
 * Cliente falso. `devices`/`activity` alimentam a contagem de frota; `updateResult` é o retorno do
 * `.update().eq().select().single()`. `captured.patch` guarda o que foi gravado.
 */
function makeSupabase(options: {
  devices?: { data?: unknown; error?: unknown }
  activity?: { data?: unknown; error?: unknown }
  updateResult?: { data?: unknown; error?: unknown }
  listResult?: { data?: unknown; error?: unknown }
} = {}) {
  const captured: { patch?: any; platform?: string } = {}
  const devices = options.devices ?? { data: [], error: null }
  const activity = options.activity ?? { data: [], error: null }
  const updateResult = options.updateResult ?? { data: { platform: 'ios' }, error: null }
  const listResult = options.listResult ?? { data: [], error: null }

  const supabase = {
    captured,
    from(table: string) {
      if (table === 'notification_devices') {
        return { select: () => ({ gte: () => Promise.resolve(devices) }) }
      }
      if (table === 'device_activity') {
        return { select: () => ({ gte: () => Promise.resolve(activity) }) }
      }
      if (table === 'app_version_gate') {
        return {
          select: () => ({ order: () => Promise.resolve(listResult) }),
          update: (patch: any) => {
            captured.patch = patch
            return {
              eq: (_col: string, value: string) => {
                captured.platform = value
                return { select: () => ({ single: () => Promise.resolve(updateResult) }) }
              },
            }
          },
        }
      }
      throw new Error(`tabela inesperada no teste: ${table}`)
    },
  }
  return supabase
}

/** Frota: 3 instalações ios abaixo de 0.29.0, 1 acima, 1 android. Afetadas(ios, 0.29.0) = 3. */
const FROTA = {
  devices: {
    data: [
      { user_id: 'u1', platform: 'ios', app_version: '0.28.0', updated_at: '2026-07-01T10:00:00Z' },
      { user_id: 'u2', platform: 'ios', app_version: '0.27.0', updated_at: '2026-07-01T10:00:00Z' },
      { user_id: 'u3', platform: 'ios', app_version: '0.24.1', updated_at: '2026-07-01T10:00:00Z' },
      { user_id: 'u4', platform: 'ios', app_version: '0.30.0', updated_at: '2026-07-01T10:00:00Z' },
      { user_id: 'u5', platform: 'android', app_version: '0.10.0', updated_at: '2026-07-01T10:00:00Z' },
    ],
    error: null,
  },
  activity: { data: [], error: null },
}

const ativar = (extra: Record<string, unknown> = {}) => ({
  platform: 'ios',
  is_active: true,
  min_supported_version: '0.29.0',
  ...extra,
})

describe('handleUpdateVersionGate — guarda de raio de impacto (PO-SEC-5)', () => {
  it('(a) ativar SEM acknowledge_affected_devices é RECUSADO, nomeando a contagem', async () => {
    const res = makeRes()
    const supabase = makeSupabase(FROTA)

    await handleUpdateVersionGate({ body: ativar() }, res, supabase, ADMIN_UID)

    expect(res.statusCode).toBe(409)
    expect(res.body.affected_devices).toBe(3)
    // A recusa precisa ser informativa: quem opera por curl tem de saber qual número confirmar.
    expect(res.body.error).toMatch(/acknowledge_affected_devices/)
    expect(supabase.captured.patch).toBeUndefined() // nada gravado
  })

  it('(b) acknowledge com número ERRADO é RECUSADO, e a resposta traz o número certo', async () => {
    const res = makeRes()
    const supabase = makeSupabase(FROTA)

    await handleUpdateVersionGate(
      { body: ativar({ acknowledge_affected_devices: 2 }) },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(409)
    expect(res.body.acknowledged).toBe(2)
    expect(res.body.affected_devices).toBe(3)
    expect(supabase.captured.patch).toBeUndefined()
  })

  it('(c) acknowledge com número CERTO grava, com updated_by do admin', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      ...FROTA,
      updateResult: { data: { platform: 'ios', is_active: true }, error: null },
    })

    await handleUpdateVersionGate(
      { body: ativar({ acknowledge_affected_devices: 3 }) },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)
    expect(supabase.captured.platform).toBe('ios')
    expect(supabase.captured.patch.is_active).toBe(true)
    expect(supabase.captured.patch.min_supported_version).toBe('0.29.0')
    expect(supabase.captured.patch.updated_by).toBe(ADMIN_UID)
    // `acknowledge_affected_devices` é cerimônia, não coluna — não pode vazar para o UPDATE.
    expect(supabase.captured.patch).not.toHaveProperty('acknowledge_affected_devices')
  })

  it('(d) DESATIVAR sem acknowledge GRAVA — a assimetria é regra, não borda', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      ...FROTA,
      updateResult: { data: { platform: 'ios', is_active: false }, error: null },
    })

    await handleUpdateVersionGate(
      { body: { platform: 'ios', is_active: false } },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(200)
    expect(supabase.captured.patch.is_active).toBe(false)
  })

  it('acknowledge = 0 é confirmação legítima quando a frota afetada é zero', async () => {
    const res = makeRes()
    // Piso baixo o bastante para não afetar ninguém.
    const supabase = makeSupabase({
      ...FROTA,
      updateResult: { data: { platform: 'ios', is_active: true }, error: null },
    })

    await handleUpdateVersionGate(
      { body: ativar({ min_supported_version: '0.1.0', acknowledge_affected_devices: 0 }) },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(200)
  })

  it('acknowledge exigido também quando a linha JÁ está ativa (evita TOCTOU na transição)', async () => {
    const res = makeRes()
    const supabase = makeSupabase(FROTA)

    // Editar o piso de um gate já ativo muda o raio de impacto tanto quanto ligá-lo.
    await handleUpdateVersionGate(
      { body: ativar({ min_supported_version: '0.28.0' }) },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(409)
    expect(supabase.captured.patch).toBeUndefined()
  })
})

describe('handleUpdateVersionGate — validação do payload', () => {
  it.each([
    ['corpo vazio', {}],
    ['corpo undefined', undefined],
    ['plataforma fora do domínio', { platform: 'web', is_active: false }],
    ['plataforma com caixa errada', { platform: 'IOS', is_active: false }],
    ['is_active ausente', { platform: 'ios' }],
    ['is_active como string', { platform: 'ios', is_active: 'true' }],
    ['piso malformado', { platform: 'ios', is_active: true, min_supported_version: '1.2' }],
    ['piso não-numérico', { platform: 'ios', is_active: true, min_supported_version: 'abc' }],
    ['acknowledge como string', { ...{ platform: 'ios', is_active: true, min_supported_version: '0.29.0' }, acknowledge_affected_devices: '3' }],
    ['acknowledge fracionário', { platform: 'ios', is_active: true, min_supported_version: '0.29.0', acknowledge_affected_devices: 1.5 }],
    ['acknowledge negativo', { platform: 'ios', is_active: true, min_supported_version: '0.29.0', acknowledge_affected_devices: -1 }],
    ['store_url fora da allowlist', { platform: 'ios', is_active: false, store_url: 'https://evil.example.com/app' }],
    ['store_url que só CONTÉM o domínio permitido', { platform: 'ios', is_active: false, store_url: 'https://apps.apple.com.evil.com/x' }],
    ['store_url sem https', { platform: 'ios', is_active: false, store_url: 'http://play.google.com/store' }],
  ])('recusa com 400: %s', async (_label, body) => {
    const res = makeRes()
    const supabase = makeSupabase(FROTA)

    await handleUpdateVersionGate({ body }, res, supabase, ADMIN_UID)

    expect(res.statusCode).toBe(400)
    expect(supabase.captured.patch).toBeUndefined()
  })

  it('ativar SEM piso é recusado — gate "ligado" sem piso válido é inerte em campo e mente no painel', async () => {
    const res = makeRes()
    const supabase = makeSupabase(FROTA)

    await handleUpdateVersionGate(
      { body: { platform: 'ios', is_active: true, acknowledge_affected_devices: 0 } },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(400)
    expect(supabase.captured.patch).toBeUndefined()
  })

  it('aceita store_url dentro da allowlist', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      ...FROTA,
      updateResult: { data: { platform: 'android' }, error: null },
    })

    await handleUpdateVersionGate(
      { body: { platform: 'android', is_active: false, store_url: 'https://play.google.com/store/apps/details?id=app.dosiq' } },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(200)
  })
})

describe('handleUpdateVersionGate — falhas de infraestrutura', () => {
  it('falha na leitura da frota RECUSA a ativação (503) — fail-closed na escrita', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      devices: { data: null, error: { code: '42501', message: 'permission denied' } },
      activity: { data: [], error: null },
    })

    await handleUpdateVersionGate(
      { body: ativar({ acknowledge_affected_devices: 3 }) },
      res,
      supabase,
      ADMIN_UID,
    )

    // Não medir o estrago não pode virar permissão para causá-lo. O fail-OPEN é do cliente (AP-303).
    expect(res.statusCode).toBe(503)
    expect(supabase.captured.patch).toBeUndefined()
  })

  it('falha na fonte aditiva também recusa (a contagem tem de ser a mesma do script)', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      devices: FROTA.devices,
      activity: { data: null, error: { code: '42501', message: 'permission denied' } },
    })

    await handleUpdateVersionGate(
      { body: ativar({ acknowledge_affected_devices: 3 }) },
      res,
      supabase,
      ADMIN_UID,
    )

    expect(res.statusCode).toBe(503)
  })

  it('desativar NÃO depende da frota: funciona mesmo com a leitura quebrada', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      devices: { data: null, error: { code: '42501', message: 'permission denied' } },
      activity: { data: null, error: { code: '42501', message: 'permission denied' } },
      updateResult: { data: { platform: 'ios', is_active: false }, error: null },
    })

    // Destravar a base tem de ser imediato, inclusive quando a telemetria está fora do ar.
    await handleUpdateVersionGate({ body: { platform: 'ios', is_active: false } }, res, supabase, ADMIN_UID)

    expect(res.statusCode).toBe(200)
  })

  it('UPDATE que afeta 0 linhas é FALHA, não sucesso silencioso', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      ...FROTA,
      updateResult: { data: null, error: null },
    })

    // Medido no BEGIN..ROLLBACK deste PR: sob RLS sem policy de escrita, o UPDATE afeta 0 linhas e
    // NÃO levanta erro. Sem esta checagem a UI anunciaria um bloqueio que não foi gravado.
    await handleUpdateVersionGate({ body: { platform: 'ios', is_active: false } }, res, supabase, ADMIN_UID)

    expect(res.statusCode).toBe(500)
  })

  it('linha inexistente devolve 404 (as 2 linhas são semeadas; chegar aqui é anomalia)', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      ...FROTA,
      updateResult: { data: null, error: { code: 'PGRST116', message: 'no rows' } },
    })

    await handleUpdateVersionGate({ body: { platform: 'ios', is_active: false } }, res, supabase, ADMIN_UID)

    expect(res.statusCode).toBe(404)
  })
})

describe('handleGetVersionGate', () => {
  it('devolve as linhas para o painel', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      listResult: { data: [{ platform: 'android' }, { platform: 'ios' }], error: null },
    })

    await handleGetVersionGate({}, res, supabase)

    expect(res.statusCode).toBe(200)
    expect(res.body.data).toHaveLength(2)
  })

  it('erro de leitura devolve 500 sem vazar o erro do banco', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      listResult: { data: null, error: { code: '42P01', message: 'relation does not exist' } },
    })

    await handleGetVersionGate({}, res, supabase)

    expect(res.statusCode).toBe(500)
    expect(JSON.stringify(res.body)).not.toMatch(/relation does not exist/)
  })
})

describe('handleUpdateVersionGate — semântica de substituição', () => {
  it('campo ausente no corpo é gravado como null (substitui, não mescla)', async () => {
    const res = makeRes()
    const supabase = makeSupabase({
      ...FROTA,
      updateResult: { data: { platform: 'ios', is_active: false }, error: null },
    })

    // Desativar sem mandar os outros campos LIMPA o piso, a copy e a URL — de propósito: um piso
    // órfão sobrevivendo à desativação seria reaproveitado sem revisão na próxima ativação.
    await handleUpdateVersionGate({ body: { platform: 'ios', is_active: false } }, res, supabase, ADMIN_UID)

    expect(res.statusCode).toBe(200)
    expect(supabase.captured.patch.min_supported_version).toBeNull()
    expect(supabase.captured.patch.message).toBeNull()
    expect(supabase.captured.patch.store_url).toBeNull()
  })
})
