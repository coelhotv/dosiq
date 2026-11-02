import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const PUBLIC = path.resolve(__dirname, '../../public')
const LANDING_DIR = path.resolve(__dirname, '../views/landing')

// Mesmas 14 páginas de conteúdo de seoStaticPages.test.ts (spec 114)
const PAGES = [
  'glp-1',
  'insulina-e-glicemia',
  'injecao-mensal',
  'guia/rodizio-aplicacao',
  'guia/esqueci-dose-semanal',
  'guia/validade-caneta-aberta',
  'guia/horario-8-em-8-horas',
  'guia/horario-12-em-12-horas',
  'guia/horario-6-em-6-horas',
  'guia/alarme-remedio-silencioso-iphone-android',
  'guia/melhor-horario-remedio-pressao',
  'guia/melhor-horario-remedio-tireoide',
  'guia/melhor-horario-remedio-colesterol',
  'guia/melhor-horario-remedio-diabetes',
]

const read = (rel: string) => fs.readFileSync(path.join(PUBLIC, rel), 'utf8')

afterEach(() => {
  vi.clearAllMocks()
  vi.clearAllTimers()
})

/**
 * INV-6 (spec 114) — ZERO travessão (—) no texto das landings.
 * No português do Brasil o travessão em prosa é raro e passou a soar como texto gerado por IA.
 * Use ponto, vírgula, dois-pontos, ponto e vírgula ou parênteses conforme o sentido da frase.
 * Vale para HTML (inclusive o JSON-LD, que é lido por buscadores), .md, llms.txt e o texto visível
 * da Landing SPA (comentários de código ficam de fora).
 */
describe('INV-6: sem travessão (—) no texto das landings', () => {
  const EM_DASH = '—'
  const staticFiles = [...PAGES.flatMap((p) => [`${p}.html`, `${p}.md`]), 'llms.txt']
  const spaFiles = fs.readdirSync(LANDING_DIR).filter((f) => f.endsWith('.tsx'))
  const stripComments = (src: string) =>
    src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const offenders = (src: string) =>
    src
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => line.includes(EM_DASH))
      .map(([n, line]) => `L${n}: ${line.trim().slice(0, 120)}`)

  it.each(staticFiles)('🚨 %s não tem travessão', (f) => {
    expect(offenders(read(f)), `TRAVESSÃO (—) em public/${f}: reescreva com pontuação brasileira`).toEqual([])
  })

  it.each(spaFiles)('🚨 Landing SPA %s não tem travessão no texto visível', (f) => {
    const src = stripComments(fs.readFileSync(path.join(LANDING_DIR, f), 'utf8'))
    expect(offenders(src), `TRAVESSÃO (—) em views/landing/${f}: reescreva com pontuação brasileira`).toEqual([])
  })
})
