// src/views/redesign/profile/ProfileHeaderRedesign.jsx
import './ProfileRedesign.css'

/**
 * Cabeçalho do perfil redesenhado — Santuário Terapêutico.
 * Avatar com initials em gradiente verde, sem glassmorphism.
 */
export default function ProfileHeaderRedesign({ name, email }) {
  // Gera initials: "Dona Maria" → "DM", "Carlos" → "C"
  const initials = (name || email || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <div className="pr-header">
      <div className="pr-header__avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="pr-header__info">
        <h2 className="pr-header__name">{name || 'Paciente'}</h2>
        {email && <span className="pr-header__email">{email}</span>}
      </div>
    </div>
  )
}
