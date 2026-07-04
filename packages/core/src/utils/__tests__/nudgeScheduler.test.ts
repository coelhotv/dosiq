import { describe, it, expect } from 'vitest'
import { buildNudgeList, dismissKey } from '../nudgeScheduler'

const makeNudge = (overrides = {}) => ({
  id: 'test-nudge',
  version: 1,
  title: 'Teste',
  body: 'Corpo',
  target_view: 'dashboard',
  action_type: 'dismiss_only',
  action_payload: null,
  min_app_version: null,
  max_app_version: null,
  platform: 'all',
  priority: 0,
  is_active: true,
  start_at: null,
  end_at: null,
  ...overrides,
})

describe('dismissKey', () => {
  it('gera chave no formato id:version', () => {
    expect(dismissKey({ id: 'tz-reconcile', version: 1 })).toBe('tz-reconcile:1')
    expect(dismissKey({ id: 'foo', version: 3 })).toBe('foo:3')
  })
})

describe('buildNudgeList', () => {
  describe('filtragem de plataforma', () => {
    it('inclui nudge platform=all', () => {
      const n = makeNudge({ platform: 'all' })
      expect(buildNudgeList([n], [], { platform: 'ios' })).toHaveLength(1)
    })

    it('inclui nudge da plataforma correta', () => {
      const n = makeNudge({ platform: 'ios' })
      expect(buildNudgeList([n], [], { platform: 'ios' })).toHaveLength(1)
    })

    it('exclui nudge de outra plataforma', () => {
      const n = makeNudge({ platform: 'android' })
      expect(buildNudgeList([n], [], { platform: 'ios' })).toHaveLength(0)
    })
  })

  describe('filtragem por datas', () => {
    const now = new Date('2026-06-08T12:00:00Z')

    it('exclui nudge com start_at no futuro', () => {
      const n = makeNudge({ start_at: '2026-06-09T00:00:00Z' })
      expect(buildNudgeList([n], [], { platform: 'all', now })).toHaveLength(0)
    })

    it('exclui nudge com end_at no passado', () => {
      const n = makeNudge({ end_at: '2026-06-07T00:00:00Z' })
      expect(buildNudgeList([n], [], { platform: 'all', now })).toHaveLength(0)
    })

    it('inclui nudge dentro da janela', () => {
      const n = makeNudge({ start_at: '2026-06-01T00:00:00Z', end_at: '2026-06-30T00:00:00Z' })
      expect(buildNudgeList([n], [], { platform: 'all', now })).toHaveLength(1)
    })
  })

  describe('filtragem por versão', () => {
    it('exclui nudge abaixo do min_app_version', () => {
      const n = makeNudge({ min_app_version: '1.0.0' })
      expect(buildNudgeList([n], [], { platform: 'all', appVersion: '0.9.0' })).toHaveLength(0)
    })

    it('exclui nudge acima do max_app_version', () => {
      const n = makeNudge({ max_app_version: '0.14.0' })
      expect(buildNudgeList([n], [], { platform: 'all', appVersion: '0.15.0' })).toHaveLength(0)
    })

    it('inclui nudge dentro do intervalo de versão', () => {
      const n = makeNudge({ min_app_version: '0.14.0', max_app_version: '1.0.0' })
      expect(buildNudgeList([n], [], { platform: 'all', appVersion: '0.15.0' })).toHaveLength(1)
    })

    it('inclui nudge sem restrição de versão', () => {
      const n = makeNudge()
      expect(buildNudgeList([n], [], { platform: 'all', appVersion: '99.0.0' })).toHaveLength(1)
    })
  })

  describe('filtragem de dispensados', () => {
    it('exclui nudge já dispensado', () => {
      const n = makeNudge({ id: 'foo', version: 1 })
      const dismissed = new Set(['foo:1'])
      expect(buildNudgeList([n], [], { platform: 'all', dismissed })).toHaveLength(0)
    })

    it('inclui nudge nova versão mesmo se versão anterior foi dispensada', () => {
      const n = makeNudge({ id: 'foo', version: 2 })
      const dismissed = new Set(['foo:1'])
      expect(buildNudgeList([n], [], { platform: 'all', dismissed })).toHaveLength(1)
    })
  })

  describe('prioridade', () => {
    it('ordena por prioridade decrescente', () => {
      const low = makeNudge({ id: 'low', priority: 0 })
      const high = makeNudge({ id: 'high', priority: 10 })
      const result = buildNudgeList([low, high], [], { platform: 'all' })
      expect(result[0].id).toBe('high')
      expect(result[1].id).toBe('low')
    })
  })

  describe('nudges locais vs remotos', () => {
    it('combina remotos e locais', () => {
      const remote = makeNudge({ id: 'remote' })
      const local = makeNudge({ id: 'local' })
      expect(buildNudgeList([remote], [local], { platform: 'all' })).toHaveLength(2)
    })

    it('retorna lista vazia quando tudo dispensado', () => {
      const n = makeNudge({ id: 'x', version: 1 })
      const dismissed = new Set(['x:1'])
      expect(buildNudgeList([n], [], { platform: 'all', dismissed })).toHaveLength(0)
    })

    it('retorna lista vazia sem nudges', () => {
      expect(buildNudgeList([], [], { platform: 'all' })).toHaveLength(0)
    })

    it('funciona com opts undefined', () => {
      expect(buildNudgeList([], [], undefined)).toHaveLength(0)
    })
  })
})
