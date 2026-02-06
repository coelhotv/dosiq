import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import './TreatmentAccordion.css';

/**
 * TreatmentAccordion - Card expansível para protocolos.
 * 
 * @param {Object} props
 * @param {Object} props.protocol - Dados do protocolo
 * @param {React.ReactNode} props.children - Itens de medicamento (SwipeRegisterItem)
 * @param {Function} props.onBatchRegister - Callback para registro em lote
 */
export default function TreatmentAccordion({ protocol, children, onBatchRegister, selectedMedicines = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedCount = selectedMedicines.length;
  const totalCount = protocol.medicines_count || 0;

  return (
    <div className={`treatment-accordion ${isExpanded ? 'treatment-accordion--expanded' : ''}`}>
      <div 
        className="treatment-accordion__header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="treatment-accordion__info">
          <h3 className="treatment-accordion__title">{protocol.name}</h3>
          <span className="treatment-accordion__meta">
            {protocol.medicines_count || 0} medicamentos • Próxima: {protocol.next_dose || '--:--'}
          </span>
        </div>
        <div className="treatment-accordion__controls">
          <button 
            className="treatment-accordion__batch-btn"
            onClick={(e) => {
              e.stopPropagation();
              onBatchRegister?.(protocol, selectedMedicines);
            }}
          >
            {selectedCount > 0 && selectedCount < totalCount ? `LOTE (${selectedCount})` : 'LOTE'}
          </button>
          <motion.span 
            className="treatment-accordion__icon"
            animate={{ rotate: isExpanded ? 180 : 0 }}
          >
            ▼
          </motion.span>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            className="treatment-accordion__content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="treatment-accordion__list">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
