/**
 * Pós-processa os .d.ts emitidos em dist/ adicionando extensão `.js` nos
 * specifiers relativos. Sem isso, a resolução nodenext (typecheck da Vercel)
 * não segue os barrels extensionless e reporta TS2305 em todo consumer de
 * `@dosiq/core` (critério D1 do 040/F6). O tsc não reescreve specifiers no
 * declaration emit — daí o passo extra no build.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = new URL('../dist', import.meta.url).pathname

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.d.ts') ? [p] : []
  })
}

// from './x' | import './x' | import('./x') — só relativos e sem extensão
const RE = /((?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+)\2/g

let touched = 0
for (const file of walk(DIST)) {
  const src = readFileSync(file, 'utf8')
  const out = src.replace(RE, (m, pre, q, spec) =>
    /\.[cm]?js$/.test(spec) ? m : `${pre}${q}${spec}.js${q}`
  )
  if (out !== src) {
    writeFileSync(file, out)
    touched++
  }
}
console.log(`[fix-dts-extensions] ${touched} arquivos .d.ts ajustados`)
