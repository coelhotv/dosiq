/**
 * AppPreview — Simula a tab "Hoje" da UX v3.2
 * Mostra ring gauge animado, dose zones e stock bars
 * Usado na Landing page para dar preview do que o usuário vai encontrar
 */
export default function AppPreview() {
  return (
    <div className="app-preview">
      <div className="preview-header">
        <div className="preview-score">
          <svg viewBox="0 0 60 60" className="ring-svg">
            <circle
              cx="30"
              cy="30"
              r="24"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="6"
            />
            <circle
              cx="30"
              cy="30"
              r="24"
              fill="none"
              stroke="var(--color-success)"
              strokeWidth="6"
              strokeDasharray="128 151"
              strokeLinecap="round"
              transform="rotate(-90 30 30)"
              className="ring-fill"
            />
          </svg>
          <span className="ring-percent">85%</span>
        </div>
        <span className="ring-streak">🔥 12d</span>
      </div>

      <div className="preview-zones">
        <div className="zone zone-now">
          <span className="zone-label">AGORA</span>
          <div className="zone-item">
            Losartana 08:00 <span className="swipe-hint">→</span>
          </div>
          <div className="zone-item done">
            Metformina 08:00 <span className="check">✓</span>
          </div>
        </div>
        <div className="zone zone-upcoming">
          <span className="zone-label">PRÓXIMAS</span>
          <div className="zone-item muted">Omeprazol 22:00</div>
        </div>
      </div>

      <div className="preview-stock">
        <div className="stock-bar critical">
          <span>Omeprazol</span>
          <div className="bar">
            <div className="fill" />
          </div>
          <span className="days">2d 🔴</span>
        </div>
        <div className="stock-bar">
          <span>Metformina</span>
          <div className="bar">
            <div className="fill" />
          </div>
          <span className="days">24d 🟢</span>
        </div>
      </div>
    </div>
  )
}
