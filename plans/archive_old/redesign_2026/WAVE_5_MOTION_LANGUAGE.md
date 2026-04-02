# Wave 5 — Motion Language

**Status:** ✅ COMPLETA (Entregue 2026-03-25)
**Dependências:** W0-W4 ✅ completas
**Branch:** `feature/redesign/wave-5-motion-language` — MERGED em PR #424
**Estimativa:** 3 sprints sequenciais ✅ (S5.1 concluído)
**Risco:** BAIXO — apenas arquivos novos + adições scoped a `components.redesign.css`

### 📦 Entregas Completas

**Sprint 5.1 — Motion Constants** ✅
- `src/shared/utils/motionConstants.js` — 6 archetypes (subtle, calm, engaging, energetic, delightful, ceremonial)
- `useMotion()` hook — wrapper safety-first
- CSS keyframes em `components.redesign.css` scoped com `[data-redesign="true"]`
- Framer Motion 12 integration
- AI review cycle com fixes (staticFallback bug, useMemo optimization)
- PR #424 merged com sucesso

---

## 🚩 ESTRATÉGIA DE ROLLOUT

Esta wave cria a linguagem de animação do redesign:
- **Arquivos novos** (`motionConstants.js`, `useMotion.js`): sem impacto em usuários sem flag
- **Animações CSS novas**: adicionadas em `components.redesign.css` scoped com `[data-redesign="true"]`
- **`animations.css` NÃO é modificado**: as animações neon/glow existentes permanecem para usuários sem flag
- Framer Motion 12 já está instalado — usar import de `'framer-motion'`

---

## 🧠 CONTEXTO OBRIGATÓRIO

### Regras de motion do projeto
1. **GPU-only**: animar somente `transform` e `opacity`. NUNCA `width`, `height`, `margin`, `padding`.
2. **Max duração**: 400ms para interações, 1000ms para data fills (living fill).
3. **prefers-reduced-motion**: SEMPRE respeitar via `useReducedMotion()` do Framer Motion.
4. **60fps non-negotiable**: se uma animação cair abaixo de 60fps em mobile, simplificar.
5. **`framer-motion` NÃO é `motion/react`**: nos protótipos de referência pode aparecer `import { motion } from 'motion/react'` — no projeto real SEMPRE usar `import { motion } from 'framer-motion'`.

### Arquivos existentes relevantes
- `src/shared/styles/animations.css` — animações globais atuais (NÃO modificar)
- `src/shared/styles/components.redesign.css` — onde animações scoped serão adicionadas
- `src/shared/styles/index.css` — já importa `components.redesign.css` (nenhuma mudança necessária aqui)

---

## Sprint 5.1 — Motion Constants

**Skill:** `/deliver-sprint`

### Arquivo a criar
- `src/shared/utils/motionConstants.js` (NOVO)

### Implementação completa

```js
/**
 * Constantes de animação — Therapeutic Sanctuary Motion Language
 *
 * Regras de uso:
 * 1. GPU-only: transform + opacity APENAS. Nunca animar width/height/margin.
 * 2. Max 400ms para interações, 1000ms para data fills.
 * 3. Sempre respeitar useReducedMotion() via useMotion() hook.
 * 4. 60fps non-negotiable — simplificar se necessário.
 * 5. Usar import de 'framer-motion', NÃO de 'motion/react'.
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
  handoff: {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 1 },
    transition: { duration: 0 },
  },
  tactile: {},
}
```

### Critério de conclusão Sprint 5.1
- [ ] `src/shared/utils/motionConstants.js` criado
- [ ] Exporta: `cascadeReveal`, `livingFill`, `softHandoff`, `tactilePress`, `doseConfirmed`, `staticFallback`
- [ ] Sem imports de bibliotecas externas (apenas constantes JS puras)
- [ ] Comentários documentando cada archetype
- [ ] `npm run lint` passa (0 erros)

---

## Sprint 5.2 — CSS Keyframe Animations (Scoped)

**Skill:** `/deliver-sprint`

**Dependência:** `components.redesign.css` DEVE existir (criado em W3).

### Arquivo a modificar
- `src/shared/styles/components.redesign.css` (adicionar ao final)

### NÃO modificar
- `src/shared/styles/animations.css` (intacto — usuários sem flag dependem dele)

### Adições ao final de `components.redesign.css`

```css
/* ============================================
   MOTION LANGUAGE — Sanctuary Therapeutic
   Animações CSS para fallback e estados simples.
   Todas scoped em [data-redesign="true"].
   ============================================ */

/* Keyframes globais (sem scoping — são apenas definições) */
@keyframes fadeInUp-sanctuary {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fillWidth-sanctuary {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

@keyframes pulse-sanctuary {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.55; }
}

@keyframes scaleIn-sanctuary {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

/* Classe utilitária: cascade reveal (CSS fallback sem Framer Motion) */
[data-redesign="true"] .motion-fade-in {
  animation: fadeInUp-sanctuary 300ms ease-out forwards;
}

/* Classe utilitária: living fill para barras (CSS fallback) */
[data-redesign="true"] .motion-fill-bar {
  animation: fillWidth-sanctuary 1000ms 500ms ease-out both;
  transform-origin: left;
}

/* Pulse para estoque crítico — atualizado para cores sanctuary */
[data-redesign="true"] .pulse-critical {
  animation: pulse-sanctuary 2s ease-in-out infinite;
}

/* Scale in — para modais, tooltips */
[data-redesign="true"] .motion-scale-in {
  animation: scaleIn-sanctuary 200ms ease-out forwards;
}

/* Respeitar prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  [data-redesign="true"] .motion-fade-in,
  [data-redesign="true"] .motion-fill-bar,
  [data-redesign="true"] .pulse-critical,
  [data-redesign="true"] .motion-scale-in {
    animation: none;
    transform: none;
    opacity: 1;
  }
}
```

