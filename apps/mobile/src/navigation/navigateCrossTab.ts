// navigateCrossTab — navegar de uma tab para uma SUB-TELA de outra tab, sem deixar o stack
// de destino sem raiz.
//
// ═══ O BUG QUE ESTE HELPER EXISTE PARA IMPEDIR ═══
// `navigation.navigate(TAB, { screen: SUB })` num único tiro REUTILIZA o estado do stack de
// destino e pode deixá-lo com a sub-tela SOZINHA: `[PROTOCOL_DETAIL]`, sem a lista embaixo.
//
// O efeito colateral parece um bug de outro lugar: com um único item no stack,
// `tabState.index === 0`, e o listener de re-tap do `RootTabs` — que existe justamente para
// devolver o usuário à raiz — testa `isOnSubScreen = index > 0`, conclui que NÃO há sub-tela e
// não faz nada. A tab fica presa na sub-tela, sem saída. O mecanismo de escape existe e é
// desarmado pela forma da navegação.
//
// Correção (padrão original do 028, em `useNudges.handleAction`): DOIS PASSOS.
//   1. `navigate(tab)` → monta/foca a raiz do stack de destino;
//   2. após as animações, `navigate(screen, params)` → empilha a sub-tela EM CIMA da raiz.
// Resultado: `[LISTA, SUB]`, `index === 1`, re-tap na tab volta para a lista.
//
// Usa `navigationRef` (não o `navigation` do componente) porque o passo 2 roda fora do ciclo de
// render, quando a árvore já mudou de tab — o objeto de navegação local aponta para o contexto
// ANTIGO. Foi por isso que o 028 escolheu o ref, e a razão continua valendo.
//
// 🔴 Só para navegação ENTRE tabs. Dentro da mesma tab, `navigation.navigate(SCREEN)` já empilha
// corretamente e este helper só adicionaria um frame de atraso.

import { InteractionManager } from 'react-native'
import { navigationRef } from '@navigation/navigationRef'

/**
 * @param tab rota da TAB de destino (ex.: `ROUTES.TREATMENTS`)
 * @param screen sub-tela dentro do stack dessa tab (ex.: `ROUTES.PROTOCOL_DETAIL`).
 *               Omitir leva só à raiz da tab.
 * @param params params da sub-tela
 */
export function navigateCrossTab(tab: string, screen?: string, params?: object): void {
  const nav = navigationRef.navigate as any
  if (!navigationRef.isReady()) return
  nav(tab)
  if (!screen) return
  InteractionManager.runAfterInteractions(() => {
    // A árvore pode ter sido desmontada entre os dois passos (logout, deeplink concorrente).
    if (!navigationRef.isReady()) return
    nav(screen, params)
  })
}
