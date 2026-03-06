import './Profile.css'

export default function ProfileHeader({ name, email }) {
  const initial = (name || email || 'P')[0].toUpperCase()

  return (
    <div className="profile-header">
      <div className="profile-header__avatar">{initial}</div>
      <div className="profile-header__info">
        <h2 className="profile-header__name">{name || 'Paciente'}</h2>
        {email && <span className="profile-header__email">{email}</span>}
      </div>
    </div>
  )
}
