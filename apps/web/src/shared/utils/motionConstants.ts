/**
 * Constantes de animação — Therapeutic Sanctuary Motion Language
 *
 * Regras de uso:
 * 1. GPU-only: transform + opacity APENAS. Nunca animar width/height/margin.
 * 2. Max 400ms para interações, 1000ms para data fills.
 * 3. Sempre respeitar useReducedMotion() via useMotion() hook.
 * 4. 60fps non-negotiable — simplificar se necessário.
 * 5. Usar import de 'framer-motion', NÃO de 'motion/react'.
 *
 * @module motionConstants
 */

// ============================================
// 1. CASCADE REVEAL — entrada em listas
// Stagger: cada item aparece com 100ms de delay após o anterior.
// ============================================
export const cascadeReveal = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' },
    },
  },
}

// ============================================
// 2. LIVING FILL — barras de progresso e rings
// Anima a partir de scaleX(0) → scaleX(1) (transformOrigin: left).
// Delay de 500ms para que o usuário veja o estado inicial primeiro.
// ============================================
export const livingFill = {
  bar: {
    initial: { scaleX: 0 },
    animate: { scaleX: 1 },
    transition: { duration: 1, delay: 0.5, ease: [0.4, 0, 0.2, 1] },
    style: { transformOrigin: 'left' },
  },
  ring: {
    // Para SVG rings: pathLength de 0 → valor alvo
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 1, delay: 0.5, ease: [0.4, 0, 0.2, 1] },
  },
  counter: {
    // Números que "viram" ao chegar no valor
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.3, delay: 0.8, ease: 'easeOut' },
  },
}

// ============================================
// 3. SOFT HANDOFF — transições de page/view
// Usado em AnimatePresence mode="wait" em App.jsx.
// ============================================
export const softHandoff = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.25, ease: 'easeOut' },
}

// ============================================
// 4. TACTILE PRESS — botões e cards interativos
// Scale sutil ao hover e press — sensação física de clique.
// ============================================
export const tactilePress = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: 'easeOut' },
}

// ============================================
// 5. DOSE CONFIRMED — feedback de registro de dose
// Usado em botões de "Tomar Agora" após registro.
// ============================================
export const doseConfirmed = {
  checkIn: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: [0, 1.3, 1], opacity: 1 },
    transition: { duration: 0.35, ease: 'easeOut' },
  },
  counterFlip: {
    initial: { y: 12, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0.2, delay: 0.1, ease: 'easeOut' },
  },
  streakPulse: {
    animate: { scale: [1, 1.12, 1] },
    transition: { duration: 0.4, repeat: 1, ease: 'easeInOut' },
  },
}

// ============================================
// 6. STATIC FALLBACK — prefers-reduced-motion
// Sem movimento. Conteúdo aparece instantaneamente.
// ============================================
export const staticFallback = {
  container: {
    hidden: { opacity: 1 },
    visible: { opacity: 1, transition: { staggerChildren: 0 } },
  },
  item: {
    hidden: { opacity: 1, y: 0 },
    visible: { opacity: 1, y: 0, transition: { duration: 0 } },
  },
  bar: {
    initial: { scaleX: 1 },
    animate: { scaleX: 1 },
    transition: { duration: 0 },
    style: { transformOrigin: 'left' },
  },
  ring: {
    initial: { pathLength: 1, opacity: 1 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0 },
  },
  counter: {
    initial: { y: 0, opacity: 1 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: 0 },
  },
  handoff: {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 1 },
    transition: { duration: 0 },
  },
  tactile: {
    whileHover: { scale: 1 },
    whileTap: { scale: 1 },
    transition: { duration: 0 },
  },
  dose: {
    checkIn: {
      initial: { scale: 1, opacity: 1 },
      animate: { scale: 1, opacity: 1 },
      transition: { duration: 0 },
    },
    counterFlip: {
      initial: { y: 0, opacity: 1 },
      animate: { y: 0, opacity: 1 },
      transition: { duration: 0 },
    },
    streakPulse: {
      animate: { scale: 1 },
      transition: { duration: 0, repeat: 0 },
    },
  },
}
