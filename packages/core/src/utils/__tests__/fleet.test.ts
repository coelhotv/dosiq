import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  dedupeFleetInstalls,
  summarizeFleetVersions,
  countAffectedInstalls,
  fleetWindowStart,
  FLEET_WINDOW_DAYS,
} from '../fleet'

/**
 * Contagem de frota (spec 051 / RC3-2 F3).
 *
 * O que estes testes protegem: o número que sai daqui é o que o operador confirma em
 * `acknowledge_affected_devices` antes de bloquear o boot da base instalada. Contagem errada = ou
 * recusa falsa em plena emergência, ou confirmação sobre um conjunto diferente do que será
 * bloqueado.
 */

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

/** Linha de `notification_devices` (campo de tempo: `updated_at`). */
const dev = (user: string, platform: string, version: string | null, updated_at: string) => ({
  user_id: user,
  platform,
  app_version: version,
  updated_at,
})

/** Linha de `device_activity` (campo de tempo: `last_seen_at`). */
const act = (user: string, platform: string, version: string | null, last_seen_at: string) => ({
  user_id: user,
  platform,
  app_version: version,
  last_seen_at,
})

describe('dedupeFleetInstalls', () => {
  it('une as duas fontes e conta uma instalação por (user_id, platform)', () => {
    const installs = dedupeFleetInstalls(
      [dev('u1', 'ios', '0.28.0', '2026-07-01T10:00:00Z')],
      [act('u2', 'android', '0.29.0', '2026-07-02T10:00:00Z')],
    )
    expect(installs).toHaveLength(2)
  })

  it('dedupe cruzado entre fontes mantém a linha MAIS RECENTE', () => {
    // O mesmo usuário aparece nas duas fontes; a activity é mais nova e tem outra versão.
    const installs = dedupeFleetInstalls(
      [dev('u1', 'ios', '0.27.0', '2026-07-01T10:00:00Z')],
      [act('u1', 'ios', '0.29.1', '2026-07-20T10:00:00Z')],
    )
    expect(installs).toHaveLength(1)
    expect(installs[0].appVersion).toBe('0.29.1')
  })

  it('mesmo usuário em plataformas diferentes são DUAS instalações', () => {
    const installs = dedupeFleetInstalls(
      [dev('u1', 'ios', '0.28.0', '2026-07-01T10:00:00Z'), dev('u1', 'android', '0.28.0', '2026-07-01T10:00:00Z')],
      [],
    )
    expect(installs).toHaveLength(2)
  })

  it('usuário com 3 aparelhos antigos na mesma plataforma pesa 1, não 3', () => {
    const installs = dedupeFleetInstalls(
      [
        dev('u1', 'android', '0.20.0', '2026-06-01T10:00:00Z'),
        dev('u1', 'android', '0.24.1', '2026-06-15T10:00:00Z'),
        dev('u1', 'android', '0.28.3', '2026-07-01T10:00:00Z'),
      ],
      [],
    )
    expect(installs).toHaveLength(1)
    expect(installs[0].appVersion).toBe('0.28.3')
  })

  // `notification_devices.app_version` é NULLABLE no banco (verificado 2026-07-25).
  it('ignora linha sem app_version em vez de inventar uma versão', () => {
    const installs = dedupeFleetInstalls(
      [dev('u1', 'ios', null, '2026-07-01T10:00:00Z'), dev('u2', 'ios', '0.29.0', '2026-07-01T10:00:00Z')],
      [],
    )
    expect(installs).toHaveLength(1)
    expect(installs[0].userId).toBe('u2')
  })

  it('ignora linha sem user_id ou sem platform', () => {
    const installs = dedupeFleetInstalls(
      [
        { platform: 'ios', app_version: '0.29.0', updated_at: '2026-07-01T10:00:00Z' },
        { user_id: 'u1', app_version: '0.29.0', updated_at: '2026-07-01T10:00:00Z' },
      ],
      [],
    )
    expect(installs).toHaveLength(0)
  })

  // O PostgREST devolve OBJETO de erro no lugar do array quando a leitura falha (permissão/config).
  it('não estoura quando a fonte vem como objeto de erro, null ou undefined', () => {
    expect(dedupeFleetInstalls({ code: '42501', message: 'permission denied' }, null)).toEqual([])
    expect(dedupeFleetInstalls(undefined, undefined)).toEqual([])
    expect(dedupeFleetInstalls([], [])).toEqual([])
  })

  it('timestamp ilegível nunca vence a linha com timestamp válido', () => {
    const installs = dedupeFleetInstalls(
      [dev('u1', 'ios', '0.28.0', '2026-07-01T10:00:00Z'), dev('u1', 'ios', '0.10.0', 'não é data')],
      [],
    )
    expect(installs).toHaveLength(1)
    expect(installs[0].appVersion).toBe('0.28.0')
  })
})

