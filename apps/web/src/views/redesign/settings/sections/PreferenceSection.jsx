import { MonitorCog, Form, Wand2, Grid3x2 } from 'lucide-react'

/**
 * PreferenceSection — Preferências de interface e experiência de uso.
 */
export default function PreferenceSection({
  overrideMode,
  handleComplexityChange,
  getComplexityDisplayMode,
}) {
  return (
    <section className="sr-section">
      <h3 className="sr-section__title">
        <MonitorCog size={24} /> Preferências
      </h3>

      <div className="sr-section__card">
        <h3 className="sr-section__card-header">Densidade da Interface</h3>

        <div className="sr-density__options">
          <button
            className={`sr-density__option ${overrideMode === 'simple' ? 'sr-density__option--selected' : ''}`}
            onClick={() => handleComplexityChange('simple')}
            type="button"
          >
            <Form size={24} className="sr-density__option-icon" />
            <div className="sr-density__option-label">Padrão</div>
            <div className="sr-density__option-desc">Textos maiores e foco no essencial</div>
          </button>

          <button
            className={`sr-density__option ${overrideMode === null ? 'sr-density__option--selected' : ''}`}
            onClick={() => handleComplexityChange('auto')}
            type="button"
          >
            <Wand2 size={24} className="sr-density__option-icon" />
            <div className="sr-density__option-label">Automático</div>
            <div className="sr-density__option-desc">Ajusta baseado nos seus tratamentos</div>
          </button>

          <button
            className={`sr-density__option ${overrideMode === 'complex' ? 'sr-density__option--selected' : ''}`}
            onClick={() => handleComplexityChange('complex')}
            type="button"
          >
            <Grid3x2 size={24} className="sr-density__option-icon" />
            <div className="sr-density__option-label">Detalhado</div>
            <div className="sr-density__option-desc">Gráficos detalhados e visões técnicas</div>
          </button>
        </div>

        <div className="sr-density__current">{getComplexityDisplayMode()}</div>
      </div>
    </section>
  )
}
