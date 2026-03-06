import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { medicineService, protocolService, stockService } from '@shared/services'
import { DOSAGE_UNITS } from '@schemas/medicineSchema'
import { FREQUENCIES } from '@schemas/protocolSchema'
import Button from '@shared/components/ui/Button'
import './TreatmentWizard.css'

const FREQUENCY_LABELS = {
  diario: 'Diário',
  dias_alternados: 'Dias alternados',
  semanal: 'Semanal',
  personalizado: 'Personalizado',
  quando_necessario: 'Quando necessário',
}

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -300 : 300, opacity: 0 }),
}

export default function TreatmentWizard({ onComplete, onCancel, preselectedMedicine, treatmentPlanId }) {
  // States
  const [step, setStep] = useState(preselectedMedicine ? 2 : 1)
  const [direction, setDirection] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const [medicineData, setMedicineData] = useState({
    name: preselectedMedicine?.name || '',
    type: preselectedMedicine?.type || 'medicamento',
    dosage_per_pill: preselectedMedicine?.dosage_per_pill || '',
    dosage_unit: preselectedMedicine?.dosage_unit || 'mg',
  })

  const [protocolData, setProtocolData] = useState({
    frequency: 'diario',
    time_schedule: ['08:00'],
    dosage_per_intake: 1,
    start_date: new Date().toISOString().split('T')[0],
  })

  const [stockData, setStockData] = useState({
    quantity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    unit_price: '',
    expiration_date: '',
  })

  const { refresh } = useDashboard()

  // Navigation
  const goNext = useCallback(() => {
    setDirection(1)
    setStep(s => s + 1)
  }, [])

  const goBack = useCallback(() => {
    setDirection(-1)
    setStep(s => s - 1)
  }, [])

  // Medicine field handler
  const updateMedicine = useCallback((field, value) => {
    setMedicineData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Protocol field handler
  const updateProtocol = useCallback((field, value) => {
    setProtocolData(prev => ({ ...prev, [field]: value }))
  }, [])

  const addTime = useCallback(() => {
    setProtocolData(prev => ({
      ...prev,
      time_schedule: [...prev.time_schedule, '12:00'],
    }))
  }, [])

  const removeTime = useCallback((index) => {
    setProtocolData(prev => ({
      ...prev,
      time_schedule: prev.time_schedule.filter((_, i) => i !== index),
    }))
  }, [])

  const updateTime = useCallback((index, value) => {
    setProtocolData(prev => ({
      ...prev,
      time_schedule: prev.time_schedule.map((t, i) => i === index ? value : t),
    }))
  }, [])

  // Stock field handler
  const updateStock = useCallback((field, value) => {
    setStockData(prev => ({ ...prev, [field]: value }))
  }, [])

  // Submit
  const handleComplete = useCallback(async (skipStock) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const medicine = preselectedMedicine || await medicineService.create({
        name: medicineData.name,
        type: medicineData.type,
        dosage_per_pill: Number(medicineData.dosage_per_pill),
        dosage_unit: medicineData.dosage_unit,
      })

      let protocol = null
      if (step >= 3 || (step === 2 && !skipStock)) {
        protocol = await protocolService.create({
          medicine_id: medicine.id,
          name: `${medicine.name} - ${FREQUENCY_LABELS[protocolData.frequency]}`,
          frequency: protocolData.frequency,
          time_schedule: protocolData.time_schedule,
          dosage_per_intake: Number(protocolData.dosage_per_intake),
          start_date: protocolData.start_date,
          treatment_plan_id: treatmentPlanId || null,
        })
      }

      if (!skipStock && stockData.quantity) {
        await stockService.create({
          medicine_id: medicine.id,
          quantity: Number(stockData.quantity),
          purchase_date: stockData.purchase_date,
          unit_price: Number(stockData.unit_price) || 0,
          expiration_date: stockData.expiration_date || null,
        })
      }

      refresh()
      setResult({ medicine, protocol })
      setDirection(1)
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }, [medicineData, protocolData, stockData, preselectedMedicine, treatmentPlanId, refresh, step])

  // Validation
  const isMedicineValid = medicineData.name.length >= 2 && medicineData.dosage_per_pill > 0
  const isProtocolValid = protocolData.time_schedule.length > 0 && protocolData.dosage_per_intake > 0

  return (
    <div className="wizard">
      {/* Progress dots */}
      {step < 4 && (
        <div className="wizard__progress">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`wizard__dot ${s <= step ? 'wizard__dot--active' : ''}`}
            />
          ))}
          <span className="wizard__step-label">{step}/3</span>
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="wizard__content"
        >
          {step === 1 && (
            <div className="wizard__step">
              <h3 className="wizard__title">Medicamento</h3>

              <label className="wizard__label">
                Nome *
                <input
                  type="text"
                  className="wizard__input"
                  value={medicineData.name}
                  onChange={(e) => updateMedicine('name', e.target.value)}
                  placeholder="Ex: Losartana"
                  autoFocus
                />
              </label>

              <label className="wizard__label">
                Tipo
                <select
                  className="wizard__select"
                  value={medicineData.type}
                  onChange={(e) => updateMedicine('type', e.target.value)}
                >
                  <option value="medicamento">Medicamento</option>
                  <option value="suplemento">Suplemento</option>
                </select>
              </label>

              <div className="wizard__row">
                <label className="wizard__label" style={{ flex: 1 }}>
                  Dosagem *
                  <input
                    type="number"
                    className="wizard__input"
                    value={medicineData.dosage_per_pill}
                    onChange={(e) => updateMedicine('dosage_per_pill', e.target.value)}
                    placeholder="50"
                    min="0"
                    step="any"
                  />
                </label>
                <label className="wizard__label" style={{ width: 100 }}>
                  Unidade
                  <select
                    className="wizard__select"
                    value={medicineData.dosage_unit}
                    onChange={(e) => updateMedicine('dosage_unit', e.target.value)}
                  >
                    {DOSAGE_UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="wizard__actions">
                <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button variant="primary" onClick={goNext} disabled={!isMedicineValid}>
                  Próximo →
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard__step">
              <h3 className="wizard__title">Como Tomar</h3>

              <label className="wizard__label">
                Frequência
                <select
                  className="wizard__select"
                  value={protocolData.frequency}
                  onChange={(e) => updateProtocol('frequency', e.target.value)}
                >
                  {FREQUENCIES.map(f => (
                    <option key={f} value={f}>{FREQUENCY_LABELS[f] || f}</option>
                  ))}
                </select>
              </label>

              <div className="wizard__label">
                Horários
                {protocolData.time_schedule.map((time, i) => (
                  <div key={i} className="wizard__time-row">
                    <input
                      type="time"
                      className="wizard__input"
                      value={time}
                      onChange={(e) => updateTime(i, e.target.value)}
                    />
                    {protocolData.time_schedule.length > 1 && (
                      <button className="wizard__remove-time" onClick={() => removeTime(i)}>✕</button>
                    )}
                  </div>
                ))}
                <button className="wizard__add-time" onClick={addTime}>+ Adicionar horário</button>
              </div>

              <label className="wizard__label">
                Comprimidos por dose
                <input
                  type="number"
                  className="wizard__input"
                  value={protocolData.dosage_per_intake}
                  onChange={(e) => updateProtocol('dosage_per_intake', e.target.value)}
                  min="1"
                  max="100"
                />
              </label>

              <label className="wizard__label">
                Data de início
                <input
                  type="date"
                  className="wizard__input"
                  value={protocolData.start_date}
                  onChange={(e) => updateProtocol('start_date', e.target.value)}
                />
              </label>

              <div className="wizard__actions">
                <Button variant="ghost" onClick={goBack}>← Voltar</Button>
                <Button variant="ghost" onClick={() => {
                  handleComplete(true)
                }}>Pular</Button>
                <Button variant="primary" onClick={goNext} disabled={!isProtocolValid}>
                  Próximo →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard__step">
              <h3 className="wizard__title">Estoque Atual</h3>

              <label className="wizard__label">
                Quantidade (comprimidos)
                <input
                  type="number"
                  className="wizard__input"
                  value={stockData.quantity}
                  onChange={(e) => updateStock('quantity', e.target.value)}
                  placeholder="60"
                  min="0"
                />
              </label>

              <label className="wizard__label">
                Data da compra
                <input
                  type="date"
                  className="wizard__input"
                  value={stockData.purchase_date}
                  onChange={(e) => updateStock('purchase_date', e.target.value)}
                />
              </label>

              <label className="wizard__label">
                Preço unitário (R$)
                <input
                  type="number"
                  className="wizard__input"
                  value={stockData.unit_price}
                  onChange={(e) => updateStock('unit_price', e.target.value)}
                  placeholder="0.75"
                  min="0"
                  step="0.01"
                />
              </label>

              <label className="wizard__label">
                Validade (opcional)
                <input
                  type="date"
                  className="wizard__input"
                  value={stockData.expiration_date}
                  onChange={(e) => updateStock('expiration_date', e.target.value)}
                />
              </label>

              {error && <div className="wizard__error">{error}</div>}

              <div className="wizard__actions">
                <Button variant="ghost" onClick={goBack}>← Voltar</Button>
                <Button variant="ghost" onClick={() => handleComplete(true)} disabled={isSubmitting}>
                  Pular
                </Button>
                <Button variant="primary" onClick={() => handleComplete(false)} disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Concluir'}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && result && (
            <div className="wizard__step wizard__step--complete">
              <div className="wizard__complete-icon">✅</div>
              <h3 className="wizard__title">Pronto!</h3>
              <p className="wizard__complete-summary">
                <strong>{result.medicine?.name || medicineData.name}</strong> cadastrado
                {result.protocol && ` com protocolo ${FREQUENCY_LABELS[protocolData.frequency]}`}
                {stockData.quantity && ` e ${stockData.quantity} comprimidos em estoque`}
                .
              </p>
              <div className="wizard__actions wizard__actions--center">
                <Button variant="primary" onClick={() => onComplete(result)}>
                  Ir para Hoje
                </Button>
                <Button variant="ghost" onClick={() => {
                  setStep(1)
                  setResult(null)
                  setMedicineData({ name: '', type: 'medicamento', dosage_per_pill: '', dosage_unit: 'mg' })
                  setProtocolData({ frequency: 'diario', time_schedule: ['08:00'], dosage_per_intake: 1, start_date: new Date().toISOString().split('T')[0] })
                  setStockData({ quantity: '', purchase_date: new Date().toISOString().split('T')[0], unit_price: '', expiration_date: '' })
                }}>
                  Cadastrar outro
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
