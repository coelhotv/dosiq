/**
 * NewTreatmentDropdown — Dropdown [+ Novo ▼] da view de Tratamentos
 *
 * Modo simples:  + Medicamento | + Tratamento
 * Modo complexo: + Medicamento | + Tratamento | + Plano de tratamento
 */
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Pill, Stethoscope, FolderHeart } from 'lucide-react'
import './NewTreatmentDropdown.css'

export default function NewTreatmentDropdown({
  isComplex,
  onAddMedicine,
  onAddTreatment,
  onAddPlan,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen])

  function handleOption(callback) {
    setIsOpen(false)
    callback()
  }

  return (
    <div className="new-treatment-dropdown" ref={containerRef}>
      <button
        className="btn btn-primary btn-md new-treatment-dropdown__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        + Novo
        <ChevronDown size={15} className={isOpen ? 'rotated' : ''} />
      </button>

      {isOpen && (
        <div className="new-treatment-dropdown__menu" role="menu">
          <button
            className="new-treatment-dropdown__item"
            role="menuitem"
            onClick={() => handleOption(onAddMedicine)}
          >
            <Pill size={15} />
            Medicamento
          </button>
          <button
            className="new-treatment-dropdown__item"
            role="menuitem"
            onClick={() => handleOption(onAddTreatment)}
          >
            <Stethoscope size={15} />
            Tratamento
          </button>
          {isComplex && (
            <button
              className="new-treatment-dropdown__item"
              role="menuitem"
              onClick={() => handleOption(onAddPlan)}
            >
              <FolderHeart size={15} />
              Plano de tratamento
            </button>
          )}
        </div>
      )}
    </div>
  )
}
