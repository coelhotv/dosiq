import TitrationWizard from '@protocols/components/TitrationWizard'

export default function ProtocolFormAdvancedSection({
  formData,
  handleChange,
  enableTitration,
  handleTitrationEnable,
  setTitrationSchedule,
  isSimpleMode,
  showTitration,
}) {
  return (
    <>
      {!isSimpleMode && showTitration && (
        <div
          className="form-row"
          style={{
            flexDirection: 'column',
            gap: 'var(--space-2)',
            border: '1px solid var(--border-color)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <div className="form-group checkbox-group" style={{ marginBottom: 0 }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enableTitration}
                onChange={(e) => handleTitrationEnable(e.target.checked)}
              />
              <span>📈 Regime de Titulação Inteligente</span>
            </label>
          </div>

          {enableTitration ? (
            <TitrationWizard
              schedule={formData.titration_schedule}
              onChange={setTitrationSchedule}
            />
          ) : (
            <div className="form-row" style={{ marginTop: 'var(--space-2)' }}>
              <div className="form-group">
                <label htmlFor="target_dosage">Dose Alvo (mg)</label>
                <input
                  type="number"
                  id="target_dosage"
                  name="target_dosage"
                  value={formData.target_dosage}
                  onChange={handleChange}
                  placeholder="Ex: 50"
                  step="0.1"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label htmlFor="titration_status">Status Manual</label>
                <select
                  id="titration_status"
                  name="titration_status"
                  value={formData.titration_status}
                  onChange={handleChange}
                >
                  <option value="estável">✅ Estável</option>
                  <option value="titulando">📈 Titulando</option>
                  <option value="alvo_atingido">🎯 Alvo Atingido</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="notes">
          Observações{!isSimpleMode && ''}
          {isSimpleMode && ' (opcional)'}
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder={
            isSimpleMode
              ? 'Ex: Tomar após as refeições'
              : 'Informações adicionais sobre o tratamento...'
          }
          rows={3}
        />
      </div>

      {!isSimpleMode && (
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="active"
              checked={formData.active}
              onChange={handleChange}
            />
            <span>Tratamento ativo</span>
          </label>
        </div>
      )}
    </>
  )
}
