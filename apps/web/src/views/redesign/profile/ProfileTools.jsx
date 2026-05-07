/**
 * ProfileTools — Seção de ferramentas de gestão do perfil.
 */
import { ClipboardPlus, History, CloudDownload } from 'lucide-react'

export default function ProfileTools({ onNavigate, setIsReportModalOpen, setIsExportDialogOpen }) {
  return (
    <section className="ph-tools">
      <h2 className="ph-tools__title">Ferramentas de Gestão</h2>
      <div className="ph-tools__grid">
        <ToolCard
          icon={ClipboardPlus} label="Relatório PDF"
          description="Gerar relatório completo dos últimos 30 dias"
          onClick={() => setIsReportModalOpen(true)}
        />
        <ToolCard
          icon={History} label="Histórico de Doses"
          description="Calendário, adesão e heatmap"
          onClick={() => onNavigate('health-history')}
        />
        <ToolCard
          icon={CloudDownload} label="Exportar Dados"
          description="Formato CSV ou JSON para outros sistemas"
          onClick={() => setIsExportDialogOpen(true)}
        />
      </div>
    </section>
  )
}

function ToolCard({ icon: Icon, label, description, onClick }) {
  return (
    <button className="ph-tool-card" onClick={onClick} type="button">
      <span className="ph-tool-card__icon">{Icon && <Icon size={24} />}</span>
      <span className="ph-tool-card__label">{label}</span>
      {description && <span className="ph-tool-card__desc">{description}</span>}
    </button>
  )
}
