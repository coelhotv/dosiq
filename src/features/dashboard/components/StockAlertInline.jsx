import { AlertTriangle } from 'lucide-react'

/**
 * StockAlertInline — Banner de alerta de estoque para o Dashboard redesenhado.
 *
 * @param {Array} criticalItems — items com stockStatus === 'critical' ou 'low'
 *   Shape: { medicineName: string, daysRemaining: number, stockStatus: 'critical'|'low' }
 * @param {Function} onNavigateToStock — Callback para navegar para Estoque
 */
export default function StockAlertInline({ criticalItems = [], onNavigateToStock }) {
  if (!criticalItems || criticalItems.length === 0) return null

  const sorted = [...criticalItems].sort((a, b) => a.daysRemaining - b.daysRemaining)
  const mostCritical = sorted[0]
  const isCritical = mostCritical.stockStatus === 'critical'

  const accentColor = isCritical
    ? 'var(--color-error, #ba1a1a)'
    : 'var(--color-tertiary, #7b5700)'

  const progressPct = Math.max(0, Math.min((mostCritical.daysRemaining / 30) * 100, 100))

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 'var(--radius-lg, 1rem)',
        padding: '1rem 1.25rem',
        background: isCritical
          ? 'color-mix(in srgb, var(--color-error, #ba1a1a) 8%, transparent)'
          : 'color-mix(in srgb, var(--color-tertiary-fixed, #ffdea8) 40%, transparent)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertTriangle size={16} color={accentColor} aria-hidden="true" />
        <span style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          fontSize: 'var(--text-body-lg, 1rem)',
          color: accentColor,
        }}>
          {isCritical ? 'Estoque Crítico' : 'Estoque Baixo'}
          {criticalItems.length > 1
            ? ` · ${criticalItems.length} itens`
            : ` · ${mostCritical.medicineName}`
          }
        </span>
      </div>

      {/* Barra de progresso */}
      <div>
        <div style={{
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          color: 'var(--color-on-surface-variant, #3e4946)',
          marginBottom: '0.375rem',
        }}>
          {mostCritical.daysRemaining} dia{mostCritical.daysRemaining !== 1 ? 's' : ''} restante{mostCritical.daysRemaining !== 1 ? 's' : ''}
        </div>
        <div
          role="progressbar"
          aria-valuenow={mostCritical.daysRemaining}
          aria-valuemin={0}
          aria-valuemax={30}
          aria-label={`${mostCritical.medicineName}: ${mostCritical.daysRemaining} dias restantes`}
          style={{
            height: '8px',
            borderRadius: 'var(--radius-full, 9999px)',
            background: 'var(--color-surface-container-highest, #e1e3e4)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            borderRadius: 'var(--radius-full, 9999px)',
            background: accentColor,
            transition: 'width 1s ease-out',
          }} />
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => onNavigateToStock?.()}
        aria-label="Ir para controle de estoque"
        style={{
          alignSelf: 'flex-end',
          padding: '0.375rem 0.875rem',
          minHeight: '36px',
          background: 'transparent',
          color: accentColor,
          border: `1.5px solid ${accentColor}`,
          borderRadius: 'var(--radius-full, 9999px)',
          fontFamily: 'var(--font-body, Lexend, sans-serif)',
          fontSize: 'var(--text-label-md, 0.75rem)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 150ms ease-out',
        }}
      >
        Ver Estoque →
      </button>
    </div>
  )
}
