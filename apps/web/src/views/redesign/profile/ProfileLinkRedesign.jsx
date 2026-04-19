// src/views/redesign/profile/ProfileLinkRedesign.jsx
import { ChevronRight } from 'lucide-react'
import './ProfileRedesign.css'

/**
 * Item de navegação do perfil redesenhado — sanctuary list item.
 * Ícone em container secondary-fixed, chevron Lucide.
 *
 * @param {string} icon - Emoji do ícone (mantido para compatibilidade com original)
 * @param {string} label - Texto do item
 * @param {string} [detail] - Detalhe opcional (ex: status)
 * @param {Function} onClick - Callback de clique
 */
export default function ProfileLinkRedesign({ icon, label, detail, onClick }) {
  return (
    <button className="pr-link" onClick={onClick} type="button">
      <span className="pr-link__icon-wrap" aria-hidden="true">
        <span className="pr-link__icon-emoji">{icon}</span>
      </span>
      <span className="pr-link__label">{label}</span>
      {detail && <span className="pr-link__detail">{detail}</span>}
      <ChevronRight className="pr-link__chevron" size={18} aria-hidden="true" />
    </button>
  )
}
