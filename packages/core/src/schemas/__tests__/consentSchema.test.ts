import { describe, it, expect } from 'vitest'
import {
  CONSENT_TYPES,
  CONSENT_ACTIONS,
  PRUNE_REASONS,
  PRUNE_DECISIONS,
  consentCopyBodySchema,
  renderDeadlineCopy,
  NEVER_CONSENTED_DEADLINE_COPY,
  CONSENT_PLATFORMS,
  CURRENT_POLICY_VERSION,
  HEALTH_CONSENT_COPY,
  TRANSFER_CONSENT_COPY,
  consentEventSchema,
  deriveConsentState,
  type ConsentEvent,
} from '../consentSchema'

// 046 Slice A — vocabulário + copy canônica.
// Os enums aqui espelham CHECK constraints do Postgres. Divergir = o app oferece um valor que o
// banco rejeita (ou pior: para de oferecer um que o banco ainda aceita, e a trilha fica incompleta).

const base: ConsentEvent = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  consent_type: 'health_data',
  action: 'granted',
  policy_version: CURRENT_POLICY_VERSION,
  platform: 'web',
  created_at: '2026-07-14T10:00:00.000Z',
}

// Spec 096 (T025): as caixas A e B são citadas VERBATIM pela política v0.4 (§5 e §13). Frases
// fixadas a partir de docs/legal/POLITICA_DE_PRIVACIDADE_v0.4.md (B1, PR #896, l. 131 e 265) —
// mudou a copy, muda a política, e este teste fica vermelho até as duas baterem.
const POLICY_V04_BOX_A =
  'Autorizo o uso dos meus dados de saúde para lembretes, histórico, adesão e melhoria do app. Tenho 18 anos ou mais.'
const POLICY_V04_BOX_B =
  'Autorizo enviar meus dados de saúde para fora do Brasil (EUA) para notificações detalhadas, assistente IA e medições de uso. Opcional.'

describe('consentSchema — copy v0.4 = texto da política', () => {
  it('versão vigente é 0.4', () => {
    expect(CURRENT_POLICY_VERSION).toBe('0.4')
  })
  it('caixa A idêntica à política §5', () => {
    expect(HEALTH_CONSENT_COPY.label).toBe(POLICY_V04_BOX_A)
  })
  it('caixa B idêntica à política §13', () => {
    expect(TRANSFER_CONSENT_COPY.label).toBe(POLICY_V04_BOX_B)
  })
})

describe('consentSchema — vocabulário espelha os CHECKs do banco', () => {
  it('CONSENT_TYPES = o CHECK de consent_log.consent_type', () => {
    expect([...CONSENT_TYPES]).toEqual(['health_data', 'terms_privacy', 'international_transfer'])
  })

  it('CONSENT_ACTIONS inclui os 4 atos do CONTROLADOR além dos 2 do titular (CHECK de 2026-10-20)', () => {
    expect([...CONSENT_ACTIONS]).toEqual([
      'granted',
      'revoked',
      'notice_sent',
      'pruned',
      'account_deleted',
      'scheduled_deletion',
    ])
  })

  it('CONSENT_PLATFORMS = o CHECK de consent_log.platform', () => {
    expect([...CONSENT_PLATFORMS]).toEqual(['web', 'mobile', 'server'])
  })

  it('o evento não carrega subject_hash nem user_id (S4 — fora do grant de coluna)', () => {
    const parsed = consentEventSchema.parse({ ...base, subject_hash: 'x', user_id: 'y' })
    expect(parsed).not.toHaveProperty('subject_hash')
    expect(parsed).not.toHaveProperty('user_id')
  })

  it('rejeita ação fora do domínio', () => {
    const r = consentEventSchema.safeParse({ ...base, action: 'inventada' })
    expect(r.success).toBe(false)
  })
})

