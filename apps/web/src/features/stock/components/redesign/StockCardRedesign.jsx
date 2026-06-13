/**
 * StockCardRedesign — Card de medicamento para o redesign do Estoque (Wave 8)
 * Dois modos: simples (Dona Maria) e complexo (Carlos).
 *
 * Simple: nome + dosagem pill + barra + dias + "última compra" + CTA (urgente/atencao apenas)
 * Complex: idem + linha de uso (dose/dia · Período) + bar-pct + quantidade visível
 */

import { motion } from 'framer-motion'
import {
  ScanBarcode,
  ShoppingBasket,
  CalendarClock,
  ShieldCheck,
  ShieldAlert,
  Syringe,
} from 'lucide-react'
import MedicineIcon from '@shared/components/ui/MedicineIcon'
import { useMotion } from '@shared/hooks/useMotion'
import { parseLocalDate } from '@utils/dateUtils'
import { formatStockQuantity, formatConcentration, stockUnitLabel, formatStockApplications, INJECTION_CONTAINER_SINGULAR } from '@dosiq/core'
import './StockCardRedesign.css'

/**
 * Rendimento de estoque em APLICAÇÕES p/ injetáveis dosados em mg (012 Fase B2,
 * FR-020): floor(ml ÷ ml-por-aplicação), ml-por-aplicação = dose_mg / units_per_ml.
 * Retorna '' quando não se aplica (não-mg, sem protocolo, sem densidade).
 */
function applicationsLine(medicine, primaryProtocol, totalMl) {
  // mg → ml por aplicação = dose_mg ÷ concentração (dosage_per_pill = mg/ml do cadastro).
  if (primaryProtocol?.intake_unit !== 'mg' || !(Number(medicine?.dosage_per_pill) > 0)) return ''
  const doseMg = Number(primaryProtocol.dosage_per_intake)
  if (!(doseMg > 0)) return ''
  const mlPerApplication = doseMg / Number(medicine.dosage_per_pill)
  const container = INJECTION_CONTAINER_SINGULAR[medicine.injection_container] || null
  return formatStockApplications(totalMl, mlPerApplication, container)
}

const CTA_CONFIG = {
  urgente: { label: 'Comprar Agora', Icon: ScanBarcode },
  atencao: { label: 'Comprar em Breve', Icon: ShoppingBasket },
  seguro: { label: 'Agendar Compra', Icon: CalendarClock },
  alto: { label: 'Agendar Compra', Icon: CalendarClock },
}

function _shouldShowCta(isComplex, stockStatus) {
  if (isComplex) return true
  return stockStatus === 'urgente' || stockStatus === 'atencao'
}

/**
 * Formata "última compra: DD/MM · R$ X,XX/un." para o subtexto do card.
 * Exibe o preço UNITÁRIO — custo total seria irreal pois FIFO decrementa quantity.
 * Sem unit_price: "última compra: DD/MM".
 */
function formatLastPurchase(lastPurchase, unitLabel = 'un.') {
  if (!lastPurchase) return null
  const date = parseLocalDate(lastPurchase.date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })

  let text = `última compra: ${date}`

  if (lastPurchase.unitPrice != null) {
    const priceLabel =
      lastPurchase.unitPrice < 0.01
        ? 'Grátis'
        : `${lastPurchase.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/${unitLabel}`
    text += ` · ${priceLabel}`
  }

  const sources = []
  if (lastPurchase.laboratory) sources.push(lastPurchase.laboratory)
  if (lastPurchase.pharmacy) sources.push(lastPurchase.pharmacy)

  if (sources.length > 0) {
    text += ` · ${sources.join(' / ')}`
  }

  return text
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
 * Métrica-herói do card (012 B4 / ADR-067):
 *  - diário: "N DIAS" (sem regressão — público atual 1×/dia)
 *  - freq ≠ diário: "N DOSES"/"N APLICAÇÕES" (dose-primário; dia engana)
 *  - sem protocolo: "S.O.S"
 * A COR/barra continuam medindo runway (stockStatus), independente do rótulo.
 */
function formatHeroMetric({ daysRemaining, dosesRemaining, isDailyStock, hasActiveProtocol }) {
  if (!hasActiveProtocol) return { number: '—', label: 'S.O.S' }
  if (!isDailyStock && Number.isFinite(dosesRemaining)) {
    return { number: String(dosesRemaining), label: dosesRemaining === 1 ? 'DOSE' : 'DOSES' }
  }
  if (!Number.isFinite(daysRemaining) || daysRemaining >= 30) return { number: '30+', label: 'DIAS' }
  const days = Math.floor(daysRemaining)
  return { number: String(days), label: days === 1 ? 'DIA' : 'DIAS' }
}

