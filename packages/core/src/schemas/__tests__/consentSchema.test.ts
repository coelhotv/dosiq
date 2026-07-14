import { describe, it, expect } from 'vitest'
import {
  CONSENT_TYPES,
  CONSENT_ACTIONS,
  CONSENT_PLATFORMS,
  CURRENT_POLICY_VERSION,
  HEALTH_CONSENT_COPY,
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

describe('consentSchema — vocabulário espelha os CHECKs do banco', () => {
  it('CONSENT_TYPES = o CHECK de consent_log.consent_type', () => {
    expect([...CONSENT_TYPES]).toEqual(['health_data', 'terms_privacy'])
  })

  it('CONSENT_ACTIONS inclui os 3 atos do CONTROLADOR além dos 2 do titular', () => {
    expect([...CONSENT_ACTIONS]).toEqual([
      'granted',
      'revoked',
      'notice_sent',
      'pruned',
      'account_deleted',
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

  it('o label nomeia explicitamente os dados de saúde tratados (art. 11 — específico)', () => {
    const label = HEALTH_CONSENT_COPY.label.toLowerCase()
    expect(label).toContain('dados de saúde')
    expect(label).toContain('medicamentos')
    expect(label).toContain('adesão')
    expect(label).toContain('biomarcadores')
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

  it('revoked nunca é stale (não há o que revalidar num consentimento retirado)', () => {
    const state = deriveConsentState([{ ...base, action: 'revoked', policy_version: '0.1' }])
    expect(state.status).toBe('revoked')
    expect(state.stale).toBe(false)
  })

  it('entrada não-array não estoura', () => {
    expect(deriveConsentState(undefined as unknown as ConsentEvent[]).status).toBe('missing')
  })
})
