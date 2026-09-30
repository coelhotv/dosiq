import { useState, useEffect, useRef, useId, useCallback } from 'react'
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import { getInjectionSiteLabel } from '@dosiq/core'
import BodyMapSelector from '@shared/components/log/BodyMapSelector'

/**
 * Seção de sítio de aplicação — só renderizada para injetáveis (031/US1).
 * Accordion fechado por padrão e aberto na edição (071, D-2): o campo é opcional e não pode
 * poluir quem só confirma a dose. Fechado, o subtexto mostra o valor escolhido ou a última
 * aplicação — fechar nunca esconde o que foi registrado. Aberto: mapa corporal (071) com
 * última aplicação, alerta de repetição e hint de absorção (031/US2-US4, não-SaMD).
 */
export default function LogFormInjectionSiteSection({
  value,
  lastInjectionSite,
  handleChange,
  isEditing = false,
  disabled = false,
}: {
  value: string | null | undefined
  lastInjectionSite: string | null
  handleChange: (e: { target: { name: string; value: string } }) => void
  isEditing?: boolean
  disabled?: boolean
}) {
  // States
  const [open, setOpen] = useState(isEditing)
  const focusOnOpenRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const selected = value || null
  const subtitle = selected
    ? getInjectionSiteLabel(selected)
    : lastInjectionSite
      ? `Última: ${getInjectionSiteLabel(lastInjectionSite)}`
      : 'Não informado'

  // Effects — abrir pelo toque move o foco para a primeira região do mapa (DESIGN_DECISOES §4b)
  useEffect(() => {
    if (!open || !focusOnOpenRef.current) return
    focusOnOpenRef.current = false
    panelRef.current?.querySelector<SVGGElement>('[role="radio"]')?.focus()
  }, [open])

  // Handlers
  const toggleOpen = useCallback(() => {
    focusOnOpenRef.current = !open
    setOpen(!open)
  }, [open])

  // O form guarda '' para "não informado" (mesmo contrato do <select> que este bloco substitui).
  const handleSiteChange = useCallback(
    (site: string | null) => {
      handleChange({ target: { name: 'injection_site', value: site ?? '' } })
    },
    [handleChange]
  )

  return (
    <div
      className={`form-group injection-site-accordion${open ? ' injection-site-accordion--open' : ''}${
        selected ? ' injection-site-accordion--filled' : ''
      }`}
    >
      <button
        type="button"
        className="injection-site-accordion__toggle"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggleOpen}
      >
        <MapPin size={18} aria-hidden="true" />
        <span className="injection-site-accordion__text">
          <span className="injection-site-accordion__title">
            Local de aplicação <span className="injection-site-accordion__optional">· opcional</span>
          </span>
          <span className="injection-site-accordion__subtitle">{subtitle}</span>
        </span>
        {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </button>

      {open && (
        <div id={panelId} ref={panelRef} className="injection-site-accordion__panel">
          <BodyMapSelector
            value={selected}
            onChange={handleSiteChange}
            lastUsedSite={lastInjectionSite}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}
