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
import { useRef, useEffect } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(isOpen) {
  const containerRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      // Salvar elemento com foco antes de abrir
      previousFocusRef.current = document.activeElement

      // Focar no primeiro elemento focável após a animação de abertura
      const timer = setTimeout(() => {
        const firstFocusable = containerRef.current?.querySelector(FOCUSABLE_SELECTOR)
        firstFocusable?.focus()
      }, 100)

      return () => clearTimeout(timer)
    } else if (previousFocusRef.current) {
      // Restaurar foco ao fechar
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [isOpen])

  const handleKeyDown = (e) => {
    if (e.key !== 'Tab') return

    const focusableElements = containerRef.current?.querySelectorAll(FOCUSABLE_SELECTOR)
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
