import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { parseISO } from '@utils/dateUtils'
import { ArrowLeft, FileText, Share2 } from 'lucide-react'
import {
  RedesignMedicinesSection,
  RedesignStockSection,
  RedesignPrescriptionsSection,
  RedesignTitrationsSection,
} from './ConsultationRedesignSections'
import ConsultationAdherenceSection from './ConsultationAdherenceSection'
import './ConsultationViewRedesign.css'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function ConsultationViewRedesign({ data, onGeneratePDF, onShare, onBack }) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const { patientInfo, activeMedicines, adherenceSummary, stockAlerts, prescriptionStatus, activeTitrations, generatedAt } = useMemo(() => data || {}, [data])

  const handleGeneratePDF = async () => { setIsGeneratingPDF(true); try { await onGeneratePDF?.() } finally { setIsGeneratingPDF(false) } }
  const handleShare = async () => { setIsSharing(true); try { await onShare?.() } finally { setIsSharing(false) } }

  const formattedGeneratedAt = useMemo(() => {
    if (!generatedAt) return ''
    return parseISO(generatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }, [generatedAt])

  return (
    <motion.div className="sr-consultation" initial="hidden" animate="visible" variants={containerVariants}>
      <motion.header className="sr-consultation__header" variants={itemVariants}>
        <div className="sr-consultation__header-content">
          <div>
            <h1 className="sr-consultation__patient-name">{patientInfo?.name || 'Paciente'}</h1>
            {patientInfo?.age && <span className="sr-consultation__patient-age">{patientInfo.age} anos</span>}
          </div>
          <div className="sr-consultation__gen-info">
            <span className="sr-consultation__gen-label">Gerado em:</span>
            <span className="sr-consultation__gen-time">{formattedGeneratedAt}</span>
          </div>
        </div>
        {onBack && (
          <button className="sr-consultation__back-btn" onClick={onBack} type="button">
            <ArrowLeft size={18} /> Voltar
          </button>
        )}
      </motion.header>

      <main className="sr-consultation__content">
        <RedesignMedicinesSection activeMedicines={activeMedicines} />
        <ConsultationAdherenceSection adherenceSummary={adherenceSummary} />
        <RedesignStockSection stockAlerts={stockAlerts} />
        <RedesignPrescriptionsSection prescriptionStatus={prescriptionStatus} />
        <RedesignTitrationsSection activeTitrations={activeTitrations} />
      </main>

      <motion.section className="sr-consultation__section sr-consultation__section--actions" variants={itemVariants}>
        <div className="sr-consultation__actions">
          <button className="sr-consultation__action-btn sr-consultation__action-btn--secondary" onClick={handleGeneratePDF} disabled={isGeneratingPDF} type="button">
            <FileText size={18} />
            {isGeneratingPDF ? 'Gerando...' : 'Gerar PDF'}
          </button>
          <button className="sr-consultation__action-btn sr-consultation__action-btn--primary" onClick={handleShare} disabled={isSharing} type="button">
            <Share2 size={18} />
            {isSharing ? 'Enviando...' : 'Compartilhar'}
          </button>
        </div>
      </motion.section>
    </motion.div>
  )
}
