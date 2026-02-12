import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { analyticsService } from '@dashboard/services/analyticsService'
import './MilestoneCelebration.css'

export default function MilestoneCelebration({ milestone, visible, onClose }) {
  useEffect(() => {
    if (visible && milestone) {
      analyticsService.track('milestone_achieved', {
        milestoneId: milestone.id,
        milestoneName: milestone.name
      })
    }
  }, [visible, milestone])

  useEffect(() => {
    if (visible) {
      // Auto-close após 5 segundos
      const timer = setTimeout(() => {
        onClose()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [visible, onClose])

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="milestone-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            className="milestone-modal"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="milestone-icon">{milestone.icon}</div>
            <h2 className="milestone-title">{milestone.name}</h2>
            <p className="milestone-description">{milestone.description}</p>
            <button
              className="milestone-button"
              onClick={onClose}
              type="button"
            >
              Continuar
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
