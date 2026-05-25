// ChangePasswordScreen.jsx — Alterar senha (Fase 4)
// R-010: States → Memos → Effects → Handlers

import { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { ChevronLeft, Lock, Eye, EyeOff, Info } from 'lucide-react-native'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import FormInput from '@shared/components/form/FormInput'
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { updatePassword } from '@platform/auth/authService'

// ─── Helpers de força de senha ────────────────────────────────────────────────

function computeStrength(password) {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[a-zA-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (password.length >= 12) score++
  return score
}

const STRENGTH_CONFIG = [
  { label: 'Fraca', color: colors.status.error },
  { label: 'Média', color: colors.status.warning },
  { label: 'Boa', color: colors.primary[500] },
  { label: 'Forte', color: colors.status.success },
]

// ─── Componente principal ─────────────────────────────────────────────────────

// eslint-disable-next-line max-lines-per-function
export default function ChangePasswordScreen() {
  const navigation = useNavigation()
  const toast = useToast()

  // States — R-010
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // Memos
  const strength = useMemo(() => computeStrength(newPassword), [newPassword])
  const strengthConfig = useMemo(
    () => (strength > 0 ? STRENGTH_CONFIG[strength - 1] : null),
    [strength],
  )

  // Handlers
  const validate = useCallback(() => {
    const next = {}
    if (!currentPassword) next.currentPassword = 'Senha atual é obrigatória'
    if (!newPassword || newPassword.length < 8)
      next.newPassword = 'A nova senha deve ter no mínimo 8 caracteres'
    if (!confirmPassword) next.confirmPassword = 'Confirmação é obrigatória'
    else if (newPassword !== confirmPassword)
      next.confirmPassword = 'As senhas não conferem'
    setErrors(next)
    return Object.keys(next).length === 0
  }, [currentPassword, newPassword, confirmPassword])

  const handleSubmit = useCallback(async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await updatePassword(newPassword, confirmPassword)
      if (res.success) {
        toast.show('Senha atualizada!', { variant: 'success' })
        navigation.goBack()
      } else {
        toast.show(res.error ?? 'Erro ao atualizar senha', { variant: 'error' })
      }
    } finally {
      setSubmitting(false)
    }
  }, [validate, newPassword, confirmPassword, toast, navigation])

  const handleCancel = useCallback(() => navigation.goBack(), [navigation])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleCancel}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Alterar senha</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Bloco contextual */}
        <View style={styles.contextBlock}>
          <View style={styles.lockCircle}>
            <Lock size={24} color={colors.primary[600]} />
          </View>
          <View style={styles.contextText}>
            <Text style={styles.contextTitle}>Mantenha sua conta segura</Text>
            <Text style={styles.contextSub}>
              Escolha uma senha de pelo menos 8 caracteres com letras e números.
            </Text>
          </View>
        </View>

        {/* Campo: Senha atual */}
        <View style={styles.fieldWrapper}>
          <FormInput
            name="currentPassword"
            label="Senha atual"
            required
            value={currentPassword}
            error={errors.currentPassword}
            onChange={(_name, val) => {
              setCurrentPassword(val)
              if (errors.currentPassword) setErrors((e) => ({ ...e, currentPassword: undefined }))
            }}
            onBlur={() => {}}
            secureTextEntry={!showCurrent}
          />
          <Pressable
            style={styles.eyeToggle}
            onPress={() => setShowCurrent((v) => !v)}
            hitSlop={8}
            accessibilityLabel={showCurrent ? 'Ocultar senha atual' : 'Mostrar senha atual'}
          >
            {showCurrent
              ? <EyeOff size={18} color={colors.text.muted} />
              : <Eye size={18} color={colors.text.muted} />}
          </Pressable>
        </View>

        {/* Campo: Nova senha */}
        <View style={styles.fieldWrapper}>
          <FormInput
            name="newPassword"
            label="Nova senha"
            required
            value={newPassword}
            error={errors.newPassword}
            onChange={(_name, val) => {
              setNewPassword(val)
              if (errors.newPassword) setErrors((e) => ({ ...e, newPassword: undefined }))
            }}
            onBlur={() => {}}
            secureTextEntry={!showNew}
          />
          <Pressable
            style={styles.eyeToggle}
            onPress={() => setShowNew((v) => !v)}
            hitSlop={8}
            accessibilityLabel={showNew ? 'Ocultar nova senha' : 'Mostrar nova senha'}
          >
            {showNew
              ? <EyeOff size={18} color={colors.text.muted} />
              : <Eye size={18} color={colors.text.muted} />}
          </Pressable>
        </View>

        {/* Barra de força */}
        <View style={styles.strengthBar}>
          <View style={styles.strengthSegments}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthSegment,
                  {
                    backgroundColor:
                      i < strength && strengthConfig
                        ? strengthConfig.color
                        : colors.border.light,
                  },
                ]}
              />
            ))}
          </View>
          {strengthConfig && (
            <Text style={[styles.strengthLabel, { color: strengthConfig.color }]}>
              {strengthConfig.label}
            </Text>
          )}
        </View>

        {/* Campo: Confirmar nova senha */}
        <View style={[styles.fieldWrapper, styles.fieldWrapperTop]}>
          <FormInput
            name="confirmPassword"
            label="Confirmar nova senha"
            required
            value={confirmPassword}
            error={errors.confirmPassword}
            onChange={(_name, val) => {
              setConfirmPassword(val)
              if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: undefined }))
            }}
            onBlur={() => {}}
            secureTextEntry={!showConfirm}
          />
          <Pressable
            style={styles.eyeToggle}
            onPress={() => setShowConfirm((v) => !v)}
            hitSlop={8}
            accessibilityLabel={showConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
          >
            {showConfirm
              ? <EyeOff size={18} color={colors.text.muted} />
              : <Eye size={18} color={colors.text.muted} />}
          </Pressable>
        </View>

        {/* Banner informativo */}
        <View style={styles.infoBanner}>
          <Info size={16} color={colors.primary[600]} />
          <Text style={styles.infoBannerText}>
            Após salvar, você precisará entrar de novo em outros dispositivos.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky actions */}
      <FormActions
        secondaryLabel="Cancelar"
        onSecondary={handleCancel}
        primaryLabel="Atualizar senha"
        onPrimary={handleSubmit}
        primaryLoading={submitting}
      />
    </SafeAreaView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.bg.card,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    fontFamily: typography.fontFamily.bold,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  contextBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    marginBottom: spacing[2],
  },
  lockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextText: {
    flex: 1,
  },
  contextTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  contextSub: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  fieldWrapper: {
    position: 'relative',
  },
  fieldWrapperTop: {
    marginTop: spacing[1],
  },
  eyeToggle: {
    position: 'absolute',
    right: 14,
    // Vertically center inside the 50px input. labelRow ~24px + marginBottom 6px = 30px offset.
    top: 36,
    height: 50,
    justifyContent: 'center',
  },
  strengthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: -spacing[2],
  },
  strengthSegments: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary[700],
    lineHeight: 18,
  },
})
