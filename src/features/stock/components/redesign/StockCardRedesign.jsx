/**
 * StockCardRedesign — Card de medicamento para o redesign do Estoque (Wave 8)
 * Dois modos: simples (Dona Maria) e complexo (Carlos).
 *
 * Simple: nome + dosagem pill + barra + dias + "última compra" + CTA (urgente/atencao apenas)
 * Complex: idem + linha de uso (dose/dia · Período) + bar-pct + quantidade visível
 */

import { motion } from 'framer-motion'
import { ScanBarcode, ShoppingBasket, CalendarClock } from 'lucide-react'
import { useMotion } from '@shared/hooks/useMotion'
import { parseLocalDate } from '@utils/dateUtils'
import './StockCardRedesign.css'

// Texto e ícone do CTA por status
// Simple: CTA visível apenas para urgente e atencao; seguro/alto não têm botão
// Complex: CTA visível para todos os status
const CTA_CONFIG = {
  urgente: { label: 'Comprar Agora', Icon: ScanBarcode },
  atencao: { label: 'Comprar em Breve', Icon: ShoppingBasket },
  seguro: { label: 'Agendar Compra', Icon: CalendarClock },
  alto: { label: 'Agendar Compra', Icon: CalendarClock },
}

/**
 * Formata "última compra: DD/MM · R$ X,XX/un." para o subtexto do card.
 * Exibe o preço UNITÁRIO — custo total seria irreal pois FIFO decrementa quantity.
 * Sem unit_price: "última compra: DD/MM".
 */
function formatLastPurchase(lastPurchase) {
  if (!lastPurchase) return null
  const date = parseLocalDate(lastPurchase.date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
  if (lastPurchase.unitPrice != null) {
    const priceLabel =
      lastPurchase.unitPrice < 0.01
        ? 'Grátis'
        : `${lastPurchase.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/un.`
    return `última compra: ${date} · ${priceLabel}`
  }
  return `última compra: ${date}`
}

/**
 * Formata a linha de uso: "1 dose/dia · Manhã" ou "2 doses/dia · 08:00 / 20:00"
 */
function formatUsageLine(primaryProtocol) {
  if (!primaryProtocol) return null
  const { time_schedule } = primaryProtocol
  const times = time_schedule || []
  const count = times.length
  const doses = `${count} dose${count !== 1 ? 's' : ''}/dia`
  const schedule = times.length > 0 ? ` · ${times.join(' / ')}` : ''
  return `${doses}${schedule}`
}

/**
 * Formata "N dias" ou "30+ dias" ou "S.O.S" (sem protocolo ativo)
 */
function formatDays(daysRemaining, hasActiveProtocol) {
  if (!hasActiveProtocol) return { number: '—', label: 'S.O.S' }
  if (!isFinite(daysRemaining) || daysRemaining >= 30) return { number: '30+', label: 'DIAS' }
  const days = Math.floor(daysRemaining)
  return { number: String(days), label: days === 1 ? 'DIA' : 'DIAS' }
}

export default function StockCardRedesign({ item, isComplex, onAddStock, index = 0 }) {
  const motionConfig = useMotion()
  const { medicine, totalQuantity, stockStatus, barPercentage, primaryProtocol, hasActiveProtocol, lastPurchase } = item
  const { number: daysNumber, label: daysLabel } = formatDays(item.daysRemaining, hasActiveProtocol)
  const usageLine = isComplex ? formatUsageLine(primaryProtocol) : null
  const ctaConfig = CTA_CONFIG[stockStatus] || { label: 'Comprar Agora', Icon: ScanBarcode }
  const showCta = isComplex || stockStatus === 'urgente' || stockStatus === 'atencao'
  const lastPurchaseText = formatLastPurchase(lastPurchase)

  return (
    <motion.div
      className={`stock-card-r stock-card-r--${stockStatus}`}
      variants={motionConfig.cascade.item}
      {...motionConfig.tactile}
      role="article"
      aria-label={`${medicine.name} — ${daysNumber} ${daysLabel}`}
    >
      {/* ── Medicine name + dosage pill (inline) ── */}
      <div className="stock-card-r__name-row">
        <div className="stock-card-r__medicine">
          <div className="stock-card-r__name-dosage">
            <h3 className="stock-card-r__name">{medicine.name}</h3>
            {medicine.dosage_per_pill && (
              <span className="stock-card-r__dosage">
                {medicine.dosage_per_pill}
                {medicine.dosage_unit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Complex only: linha de uso ── */}
      {isComplex && usageLine && <p className="stock-card-r__usage">{usageLine}</p>}

      {/* ── Quantidade total (complex only — Dona Maria não precisa) ── */}
      {isComplex && (
        <p className="stock-card-r__quantity">
          {totalQuantity} {{ liquido: 'ml', capsula: 'cáps.' }[medicine.medicine_type] ?? 'comprimidos'}
        </p>
      )}

      {/* ── Dias restantes — escondido para órfãos (sem protocolo ativo) ── */}
      {hasActiveProtocol && (
        <>
          <div className="stock-card-r__days" aria-label={`${daysNumber} ${daysLabel}`}>
            <span className="stock-card-r__days-number">{daysNumber}</span>
            <span className="stock-card-r__days-label">{daysLabel}</span>
          </div>

          {/* ── Progress bar (Living Fill — GPU scaleX) ── */}
          <div className="stock-card-r__bar-track" aria-hidden="true">
            <motion.div
              className={`stock-card-r__bar-fill stock-card-r__bar-fill--${stockStatus}`}
              style={{ width: `${barPercentage}%`, ...motionConfig.fill.style }}
              initial={motionConfig.fill.initial}
              animate={motionConfig.fill.animate}
              transition={{
                ...motionConfig.fill.transition,
                delay: 0.5 + index * 0.05,
              }}
            />
          </div>
          {/* bar-pct: apenas no modo complex (Carlos quer precisão; Dona Maria não precisa) */}
          {isComplex && (
            <span className="stock-card-r__bar-pct" aria-hidden="true">
              {barPercentage}%
            </span>
          )}
        </>
      )}

      {/* ── Última compra — subtexto de referência de preço ── */}
      {lastPurchaseText && <p className="stock-card-r__last-purchase">{lastPurchaseText}</p>}

      {/* ── CTA button — simple: apenas urgente/atencao; complex: todos ── */}
      {showCta && (
        <button
          className={`stock-card-r__cta stock-card-r__cta--${stockStatus}`}
          onClick={(e) => {
            e.stopPropagation()
            onAddStock?.()
          }}
          aria-label={`${ctaConfig.label} ${medicine.name}`}
        >
          <ctaConfig.Icon size={14} aria-hidden="true" />
          {ctaConfig.label}
        </button>
      )}
    </motion.div>
  )
}
