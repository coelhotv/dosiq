/**
 * InsightCard Component
 *
 * Visual Example 3: Enhanced InsightCard with gradient and glassmorphism
 * Displays insights and recommendations to users with interactive actions
 */

import React from 'react'
import './InsightCard.css'

/**
 * InsightCard Component
 *
 * @param {Object} props - Component props
 * @param {string} props.icon - Icon emoji or character to display
 * @param {string} props.text - Main insight text
 * @param {string} props.highlight - Text to highlight with neon color
 * @param {string} props.actionLabel - Label for the action button
 * @param {Function} props.onAction - Callback when action button is clicked
 * @param {string} props.className - Additional CSS classes
 * @returns {JSX.Element} InsightCard component
 */
export default function InsightCard({
  icon = '💡',
  text = '',
  highlight = '',
  actionLabel = 'Saiba mais',
  onAction,
  className = '',
}) {
  // Parse text and highlight the specified portion
  const renderText = () => {
    if (!highlight || !text.includes(highlight)) {
      return text
    }

    const parts = text.split(highlight)
    return (
      <>
        {parts[0]}
        <span className="insight-card__highlight">{highlight}</span>
        {parts[1]}
      </>
    )
  }

  return (
    <div className={`insight-card ${className}`}>
      <div className="insight-card__icon" role="img" aria-label="Insight icon">
        {icon}
      </div>
      <div className="insight-card__content">
        <p className="insight-card__text">{renderText()}</p>
        {onAction && (
          <button className="insight-card__action" onClick={onAction} type="button">
            {actionLabel}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  )
}
