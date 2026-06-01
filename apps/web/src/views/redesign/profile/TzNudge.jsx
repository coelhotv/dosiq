/**
 * TzNudge — convite passivo de reconciliação de fuso horário (F4.3f.0).
 *
 * Usuários existentes nasceram com `timezone` no DEFAULT (São Paulo) porque a
 * UI nunca capturou o fuso do device. Este card informa a nova feature e leva
 * ao seletor de fuso nas Configurações. Dispensável; o dismiss persiste em
 * localStorage (e some também após o usuário ajustar o tz manualmente).
 */
import { Globe, X } from 'lucide-react'

const DISMISS_KEY = 'dosiq_tz_nudge_dismissed'

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function TzNudge({ onNavigate, onDismiss }) {
  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ambiente sem localStorage (teste/privado) — dismiss apenas em memória
    }
    onDismiss?.()
  }

  return (
    <section className="ph-tz-nudge" role="status">
      <span className="ph-tz-nudge__icon"><Globe size={22} /></span>
      <div className="ph-tz-nudge__body">
        <h3 className="ph-tz-nudge__title">Novidade: fuso horário</h3>
        <p className="ph-tz-nudge__text">
          Agora o Dosiq respeita o seu fuso horário. Veja nas
          &lsquo;Configurações&rsquo; e ajuste se for necessário.
        </p>
        <button
          className="ph-tz-nudge__cta"
          onClick={() => onNavigate('account-settings')}
          type="button"
        >
          Ajustar fuso horário
        </button>
      </div>
      <button
        className="ph-tz-nudge__close"
        onClick={handleDismiss}
        type="button"
        aria-label="Dispensar aviso"
      >
        <X size={18} />
      </button>
    </section>
  )
}

TzNudge.isDismissed = isDismissed
TzNudge.DISMISS_KEY = DISMISS_KEY
