/**
 * useFocusTrap — Hook para gerenciar focus trap dentro de um container.
 *
 * Captura o Tab dentro do container enquanto isOpen=true.
 * Restaura o foco ao elemento original quando isOpen vira false.
 *
 * @param {boolean} isOpen - Se o container está aberto/visível
 * @returns {{ containerRef: React.RefObject, handleKeyDown: Function }}
 *
 * @example
 * const { containerRef, handleKeyDown } = useFocusTrap(isOpen)
 * return <div ref={containerRef} onKeyDown={handleKeyDown}>...</div>
 */
import { useRef, useEffect, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export interface UseFocusTrapResult {
  containerRef: RefObject<HTMLElement | null>
  handleKeyDown: (e: KeyboardEvent) => void
}

export function useFocusTrap(isOpen: boolean): UseFocusTrapResult {
  const containerRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      // Salvar elemento com foco antes de abrir
      previousFocusRef.current = document.activeElement as HTMLElement | null

      // Focar no primeiro elemento focável após a animação de abertura
      const timer = setTimeout(() => {
        const firstFocusable = containerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
        firstFocusable?.focus()
      }, 100)

      return () => clearTimeout(timer)
    } else if (previousFocusRef.current) {
      // Restaurar foco ao fechar
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return

    const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (!focusableElements?.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault()
      lastElement.focus()
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault()
      firstElement.focus()
    }
  }

  return { containerRef, handleKeyDown }
}
