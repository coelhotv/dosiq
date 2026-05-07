import React from 'react'
import { Plus } from 'lucide-react'

export default function StockHeader({ onAddStock }) {
  return (
    <header className="stock-redesign__header">
      <div>
        <h1 className="stock-redesign__title">Controle de Estoque</h1>
        <p className="stock-redesign__subtitle">Prioridade de Reabastecimento</p>
      </div>
      <button
        className="stock-redesign__add-btn stock-redesign__add-btn--desktop"
        onClick={() => onAddStock()}
        aria-label="Adicionar estoque"
      >
        <Plus size={16} aria-hidden="true" />
        <span>Adicionar Estoque</span>
      </button>
    </header>
  )
}
