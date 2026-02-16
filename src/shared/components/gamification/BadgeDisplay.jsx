import './BadgeDisplay.css'

export default function BadgeDisplay({ milestones }) {
  if (!milestones || milestones.length === 0) {
    return null
  }

  return (
    <div className="badge-display">
      <h3 className="badge-title">Conquistas</h3>
      <div className="badge-grid">
        {milestones.map((milestone) => (
          <div key={milestone.id} className="badge-item">
            <span className="badge-icon">{milestone.icon}</span>
            <span className="badge-name">{milestone.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
