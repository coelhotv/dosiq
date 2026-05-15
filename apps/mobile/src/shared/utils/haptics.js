import * as Haptics from 'expo-haptics'

// Wrapper fire-and-forget sobre expo-haptics. Centraliza tipos usados no app
// e evita boilerplate de catch em cada call site. Erros silenciados (haptic
// é UX-only — falha não deve quebrar fluxo do usuário).

function safe(fn) {
  return (...args) => {
    try {
      fn(...args).catch(() => {})
    } catch {
      // Plataforma não suportada (ex: web preview)
    }
  }
}

export const successHaptic = safe(() =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
)

export const errorHaptic = safe(() =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
)

export const warningHaptic = safe(() =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
)

export const lightTap = safe(() =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
)

export const mediumTap = safe(() =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
)

export const heavyTap = safe(() =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
)

export const selectionTap = safe(() => Haptics.selectionAsync())
