import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ZoneSection({ zoneKey, doses, expanded, onToggle, config, children }) {
  if (!doses || doses.length === 0) return null

  return (
    <div className="dose-zone-section" data-testid={`zone-${zoneKey}`}>
      <button
        type="button"
        className={`zone-header zone-header--${config.color}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="zone-header__icon" aria-hidden="true">{config.icon}</span>
        <span className="zone-header__label">{config.label}</span>
        <span className="zone-header__count">{doses.length}</span>
        <span className={`zone-header__chevron${expanded ? ' zone-header__chevron--expanded' : ''}`}>▾</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key={`${zoneKey}-content`}
            className="zone-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <motion.div
              className="zone-content__items"
              variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              initial="hidden"
              animate="visible"
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
