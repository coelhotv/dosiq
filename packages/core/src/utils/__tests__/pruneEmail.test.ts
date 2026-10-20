import { describe, it, expect, afterEach, vi } from 'vitest'
import { buildPruneEmail, pruneEmailVariant, PRUNE_EMAIL_LINKS, type PruneEmailVariant } from '../pruneEmail'

/** spec 107 FR-015 — e-mails da fila: variante certa, links visíveis, nenhum dado de saúde. */

afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })

const VARIANTS: PruneEmailVariant[] = ['revoked', 'never_consented', 'reaviso']

describe('pruneEmailVariant', () => {
  it('reaviso vence; revogado ≠ nunca autorizou; onda 2 sem linha = nunca autorizou', () => {
    expect(pruneEmailVariant('revoked_90d', 'reaviso')).toBe('reaviso')
    expect(pruneEmailVariant('revoked_90d', 'd60')).toBe('revoked')
    expect(pruneEmailVariant('legacy_no_consent', 'd83')).toBe('never_consented')
    expect(pruneEmailVariant('onboarding_no_consent', 'd60')).toBe('never_consented')
    expect(pruneEmailVariant(null, 'wave2')).toBe('never_consented')
  })
})

describe('buildPruneEmail', () => {
  it.each(VARIANTS)('%s: prazo no assunto/corpo, sem placeholder, sem termo de saúde', (v) => {
    const e = buildPruneEmail(v, '27/10/2026')
    for (const part of [e.html, e.text]) {
      expect(part).toContain('27/10/2026')
      expect(part).not.toContain('{prazo}')
      // URLs fora da checagem: o nome da loja contém "doses" e não é dado do titular
      const prose = part.replace(/(https:\/\/)?[a-z.]+\.(com|app)\/\S*/g, '').toLowerCase()
      expect(prose).not.toMatch(/medicament|remédio|dose|tratamento|comprimido|doença|diagnóstico/)
    }
    expect(e.subject).not.toContain('{prazo}')
  })

  it.each(VARIANTS)('%s: todos os links (lojas, web, política, termos), URL visível, frase anti-phishing', (v) => {
    const e = buildPruneEmail(v, '27/10/2026')
    for (const url of [PRUNE_EMAIL_LINKS.appStore, PRUNE_EMAIL_LINKS.googlePlay, PRUNE_EMAIL_LINKS.web, PRUNE_EMAIL_LINKS.privacy, PRUNE_EMAIL_LINKS.terms]) {
      expect(e.html).toContain(`href="${url}"`)
      expect(e.text).toContain(url)
    }
    expect(e.html).toContain(`>${PRUNE_EMAIL_LINKS.appStore.replace('https://', '')}</a>`)
    // só domínios nossos ou das lojas
    const hosts = [...e.html.matchAll(/href="https:\/\/([^/"]+)/g)].map((m) => m[1])
    expect(new Set(hosts)).toEqual(new Set(['apps.apple.com', 'play.google.com', 'dosiq.app']))
    expect(e.text).toContain('nunca pede senha')
    expect(e.text).toContain('CNPJ 68.335.606/0001-11')
  })

  it('revogado não diz "ainda não autorizou"; nunca autorizou não diz "retirou"', () => {
    expect(buildPruneEmail('revoked', 'x').text).not.toContain('ainda não autorizou')
    expect(buildPruneEmail('never_consented', 'x').text).not.toContain('retirou')
    expect(buildPruneEmail('reaviso', 'x').subject).toMatch(/^Último aviso/)
  })

  it('data com HTML é escapada', () => {
    expect(buildPruneEmail('revoked', '<b>x</b>').html).not.toContain('<b>x</b>')
  })
})
