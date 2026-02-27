/**
 * Calendar View - View removida
 *
 * A funcionalidade de calendario foi consolidada na view History.jsx
 * que usa CalendarWithMonthCache e oferece experiencia completa.
 *
 * @deprecated Use History.jsx para acesso ao calendario de doses
 */
import { useEffect } from 'react'

export default function Calendar({ onNavigate }) {
  useEffect(() => {
    // Redireciona para o Historico onde o calendario funcional existe
    onNavigate?.('history')
  }, [onNavigate])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Redirecionando para Histórico...</p>
    </div>
  )
}
