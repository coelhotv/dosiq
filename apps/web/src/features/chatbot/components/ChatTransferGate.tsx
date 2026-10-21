// ChatTransferGate.tsx — chat sem B (spec 096 S8b `E-ChatSemB`).
//
// Aparece no lugar do chat quando o titular não tem `international_transfer` vigente: o assistente
// manda a pergunta e um resumo dos tratamentos para a Groq (EUA). Nunca chama a API. "Ver a
// autorização" abre a autorização COMPLETA da caixa B (`EnableTransferModal`, guarda 11).

import { useState } from 'react'
import { motion } from 'framer-motion'
import { createConsentService, CHAT_WITHOUT_TRANSFER_COPY as COPY } from '@dosiq/core'
import EnableTransferModal from '@features/consent/components/EnableTransferModal'
import { supabase } from '@shared/utils/supabase'
import styles from './ChatTransferGate.module.css'

const consentService = createConsentService({ client: supabase })

interface ChatTransferGateProps {
  onClose: () => void
  /** B foi autorizado agora — o chat pode abrir. */
  onAuthorized: () => void
}

export default function ChatTransferGate({ onClose, onAuthorized }: ChatTransferGateProps) {
  const [enabling, setEnabling] = useState(false)

  const handleAuthorize = async () => {
    const res = await consentService.grant('international_transfer', 'web')
    if (res.ok) {
      setEnabling(false)
      onAuthorized()
    }
    return res.ok
  }

  return (
    <>
      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-transfer-gate-title"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="chat-transfer-gate-title" className={styles.title}>{COPY.title}</h2>
        <p className={styles.body}>{COPY.body}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.close} onClick={onClose}>
            {COPY.close}
          </button>
          <button type="button" className={styles.enable} onClick={() => setEnabling(true)}>
            {COPY.enable}
          </button>
        </div>
      </motion.div>
      {enabling && <EnableTransferModal onAuthorize={handleAuthorize} onCancel={() => setEnabling(false)} />}
    </>
  )
}
