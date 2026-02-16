/**
 * EmptyState.jsx - Componente reutilizável para estados vazios
 *
 * Funcionalidades:
 * - Ilustrações SVG inline para diferentes contextos
 * - Título, descrição e CTA configuráveis
 * - Suporte a tema claro/escuro
 * - Responsivo e acessível (WCAG AA)
 *
 * @component
 * @example
 * <EmptyState
 *   illustration="dashboard"
 *   title="Nenhum protocolo encontrado"
 *   description="Comece adicionando seu primeiro medicamento"
 *   ctaLabel="Cadastrar Medicamento"
 *   onCtaClick={() => navigate('/medicines/new')}
 * />
 */

import { memo } from 'react'
import './EmptyState.css'

// Ilustrações SVG inline (<20KB total)
const illustrations = {
  dashboard: {
    svg: (
      <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect
          x="40"
          y="30"
          width="120"
          height="90"
          rx="8"
          fill="var(--color-bg-secondary)"
          stroke="var(--color-border-default)"
          strokeWidth="2"
        />
        <circle
          cx="100"
          cy="75"
          r="25"
          fill="var(--color-primary-bg)"
          stroke="var(--color-primary)"
          strokeWidth="2"
        />
        <path
          d="M90 75L97 82L110 68"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="55" y="95" width="30" height="4" rx="2" fill="var(--color-border-default)" />
        <rect x="95" y="95" width="50" height="4" rx="2" fill="var(--color-border-default)" />
        <circle
          cx="65"
          cy="50"
          r="8"
          fill="var(--color-success-bg)"
          stroke="var(--color-success)"
          strokeWidth="2"
        />
      </svg>
    ),
    label: 'Dashboard vazio',
  },
  history: {
    svg: (
      <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect
          x="30"
          y="20"
          width="140"
          height="110"
          rx="8"
          fill="var(--color-bg-secondary)"
          stroke="var(--color-border-default)"
          strokeWidth="2"
        />
        <rect x="45" y="35" width="110" height="15" rx="4" fill="var(--color-border-light)" />
        <rect x="45" y="55" width="110" height="15" rx="4" fill="var(--color-border-light)" />
        <rect x="45" y="75" width="80" height="15" rx="4" fill="var(--color-border-light)" />
        <circle
          cx="170"
          cy="82"
          r="15"
          fill="var(--color-primary-bg)"
          stroke="var(--color-primary)"
          strokeWidth="2"
        />
        <path
          d="M165 82L169 86L176 79"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="45" y="100" width="60" height="10" rx="2" fill="var(--color-border-light)" />
      </svg>
    ),
    label: 'Histórico vazio',
  },
  stock: {
    svg: (
      <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect
          x="55"
          y="40"
          width="30"
          height="70"
          rx="4"
          fill="var(--color-bg-secondary)"
          stroke="var(--color-border-default)"
          strokeWidth="2"
        />
        <rect
          x="85"
          y="50"
          width="30"
          height="60"
          rx="4"
          fill="var(--color-bg-secondary)"
          stroke="var(--color-border-default)"
          strokeWidth="2"
        />
        <rect
          x="115"
          y="60"
          width="30"
          height="50"
          rx="4"
          fill="var(--color-bg-secondary)"
          stroke="var(--color-border-default)"
          strokeWidth="2"
        />
        <circle
          cx="70"
          cy="30"
          r="12"
          fill="var(--color-warning-bg)"
          stroke="var(--color-warning)"
          strokeWidth="2"
        />
        <path
          d="M66 30L69 33L74 27"
          stroke="var(--color-warning)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="35" y="100" width="130" height="8" rx="4" fill="var(--color-border-light)" />
      </svg>
    ),
    label: 'Estoque vazio',
  },
  protocols: {
    svg: (
      <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect
          x="25"
          y="25"
          width="150"
          height="100"
          rx="8"
          fill="var(--color-bg-secondary)"
          stroke="var(--color-border-default)"
          strokeWidth="2"
        />
        <rect
          x="40"
          y="40"
          width="60"
          height="8"
          rx="2"
          fill="var(--color-primary)"
          opacity="0.3"
        />
        <rect x="40" y="55" width="100" height="6" rx="2" fill="var(--color-border-light)" />
        <rect x="40" y="68" width="90" height="6" rx="2" fill="var(--color-border-light)" />
        <rect x="40" y="81" width="70" height="6" rx="2" fill="var(--color-border-light)" />
        <circle
          cx="150"
          cy="95"
          r="25"
          fill="var(--color-primary-bg)"
          stroke="var(--color-primary)"
          strokeWidth="2"
        />
        <path
          d="M142 95L148 101L158 90"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    label: 'Protocolos vazios',
  },
  generic: {
    svg: (
      <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle
          cx="100"
          cy="60"
          r="40"
          fill="var(--color-bg-secondary)"
          stroke="var(--color-border-default)"
          strokeWidth="2"
        />
        <path
          d="M85 60L95 70L115 50"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="60" y="110" width="80" height="8" rx="4" fill="var(--color-border-light)" />
        <rect x="80" y="125" width="40" height="6" rx="2" fill="var(--color-border-light)" />
      </svg>
    ),
    label: 'Estado vazio',
  },
}

/**
 * Componente EmptyState
 *
 * @param {Object} props
 * @param {string} props.illustration - Tipo de ilustração: 'dashboard' | 'history' | 'stock' | 'protocols' | 'generic'
 * @param {string} props.title - Título do estado vazio
 * @param {string} props.description - Descrição adicional
 * @param {string} props.ctaLabel - Label do botão de ação
 * @param {Function} props.onCtaClick - Função chamada ao clicar no CTA
 * @param {string} props.className - Classes CSS adicionais
 */
function EmptyState({
  illustration = 'generic',
  title = 'Nada aqui ainda',
  description = '',
  ctaLabel = '',
  onCtaClick,
  className = '',
}) {
  const illust = illustrations[illustration] || illustrations.generic

  return (
    <div className={`empty-state ${className}`} role="region" aria-label={illust.label}>
      <div className="empty-state__illustration">{illust.svg}</div>

      <h3 className="empty-state__title">{title}</h3>

      {description && <p className="empty-state__description">{description}</p>}

      {ctaLabel && onCtaClick && (
        <button className="empty-state__cta" onClick={onCtaClick} aria-label={ctaLabel}>
          {ctaLabel}
        </button>
      )}
    </div>
  )
}

// Memoize para evitar re-render desnecessários
const MemoizedEmptyState = memo(EmptyState)

export default MemoizedEmptyState
