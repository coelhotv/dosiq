import { useReducedMotion } from 'framer-motion'
import {
  cascadeReveal,
  livingFill,
  softHandoff,
  tactilePress,
  doseConfirmed,
  staticFallback,
} from '@shared/utils/motionConstants'

/**
 * Hook que retorna variantes de animação respeitando prefers-reduced-motion.
 *
 * Uso:
 * ```jsx
 * import { useMotion } from '@shared/hooks/useMotion'
 *
 * function MyComponent() {
 *   const motion = useMotion()
 *
 *   return (
 *     <motion.ul variants={motion.cascade.container} initial="hidden" animate="visible">
 *       <motion.li variants={motion.cascade.item}>Item 1</motion.li>
 *     </motion.ul>
 *   )
 * }
 * ```
 *
 * Quando prefers-reduced-motion está ativo, retorna fallbacks sem animação.
 */
export function useMotion() {
  const shouldReduceMotion = useReducedMotion()

  if (shouldReduceMotion) {
    return {
      cascade: staticFallback,
      fill: staticFallback.bar,
      ring: staticFallback.bar,
      counter: staticFallback.item,
      handoff: staticFallback.handoff,
      tactile: staticFallback.tactile,
      dose: {
        checkIn: { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } },
        counterFlip: { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } },
        streakPulse: { animate: { scale: 1 }, transition: { duration: 0 } },
      },
    }
  }

  return {
    /** Cascade reveal para listas — usar com motion.ul (container) e motion.li (item) */
    cascade: cascadeReveal,
    /** Living fill para barras e progress — usar em motion.div com transform-origin: left */
    fill: livingFill.bar,
    /** Ring fill para SVG arcs */
    ring: livingFill.ring,
    /** Counter flip — números que viram */
    counter: livingFill.counter,
    /** Soft handoff para page transitions — usar em AnimatePresence */
    handoff: softHandoff,
    /** Tactile press — whileHover + whileTap para botões e cards */
    tactile: tactilePress,
    /** Dose confirmed — feedback de registro */
    dose: doseConfirmed,
  }
}
