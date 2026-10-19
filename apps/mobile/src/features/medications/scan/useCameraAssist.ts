// Ajuda para câmera que não foca de perto (spec 066 D2 · C-15, smoke 2026-10-18 no LG).
//
// O `expo-camera` não foca num ponto escolhido. Dá para: (1) pedir um novo foco — `autofocus` 'on' dispara
// uma passada de foco e 'off' volta ao contínuo; no Android a passada mira um canto do preview, então o
// efeito varia por aparelho (experimental); (2) aproximar — com zoom, a pessoa afasta a caixa até a
// distância em que a câmera foca e o código continua grande no quadro. É o que de fato resolve.
//
// `zoom` é fração do máximo do aparelho e cada plataforma escala diferente: iOS exponencial
// (min·(max/min)^z, ~2× em 0,15 com o máximo típico) e Android linear (z·max, ~2× em 0,25 com máximo 8×).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

export const NEAR_ZOOM = Platform.OS === 'ios' ? 0.15 : 0.25
// Sem leitura neste tempo, sugere aproximar (antes do "não consegui ler" de 20 s).
export const ZOOM_TIP_MS = 6_000
const REFOCUS_MS = 1_200

export function useCameraAssist(cameraOn: boolean) {
  // States
  const [zoomed, setZoomed] = useState(false)
  const [focusMode, setFocusMode] = useState<'on' | 'off'>('off')
  const [tip, setTip] = useState(false)
  const refocusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Effects
  // A dica, uma vez vencido o prazo, só aparece com a câmera ligada e sem zoom (derivado no retorno).
  useEffect(() => {
    if (!cameraOn || zoomed) return undefined
    const timer = setTimeout(() => setTip(true), ZOOM_TIP_MS)
    return () => clearTimeout(timer)
  }, [cameraOn, zoomed])
  useEffect(() => () => {
    if (refocusTimer.current) clearTimeout(refocusTimer.current)
  }, [])

  // Handlers
  const toggleZoom = useCallback(() => setZoomed((on) => !on), [])
  const refocus = useCallback(() => {
    if (refocusTimer.current) clearTimeout(refocusTimer.current)
    setFocusMode('on')
    refocusTimer.current = setTimeout(() => setFocusMode('off'), REFOCUS_MS)
  }, [])

  return { zoom: zoomed ? NEAR_ZOOM : 0, zoomed, focusMode, focusing: focusMode === 'on', tip: tip && cameraOn && !zoomed, toggleZoom, refocus }
}
