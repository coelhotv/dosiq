import { useState, useEffect, useMemo } from 'react'
import { useDashboard } from '@dashboard/hooks/useDashboardContext.jsx'
import { useDoseZones } from '@dashboard/hooks/useDoseZones'
import { useComplexityMode } from '@dashboard/hooks/useComplexityMode'
import { getCurrentUser } from '@shared/utils/supabase'
import Modal from '@shared/components/ui/Modal'
import LogForm from '@shared/components/log/LogForm'
import Loading from '@shared/components/ui/Loading'
import RingGaugeRedesign from '@dashboard/components/RingGaugeRedesign'
import PriorityDoseCard from '@dashboard/components/PriorityDoseCard'
import CronogramaPeriodo from '@dashboard/components/CronogramaPeriodo'
import StockAlertInline from '@dashboard/components/StockAlertInline'

/**
 * DashboardRedesign — View principal do Santuário Terapêutico.
 *
 * Compartilha TODA a lógica de dados com Dashboard.jsx.
 * Diferença: apenas a camada de apresentação.
 *
 * @param {Function} onNavigate — Callback de navegação (view, params?) => void
 */
export default function DashboardRedesign({ onNavigate }) {
  // ── Dados compartilhados (NÃO duplicar) ──
  const { stats, stockSummary, refresh, isLoading: contextLoading } = useDashboard()
  const { zones, totals } = useDoseZones()
  const { mode: complexityMode } = useComplexityMode()

  // ── Estado local ──
  const [userName, setUserName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [prefillData, setPrefillData] = useState(null)

  // ── Computadas ──
  const allDoses = useMemo(() => [
    ...(zones.late    || []),
    ...(zones.now     || []),
    ...(zones.upcoming || []),
    ...(zones.later   || []),
    ...(zones.done    || []),
  ], [zones])

  const urgentDoses = useMemo(() => [
    ...(zones.late || []).filter(d => !d.isRegistered),
    ...(zones.now  || []).filter(d => !d.isRegistered),
  ], [zones])

  const criticalStockItems = useMemo(() => {
    if (!stockSummary?.items) return []
    return stockSummary.items.filter(
      (item) => item.stockStatus === 'critical' || item.stockStatus === 'low'
    )
  }, [stockSummary])

  // ── Carregar nome do usuário ──
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user?.user_metadata?.full_name) {
          setUserName(user.user_metadata.full_name.split(' ')[0])
        } else if (user?.email) {
          setUserName(user.email.split('@')[0])
        }
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  // ── Handlers ──
  const handleRegisterDose = (dose) => {
    setPrefillData({
      protocol_id: dose.protocolId,
      medicine_id: dose.medicineId,
      medicine_name: dose.medicineName,
      scheduled_time: dose.scheduledTime,
      dosage_per_intake: dose.dosagePerIntake,
    })
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setPrefillData(null)
  }

  const handleLogSuccess = () => {
    setIsModalOpen(false)
    setPrefillData(null)
    refresh()
  }

  // ── Loading state ──
  if (isLoading || contextLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Loading text="Carregando..." />
      </div>
    )
  }

  const adherenceScore = stats?.adherenceScore ?? 0
  const streak = stats?.streak ?? 0
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div
      className="page-container"
      style={{ paddingTop: '1.5rem', paddingBottom: '2rem' }}
      aria-label="Dashboard — Meus Remédios"
    >
      {/* ─── 1. Header + Ring de Adesão ─── */}
      <header
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '1rem', marginBottom: '1.5rem', textAlign: 'center',
        }}
      >
        <RingGaugeRedesign
          score={adherenceScore}
          streak={streak}
          size={complexityMode === 'complex' ? 'medium' : 'large'}
        />

        <div>
          <h1 style={{
            margin: 0,
            fontFamily: 'var(--font-display, Public Sans, sans-serif)',
            fontSize: 'var(--text-headline-md, 1.75rem)',
            fontWeight: '700',
            color: 'var(--color-on-surface, #191c1d)',
            lineHeight: 1.2,
          }}>
            {userName ? `Olá, ${userName} 👋` : 'Olá! 👋'}
          </h1>

          <p style={{
            margin: '0.25rem 0 0',
            fontFamily: 'var(--font-body, Lexend, sans-serif)',
            fontSize: 'var(--text-body-lg, 1rem)',
            color: 'var(--color-on-surface-variant, #3e4946)',
          }}>
            {today}
          </p>

          {totals.remaining > 0 && (
            <p style={{
              margin: '0.25rem 0 0',
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontSize: 'var(--text-body-lg, 1rem)',
              color: 'var(--color-outline, #6d7a76)',
            }}>
              {totals.remaining} dose{totals.remaining !== 1 ? 's' : ''} restante{totals.remaining !== 1 ? 's' : ''} hoje
            </p>
          )}

          {totals.remaining === 0 && totals.total > 0 && (
            <p style={{
              margin: '0.25rem 0 0',
              color: 'var(--color-primary, #006a5e)',
              fontWeight: '600',
              fontSize: 'var(--text-body-lg, 1rem)',
            }}>
              ✅ Todas as doses registradas!
            </p>
          )}
        </div>
      </header>

      {/* ─── 2. Alerta de Estoque Crítico ─── */}
      {criticalStockItems.length > 0 && (
        <section style={{ marginBottom: '1.25rem' }} aria-label="Alertas de estoque">
          <StockAlertInline
            criticalItems={criticalStockItems}
            onNavigateToStock={() => onNavigate?.('stock')}
          />
        </section>
      )}

      {/* ─── 3. Dose Prioritária ─── */}
      {urgentDoses.length > 0 && (
        <section style={{ marginBottom: '1.25rem' }} aria-label="Dose prioritária">
          <PriorityDoseCard
            doses={urgentDoses.slice(0, 3)}
            onRegister={handleRegisterDose}
            onRegisterAll={(doses) => handleRegisterDose(doses[0])}
          />
        </section>
      )}

      {/* ─── 4. Cronograma do Dia ─── */}
      {allDoses.length > 0 && (
        <section aria-label="Cronograma de hoje">
          <h2 style={{
            margin: '0 0 1rem',
            fontFamily: 'var(--font-display, Public Sans, sans-serif)',
            fontSize: 'var(--text-title-lg, 1.125rem)',
            fontWeight: '600',
            color: 'var(--color-on-surface, #191c1d)',
          }}>
            Cronograma de Hoje
          </h2>
          <CronogramaPeriodo allDoses={allDoses} onRegister={handleRegisterDose} />
        </section>
      )}

      {/* ─── 5. Empty state ─── */}
      {allDoses.length === 0 && !contextLoading && (
        <div
          style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-outline, #6d7a76)' }}
          role="status"
        >
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💊</p>
          <p style={{ fontFamily: 'var(--font-body, Lexend, sans-serif)', fontSize: 'var(--text-body-lg, 1rem)' }}>
            Nenhuma dose agendada para hoje.
          </p>
          <button
            onClick={() => onNavigate?.('medicines')}
            style={{
              marginTop: '1rem', padding: '0.75rem 1.5rem', minHeight: '48px',
              background: 'var(--gradient-primary, linear-gradient(135deg, #006a5e, #008577))',
              color: '#ffffff', border: 'none',
              borderRadius: 'var(--radius-button, 1.25rem)',
              fontFamily: 'var(--font-body, Lexend, sans-serif)',
              fontWeight: '600', cursor: 'pointer',
            }}
          >
            Adicionar Medicamento
          </button>
        </div>
      )}

      {/* ─── Modal de Registro de Dose ─── */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose} title="Registrar Dose">
        <LogForm
          prefillData={prefillData}
          onSuccess={handleLogSuccess}
          onCancel={handleModalClose}
        />
      </Modal>
    </div>
  )
}
