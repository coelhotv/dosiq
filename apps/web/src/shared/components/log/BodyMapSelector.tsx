import { useId, useCallback, type KeyboardEvent } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import {
  BODY_MAP_FACES,
  BODY_MAP_SIDE_LETTERS,
  BODY_MAP_SILHOUETTE,
  INJECTION_BODY_MAP_VIEWBOX,
  INJECTION_SITES,
  getBodyMapRegionsByFace,
  getInjectionSiteAbsorption,
  getInjectionSiteLabel,
  type BodyMapFace,
} from '@dosiq/core'
import './BodyMapSelector.css'

const FACE_LABELS = { frente: 'Frente', costas: 'Costas' }

/**
 * Nome falado de uma região: label PT do core + estado ("Coxa (esquerda), selecionado").
 * Deriva de `getInjectionSiteLabel` — nunca hardcoded (PO-4).
 */
function regionName(value: string, isSelected: boolean, isLast: boolean): string {
  const parts = [getInjectionSiteLabel(value)]
  if (isSelected) parts.push('selecionado')
  if (isLast) parts.push('última aplicação')
  return parts.join(', ')
}

/** Uma vista (frente ou costas): silhueta + regiões da face, com hachura própria por instância. */
function BodyMapFaceView({
  face,
  uid,
  value,
  lastUsedSite,
  disabled,
  onToggle,
}: {
  face: BodyMapFace
  uid: string
  value: string | null
  lastUsedSite: string | null
  disabled: boolean
  onToggle: (site: string) => void
}) {
  const hatchId = `bm-hatch-${uid}-${face}`
  const { width, height } = INJECTION_BODY_MAP_VIEWBOX

  const handleKeyDown = (e: KeyboardEvent, site: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle(site)
    }
  }

  return (
    <div className="body-map__face">
      <svg
        className="body-map__svg"
        viewBox={`0 0 ${width} ${height}`}
        data-face={face}
      >
        <defs>
          <pattern
            id={hatchId}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="5" height="5" className="body-map__hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="5" className="body-map__hatch-line" />
          </pattern>
        </defs>
        <g aria-hidden="true" className="body-map__side-letters">
          <text x="10" y="13">
            {BODY_MAP_SIDE_LETTERS.left}
          </text>
          <text x={width - 10} y="13">
            {BODY_MAP_SIDE_LETTERS.right}
          </text>
        </g>
        <g aria-hidden="true" className="body-map__silhouette">
          <circle
            cx={BODY_MAP_SILHOUETTE.head.cx}
            cy={BODY_MAP_SILHOUETTE.head.cy}
            r={BODY_MAP_SILHOUETTE.head.r}
          />
          <rect
            x={BODY_MAP_SILHOUETTE.neck.x}
            y={BODY_MAP_SILHOUETTE.neck.y}
            width={BODY_MAP_SILHOUETTE.neck.width}
            height={BODY_MAP_SILHOUETTE.neck.height}
            rx={BODY_MAP_SILHOUETTE.neck.rx}
          />
          {BODY_MAP_SILHOUETTE.limbs.map((limb) => (
            <path
              key={limb.d}
              d={limb.d}
              className="body-map__limb"
              strokeWidth={limb.strokeWidth}
            />
          ))}
          <path d={BODY_MAP_SILHOUETTE.torso} />
          {face === 'costas' &&
            BODY_MAP_SILHOUETTE.backDetails.map((d) => (
              <path key={d} d={d} className="body-map__back-line" />
            ))}
        </g>
        {getBodyMapRegionsByFace(face).map((region) => {
          const isSelected = region.value === value
          const isLast = region.value === lastUsedSite
          const state = isSelected ? 'selected' : isLast ? 'last' : 'idle'
          return (
            <g
              key={region.value}
              role="radio"
              aria-checked={isSelected}
              aria-label={regionName(region.value, isSelected, isLast)}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : 0}
              data-site={region.value}
              className={`body-map__region body-map__region--${state}`}
              onClick={disabled ? undefined : () => onToggle(region.value)}
              onKeyDown={
                disabled ? undefined : (e) => handleKeyDown(e, region.value)
              }
            >
              <path
                d={region.path}
                className="body-map__region-shape"
                fill={state === 'last' ? `url(#${hatchId})` : undefined}
              />
              {isSelected && (
                <g
                  transform={`translate(${region.centroid.x},${region.centroid.y})`}
                  className="body-map__mark-selected"
                >
                  <circle r="7" />
                  <path d="M-3.2,0.2 L-0.8,2.6 L3.4,-2.6" />
                </g>
              )}
              {isLast && !isSelected && (
                <g
                  transform={`translate(${region.centroid.x},${region.centroid.y})`}
                  className="body-map__mark-last"
                >
                  <circle r="6.5" className="body-map__mark-last-ring" />
                  <circle r="2" className="body-map__mark-last-dot" />
                </g>
              )}
              <path d={region.hitPath} className="body-map__hit" />
            </g>
          )
        })}
      </svg>
      <span className="body-map__face-label">
        {FACE_LABELS[face]}
        {face === 'costas' && <span className="body-map__face-note"> · espelho</span>}
      </span>
    </div>
  )
}

