// useKeyboardVisible — o teclado está na tela agora?
//
// Serve a um caso específico e recorrente: rodapé fixo + safe area inferior. Com o teclado
// FECHADO, o rodapé precisa do inset de baixo (home indicator no iOS, barra de navegação no
// Android) para não ficar embaixo dos botões do sistema. Com o teclado ABERTO, essa faixa não
// existe mais — o teclado ocupa o lugar dela —, e manter o inset descola o rodapé do teclado,
// deixando uma folga morta.
//
// iOS emite os eventos `keyboardWillShow/Hide` (animam junto com o teclado); o Android só tem
// os `Did*`. Escutar o par certo por plataforma evita o rodapé "pulando" depois da animação.

import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, () => setVisible(true))
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return visible
}
