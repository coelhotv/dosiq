// src/views/redesign/profile/ProfileSectionRedesign.jsx
import './ProfileRedesign.css'

/**
 * Seção de perfil redesenhada — tonal surface, sem glass, sem borda.
 */
export default function ProfileSectionRedesign({ title, children }) {
  return (
    <div className="pr-section">
      <h3 className="pr-section__title">{title}</h3>
      <div className="pr-section__content">{children}</div>
    </div>
  )
}
