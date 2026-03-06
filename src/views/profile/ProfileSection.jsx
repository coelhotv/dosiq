import './Profile.css'

export default function ProfileSection({ title, children }) {
  return (
    <div className="profile-section glass-card">
      <h3 className="profile-section__title">{title}</h3>
      <div className="profile-section__content">
        {children}
      </div>
    </div>
  )
}
