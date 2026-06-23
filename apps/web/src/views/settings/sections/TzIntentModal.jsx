import { Plane, Home } from 'lucide-react'
import Modal from '@shared/components/ui/Modal'
import { TIMEZONE_OPTIONS } from '@dosiq/core'
import './TzIntentModal.css'

/**
 * Deriva o nome curto da cidade a partir do label de TIMEZONE_OPTIONS
 * (ex: 'Londres, Reino Unido (GMT+0/+1)' → 'Londres'). Nunca expõe o IANA cru.
 */
function cityLabel(value) {
  const opt = TIMEZONE_OPTIONS.find((o) => o.value === value)
  return opt ? opt.label.split(',')[0].trim() : value
}

/**
 * TzIntentModal — pergunta a intenção na troca de fuso (F4.3f.2).
 *
 * Ambas as opções PERSISTEM o tz novo; a diferença é o que acontece com as doses:
 *  - "Estou aqui só de viagem": mantém a agenda original (instante absoluto), só muda o render;
 *  - "Me mudei": re-ancora todas as doses futuras no fuso local.
 * Fechar/backdrop = cancelar (nada muda — o seletor reflete o fuso atual inalterado).
 *
 * @param {{fromTz:string,toTz:string}|null} prompt
 * @param {boolean} applying - desabilita ações durante o persist/regen
 * @param {Function} onTravel - opção viagem (persiste, sem regen)
 * @param {Function} onMove - opção mudança (persiste + regen)
 * @param {Function} onCancel - fechar sem alterar
 */
export default function TzIntentModal({ prompt, applying, onTravel, onMove, onCancel }) {
  if (!prompt) return null
  const cidadeNova = cityLabel(prompt.toTz)
  const cidadeAntiga = cityLabel(prompt.fromTz)

  return (
    <Modal isOpen onClose={onCancel} title="Seu fuso horário mudou">
      <p className="tz-intent__body">
        Você alterou para {cidadeNova}, antes era {cidadeAntiga}. O que fazer com os
        horários das suas doses?
      </p>

      <div className="tz-intent__options">
        <button
          type="button"
          className="tz-intent__option tz-intent__option--primary"
          onClick={onTravel}
          disabled={applying}
        >
          <Plane size={24} className="tz-intent__option-icon" aria-hidden="true" />
          <span className="tz-intent__option-label">Estou aqui só de viagem</span>
          <span className="tz-intent__option-desc">
            Mantemos a agenda original das suas doses, mas elas aparecem no fuso horário daqui.
          </span>
        </button>

        <button
          type="button"
          className="tz-intent__option"
          onClick={onMove}
          disabled={applying}
        >
          <Home size={24} className="tz-intent__option-icon" aria-hidden="true" />
          <span className="tz-intent__option-label">Me mudei para {cidadeNova}</span>
          <span className="tz-intent__option-desc">
            Alteramos a agenda de todas as suas doses para o horário local daqui.
          </span>
        </button>
      </div>
    </Modal>
  )
}
