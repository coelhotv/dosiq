import './Profile.css'

export default function ProfileLink({ icon, label, detail, onClick }) {
  return (
    <button className="profile-link" onClick={onClick}>
      <span className="profile-link__icon">{icon}</span>
      <span className="profile-link__label">{label}</span>
      {detail && <span className="profile-link__detail">{detail}</span>}
      <span className="profile-link__chevron">›</span>
    </button>
  )
}
