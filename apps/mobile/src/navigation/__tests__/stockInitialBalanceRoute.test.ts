// Guard de rota do saldo inicial (spec 044, F4b/T017) — nasceu de um bug do smoke:
// a tela estava registrada no ProfileStack, mas o card de upsell dispara da aba HOJE.
// `navigate` só sobe pela cadeia de PAIS — stacks irmãos não se enxergam — então o clique
// morria em "The action 'NAVIGATE' ... was not handled by any navigator".
//
// O que este teste trava (o que um teste de componente não pegaria):
//   1. a rota é registrada no stack RAIZ, o único ancestral comum das 3 entradas;
//   2. ninguém navega para ela por string literal (foi o literal no TodayScreen que deixou o
//      destino apontar para o vazio sem nenhum gate reclamar).

import fs from 'fs'
import path from 'path'
import { ROUTES } from '../routes'

const SRC = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8')

describe('rota StockInitialBalance (044 F4b)', () => {
  it('é registrada no stack RAIZ (ancestral comum das abas Hoje e Perfil)', () => {
    const root = read('navigation/Navigation.tsx')
    expect(root).toContain('ROUTES.STOCK_INITIAL_BALANCE')
    expect(root).toContain('StockInitialBalanceScreen')
  })

  it('NÃO é registrada dentro de um stack de aba (senão as outras abas não a alcançam)', () => {
    expect(read('navigation/ProfileStack.tsx')).not.toContain('STOCK_INITIAL_BALANCE')
  })

  it('as duas entradas navegam pela constante ROUTES, nunca por string literal', () => {
    const today = read('features/dashboard/screens/TodayScreen.tsx')
    const settings = read('features/profile/screens/SettingsScreen.tsx')

    expect(today).toContain('ROUTES.STOCK_INITIAL_BALANCE')
    expect(settings).toContain('ROUTES.STOCK_INITIAL_BALANCE')
    // O literal é o que permite apontar para uma tela que não existe sem ninguém notar.
    expect(today).not.toContain("'StockInitialBalance'")
    expect(settings).not.toContain("'StockInitialBalance'")
  })

  it('o onboarding usa a SUA rota (navigator próprio), não a do app', () => {
    expect(ROUTES.STOCK_INITIAL_BALANCE).not.toBe(ROUTES.ONBOARDING_STOCK_INITIAL_BALANCE)
    expect(read('features/onboarding/screens/OnboardingStockStep.tsx')).toContain(
      'ROUTES.ONBOARDING_STOCK_INITIAL_BALANCE',
    )
  })
})
