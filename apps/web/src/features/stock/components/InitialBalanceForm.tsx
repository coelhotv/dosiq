/**
 * InitialBalanceForm — Tela de "Estoque inicial" na ativação do controle de estoque
 * (spec 044, F4b / T017). Espelho web do mock mobile
 * `plans/mocks_app_mobile/export/044-dose-only-mode/liga-estoque-saldo-inicial.png`.
 *
 * Lista os medicamentos ativos e deixa informar (ou pular) o saldo atual de cada um.
 * Skip por item é AUSÊNCIA no array `entries` — não existe flag persistida (AP-285):
 * campo vazio = pulado, zero digitado = saldo real (envia 0).
 *
 * A ÚNICA escrita é `activateStockWithInitialBalance` (stockPreferenceService) — este
 * componente nunca chama profileRepo/stockRepo de escrita diretamente (T017/T019).
 * PO-3: sem retro-consumo — nenhuma leitura/escrita de medicine_logs ou dose_instances aqui.
 */
import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  createStockRepository,
  formatConcentration,
  formatActiveIngredientShort,
  formatStockDoses,
  stockUnitLabel,
} from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'
import Button from '@shared/components/ui/Button'
import { useStockTracking } from '@shared/hooks/useStockTracking'
import {
  activateStockWithInitialBalance,
  type StockPreferenceSource,
} from '@features/settings/services/stockPreferenceService'
import './InitialBalanceForm.css'

const stockRepo = createStockRepository({ client: supabase, getUserId })

interface MedicineOption {
  id: string
  name: string
  dosage_per_pill?: number | string | null
  dosage_unit?: string | null
  concentration_volume_ml?: number | string | null
  units_per_ml?: number | string | null
  presentation?: string | null
  /** Protocolos do medicamento — o ATIVO dá a dose por tomada (insumo da contagem de doses). */
  protocols?: { active?: boolean; dosage_per_intake?: number | string | null; intake_unit?: string | null }[]
}

interface InitialBalanceFormProps {
  source: StockPreferenceSource
  onDone: () => void
  onCancel: () => void
}

/** Vírgula PT-BR → ponto. String vazia fica vazia (não normaliza p/ "0"). */
function normalizeDecimal(raw: string): string {
  return raw.trim().replace(',', '.')
}

interface BalanceItemProps {
  medicine: MedicineOption
  isSkipped: boolean
  value: string
  error?: string
  saving: boolean
  onChangeValue: (medicineId: string, raw: string) => void
  onSkip: (medicineId: string) => void
  onUnskip: (medicineId: string) => void
}

function BalanceItem({
  medicine,
  isSkipped,
  value,
  error,
  saving,
  onChangeValue,
  onSkip,
  onUnskip,
}: BalanceItemProps) {
  const dosage = formatConcentration(
    medicine.dosage_per_pill,
    medicine.dosage_unit,
    medicine.concentration_volume_ml,
  )

  // Unidade REAL do saldo — a mesma que o cadastro de compra pede (líquido é comprado em
  // frascos × volume e persistido em ml). `dosage_unit` ('mg/ml') é CONCENTRAÇÃO, não unidade
  // de estoque: pedir "un." para um líquido gravaria ml sob outro rótulo.
  const stockUnit = stockUnitLabel(medicine)

  // O hint responde "quanto tempo de tratamento eu tenho na mão?" — DOSES (injetável: aplicações).
  // O hint de princípio ativo era redundante no líquido (repetia a concentração já exibida ao lado
  // do nome) e pouco acionável no sólido. Fallback: sem protocolo ativo o sólido cai no ativo.
  const hint = useMemo(() => {
    if (!value) return ''
    const protocol = (medicine.protocols || []).find((p) => p?.active) ?? null
    const doses = formatStockDoses(value.replace(',', '.'), medicine, protocol)
    if (doses) return `Equivale a ${doses.replace('≈ ', '')}`
    if (stockUnit === 'mL') return ''
    const short = formatActiveIngredientShort(
      value.replace(',', '.'),
      medicine.dosage_per_pill,
      medicine.dosage_unit,
    )
    return short ? `Equivale a ${short} no total` : ''
  }, [value, medicine, stockUnit])

  return (
    <li className="initial-balance-form__item">
      <div className="initial-balance-form__item-info">
        <span className="initial-balance-form__item-name">{medicine.name}</span>
        {dosage ? <span className="initial-balance-form__item-dosage">{dosage}</span> : null}
      </div>

      {isSkipped ? (
        <div className="initial-balance-form__skipped">
          <span className="initial-balance-form__skipped-label">
            Pulado · sem alerta até a primeira compra
          </span>
          <button
            type="button"
            className="initial-balance-form__link"
            onClick={() => onUnskip(medicine.id)}
            disabled={saving}
          >
            Informar
          </button>
        </div>
      ) : (
        <div className="initial-balance-form__input-group">
          {/* Coluna do input: o hint é irmão da caixa (ancorado ao número que explica),
              alinhado pela mesma borda direita. */}
          <div className="initial-balance-form__input-col">
          <div className="initial-balance-form__input-wrap">
            <input
              type="text"
              inputMode="decimal"
              aria-label={`Saldo inicial de ${medicine.name}, em ${stockUnit === 'mL' ? 'mililitros' : 'unidades'}`}
              aria-invalid={Boolean(error)}
              className={`initial-balance-form__input${error ? ' initial-balance-form__input--error' : ''}`}
              value={value}
              onChange={(e) => onChangeValue(medicine.id, e.target.value)}
              placeholder="0"
              disabled={saving}
            />
            <span className="initial-balance-form__suffix">{stockUnit}</span>
          </div>
          {hint ? <span className="initial-balance-form__hint">✨ {hint}</span> : null}
          </div>
          <button
            type="button"
            className="initial-balance-form__link"
            onClick={() => onSkip(medicine.id)}
            disabled={saving}
          >
            Não quero contar este
          </button>
          {error ? <span className="initial-balance-form__field-error">{error}</span> : null}
        </div>
      )}
    </li>
  )
}

