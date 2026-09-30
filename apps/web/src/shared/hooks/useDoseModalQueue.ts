import { useEffect, useRef, useCallback } from 'react'

/** Valores iniciais do LogForm aceitos pelo GlobalDoseModal (shape livre do formulário). */
export type DoseModalInitialValues = Record<string, unknown>

/**
 * Abre o modal global de dose pelo evento `mr:open-dose-modal` (insight cards, "Tomar" do Hoje).
 * `detail.queue` (071) é uma lista de valores iniciais: o modal abre pré-preenchido para cada item
 * em sequência — "Tomar" de dose injetável pede o local, uma dose por vez. Fechar (salvar ou
 * cancelar) avança para o próximo item; sem fila, fecha como antes.
 *
 * @returns closeDoseModal — usar como `onClose` do GlobalDoseModal
 */
export function useDoseModalQueue(
  setIsDoseModalOpen: (open: boolean) => void,
  setDoseModalInitialValues: (values: DoseModalInitialValues | null) => void
): () => void {
  const queueRef = useRef<DoseModalInitialValues[]>([])

  useEffect(() => {
    const open = (e: Event) => {
      const queue = (e as CustomEvent<{ queue?: DoseModalInitialValues[] } | undefined>).detail?.queue
      if (Array.isArray(queue) && queue.length > 0) {
        queueRef.current = queue.slice(1)
        setDoseModalInitialValues(queue[0])
      }
      setIsDoseModalOpen(true)
    }
    window.addEventListener('mr:open-dose-modal', open)
    return () => window.removeEventListener('mr:open-dose-modal', open)
  }, [setIsDoseModalOpen, setDoseModalInitialValues])

  return useCallback(() => {
    const [next, ...rest] = queueRef.current
    queueRef.current = rest
    if (next) {
      setDoseModalInitialValues(next)
      return
    }
    setIsDoseModalOpen(false)
    setDoseModalInitialValues(null)
  }, [setIsDoseModalOpen, setDoseModalInitialValues])
}
