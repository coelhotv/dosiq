/**
 * useLocalToday — o dia local corrente, revalidado quando a tela volta a ser vista.
 *
 * Vigência de tratamento é pergunta de CALENDÁRIO: um tratamento vence à meia-noite, mas um
 * componente montado ontem guarda o dia da montagem para sempre. Ler `getTodayLocal()` dentro de
 * um `useMemo` cujas dependências são só dados (`protocols`, `medicines`) congela a resposta — a
 * tela segue afirmando o que era verdade ontem, sem erro, sem log e sem teste vermelho. Foi o
 * achado do RC6 no PR #810 (073 PR 2), na mesma família do [[R-299]]: estado do passado que se
 * disfarça de presente.
 *
 * Escuta `visibilitychange` + `focus` em vez de `setInterval`: cobre o caso real — celular
 * guardado no bolso, aberto no dia seguinte — sem manter timer vivo numa tela que pode ficar
 * aberta a noite inteira (constituição II: bateria e device low-mid importam).
 *
 * ⚠️ NÃO cobre o caso da tela em primeiro plano no instante exato da virada (00:00 com o app
 * aberto e visível). Para esse caso é preciso um agendamento até a próxima meia-noite; nenhuma
 * superfície pediu isso até agora, e o custo (timer sempre vivo) não se paga.
 *
 * @returns {string} data local YYYY-MM-DD, estável entre revalidações
 * @example
 *   const today = useLocalToday()
 *   const vigentes = useMemo(() => protocols.filter((p) => isProtocolVigentOn(p, today)),
 *     [protocols, today])
 */
import { useState, useEffect } from 'react'
import { getTodayLocal } from '@dosiq/core'

export function useLocalToday(): string {
  const [today, setToday] = useState(() => getTodayLocal())

  useEffect(() => {
    const refreshToday = () => {
      if (document.visibilityState === 'hidden') return
      const current = getTodayLocal()
      // Só troca a referência quando o dia REALMENTE virou — senão todo foco de janela
      // invalidaria os memos que dependem daqui.
      setToday((prev) => (prev === current ? prev : current))
    }

    document.addEventListener('visibilitychange', refreshToday)
    window.addEventListener('focus', refreshToday)

    return () => {
      document.removeEventListener('visibilitychange', refreshToday)
      window.removeEventListener('focus', refreshToday)
    }
  }, [])

  return today
}

export default useLocalToday
