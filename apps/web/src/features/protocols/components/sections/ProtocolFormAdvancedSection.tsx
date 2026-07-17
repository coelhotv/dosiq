export default function ProtocolFormAdvancedSection({
  formData,
  handleChange,
  isSimpleMode,
  showTitration,
}) {
  return (
    <>
      {/* 029 F3.1 (T017i) — WEB WRITE-FREEZE. A evolução do tratamento passou a ser criada e
          gerenciada no app; a web só LÊ (badge/timeline/PDF de consulta).

          O que estava aqui era a FÁBRICA DE ZUMBI (AP-301): o TitrationWizard e o select "Status
          Manual" deixavam marcar `titulando` na mão, e NENHUM caminho de escrita da web setava
          `stage_started_at` — o relógio que faz a escada andar. A escada nascia com status de
          "ligada" e um relógio nunca iniciado: nada avançava, sem erro e sem log, por 6 meses.
          A trava que faltava é o CHECK `titration_steps_current_exige_started_check` (T017a);
          esta seção é a superfície que produzia o dado que o CHECK agora recusa. */}
      {!isSimpleMode && showTitration && (
        <div className="titration-section">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="target_dosage">Dose Alvo (mg)</label>
              <input
                type="text"
                inputMode="decimal"
                id="target_dosage"
                name="target_dosage"
                value={formData.target_dosage}
                onChange={handleChange}
                placeholder="Ex: 50"
              />
            </div>
          </div>
          <p className="titration-section__frozen">
            📈 Gerencie a evolução do tratamento no aplicativo
          </p>
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