describe('consentSchema — copy canônica do opt-in', () => {
  it('a copy é congelada (nenhuma tela pode editá-la em runtime)', () => {
    expect(Object.isFrozen(HEALTH_CONSENT_COPY)).toBe(true)
  })

  it('o label nomeia o dado e as finalidades (art. 11 — específico; exemplos vão à folha S6-A na v0.4)', () => {
    const label = HEALTH_CONSENT_COPY.label.toLowerCase()
    expect(label).toContain('dados de saúde')
    expect(label).toContain('lembretes')
    expect(label).toContain('adesão')
  })

  it('o label embute a auto-declaração de idade 18+ no mesmo ato (spec 096 — ECA Digital)', () => {
    expect(HEALTH_CONSENT_COPY.label.toLowerCase()).toContain('18 anos ou mais')
  })

  it('a caixa B é congelada e se declara opcional (guarda 4)', () => {
    expect(Object.isFrozen(TRANSFER_CONSENT_COPY)).toBe(true)
    expect(TRANSFER_CONSENT_COPY.label).toContain('Opcional.')
  })

  it('o aviso de revogação informa o prune de 90 dias e as saídas do titular', () => {
    expect(HEALTH_CONSENT_COPY.revokeWarning).toContain('90 dias')
    expect(HEALTH_CONSENT_COPY.revokeWarning.toLowerCase()).toContain('exportar')
    expect(HEALTH_CONSENT_COPY.revokeWarning.toLowerCase()).toContain('excluir')
  })
})

describe('deriveConsentState', () => {
  it('sem eventos → missing', () => {
    expect(deriveConsentState([])).toEqual({
      status: 'missing',
      policyVersion: null,
      updatedAt: null,
      stale: false,
    })
  })

  it('ordena por created_at desc — a ordem de chegada não importa', () => {
    const state = deriveConsentState([
      { ...base, action: 'granted', created_at: '2026-07-10T10:00:00.000Z' },
      { ...base, action: 'revoked', created_at: '2026-07-12T10:00:00.000Z' },
    ])
    expect(state.status).toBe('revoked')
  })

  it('re-consentimento depois da revogação → granted', () => {
    const state = deriveConsentState([
      { ...base, action: 'revoked', created_at: '2026-07-10T10:00:00.000Z' },
      { ...base, action: 'granted', created_at: '2026-07-12T10:00:00.000Z' },
    ])
    expect(state.status).toBe('granted')
    expect(state.stale).toBe(false)
  })

  it('só atos do controlador → missing (não dizem nada sobre a vontade do titular)', () => {
    const state = deriveConsentState([
      { ...base, action: 'notice_sent' },
      { ...base, action: 'account_deleted' },
    ])
    expect(state.status).toBe('missing')
  })

  it('granted em versão antiga → stale', () => {
    const state = deriveConsentState([{ ...base, policy_version: '0.1' }])
    expect(state).toMatchObject({ status: 'granted', policyVersion: '0.1', stale: true })
  })

  // 096 — o servidor carimba a versão VIGENTE no aceite. App com constante antiga que recebe um
  // aceite carimbado com versão mais nova não pode tratá-lo como "diferente" (loop de regularização).
  describe('ordem de versão (096)', () => {
    const [major, minor] = CURRENT_POLICY_VERSION.split('.').map(Number)
    const newer = `${major}.${minor + 1}`

    it('aceite mais novo que o app ⇒ não stale', () => {
      const state = deriveConsentState([{ ...base, policy_version: newer }])
      expect(state).toMatchObject({ status: 'granted', policyVersion: newer, stale: false })
    })

    it('aceite na mesma versão do app ⇒ não stale', () => {
      const state = deriveConsentState([{ ...base, policy_version: CURRENT_POLICY_VERSION }])
      expect(state.stale).toBe(false)
    })

    it('ordem numérica, não lexical (segmento de 2 dígitos, ex. 0.13 > 0.3)', () => {
      const state = deriveConsentState([{ ...base, policy_version: `${major}.${minor + 10}` }])
      expect(state.stale).toBe(false)
    })

    it.each(['', 'abc', '4', null])('versão aceita ilegível (%j) ⇒ stale (lado seguro)', (v) => {
      const state = deriveConsentState([{ ...base, policy_version: v as string }])
      expect(state).toMatchObject({ status: 'granted', stale: true })
    })
  })

  it('revoked nunca é stale (não há o que revalidar num consentimento retirado)', () => {
    const state = deriveConsentState([{ ...base, action: 'revoked', policy_version: '0.1' }])
    expect(state.status).toBe('revoked')
    expect(state.stale).toBe(false)
  })

  it('entrada não-array não estoura', () => {
    expect(deriveConsentState(undefined as unknown as ConsentEvent[]).status).toBe('missing')
  })
})