/**
 * Mapa corporal de sítio de injeção (spec 071). Frente e costas lado a lado, geometria do
 * `@dosiq/core` (ADR-096). Estados: `selected` · `lastUsed` · `repeated` (selected === lastUsed).
 * Desmarcar tem dois caminhos (D7): tocar a região já selecionada ou "Não informar".
 * A lista textual é a rota equivalente de teclado/leitor de tela (AC-9).
 * SaMD: descreve o fato registrado; não sugere sítio.
 */
export default function BodyMapSelector({
  value,
  onChange,
  lastUsedSite = null,
  disabled = false,
}: {
  value: string | null
  onChange: (value: string | null) => void
  lastUsedSite?: string | null
  disabled?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const repeated = !!value && value === lastUsedSite
  const absorption = getInjectionSiteAbsorption(value)

  const toggle = useCallback(
    (site: string) => {
      if (disabled) return
      onChange(site === value ? null : site)
    },
    [disabled, onChange, value]
  )

  const clear = useCallback(() => {
    if (disabled) return
    onChange(null)
  }, [disabled, onChange])

  return (
    <div className={`body-map${disabled ? ' body-map--disabled' : ''}`}>
      <div className="body-map__top">
        <span className="body-map__last">
          Última aplicação: <strong>{getInjectionSiteLabel(lastUsedSite) || '—'}</strong>
        </span>
        <button
          type="button"
          className={`body-map__clear${value === null ? ' body-map__clear--active' : ''}`}
          aria-pressed={!value}
          onClick={clear}
          disabled={disabled}
        >
          Não informar
        </button>
      </div>

      <div className="body-map__layout">
        <div className="body-map__figure">
          <div
            className="body-map__faces"
            role="radiogroup"
            aria-label="Local de aplicação no mapa do corpo"
            aria-disabled={disabled || undefined}
          >
            {BODY_MAP_FACES.map((face) => (
              <BodyMapFaceView
                key={face}
                face={face}
                uid={uid}
                value={value}
                lastUsedSite={lastUsedSite}
                disabled={disabled}
                onToggle={toggle}
              />
            ))}
          </div>
          <div className="body-map__legend" aria-hidden="true">
            <span className="body-map__legend-item">
              <span className="body-map__swatch body-map__swatch--selected" />
              selecionado
            </span>
            {lastUsedSite && (
              <span className="body-map__legend-item">
                <span className="body-map__swatch body-map__swatch--last" />
                última aplicação
              </span>
            )}
          </div>
        </div>

        <div className="body-map__side">
          <span className="body-map__list-title" id={`bm-list-${uid}`}>
            Ou escolha pela lista
          </span>
          <div className="body-map__list" role="group" aria-labelledby={`bm-list-${uid}`}>
            {INJECTION_SITES.map((site) => {
              const isSelected = site.value === value
              const isLast = site.value === lastUsedSite
              return (
                <button
                  key={site.value}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={disabled}
                  className={`body-map__list-item${isSelected ? ' body-map__list-item--selected' : ''}${
                    isLast && !isSelected ? ' body-map__list-item--last' : ''
                  }`}
                  onClick={() => toggle(site.value)}
                >
                  <span>{site.label}</span>
                  {isSelected && <Check size={15} aria-hidden="true" />}
                </button>
              )
            })}
          </div>

          <div className={`body-map__summary${value ? ' body-map__summary--filled' : ''}`}>
            <span className="body-map__summary-label">
              {value ? getInjectionSiteLabel(value) : 'Nenhum local selecionado'}
            </span>
            {absorption && <span className="injection-site-hint">{absorption}</span>}
          </div>

          {repeated && (
            <p className="injection-site-alert" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              Mesmo local da última aplicação — considere rotacionar.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
