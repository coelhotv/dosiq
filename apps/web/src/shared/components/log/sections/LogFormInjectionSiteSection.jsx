import { AlertTriangle } from 'lucide-react'
import { INJECTION_SITES, getInjectionSiteLabel, getInjectionSiteAbsorption } from '@dosiq/core'

/**
 * Seção de sítio de aplicação — só renderizada para injetáveis (031/US1).
 * Dropdown dos 8 sítios + "última aplicação global" (US2) + alerta não-bloqueante
 * quando o sítio escolhido = último (US3) + hint educacional de absorção (US4, não-SaMD).
 */
export default function LogFormInjectionSiteSection({ value, lastInjectionSite, handleChange }) {
  const repeatedSite = value && lastInjectionSite && value === lastInjectionSite
  const absorption = getInjectionSiteAbsorption(value)

  return (
    <div className="form-group">
      <label htmlFor="injection_site">Local de aplicação (opcional)</label>

      {lastInjectionSite && (
        <p className="injection-site-last">
          Última aplicação: <strong>{getInjectionSiteLabel(lastInjectionSite)}</strong>
        </p>
      )}

      <select
        id="injection_site"
        name="injection_site"
        value={value || ''}
        onChange={handleChange}
      >
        <option value="">Não informar</option>
        {INJECTION_SITES.map((site) => (
          <option key={site.value} value={site.value}>
            {site.label}
          </option>
        ))}
      </select>

      {repeatedSite && (
        <p className="injection-site-alert" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          Mesmo local da última aplicação — considere rotacionar.
        </p>
      )}

      {absorption && <p className="injection-site-hint">{absorption}</p>}
    </div>
  )
}
