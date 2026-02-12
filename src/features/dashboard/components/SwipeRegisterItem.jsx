import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import PulseEffect from '@shared/components/ui/animations/PulseEffect';
import { analyticsService } from '@dashboard/services/analyticsService';
import './SwipeRegisterItem.css';

/**
 * SwipeRegisterItem - Item de medicamento com gesto de deslizar para confirmar.
 * 
 * @param {Object} props
 * @param {Object} props.medicine - Dados do medicamento
 * @param {string} props.time - Horário previsto
 * @param {boolean} props.isSelected - Estado de seleção para lote
 * @param {Function} props.onToggleSelection - Callback para alternar seleção
 * @param {Function} props.onRegister - Callback de sucesso (dose registrada)
 */
export default function SwipeRegisterItem({
  medicine,
  time,
  isSelected = false,
  onToggleSelection,
  onRegister
}) {
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const x = useMotionValue(0);
  
  // Mapear o arraste para opacidade e cor do fundo de confirmação
  const background = useTransform(
    x,
    [0, 200],
    ['rgba(0, 229, 255, 0)', 'rgba(0, 229, 255, 0.2)']
  );
  
  const opacity = useTransform(x, [0, 150], [0, 1]);

  const handleDragEnd = async (_, info) => {
    // Threshold de 70% da largura (assumindo largura aprox de 300-350 no mobile)
    // Usaremos um valor fixo de 150px para maior consistência tátil
    if (info.offset.x > 150) {
      setIsSuccess(true);
      try {
        await onRegister?.(medicine.id);
        setShowPulse(true);
        analyticsService.track('swipe_used', { medicine: medicine.name });
      } catch (err) {
        console.error('Erro ao registrar via swipe:', err);
        setIsSuccess(false);
        // O Framer Motion vai resetar a posição automaticamente se não mudarmos o estado
      }
    }
  };

  return (
    <div className="swipe-item-container">
      {/* Camada de Fundo (Ação) */}
      <motion.div 
        className="swipe-item-action"
        style={{ background, opacity }}
      >
        <span className="swipe-item-action__text">CONFIRMAR DOSE</span>
        <span className="swipe-item-action__icon">✓</span>
      </motion.div>

      {/* Camada do Card (Interativa) */}
      <motion.div
        className={`swipe-item-card ${isSuccess ? 'swipe-item-card--success' : ''} ${isSelected ? 'swipe-item-card--selected' : ''}`}
        drag="x"
        dragConstraints={{ left: 0, right: 300 }}
        dragElastic={0.1}
        style={{ x }}
        onDragEnd={handleDragEnd}
        animate={isSuccess ? { x: '100%', opacity: 0 } : { x: 0, opacity: 1 }}
      >
        <div
          className="swipe-item-card__checkbox-wrapper"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection?.(medicine.id);
          }}
        >
          <div className={`swipe-item-card__checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>

        <div className="swipe-item-card__time">{time}</div>
        <div className="swipe-item-card__info">
          <h4 className="swipe-item-card__name">{medicine.name}</h4>
          <span className="swipe-item-card__dosage">
            {medicine.dosage_per_pill} {medicine.dosage_unit}
          </span>
        </div>
        <div className="swipe-item-card__gesture-hint">
          <span>→</span>
        </div>
      </motion.div>

      <PulseEffect trigger={showPulse} onComplete={() => setShowPulse(false)} />
    </div>
  );
}