describe('summarizeFleetVersions', () => {
  it('agrupa por versão, conta usuários distintos e ordena da mais nova para a mais antiga', () => {
    const installs = dedupeFleetInstalls(
      [
        dev('u1', 'ios', '0.29.1', '2026-07-20T10:00:00Z'),
        dev('u2', 'ios', '0.29.1', '2026-07-20T10:00:00Z'),
        dev('u3', 'android', '0.6.2', '2026-07-19T10:00:00Z'),
      ],
      [],
    )
    const s = summarizeFleetVersions(installs)

    expect(s.totalInstalls).toBe(3)
    expect(s.totalUsers).toBe(3)
    expect(s.byVersion.map((b) => b.version)).toEqual(['0.29.1', '0.6.2'])
    expect(s.byVersion[0]).toEqual({ version: '0.29.1', installs: 2, users: 2 })
    expect(s.oldestVersion).toBe('0.6.2')
  })

  it('frota vazia devolve zeros e oldestVersion null (0 é resultado, não ausência)', () => {
    const s = summarizeFleetVersions([])
    expect(s.totalInstalls).toBe(0)
    expect(s.totalUsers).toBe(0)
    expect(s.byVersion).toEqual([])
    expect(s.oldestVersion).toBeNull()
  })

  it('ordena numericamente, não lexicograficamente (0.10.0 é MAIS NOVA que 0.9.0)', () => {
    const installs = dedupeFleetInstalls(
      [dev('u1', 'ios', '0.9.0', '2026-07-01T10:00:00Z'), dev('u2', 'ios', '0.10.0', '2026-07-01T10:00:00Z')],
      [],
    )
    expect(summarizeFleetVersions(installs).byVersion.map((b) => b.version)).toEqual(['0.10.0', '0.9.0'])
  })
})

describe('countAffectedInstalls', () => {
  const installs = dedupeFleetInstalls(
    [
      dev('u1', 'ios', '0.28.0', '2026-07-01T10:00:00Z'), // abaixo do piso  -> afetada
      dev('u2', 'ios', '0.29.0', '2026-07-01T10:00:00Z'), // igual ao piso   -> ok
      dev('u3', 'ios', '0.30.0', '2026-07-01T10:00:00Z'), // acima do piso   -> ok
      dev('u4', 'android', '0.10.0', '2026-07-01T10:00:00Z'), // outra plataforma
    ],
    [],
  )

  it('conta só a plataforma pedida e só quem está ABAIXO do piso', () => {
    expect(countAffectedInstalls(installs, { platform: 'ios', minSupportedVersion: '0.29.0' })).toBe(1)
  })

  it('versão igual ao piso NÃO é afetada (o piso é inclusivo)', () => {
    expect(countAffectedInstalls(installs, { platform: 'ios', minSupportedVersion: '0.28.0' })).toBe(0)
  })

  it('não vaza contagem entre plataformas', () => {
    expect(countAffectedInstalls(installs, { platform: 'android', minSupportedVersion: '0.29.0' })).toBe(1)
  })

  // 🔴 Assimetria deliberada: no CLIENTE, indeterminado ABRE (AP-303). Aqui, indeterminado CONTA —
  // este número existe para medir o estrago antes de causá-lo, e subestimar o estrago é o erro que
  // importa. As duas escolhas são a mesma política: errar para o lado de não prejudicar o usuário.
  it('versão instalada ilegível conta como AFETADA (fail-closed na escrita)', () => {
    const sujas = dedupeFleetInstalls(
      [
        dev('u1', 'ios', 'abc', '2026-07-01T10:00:00Z'),
        dev('u2', 'ios', '', '2026-07-01T10:00:00Z'), // string vazia é ignorada no dedupe
        dev('u3', 'ios', '1.2.3.4-beta+build', '2026-07-01T10:00:00Z'), // parse ok → 1.2.3, acima do piso
      ],
      [],
    )
    // Só `abc` é indeterminada: `''` não entra na frota e `1.2.3.4-beta+build` parseia como 1.2.3.
    expect(countAffectedInstalls(sujas, { platform: 'ios', minSupportedVersion: '0.29.0' })).toBe(1)
  })

  // Comportamento REAL de `parseSemver` (utils/semver.ts), medido — não suposto: 2 componentes são
  // aceitos e o patch vira 0. Ou seja `'0.29'` é lido como `0.29.0` e NÃO é indeterminado.
  // Fica assere aqui porque é assimetria com o Zod da ESCRITA, que exige X.Y.Z: a leitura é
  // tolerante de propósito (AP-303), e quem for endurecer a leitura tem de derrubar este teste.
  it('versão com 2 componentes é lida como X.Y.0, não como indeterminada', () => {
    const duas = dedupeFleetInstalls([dev('u1', 'ios', '0.29', '2026-07-01T10:00:00Z')], [])
    expect(countAffectedInstalls(duas, { platform: 'ios', minSupportedVersion: '0.29.0' })).toBe(0)
    expect(countAffectedInstalls(duas, { platform: 'ios', minSupportedVersion: '0.29.1' })).toBe(1)
  })

  it('piso ausente ou inválido devolve 0 — sem piso não há bloqueio', () => {
    expect(countAffectedInstalls(installs, { platform: 'ios', minSupportedVersion: null })).toBe(0)
    expect(countAffectedInstalls(installs, { platform: 'ios', minSupportedVersion: undefined })).toBe(0)
    expect(countAffectedInstalls(installs, { platform: 'ios', minSupportedVersion: 'abc' })).toBe(0)
  })

  it('frota vazia devolve 0', () => {
    expect(countAffectedInstalls([], { platform: 'ios', minSupportedVersion: '0.29.0' })).toBe(0)
  })
})

