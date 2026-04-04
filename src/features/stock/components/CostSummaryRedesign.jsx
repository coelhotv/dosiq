/**
 * CostSummaryRedesign — Card de análise de custo mensal para o redesign do Estoque
 * Renderiza custos de medicamentos com barras de progressão (Wave 15.5)
 */

import { Receipt } from 'lucide-react'
import './CostSummaryRedesign.css'

export default function CostSummaryRedesign({ costData, isComplex }) {
  if (!costData || costData.items.length === 0) {
    return (
      <section className="cost-summary-redesign cost-summary-redesign--empty" aria-label="Análise de custo mensal">
        <div className="cost-summary-redesign__header">
          <div className="cost-summary-redesign__icon-wrap">
            <Receipt size={20} aria-hidden="true" />
          </div>
          <h3 className="cost-summary-redesign__title">Custo Mensal</h3>
        </div>
        <p className="cost-summary-redesign__empty-msg">Adicione dados de compra para ver a análise de custo.</p>
      </section>
    )
  }

  const itemsToShow = isComplex ? costData.items : costData.items.slice(0, 3)
  const maxCost = Math.max(...costData.items.map(i => i.monthlyCost))

  return (
    <section className="cost-summary-redesign" aria-label="Análise de custo mensal">
      <div className="cost-summary-redesign__header">
        <div className="cost-summary-redesign__icon-wrap">
          <Receipt size={20} aria-hidden="true" />
        </div>
        <h3 className="cost-summary-redesign__title">Custo Mensal</h3>
      </div>

      <p className="cost-summary-redesign__total">
        R$ {costData.totalMonthly.toFixed(2)}
        <span className="cost-summary-redesign__period">/mês</span>
      </p>

      <div className="cost-summary-redesign__list">
        {itemsToShow.map((item, index) => {
          const widthPct = maxCost > 0 ? (item.monthlyCost / maxCost) * 100 : 0
          const isTop = index === 0
          return (
            <div key={item.name ?? item.medicineName} className="cost-summary-redesign__item">
              <div className="cost-summary-redesign__item-header">
                <span className="cost-summary-redesign__item-name">{item.name ?? item.medicineName}</span>
                <span className="cost-summary-redesign__item-cost">
                  {item.monthlyCost < 0.01 ? 'Grátis' : `R$ ${item.monthlyCost.toFixed(2)}`}
                </span>
              </div>
              {isComplex && item.dailyCost != null && (
                <p className="cost-summary-redesign__daily">R$ {item.dailyCost.toFixed(2)}/dia</p>
              )}
              <div className="cost-summary-redesign__bar-track" role="presentation">
                <div
                  className={`cost-summary-redesign__bar-fill${isTop ? ' cost-summary-redesign__bar-fill--top' : ''}`}
                  style={{ '--bar-width': `${widthPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {!isComplex && costData.items.length > 3 && (
        <p className="cost-summary-redesign__more">+ {costData.items.length - 3} medicamentos</p>
      )}
    </section>
  )
}
