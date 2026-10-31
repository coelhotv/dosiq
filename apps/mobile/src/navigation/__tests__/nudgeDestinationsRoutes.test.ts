// Guard da fonte única de destinos de nudge (028 emenda 2026-10). `NUDGE_DESTINATIONS` vive no
// core (o admin web monta o dropdown dela) e repete nomes de rota do app como string — o core não
// importa do mobile. Este teste é o elo: renomear/mover uma tela sem atualizar a lista quebra aqui,
// e não num nudge de produção com botão morto.

import fs from 'fs'
import path from 'path'
import { NUDGE_DESTINATIONS } from '@dosiq/core'
import { ROUTES } from '../routes'

const SRC = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

// Constante do ROUTES para o nome de rota (ex.: 'Measures' → 'MEASURES').
const routeKey = (screen: string) =>
  Object.entries(ROUTES).find(([, value]) => value === screen)?.[0]

const TAB_STACK: Record<string, string> = {
  Tratamentos: 'navigation/TreatmentsStack.tsx',
  Estoque: 'navigation/StockStack.tsx',
  Perfil: 'navigation/ProfileStack.tsx',
}

describe('NUDGE_DESTINATIONS × navegação do app', () => {
  it.each(NUDGE_DESTINATIONS.map((d) => [d.screen, d]))('%s existe no ROUTES', (_screen, d) => {
    expect(routeKey(d.screen)).toBeDefined()
  })

  it.each(NUDGE_DESTINATIONS.filter((d) => d.tab).map((d) => [d.screen, d]))(
    '%s está registrada na pilha da aba declarada',
    (_screen, d) => {
      expect(read(TAB_STACK[d.tab as string])).toContain(`name={ROUTES.${routeKey(d.screen)}}`)
    },
  )

  it.each(NUDGE_DESTINATIONS.filter((d) => !d.tab).map((d) => [d.screen, d]))(
    '%s (sem aba) é aba do RootTabs ou tela do stack raiz',
    (_screen, d) => {
      const marker = `name={ROUTES.${routeKey(d.screen)}}`
      const tabs = read('navigation/RootTabs.tsx')
      const root = read('navigation/Navigation.tsx')
      expect(tabs.includes(marker) || root.includes(marker)).toBe(true)
    },
  )
})
