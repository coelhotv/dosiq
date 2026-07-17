// 034-A T015 — SC-002: guardrails de lint determinístico (sem LLM).
// Valida COMPORTAMENTO das regras novas contra o eslint.config.js REAL:
// se o seletor for removido/alterado no config, o teste quebra junto.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { Linter } from 'eslint'
// config flat da raiz do monorepo (fonte única dos guardrails)
import rootConfig from '../../../../../eslint.config.js'

type Restriction = { selector: string; message: string }

// extrai as entradas de no-restricted-syntax do bloco base do flat config
function loadRestrictions(): Restriction[] {
  const blocks = rootConfig as Array<{ rules?: Record<string, unknown> }>
  for (const block of blocks) {
    const rule = block.rules?.['no-restricted-syntax'] as unknown[] | undefined
    if (Array.isArray(rule)) return rule.slice(1) as Restriction[]
  }
  throw new Error('no-restricted-syntax não encontrado no eslint.config.js')
}

function lint(code: string): string[] {
  const linter = new Linter()
  const messages = linter.verify(code, {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: { 'no-restricted-syntax': ['error', ...loadRestrictions()] },
  })
  return messages.map((m) => m.message)
}

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

describe('034-A guardrails — enum não-pt-BR em z.enum() (AP-299)', () => {
  it('rejeita enum de DB em inglês', () => {
    const msgs = lint(`z.enum(['daily', 'weekly'])`)
    expect(msgs.some((m) => m.includes('AP-299'))).toBe(true)
  })

  it('rejeita a versão SEM acento (o CHECK do banco rejeita — 23514)', () => {
    const msgs = lint(`z.enum(['diario', 'quando_necessario'])`)
    expect(msgs.filter((m) => m.includes('AP-299'))).toHaveLength(2)
  })

  it("rejeita 'cp' em z.enum (comprimido em protocols é NULL)", () => {
    const msgs = lint(`z.enum(['gotas', 'ml', 'UI', 'mg', 'cp'])`)
    expect(msgs.some((m) => m.includes('AP-299'))).toBe(true)
  })

  it('aceita os valores pt-BR verbatim do banco', () => {
    const msgs = lint(
      `z.enum(['diário', 'dias_alternados', 'semanal', 'personalizado', 'quando_necessário'])`
    )
    expect(msgs).toHaveLength(0)
  })

  it('NÃO alcança literais fora de z.enum (mapas de normalização tolerante são legítimos)', () => {
    const msgs = lint(`const FREQ_MAP = { daily: 'diário', diario: 'diário' }`)
    expect(msgs).toHaveLength(0)
  })
})

describe('034-A guardrails — res.json sem res.status (R-090 / lição Sprint 7)', () => {
  it('rejeita res.json(body) direto', () => {
    const msgs = lint(`res.json({ ok: true })`)
    expect(msgs.some((m) => m.includes('R-090'))).toBe(true)
  })

  it('aceita res.status(code).json(body)', () => {
    const msgs = lint(`res.status(200).json({ ok: true })`)
    expect(msgs).toHaveLength(0)
  })

  it('aceita res.json() de fetch Response (zero args)', () => {
    const msgs = lint(`const data = await res.json()`)
    expect(msgs).toHaveLength(0)
  })
})
