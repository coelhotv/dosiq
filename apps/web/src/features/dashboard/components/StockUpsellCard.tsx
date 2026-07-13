import { Box } from 'lucide-react'
import './StockUpsellCard.css'

/**
 * StockUpsellCard — nudge de upsell de estoque no dashboard (spec 044, F4b / T018).
 *
 * NÃO é modal (R-239): card inline, sem interromper o fluxo. Copy exata do mock
 * (plans/mocks_app_mobile/export/044-dose-only-mode/hoje-card-prompt-habilita-estoque.png),
 * copiada — não reescrita.
 */
interface StockUpsellCardProps {
  /** "Ativar": abre o modal de saldo inicial (a web não tem rota própria para ele). */
  onActivate: () => void
  /** "Agora não": dismiss local persistente (useStockUpsell) — não re-insiste. */
  onDismiss: () => void
}

export default function StockUpsellCard({ onActivate, onDismiss }: StockUpsellCardProps) {
  return (
    <div className="stock-upsell-card" role="complementary" aria-label="Ativar controle de estoque">
      <div className="stock-upsell-card__body">
        <div className="stock-upsell-card__icon-wrap">
          <Box size={22} strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="stock-upsell-card__text">
          <p className="stock-upsell-card__title">Quer um aviso quando o remédio estiver acabando?</p>
          <p className="stock-upsell-card__subtitle">
            O Dosiq passa a acompanhar seu estoque e avisa antes de faltar.
          </p>
        </div>
      </div>
      <div className="stock-upsell-card__actions">
        <button type="button" className="stock-upsell-card__cta-primary" onClick={onActivate}>
          Ativar
        </button>
        <button type="button" className="stock-upsell-card__cta-neutral" onClick={onDismiss}>
          Agora não
        </button>
      </div>
    </div>
  )
}