export default function StockCardRedesign({ item, isComplex, onAddStock, prediction, index = 0 }) {
  const motionConfig = useMotion()
  const {
    medicine,
    totalQuantity,
    stockStatus,
    barPercentage,
    primaryProtocol,
    hasActiveProtocol,
    lastPurchase,
    ttlAlert,
  } = item
  const { number: daysNumber, label: daysLabel } = formatHeroMetric({
    daysRemaining: item.daysRemaining,
    dosesRemaining: item.dosesRemaining,
    isDailyStock: item.isDailyStock,
    hasActiveProtocol,
  })
  const usageLine = isComplex ? formatUsageLine(primaryProtocol) : null
  const ctaConfig = CTA_CONFIG[stockStatus] || { label: 'Comprar Agora', Icon: ScanBarcode }
  const showCta = _shouldShowCta(isComplex, stockStatus)
  const lastPurchaseText = formatLastPurchase(lastPurchase, stockUnitLabel(medicine))
  const isSupplement = medicine.type === 'suplemento'

  return (
    <motion.div
      className={`stock-card-r stock-card-r--${stockStatus} stock-card-r--${isSupplement ? 'supplement' : 'medicine'}`}
      variants={motionConfig.cascade.item}
      {...motionConfig.tactile}
      role="article"
      aria-label={`${medicine.name} — ${daysNumber} ${daysLabel}`}
    >
      {/* ── Medicine name + dosage pill (inline) ── */}
      <div className="stock-card-r__name-row">
        <div className="stock-card-r__medicine">
          <div className="stock-card-r__icon-wrap">
            {/* Ícone canônico de identificação do medicamento */}
            <MedicineIcon medicine={medicine} size={18} aria-label={isSupplement ? 'Suplemento' : 'Medicamento'} />
          </div>
          <div className="stock-card-r__name-dosage">
            <h3 className="stock-card-r__name">{medicine.name}</h3>
            {medicine.dosage_per_pill && (
              <span className="stock-card-r__dosage">
                {formatConcentration(medicine.dosage_per_pill, medicine.dosage_unit, medicine.concentration_volume_ml)}
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
          {formatStockQuantity(totalQuantity, medicine)}
        </p>
      )}

      {/* ── Rendimento em aplicações (injetável GLP-1 em mg — 012 Fase B2 FR-020) ── */}
      {isComplex && applicationsLine(medicine, primaryProtocol, totalQuantity) && (
        <p className="stock-card-r__applications">
          {applicationsLine(medicine, primaryProtocol, totalQuantity)}
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

      {/* ── Alerta de validade biológica pós-abertura (012 Fase A) — eixo paralelo.
          Antes da última compra: alerta clínico > referência de preço (PO smoke). */}
      {ttlAlert && (
        <div
          className={`stock-card-r__ttl-alert stock-card-r__ttl-alert--${ttlAlert.type}`}
          role="alert"
          aria-live="polite"
        >
          <Syringe size={13} aria-hidden="true" />
          <span>{ttlAlert.message}</span>
        </div>
      )}

      {/* ── Última compra — subtexto de referência de preço ── */}
      {lastPurchaseText && <p className="stock-card-r__last-purchase">{lastPurchaseText}</p>}

      {/* ── Previsão de reabastecimento (Sprint 15.7) ── */}
      {prediction?.predictedStockoutDate &&
        (prediction.confidence === 'high' || prediction.confidence === 'medium') && (
          <div className="stock-card-r__prediction">
            <span className="stock-card-r__prediction-date">
              Previsão: acaba em ~
              {parseLocalDate(prediction.predictedStockoutDate).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              })}
            </span>
            <span
              className={`stock-card-r__prediction-confidence stock-card-r__prediction-confidence--${prediction.confidence}`}
            >
              {prediction.confidence === 'high' ? (
                <>
                  <ShieldCheck size={12} aria-hidden="true" /> Alta
                </>
              ) : (
                <>
                  <ShieldAlert size={12} aria-hidden="true" /> Média
                </>
              )}
            </span>
          </div>
        )}

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
