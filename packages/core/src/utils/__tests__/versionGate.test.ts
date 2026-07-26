import { describe, it, expect } from 'vitest'
import { resolveVersionGate, type VersionGateRow } from '../versionGate'

/**
 * Kill switch de versão mínima (spec 051-A / ADR-091 / CON-033).
 *
 * Uma asserção por linha da tabela-verdade normativa (CON-033 §1) — cada teste É a linha, não uma
 * paráfrase dela. Alterar uma decisão aqui exige emenda ao ADR-091.
 */

const row = (overrides: Partial<VersionGateRow> = {}): VersionGateRow => ({
  is_active: true,
  min_supported_version: '2.0.0',
  message: null,
  store_url: null,
  ...overrides,
})

describe('resolveVersionGate', () => {
  it('gateRow == null (offline, timeout, erro do PostgREST, linha ausente) ⇒ ABRE', () => {
    expect(resolveVersionGate('1.0.0', null)).toEqual({ blocked: false })
    expect(resolveVersionGate('1.0.0', undefined)).toEqual({ blocked: false })
  })

  it('is_active === false ⇒ ABRE mesmo com instalada abaixo do piso', () => {
    expect(resolveVersionGate('1.0.0', row({ is_active: false, min_supported_version: '2.0.0' }))).toEqual({
      blocked: false,
    })
  })

  it('compareSemver(instalada, min) === null por min inválido ⇒ ABRE', () => {
    expect(resolveVersionGate('1.0.0', row({ min_supported_version: 'abc' }))).toEqual({ blocked: false })
  })

  it('compareSemver(instalada, min) === null por versão instalada inválida ⇒ ABRE', () => {
    expect(resolveVersionGate('abc', row({ min_supported_version: '2.0.0' }))).toEqual({ blocked: false })
    expect(resolveVersionGate(null, row({ min_supported_version: '2.0.0' }))).toEqual({ blocked: false })
    expect(resolveVersionGate(undefined, row({ min_supported_version: '2.0.0' }))).toEqual({ blocked: false })
  })

  it('compareSemver(instalada, min) === -1 ⇒ BLOQUEIA, carregando message e storeUrl', () => {
    expect(
      resolveVersionGate(
        '1.0.0',
        row({ min_supported_version: '2.0.0', message: 'Atualize', store_url: 'https://apps.apple.com/x' }),
      ),
    ).toEqual({ blocked: true, message: 'Atualize', storeUrl: 'https://apps.apple.com/x' })
  })

  it('bloqueio sem message/store_url na linha ⇒ carrega null (consumidor cai para copy compilada)', () => {
    expect(resolveVersionGate('1.0.0', row({ min_supported_version: '2.0.0' }))).toEqual({
      blocked: true,
      message: null,
      storeUrl: null,
    })
  })

  it('qualquer outro caso (instalada igual ao piso) ⇒ ABRE', () => {
    expect(resolveVersionGate('2.0.0', row({ min_supported_version: '2.0.0' }))).toEqual({ blocked: false })
  })

  it('qualquer outro caso (instalada acima do piso) ⇒ ABRE', () => {
    expect(resolveVersionGate('3.0.0', row({ min_supported_version: '2.0.0' }))).toEqual({ blocked: false })
  })

  it('min_supported_version null com is_active=true ⇒ compareSemver devolve null ⇒ ABRE', () => {
    expect(resolveVersionGate('1.0.0', row({ min_supported_version: null }))).toEqual({ blocked: false })
  })
})
