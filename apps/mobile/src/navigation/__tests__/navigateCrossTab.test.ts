// Regressão da tab presa numa sub-tela (achado no smoke do 029 F5).
//
// O que se trava aqui é a ORDEM e a SEPARAÇÃO dos dois passos: a raiz da tab PRIMEIRO, a
// sub-tela DEPOIS. Um `navigate(tab, { screen })` único deixa o stack `[SUB]` sem raiz, e aí
// `tabState.index === 0` desarma o listener de re-tap do RootTabs (que só age com `index > 0`).
// A tab fica sem saída.

import { InteractionManager } from 'react-native'
import { navigateCrossTab } from '../navigateCrossTab'
import { navigationRef } from '../navigationRef'

jest.mock('../navigationRef', () => ({
  navigationRef: { navigate: jest.fn(), isReady: jest.fn(() => true) },
}))

beforeEach(() => {
  jest
    .spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation((cb: any) => {
      cb?.()
      return { then: jest.fn(), done: jest.fn(), cancel: jest.fn() } as any
    })
})

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  jest.restoreAllMocks()
})

describe('navigateCrossTab', () => {
  it('navega em DOIS passos: raiz da tab primeiro, sub-tela depois', () => {
    navigateCrossTab('Tratamentos', 'ProtocolDetail', { id: 'p1' })

    expect(navigationRef.navigate).toHaveBeenNthCalledWith(1, 'Tratamentos')
    expect(navigationRef.navigate).toHaveBeenNthCalledWith(2, 'ProtocolDetail', { id: 'p1' })
  })

  it('NUNCA usa a forma de um tiro `navigate(tab, { screen })`', () => {
    navigateCrossTab('Tratamentos', 'ProtocolDetail', { id: 'p1' })

    const calls = (navigationRef.navigate as jest.Mock).mock.calls
    // A forma proibida passaria a sub-tela como objeto `{ screen }` no 2º argumento da TAB.
    expect(calls[0][1]).toBeUndefined()
  })

  it('sem sub-tela vai só até a raiz da tab', () => {
    navigateCrossTab('Estoque')

    expect(navigationRef.navigate).toHaveBeenCalledTimes(1)
    expect(navigationRef.navigate).toHaveBeenCalledWith('Estoque')
  })

  it('árvore não pronta → não navega (evita crash em deeplink no boot)', () => {
    ;(navigationRef.isReady as jest.Mock).mockReturnValue(false)

    navigateCrossTab('Tratamentos', 'ProtocolDetail')

    expect(navigationRef.navigate).not.toHaveBeenCalled()
  })

  it('árvore desmontada ENTRE os dois passos → não empilha a sub-tela', () => {
    // Logout/deeplink concorrente durante a animação: o passo 2 roda fora do ciclo de render.
    ;(navigationRef.isReady as jest.Mock).mockReturnValueOnce(true).mockReturnValueOnce(false)

    navigateCrossTab('Tratamentos', 'ProtocolDetail')

    expect(navigationRef.navigate).toHaveBeenCalledTimes(1)
    expect(navigationRef.navigate).toHaveBeenCalledWith('Tratamentos')
  })
})
