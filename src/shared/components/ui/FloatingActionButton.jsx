import './FloatingActionButton.css'

/**
 * Componente FloatingActionButton (FAB) compartilhado
 * Usado em Dashboard e HealthHistory para ações primárias flutuantes
 *
 * Props:
 * - onClick: função a executar ao clicar
 * - children: rótulo do botão (ex: "+ Registrar Dose")
 */
export default function FloatingActionButton({ onClick, children }) {
  return (
    <div className="fab-container">
      <button className="fab-button" onClick={onClick}>
        {children}
      </button>
    </div>
  )
}
