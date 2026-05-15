// Toast.jsx — Provider global de notificações toast + hook useToast
// Exporta: ToastProvider (default), useToast (named)

import { createContext, memo, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertCircle, CheckCircle, Info } from 'lucide-react-native'
import { errorHaptic, successHaptic } from '@shared/utils/haptics'
import { borderRadius, colors, spacing } from '@shared/styles/tokens'

// ─── Contexto ────────────────────────────────────────────────────────────────

const ToastContext = createContext(null)

// ─── Configuração por variante ────────────────────────────────────────────────

const VARIANT_CONFIG = {
  success: {
    bg: colors.status.success,
    Icon: CheckCircle,
    haptic: successHaptic,
  },
  error: {
    bg: colors.status.error,
    Icon: AlertCircle,
    haptic: errorHaptic,
  },
  info: {
    bg: colors.text.primary,
    Icon: Info,
    haptic: null,
  },
}

// ─── ToastItem ────────────────────────────────────────────────────────────────

const ToastItem = memo(function ToastItem({ toast, onDismiss }) {
  // States
  const [translateY] = useState(() => new Animated.Value(-100))
  const [opacity] = useState(() => new Animated.Value(0))

  const config = VARIANT_CONFIG[toast.variant] ?? VARIANT_CONFIG.info
  const { Icon } = config

  // Handlers
  const handleDismiss = useCallback(() => {
    // Animação de saída antes de remover
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss())
  }, [opacity, onDismiss, translateY])

  // Effects
  useEffect(() => {
    // Animação de entrada
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [opacity, translateY])

  useEffect(() => {
    // Auto-dismiss: item gerencia próprio ciclo de vida → dispara animação
    // de saída antes da remoção do estado global. Cleanup garante que timer
    // morra no unmount ou se usuário tocar pra dispensar cedo.
    const timer = setTimeout(handleDismiss, toast.duration)
    return () => clearTimeout(timer)
  }, [handleDismiss, toast.duration])

  return (
    <Animated.View style={[styles.toast, { backgroundColor: config.bg, transform: [{ translateY }], opacity }]}>
      <Pressable style={styles.toastInner} onPress={handleDismiss}>
        <Icon size={18} color={colors.text.inverse} strokeWidth={2} />
        <Text style={styles.toastText}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  )
})

// ─── ToastProvider ────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets()
  const counterRef = useRef(0)

  // States
  const [toasts, setToasts] = useState([])

  // Handlers
  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message, opts = {}) => {
    const id = ++counterRef.current
    const variant = opts.variant ?? 'info'
    const duration = opts.duration ?? 3000
    const toast = { id, message, variant, duration }

    // Dispara haptic conforme variante
    const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info
    config.haptic?.()

    setToasts(prev => [...prev, toast].slice(-3))
    // Auto-dismiss agora é responsabilidade do ToastItem — ele dispara
    // animação de saída antes de chamar onDismiss.
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={[styles.overlay, { top: insets.top + spacing[2] }]} pointerEvents="box-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

// ─── useToast ─────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    pointerEvents: 'box-none',
    paddingHorizontal: spacing[4],
    gap: spacing[2],
  },
  toast: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    gap: spacing[2],
  },
  toastText: {
    flex: 1,
    color: colors.text.inverse,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
})

export default ToastProvider
