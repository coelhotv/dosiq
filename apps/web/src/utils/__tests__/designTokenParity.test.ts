/**
 * Paridade de tokens de cor web ↔ mobile (spec 112 US7 · ADR-117).
 *
 * O mobile (`apps/mobile/src/shared/styles/tokens.ts`) é a referência; a web espelha.
 * O tokens.ts é transpilado com `ts.transpileModule` e avaliado como objeto real (sem importar RN
 * e sem import relativo cross-program — R-283). Os CSS da web são lidos como texto, na ordem de
 * `@import` de `shared/styles/index.css`; a última declaração vence (cascata do `:root`).
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const REPO = path.resolve(__dirname, '../../../../..')
const MOBILE_TOKENS = path.join(REPO, 'apps/mobile/src/shared/styles/tokens.ts')
const STYLES_DIR = path.join(REPO, 'apps/web/src/shared/styles')

type Tree = { [key: string]: string | number | Tree }

function loadMobileColors(): Tree {
  const source = fs.readFileSync(MOBILE_TOKENS, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  })
  const mod: { exports: { colors?: Tree } } = { exports: {} }
  new Function('module', 'exports', outputText)(mod, mod.exports)
  if (!mod.exports.colors) throw new Error('tokens.ts sem export `colors`')
  return mod.exports.colors
}

function mobileValue(colors: Tree, dotted: string): string {
  const value = dotted.split('.').reduce<string | number | Tree | undefined>(
    (node, key) => (node && typeof node === 'object' ? node[key] : undefined),
    colors
  )
  if (typeof value !== 'string') throw new Error(`token mobile ausente: ${dotted}`)
  return value
}

// Remove comentários e blocos @media (overrides condicionais: contraste, transparência, print).
function stripConditional(css: string): string {
  let out = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (;;) {
    const start = out.search(/@media[^{]*\{/)
    if (start === -1) return out
    let depth = 0
    let i = out.indexOf('{', start)
    for (; i < out.length; i++) {
      if (out[i] === '{') depth++
      else if (out[i] === '}' && --depth === 0) break
    }
    out = out.slice(0, start) + out.slice(i + 1)
  }
}

function loadWebVars(): Map<string, string> {
  const index = fs.readFileSync(path.join(STYLES_DIR, 'index.css'), 'utf8')
  const files = [...index.matchAll(/@import\s+'\.\/([^']+)'/g)].map((m) => m[1])
  const vars = new Map<string, string>()
  for (const file of [...files, 'index.css']) {
    const css = stripConditional(fs.readFileSync(path.join(STYLES_DIR, file), 'utf8'))
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(m[1], m[2].trim())
  }
  return vars
}

function resolveVar(vars: Map<string, string>, name: string, depth = 0): string {
  const raw = vars.get(name)
  if (raw === undefined) throw new Error(`CSS var web ausente: ${name}`)
  const ref = raw.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/)
  if (!ref) return raw
  if (depth > 10) throw new Error(`ciclo de var(): ${name}`)
  return vars.has(ref[1]) ? resolveVar(vars, ref[1], depth + 1) : (ref[2] ?? raw)
}

export function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase()
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/)
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : v
}

// Pares mobile → CSS var web que DEVEM ser idênticos.
const PAIRS: Array<[mobile: string, web: string]> = [
  ['brand.primary', '--color-primary'],
  ['brand.secondary', '--color-primary-container'],
  ['bg.screen', '--bg-primary'],
  ['bg.card', '--bg-card'],
  ['status.error', '--color-error'],
  ['status.info', '--color-info'],
  ['text.inverse', '--text-inverse'],
  ['text.primary', '--text-primary'],
  ['text.secondary', '--text-secondary'],
  ['border.light', '--border-light'],
]

// Divergências aceitas pelo PO no C2 (2026-10-26): o teste trava OS DOIS valores — mudar qualquer
// lado sem atualizar esta tabela quebra o teste.
const ACCEPTED_DRIFT: Array<{ mobile: string; web: string; mobileValue: string; webValue: string; why: string }> = [
  {
    mobile: 'text.muted',
    web: '--text-tertiary',
    mobileValue: '#8e9199',
    webValue: '#6d7a76',
    why: 'mobile #8e9199 ≈ 3.2:1 sobre branco (falha WCAG AA); correção é do mobile, fora da 112',
  },
  {
    mobile: 'border.default',
    web: '--border-default',
    mobileValue: '#e1e3e8',
    webValue: '#bdc9c5',
    why: 'borda web mais escura em todo o app autenticado; alinhar = mudança visual ampla',
  },
  {
    mobile: 'status.success',
    web: '--color-success',
    mobileValue: '#4fb3a4',
    webValue: '#22c55e',
    why: 'tons de sucesso diferentes por desenho; unificar na spec de fonte única',
  },
  {
    mobile: 'status.warning',
    web: '--color-warning',
    mobileValue: '#904d00',
    webValue: '#f59e0b',
    why: 'web usa o equivalente ao warningBright do mobile; semântica difere',
  },
]

// Tokens do mobile sem correspondente na web — listados para não sumirem em silêncio.
const NO_PAIR = [
  'primary',
  'neutral',
  'status.warningBright',
  'status.errorLight',
  'status.warningLight',
  'status.infoLight',
  'status.successDark',
  'supplement',
  'text.brand',
  'bg.overlay',
  'bg.brand',
  'brand.forest',
  'brand.mint',
  'brand.light',
  'doseDelayed',
  'tab',
  'opacity',
]

function leafPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const p = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' ? leafPaths(value, p) : [p]
  })
}

describe('paridade de tokens de cor web ↔ mobile (ADR-117)', () => {
  const colors = loadMobileColors()
  const vars = loadWebVars()

  it.each(PAIRS)('%s (mobile) = %s (web)', (mobile, web) => {
    expect(normalizeHex(resolveVar(vars, web))).toBe(normalizeHex(mobileValue(colors, mobile)))
  })

  it.each(ACCEPTED_DRIFT)('divergência aceita $mobile ↔ $web continua a registrada', (d) => {
    expect(normalizeHex(mobileValue(colors, d.mobile))).toBe(d.mobileValue)
    expect(normalizeHex(resolveVar(vars, d.web))).toBe(d.webValue)
  })

  it('todo token de cor do mobile está classificado (par, divergência aceita ou sem par)', () => {
    const classified = [...PAIRS.map(([m]) => m), ...ACCEPTED_DRIFT.map((d) => d.mobile)]
    const unclassified = leafPaths(colors).filter(
      (leaf) => !classified.includes(leaf) && !NO_PAIR.some((n) => leaf === n || leaf.startsWith(`${n}.`))
    )
    expect(unclassified).toEqual([])
  })

  it('normalizeHex expande hex curto e ignora caixa', () => {
    expect(normalizeHex('#FFF')).toBe('#ffffff')
    expect(normalizeHex(' #006A5E ')).toBe('#006a5e')
  })

  it('token mobile ausente falha nomeando o token', () => {
    expect(() => mobileValue(colors, 'brand.inexistente')).toThrow('brand.inexistente')
  })

  it('CSS var ausente falha nomeando a var', () => {
    expect(() => resolveVar(vars, '--nao-existe')).toThrow('--nao-existe')
  })
})