### Critério de conclusão Sprint 5.2
- [ ] 4 keyframes adicionados ao final de `components.redesign.css`: `fadeInUp-sanctuary`, `fillWidth-sanctuary`, `pulse-sanctuary`, `scaleIn-sanctuary`
- [ ] 4 classes utilitárias scoped em `[data-redesign="true"]`: `.motion-fade-in`, `.motion-fill-bar`, `.pulse-critical`, `.motion-scale-in`
- [ ] `@media (prefers-reduced-motion: reduce)` bloco presente e correto
- [ ] `animations.css` NÃO foi modificado (`git diff src/shared/styles/animations.css` = vazio)
- [ ] `npm run validate:agent` passa

---

## Sprint 5.3 — useMotion Hook

**Skill:** `/deliver-sprint`

**Dependência:** Sprint 5.1 DEVE estar completo (`motionConstants.js` existindo).

### Arquivo a criar
- `src/shared/hooks/useMotion.js` (NOVO)

### Implementação completa

```js
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
```

### Como usar useMotion nas views redesenhadas

```jsx
// Exemplo: lista de medicamentos com Cascade Reveal
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'

function MedList({ meds }) {
  const motionVariants = useMotion()

  return (
    <motion.ul
      variants={motionVariants.cascade.container}
      initial="hidden"
      animate="visible"
    >
      {meds.map(med => (
        <motion.li key={med.id} variants={motionVariants.cascade.item}>
          {med.name}
        </motion.li>
      ))}
    </motion.ul>
  )
}

// Exemplo: botão com Tactile Press
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'

function PrimaryButton({ children, onClick }) {
  const { tactile } = useMotion()
  return (
    <motion.button
      {...tactile}
      onClick={onClick}
      className="btn btn-primary btn-lg"
    >
      {children}
    </motion.button>
  )
}

// Exemplo: progress bar com Living Fill
import { motion } from 'framer-motion'
import { useMotion } from '@shared/hooks/useMotion'

function AdherenceBar({ value }) {
  const { fill } = useMotion()
  return (
    <div className="progress-bar">
      <motion.div
        className="progress-bar-fill progress-fill-primary"
        style={{ ...fill.style, width: `${value}%` }}
        initial={fill.initial}
        animate={fill.animate}
        transition={fill.transition}
      />
    </div>
  )
}
```

### Critério de conclusão Sprint 5.3
- [ ] `src/shared/hooks/useMotion.js` criado
- [ ] Importa `useReducedMotion` de `'framer-motion'`
- [ ] Importa todas as constantes de `'@shared/utils/motionConstants'`
- [ ] Retorna objeto com: `cascade`, `fill`, `ring`, `counter`, `handoff`, `tactile`, `dose`
- [ ] Quando `shouldReduceMotion = true`: retorna `staticFallback` (sem animações)
- [ ] JSDoc com exemplos de uso
- [ ] `npm run validate:agent` passa

---

## Checklist Final Wave 5

### Verificações de arquivo
```bash
# Deve existir:
ls src/shared/utils/motionConstants.js
ls src/shared/hooks/useMotion.js

# NÃO deve ter sido modificado:
git diff src/shared/styles/animations.css
```

### Smoke test com flag ON (`?redesign=1`)
- [ ] Arquivo `motionConstants.js` é importável sem erros (`import { cascadeReveal } from '@shared/utils/motionConstants'`)
- [ ] Hook `useMotion()` é importável sem erros
- [ ] CSS classes `.motion-fade-in`, `.motion-fill-bar`, `.pulse-critical` presentes em `components.redesign.css`
- [ ] `.pulse-critical` scoped em `[data-redesign="true"]` (não afeta usuários sem flag)

### Testes e qualidade
- [ ] `npm run validate:agent` passa
- [ ] `npm run build` sem erros
- [ ] Bundle não aumentou significativamente (constantes JS são mínimas)
- [ ] PR criado aguardando review Gemini Code Assist

---

## Referências

- `plans/redesign/MASTER_SPEC_REDESIGN_EXPERIENCIA_PACIENTE.md` — seção 10 (Wave 5)
- `src/shared/styles/components.redesign.css` — arquivo a modificar no Sprint 5.2
- `src/shared/utils/motionConstants.js` — a criar no Sprint 5.1
- `src/shared/hooks/useMotion.js` — a criar no Sprint 5.3
