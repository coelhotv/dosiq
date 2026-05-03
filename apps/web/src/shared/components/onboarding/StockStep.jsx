import { useState, useCallback } from 'react'
import { z } from 'zod'
import { useOnboarding } from './useOnboarding'
import { cachedStockService } from '@shared/services/cachedServices'
import { formatLocalDate, getNow } from '@utils/dateUtils'
import Button from '@shared/components/ui/Button'
import './StockStep.css'

const stockFormSchema = z.object({
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantidade é obrigatória.' })
    .positive('Quantidade deve ser maior que 0.'),
  unitPrice: z.coerce.number().nonnegative('Preço não pode ser negativo.').optional().nullable(),
})

// Referência para o cálculo de duração do estoque (ex: 2 meses se 1 comprimido/dia)
const PREVIEW_MAX_QUANTITY = 60

export default function StockStep() {
  // 1. States
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // 2. Context
  const { onboardingData, nextStep } = useOnboarding()
  const medicine = onboardingData.medicine

  // 3. Handlers
  const handleSaveStock = useCallback(async () => {
    setError(null)

    // Validação com Zod
    const result = stockFormSchema.safeParse({ quantity, unitPrice })
    if (!result.success) {
      setError(result.error.errors[0]?.message || 'Erro na validação')
      return
    }

    setIsLoading(true)

    try {
      const validatedData = result.data
      await cachedStockService.add({
        medicine_id: medicine.id,
        quantity: validatedData.quantity,
        unit_price: validatedData.unitPrice,
        purchase_date: formatLocalDate(getNow()),
      })

      // Avança para próximo step após sucesso
      nextStep()
    } catch (err) {
      console.error('Erro ao salvar estoque:', err)
      setError(err.message || 'Erro ao salvar estoque. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }, [medicine, quantity, unitPrice, nextStep])

  const handleSkip = useCallback(() => {
    nextStep()
  }, [nextStep])

  // Guard clause
  if (!medicine) return null

  return (
    <div className="stock-step">
      <div className="stock-header">
        <h2>Adicionar Estoque Inicial</h2>
        <p>
          Quanto do medicamento <strong>{medicine.name}</strong> você tem agora?
        </p>
      </div>

      <div className="stock-form">
        <div className="form-group">
          <label htmlFor="quantity">Quantidade *</label>
          <input
            id="quantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Ex: 30 comprimidos"
            disabled={isLoading}
          />
          <small>Unidade: comprimidos</small>
        </div>

        <div className="form-group">
          <label htmlFor="unitPrice">Preço unitário (opcional)</label>
          <input
            id="unitPrice"
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="Ex: 2.50"
            disabled={isLoading}
          />
          <small>Preço por comprimido em R$</small>
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="stock-preview">
        <div className="preview-label">Previsão de estoque</div>
        <div className="stock-bar">
          <div
            className="stock-fill"
            style={{
              width: quantity
                ? Math.min((Number(quantity) / PREVIEW_MAX_QUANTITY) * 100, 100) + '%'
                : '0%',
            }}
          />
        </div>
        <div className="preview-text">
          {quantity ? `${quantity} comprimidos` : 'Digite a quantidade'}
        </div>
      </div>

      <div className="stock-navigation">
        <Button
          variant="primary"
          onClick={handleSaveStock}
          disabled={isLoading || !quantity}
          className="btn-save"
        >
          {isLoading ? 'Salvando...' : 'Salvar Estoque'}
        </Button>
        <button onClick={handleSkip} disabled={isLoading} className="btn-skip-stock">
          Pular esta etapa
        </button>
      </div>
    </div>
  )
}