describe('deriveConsentState — desempate de created_at (046 T013e)', () => {
  const evento = (over: Record<string, unknown>) => ({
    id: '11111111-1111-4111-8111-111111111111',
    consent_type: 'health_data' as const,
    action: 'granted' as const,
    policy_version: '0.3',
    platform: 'web' as const,
    created_at: '2026-08-20T10:00:00.000Z',
    ...over,
  })

  it('`seq` decide quando os timestamps empatam (dois atos na MESMA transação)', () => {
    const empatados = [
      evento({ id: '22222222-2222-4222-8222-222222222222', action: 'revoked', seq: 10 }),
      evento({ id: '33333333-3333-4333-8333-333333333333', action: 'granted', seq: 11 }),
    ]
    expect(deriveConsentState(empatados as never).status).toBe('granted')
    // A ordem de entrada não pode mudar a resposta — é o ponto do desempate.
    expect(deriveConsentState([...empatados].reverse() as never).status).toBe('granted')
  })

  it('sem `seq` (client, que não tem GRANT na coluna) a saída ainda é ESTÁVEL', () => {
    const a = evento({ id: '44444444-4444-4444-8444-444444444444', action: 'revoked' })
    const b = evento({ id: '55555555-5555-4555-8555-555555555555', action: 'granted' })
    const um = deriveConsentState([a, b] as never).status
    const outro = deriveConsentState([b, a] as never).status
    expect(um).toBe(outro)
  })

  it('timestamp diferente continua mandando — `seq` é só desempate', () => {
    const antigo = evento({ action: 'granted', created_at: '2026-08-19T10:00:00.000Z', seq: 99 })
    const recente = evento({ id: '66666666-6666-4666-8666-666666666666', action: 'revoked', created_at: '2026-08-20T10:00:00.000Z', seq: 1 })
    expect(deriveConsentState([antigo, recente] as never).status).toBe('revoked')
  })
})


describe('spec 107 — fila e texto da trava', () => {
  it('PRUNE_REASONS e PRUNE_DECISIONS = os CHECKs de prune_queue', () => {
    expect([...PRUNE_REASONS]).toEqual(['revoked_90d', 'legacy_no_consent', 'onboarding_no_consent', 'unconfirmed_signup'])
    expect([...PRUNE_DECISIONS]).toEqual(['pending', 'approved', 'deferred', 'void'])
  })

  it('consentCopyBodySchema recusa os 5 casos do PO-SEC-3 e aceita o texto aprovado', () => {
    const casos = [
      '<b>autorize</b> até {data} por favor, obrigado',
      'Sem marcador de data neste texto aqui, só palavras',
      'Excluímos em {data} e depois em {data}, repetido',
      'Excluímos em {data} para {nome}, texto qualquer',
      'x'.repeat(601) + '{data}',
      '',
      '   {data}   ',
    ]
    for (const c of casos) expect(consentCopyBodySchema.safeParse(c).success).toBe(false)
    expect(consentCopyBodySchema.safeParse(NEVER_CONSENTED_DEADLINE_COPY.body).success).toBe(true)
  })

  it('renderDeadlineCopy troca {data}; texto inválido ou ausente cai no fallback embarcado', () => {
    expect(renderDeadlineCopy('Sua conta será excluída em {data}, autorize.', '20/01/2027'))
      .toBe('Sua conta será excluída em 20/01/2027, autorize.')
    for (const ruim of [null, undefined, '<script>{data}</script> texto longo', 'sem data alguma no texto aqui']) {
      const out = renderDeadlineCopy(ruim, '20/01/2027')
      expect(out).toContain('20/01/2027')
      expect(out).toBe(NEVER_CONSENTED_DEADLINE_COPY.body.replace('{data}', '20/01/2027'))
    }
  })
})
