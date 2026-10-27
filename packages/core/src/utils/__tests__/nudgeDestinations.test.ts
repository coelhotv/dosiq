import { describe, it, expect } from 'vitest'
import {
  NUDGE_DESTINATIONS,
  resolveNudgeDestination,
  buildNudgeNavigatePayload,
} from '../nudgeDestinations'
import { buildNudgeList } from '../nudgeScheduler'
import { validateNudgeCreate, validateNudgeUpdate } from '../../schemas/nudgeSchema'

const navNudge = (id, action_payload) => ({
  id,
  version: 1,
  platform: 'all',
  action_type: 'navigate',
  action_payload,
})

const baseCreate = {
  title: 'Novidade',
  body: 'Confira a nova área',
  target_view: 'dashboard',
  action_type: 'navigate',
  platform: 'all',
}

describe('NUDGE_DESTINATIONS', () => {
  it('não tem telas duplicadas', () => {
    const screens = NUDGE_DESTINATIONS.map((d) => d.screen)
    expect(new Set(screens).size).toBe(screens.length)
  })

  it('não oferece destinos que exigem params, de fluxo ou removidos', () => {
    const screens = NUDGE_DESTINATIONS.map((d) => d.screen)
    for (const s of ['PurchaseForm', 'PurchaseHistory', 'StockAdjustment', 'MedicineDetail',
      'ProtocolDetail', 'StockDetail', 'TitrationForm', 'MedicineEdit', 'StockInitialBalance',
      'MedicineScan', 'ConsentPrompt', 'DeleteAccount', 'TelegramLink']) {
      expect(screens).not.toContain(s)
    }
  })

  it('round-trip: payload montado para cada destino resolve de volta para ele', () => {
    for (const d of NUDGE_DESTINATIONS) {
      expect(resolveNudgeDestination(buildNudgeNavigatePayload(d.screen))).toBe(d)
    }
  })
})

describe('resolveNudgeDestination', () => {
  it('aceita os payloads gravados hoje em prod (tab+screen)', () => {
    expect(resolveNudgeDestination({ tab: 'Perfil', screen: 'Measures' })?.screen).toBe('Measures')
    expect(resolveNudgeDestination({ tab: 'Perfil', screen: 'Settings' })?.screen).toBe('Settings')
  })

  it('aceita aba e tela do stack raiz por route', () => {
    expect(resolveNudgeDestination({ route: 'Hoje' })?.screen).toBe('Hoje')
    expect(resolveNudgeDestination({ route: 'Chat' })?.screen).toBe('Chat')
  })

  it('rejeita tela fora da lista, aba trocada e payload vazio', () => {
    expect(resolveNudgeDestination({ tab: 'Estoque', screen: 'PurchaseForm' })).toBeNull()
    expect(resolveNudgeDestination({ tab: 'Tratamentos', screen: 'Measures' })).toBeNull()
    expect(resolveNudgeDestination({ route: 'Measures' })).toBeNull()
    expect(resolveNudgeDestination(null)).toBeNull()
  })
})

describe('buildNudgeNavigatePayload', () => {
  it('sub-tela vira tab+screen com label padrão', () => {
    expect(buildNudgeNavigatePayload('Measures', { emoji: '📏' }))
      .toEqual({ emoji: '📏', label: 'Ver mais', tab: 'Perfil', screen: 'Measures' })
  })

  it('aba vira route', () => {
    expect(buildNudgeNavigatePayload('Hoje', { label: 'Ir' })).toEqual({ label: 'Ir', route: 'Hoje' })
  })

  it('tela fora da lista devolve payload vazio', () => {
    expect(buildNudgeNavigatePayload('PurchaseForm')).toEqual({})
  })
})

describe('buildNudgeList — filtro de destino', () => {
  it('descarta navigate com destino fora da lista e mantém os demais tipos', () => {
    const list = buildNudgeList([
      navNudge('ok', { tab: 'Perfil', screen: 'Measures' }),
      navNudge('ruim', { tab: 'Estoque', screen: 'PurchaseForm' }),
      { id: 'info', version: 1, platform: 'all', action_type: 'dismiss_only' },
    ], [], { platform: 'ios' })
    expect(list.map((n) => n.id)).toEqual(['ok', 'info'])
  })

  it('estoque desligado esconde nudges que levam ao Estoque', () => {
    const nudges = [navNudge('aba', { route: 'Estoque' }), navNudge('main', { tab: 'Estoque', screen: 'StockMain' })]
    expect(buildNudgeList(nudges, [], { platform: 'ios', stockTrackingEnabled: false })).toHaveLength(0)
    expect(buildNudgeList(nudges, [], { platform: 'ios', stockTrackingEnabled: true })).toHaveLength(2)
  })

  it('sem a opção de estoque não filtra por estoque (compat)', () => {
    expect(buildNudgeList([navNudge('aba', { route: 'Estoque' })], [], { platform: 'ios' })).toHaveLength(1)
  })
})

describe('nudgeSchema — version e destino', () => {
  it('create aceita destino canônico e omite version (DEFAULT do banco)', () => {
    const r = validateNudgeCreate({ ...baseCreate, action_payload: { tab: 'Perfil', screen: 'Measures' } })
    expect(r.success).toBe(true)
    expect(r.data).not.toHaveProperty('version')
  })

  it('create rejeita destino fora da lista', () => {
    const r = validateNudgeCreate({ ...baseCreate, action_payload: { tab: 'Estoque', screen: 'PurchaseForm' } })
    expect(r.success).toBe(false)
  })

  it('update aceita version inteira ≥ 1 e rejeita 0 e fração', () => {
    expect(validateNudgeUpdate({ version: 3 }).success).toBe(true)
    expect(validateNudgeUpdate({ version: 0 }).success).toBe(false)
    expect(validateNudgeUpdate({ version: 1.5 }).success).toBe(false)
  })

  it('update rejeita navigate com destino fora da lista', () => {
    const r = validateNudgeUpdate({ action_type: 'navigate', action_payload: { route: 'DeleteAccount' } })
    expect(r.success).toBe(false)
  })

  it('update sem action_type também valida payload de navegação (RC6 #914)', () => {
    expect(validateNudgeUpdate({ action_payload: { route: 'DeleteAccount' } }).success).toBe(false)
    expect(validateNudgeUpdate({ action_payload: { tab: 'Perfil', screen: 'Measures' } }).success).toBe(true)
    expect(validateNudgeUpdate({ action_payload: { url: 'https://dosiq.app' } }).success).toBe(true)
  })

  it('update devolve só as chaves enviadas — não injeta priority 0 (AP-304)', () => {
    const r = validateNudgeUpdate({ title: 'Novo título' })
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ title: 'Novo título' })
  })
})
