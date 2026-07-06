// DeleteAccountScreen.jsx — exclusão de conta (Fase 4 W3, PO-10).
//
// Tela cheia empilhada (não bottom sheet): cobre a tab bar e trata teclado
// nativamente (padrão ChangePasswordScreen/MedicineFormScreen). Decisão tomada
// após o sheet brigar com teclado+tab bar no Android 7.
//
// Duas variantes:
// - BLOQUEADA (tratamentos ativos > 0): não permite excluir; CTA p/ tratamentos.
// - CONFIRMAÇÃO: lista o que será apagado + banner "exporte antes" + dupla
//   barreira: digitar "EXCLUIR" + revalidar a senha do Dosiq (re-autenticação).
//
// Em sucesso, faz signOut → Navigation reseta para a Landing.

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, AlertCircle, Layers, Package, CalendarClock, User, TriangleAlert, Eye, EyeOff, } = LucideIcons as any
import { getDeletionSummary, deleteAccount, logoutUser } from '../services/profileService'
import { verifyPassword } from '@platform/auth/authService'
import FormActions from '@shared/components/form/FormActions'
import { ROUTES } from '@navigation/routes'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const CONFIRM_WORD = 'EXCLUIR'

// eslint-disable-next-line max-lines-per-function
export default function DeleteAccountScreen() {
  // States (R-010)
  const navigation = useNavigation()
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Memos
  const isBlocked = (summary?.activeTreatments ?? 0) > 0
  const canDelete = useMemo(
    () =>
      !isBlocked &&
      !deleting &&
      confirmText.trim().toUpperCase() === CONFIRM_WORD &&
      password.length > 0,
    [isBlocked, deleting, confirmText, password],
  )
  const planSubtitle = useMemo(() => {
    const names = summary?.treatmentPlanNames ?? []
    return names.length ? `Inclui ${names.join(', ')}` : 'Tratamentos, doses e agenda'
  }, [summary])

  // Effects — carrega o resumo no mount.
  useEffect(() => {
    let active = true
    getDeletionSummary().then(({ data, error }) => {
      if (!active) return
      if (error) setSummaryError(error)
      else setSummary(data)
      setLoadingSummary(false)
    })
    return () => { active = false }
  }, [])

  // Handlers
  const handleOpenTreatments = useCallback(() => {
    (navigation.navigate as any)(ROUTES.TABS, { screen: ROUTES.TREATMENTS })
  }, [navigation])

  const handleConfirm = useCallback(async () => {
    if (!canDelete) return
    setDeleting(true)
    setDeleteError(null)

    // Re-autenticação: revalida a senha antes de excluir (defesa contra acesso
    // físico ao aparelho desbloqueado).
    const auth = await verifyPassword(password)
    if (!auth.success) {
      setDeleting(false)
      setDeleteError(auth.error ?? 'Senha incorreta')
      return
    }

    const { success, error } = await deleteAccount()
    if (success) {
      // SIGNED_OUT (Navigation) reseta para a Landing.
      await logoutUser()
      return
    }
    setDeleting(false)
    setDeleteError(
      error?.includes('active_treatments_block')
        ? 'Há tratamentos ativos. Finalize ou pause antes de excluir.'
        : error ?? 'Não foi possível excluir a conta.',
    )
  }, [canDelete, password])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <ChevronLeft size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Excluir conta</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerIcon}>
          <AlertCircle size={26} color={colors.status.error} strokeWidth={2} />
        </View>
        <Text style={styles.title}>Excluir sua conta?</Text>
        <Text style={styles.description}>
          Essa ação é permanente e irreversível. Vamos apagar seus dados pessoais
          e revogar seu acesso. Antes, veja o que será removido:
        </Text>

        {loadingSummary ? (
          <ActivityIndicator size="small" color={colors.primary[500]} style={styles.loader} />
        ) : summaryError ? (
          <Text style={styles.errorText}>{summaryError}</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>O QUE SERÁ APAGADO</Text>

            <View style={styles.depCard}>
              <DepRow
                icon={<Layers size={18} color={colors.primary[700]} strokeWidth={2} />}
                title={`${summary.activeTreatments} tratamento${summary.activeTreatments === 1 ? '' : 's'} ativo${summary.activeTreatments === 1 ? '' : 's'}`}
                subtitle={planSubtitle}
              />
              <View style={styles.depDivider} />
              <DepRow
                icon={<Package size={18} color={colors.primary[700]} strokeWidth={2} />}
                title={`${summary.medicines} medicamento${summary.medicines === 1 ? '' : 's'}`}
                subtitle="Compras, lotes e validade"
              />
              <View style={styles.depDivider} />
              <DepRow
                icon={<CalendarClock size={18} color={colors.primary[700]} strokeWidth={2} />}
                title={`${summary.doses} dose${summary.doses === 1 ? '' : 's'} registrada${summary.doses === 1 ? '' : 's'}`}
                subtitle="Histórico de adesão"
              />
              <View style={styles.depDivider} />
              <DepRow
                icon={<User size={18} color={colors.primary[700]} strokeWidth={2} />}
                title="Dados pessoais e perfil"
                subtitle="Nome, data de nascimento, contato"
              />
            </View>

            <View style={styles.exportBanner}>
              <TriangleAlert size={16} color={colors.status.warning} strokeWidth={2} />
              <Text style={styles.exportText}>
                Exporte seus dados antes? Vá em Perfil → Privacidade e dados.
              </Text>
            </View>

            {isBlocked ? (
              <View style={styles.blockedBox}>
                <Text style={styles.blockedText}>
                  Você tem {summary.activeTreatments} tratamento
                  {summary.activeTreatments === 1 ? '' : 's'} ativo
                  {summary.activeTreatments === 1 ? '' : 's'}. Finalize ou pause
                  antes de excluir a conta.
                </Text>
              </View>
            ) : (
              <View style={styles.confirmBlock}>
                <Text style={styles.confirmLabel}>
                  Para confirmar, digite <Text style={styles.confirmWord}>EXCLUIR</Text> abaixo:
                </Text>
                <TextInput
                  style={styles.input}
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder={CONFIRM_WORD}
                  placeholderTextColor={colors.text.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!deleting}
                  maxLength={CONFIRM_WORD.length}
                  accessibilityLabel="Digite EXCLUIR para confirmar"
                />

                <Text style={[styles.confirmLabel, styles.passwordLabel]}>
                  Confirme sua senha do Dosiq:
                </Text>
                <View style={styles.passwordField}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Sua senha"
                    placeholderTextColor={colors.text.muted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!deleting}
                    accessibilityLabel="Senha do Dosiq"
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                    accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword
                      ? <EyeOff size={18} color={colors.text.muted} />
                      : <Eye size={18} color={colors.text.muted} />}
                  </Pressable>
                </View>

                {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {isBlocked ? (
        <FormActions
          primaryLabel="Abrir tratamentos"
          onPrimary={handleOpenTreatments}
          secondaryLabel="Cancelar"
          onSecondary={() => navigation.goBack()}
          primaryLoading={false}
        />
      ) : (
        <FormActions
          primaryLabel="Excluir conta"
          onPrimary={handleConfirm}
          primaryDisabled={!canDelete}
          primaryLoading={deleting}
          destructive
          secondaryLabel="Cancelar"
          onSecondary={() => navigation.goBack()}
        />
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function DepRow({ icon, title, subtitle }) {
  return (
    <View style={styles.depRow}>
      <View style={styles.depIconWrap}>{icon}</View>
      <View style={styles.depBody}>
        <Text style={styles.depName}>{title}</Text>
        <Text style={styles.depSub} numberOfLines={1}>{subtitle}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.screen,
  },
  flex: {
    flex: 1,
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
  headerTitle: {
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
    paddingTop: spacing[5],
    paddingBottom: spacing[8],
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.status.error + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily: typography.fontFamily.bold,
    marginBottom: spacing[2],
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing[4],
  },
  loader: {
    marginVertical: spacing[6],
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.text.muted,
    marginBottom: spacing[2],
  },
  depCard: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing[3],
  },
  depRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  depDivider: {
    height: 1,
    backgroundColor: colors.border.light,
  },
  depIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  depBody: {
    flex: 1,
  },
  depName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  depSub: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  exportBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    backgroundColor: colors.status.warning + '14',
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[3],
  },
  exportText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  blockedBox: {
    backgroundColor: colors.status.error + '14',
    borderRadius: borderRadius.md,
    padding: spacing[3],
    marginTop: spacing[4],
  },
  blockedText: {
    fontSize: 13,
    color: colors.status.error,
    lineHeight: 18,
  },
  confirmBlock: {
    marginTop: spacing[5],
  },
  confirmLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  confirmWord: {
    fontWeight: '800',
    color: colors.status.error,
  },
  input: {
    height: 50,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.text.primary,
    letterSpacing: 1,
  },
  passwordLabel: {
    marginTop: spacing[4],
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    color: colors.status.error,
    marginTop: spacing[2],
  },
})