/**
 * BASELINE DA CLASSE DE BUG (R-300).
 *
 * A classe de bug que este módulo existe para matar não é "conta errado": é **duas implementações
 * divergindo em silêncio** — a do `scripts/fleet-versions.sh` (que o operador lê) e a do handler
 * admin (que valida o acknowledge). Então o teste carrega a lógica ANTIGA, a que vivia no heredoc
 * `node -e` do script antes da spec 051, e assere que as duas produzem o MESMO número sobre a mesma
 * fixture — inclusive na fixture torta que motivou o guard.
 *
 * Sem esta baseline, verde não distingue "as implementações concordam" de "a fixture nunca exercitou
 * o ponto em que discordavam".
 */
function contagemAntiga(rows: unknown[], activity: unknown[]) {
  const activityRows = (Array.isArray(activity) ? activity : []).map((r: any) => ({
    app_version: r.app_version,
    platform: r.platform,
    user_id: r.user_id,
    updated_at: r.last_seen_at,
  }))
  const merged = (rows as any[]).concat(activityRows)
  const latest = new Map<string, any>()
  for (const r of merged) {
    if (!r.app_version) continue
    const key = `${r.user_id}|${r.platform}`
    const prev = latest.get(key)
    if (!prev || new Date(r.updated_at) > new Date(prev.updated_at)) latest.set(key, r)
  }
  return [...latest.values()]
}

describe('paridade com a implementação anterior (R-300)', () => {
  const rows = [
    dev('u1', 'ios', '0.27.0', '2026-07-01T10:00:00Z'),
    dev('u1', 'ios', '0.24.1', '2026-06-01T10:00:00Z'),
    dev('u2', 'android', '0.28.3', '2026-07-05T10:00:00Z'),
    dev('u3', 'ios', null, '2026-07-05T10:00:00Z'),
    dev('u4', 'ios', '0.6.2', '2026-07-06T10:00:00Z'),
  ]
  const activity = [
    act('u1', 'ios', '0.29.1', '2026-07-20T10:00:00Z'), // vence o device: mais recente
    act('u5', 'android', '0.29.1', '2026-07-21T10:00:00Z'), // só existe na fonte aditiva
    act('u2', 'android', '0.22.0', '2026-06-02T10:00:00Z'), // perde: mais antiga que o device
  ]

  it('mesmo total de instalações e usuários', () => {
    const antiga = contagemAntiga(rows, activity)
    const nova = dedupeFleetInstalls(rows, activity)
    expect(nova).toHaveLength(antiga.length)
    expect(new Set(nova.map((i) => i.userId))).toEqual(new Set(antiga.map((r) => r.user_id)))
  })

  it('mesma versão vencedora por (user_id, platform)', () => {
    const antiga = new Map(contagemAntiga(rows, activity).map((r) => [`${r.user_id}|${r.platform}`, r.app_version]))
    const nova = new Map(dedupeFleetInstalls(rows, activity).map((i) => [`${i.userId}|${i.platform}`, i.appVersion]))
    expect(nova).toEqual(antiga)
  })
})

describe('fleetWindowStart', () => {
  it('devolve YYYY-MM-DD 30 dias antes do instante recebido', () => {
    // Recebe o "agora" em vez de olhar o relógio — testável sem mock de tempo.
    expect(fleetWindowStart(new Date('2026-07-25T12:00:00Z'))).toBe('2026-06-25')
    expect(FLEET_WINDOW_DAYS).toBe(30)
  })

  it('respeita janela customizada', () => {
    expect(fleetWindowStart(new Date('2026-07-25T12:00:00Z'), 1)).toBe('2026-07-24')
  })
})