export default function InitialBalanceForm({ source, onDone, onCancel }: InitialBalanceFormProps) {
  // States
  const { refresh } = useStockTracking()
  const [medicines, setMedicines] = useState<MedicineOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Memos
  const hasMedicines = useMemo(() => medicines.length > 0, [medicines])

  // Effects
  useEffect(() => {
    let cancelled = false
    stockRepo
      .getMedicinesWithStockOrActiveProtocol()
      .then((list) => {
        if (cancelled) return
        setMedicines(Array.isArray(list) ? list : [])
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError((err as Error)?.message ?? 'Erro ao carregar medicamentos')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Handlers
  const handleChangeValue = useCallback((medicineId: string, raw: string) => {
    setValues((prev) => ({ ...prev, [medicineId]: raw }))
    setFieldErrors((prev) => {
      if (!prev[medicineId]) return prev
      const next = { ...prev }
      delete next[medicineId]
      return next
    })
  }, [])

  const handleSkip = useCallback((medicineId: string) => {
    setSkipped((prev) => ({ ...prev, [medicineId]: true }))
    setFieldErrors((prev) => {
      if (!prev[medicineId]) return prev
      const next = { ...prev }
      delete next[medicineId]
      return next
    })
  }, [])

  const handleUnskip = useCallback((medicineId: string) => {
    setSkipped((prev) => {
      const next = { ...prev }
      delete next[medicineId]
      return next
    })
  }, [])

  const handleActivate = useCallback(async () => {
    setSubmitError(null)

    const entries: { medicineId: string; quantity: number }[] = []
    const errors: Record<string, string> = {}

    for (const medicine of medicines) {
      if (skipped[medicine.id]) continue
      const raw = values[medicine.id]
      if (raw === undefined || raw.trim() === '') continue // campo vazio = pulado

      const normalized = normalizeDecimal(raw)
      const quantity = Number(normalized)
      if (!Number.isFinite(quantity) || quantity < 0) {
        errors[medicine.id] = 'Quantidade inválida'
        continue
      }
      entries.push({ medicineId: medicine.id, quantity })
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSaving(true)
    try {
      await activateStockWithInitialBalance(entries, source)
      // AP-281 aqui dentro, e não no host: o form tem TRÊS hosts (settings, onboarding, upsell).
      // Deixar o refresh a cargo de quem monta significa que o próximo host a aparecer esquece —
      // e as superfícies de estoque continuam escondidas depois de o usuário ativar.
      await refresh()
      onDone()
    } catch (err) {
      setSubmitError((err as Error)?.message ?? 'Erro ao ativar o controle de estoque')
    } finally {
      setSaving(false)
    }
  }, [medicines, skipped, values, source, onDone, refresh])

  return (
    <div className="initial-balance-form">
      <div className="initial-balance-form__header">
        <h2>Estoque inicial</h2>
        <p>
          Quantos você tem de cada remédio agora? Pode pular os que não quiser contar — dá pra
          informar depois.
        </p>
      </div>

      {loading ? (
        <p className="initial-balance-form__status">Carregando medicamentos...</p>
      ) : loadError ? (
        <p className="initial-balance-form__status initial-balance-form__status--error">
          {loadError}
        </p>
      ) : !hasMedicines ? (
        <p className="initial-balance-form__status">Nenhum medicamento ativo encontrado.</p>
      ) : (
        <ul className="initial-balance-form__list">
          {medicines.map((medicine) => (
            <BalanceItem
              key={medicine.id}
              medicine={medicine}
              isSkipped={Boolean(skipped[medicine.id])}
              value={values[medicine.id] ?? ''}
              error={fieldErrors[medicine.id]}
              saving={saving}
              onChangeValue={handleChangeValue}
              onSkip={handleSkip}
              onUnskip={handleUnskip}
            />
          ))}
        </ul>
      )}

      {submitError ? (
        <p className="initial-balance-form__status initial-balance-form__status--error" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="initial-balance-form__actions">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleActivate} disabled={saving || loading}>
          {saving ? 'Ativando...' : 'Ativar estoque'}
        </Button>
      </div>
    </div>
  )
}
