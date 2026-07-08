// ProfileEditScreen.jsx — Editar Perfil V1 (Fase 4)
//
// Form full-screen + sticky save bar. Hidrata do useProfile (null-safe, AP-N20),
// converte birth_date string 'YYYY-MM-DD' ↔ Date pro FormDatePicker (R-020:
// parseLocalDate/formatLocalDate de @dosiq/core, nunca new Date('YYYY-MM-DD')).
// Avatar = iniciais (foto = V2/backlog; tap mostra toast "em breve").

import { useMemo, useCallback, useEffect, useRef } from 'react'
import { ScrollView, View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
// TODO(040-strict): named imports do lucide-react-native batem em TS2305 sob nodenext
import * as LucideIcons from 'lucide-react-native'
const { ChevronLeft, Lock } = LucideIcons as any
import {
  userProfileSchema,
  BRAZILIAN_STATES,
  parseLocalDate,
  formatLocalDate,
  getInitials,
  getNow,
} from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import { useProfile } from '@profile/hooks/useProfile'
import { useProfileMutation } from '@profile/hooks/useProfileMutation'
import FormInput from '@shared/components/form/FormInput'
import FormSelect from '@shared/components/form/FormSelect'
import FormDatePicker from '@shared/components/form/FormDatePicker'
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'

const STATE_OPTIONS = BRAZILIAN_STATES.map((uf) => ({ value: uf, label: uf }))

// Máscara de telefone BR: (11) 98213-0685 / (11) 3456-7890
function formatPhoneBR(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formProps(form, name) {
  return {
    value: form.values[name] ?? '',
    error: form.touched[name] ? form.errors[name] : undefined,
    onChange: form.handleChange,
    onBlur: form.handleBlur,
  }
}

// eslint-disable-next-line max-lines-per-function
export default function ProfileEditScreen() {
  // States (R-010 — States → Memos → Effects → Handlers)
  const navigation = useNavigation()
  const { profile, user } = useProfile()
  const { saveProfile, loading } = useProfileMutation()
  const { show } = useToast()
  // useProfile carrega o perfil async; o form precisa re-hidratar quando os
  // dados chegam (init capturou '' antes do fetch resolver — R-216/AP-N20).
  const hydratedRef = useRef(false)

  // Memos — init null-safe a partir do perfil carregado (AP-N20: hidratar todos
  // os campos; campos ausentes → '' pro FormInput não receber null).
  const initialValues = useMemo(
    () => ({
      display_name: profile?.display_name ?? '',
      birth_date: profile?.birth_date ?? '',
      city: profile?.city ?? '',
      state: profile?.state ?? '',
      phone: profile?.phone ?? '',
    }),
    [profile],
  )

  const form = useFormState(userProfileSchema, { initialValues })

  // birth_date é string 'YYYY-MM-DD' no form; FormDatePicker opera com Date.
  const birthDateAsDate = useMemo(
    () => (typeof form.values.birth_date === 'string' && form.values.birth_date ? parseLocalDate(form.values.birth_date) : null),
    [form.values.birth_date],
  )

  const email = user?.email ?? ''
  const avatarInitials = useMemo(
    () => getInitials(form.values.display_name || profile?.display_name || email) || '?',
    [form.values.display_name, profile, email],
  )

  // Effects (R-010) — hidrata o form uma vez, quando o perfil async chega.
  useEffect(() => {
    if (!hydratedRef.current && profile) {
      form.reset(initialValues)
      hydratedRef.current = true
    }
  }, [profile, initialValues, form])

  // Handlers
  const handleBirthDateChange = useCallback(
    (_name, date) => {
      form.handleChange('birth_date', date ? formatLocalDate(date) : '')
    },
    [form],
  )

  const handlePhoneChange = useCallback(
    (_name, value) => {
      form.handleChange('phone', formatPhoneBR(value))
    },
    [form],
  )

  const handleAvatarPress = useCallback(() => {
    // Foto de avatar = Perfil V2 (backlog). V1 entrega só iniciais.
    show('Foto de perfil chega em breve', { variant: 'info' })
  }, [show])

  const handleSubmit = useCallback(async () => {
    if (!form.validate()) return
    // Normaliza campos opcionais vazios → null (schema .transform já trata state).
    const payload = {
      display_name: (form.values.display_name as string)?.trim() ?? '',
      birth_date: form.values.birth_date || null,
      city: (form.values.city as string)?.trim() || null,
      state: form.values.state || null,
      phone: (form.values.phone as string)?.trim() || null,
    }
    const res = await saveProfile(payload)
    if (res.success) {
      show('Perfil atualizado!', { variant: 'success' })
      navigation.goBack()
    } else {
      show(res.error ?? 'Erro ao salvar perfil', { variant: 'error' })
    }
  }, [form, saveProfile, show, navigation])

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
        <Text style={styles.title}>Editar Perfil</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Avatar — iniciais (foto = V2) */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Foto de perfil (em breve)"
          >
            <Text style={styles.avatarInitials}>{avatarInitials}</Text>
          </TouchableOpacity>
        </View>

        <FormInput
          name="display_name"
          label="Nome"
          required
          placeholder="Como você quer ser chamado"
          autoCapitalize="words"
          maxLength={200}
          {...formProps(form, 'display_name')}
        />

        <View style={styles.field}>
          <FormDatePicker
            name="birth_date"
            label="Data de nascimento"
            placeholder="Selecionar data"
            value={birthDateAsDate}
            error={form.touched.birth_date ? form.errors.birth_date : undefined}
            onChange={handleBirthDateChange}
            onBlur={form.handleBlur}
            maximumDate={getNow()}
          />
          <Text style={styles.optionalTag}>opcional</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowCity}>
            <FormInput
              name="city"
              label="Cidade"
              placeholder="São Paulo"
              maxLength={100}
              {...formProps(form, 'city')}
            />
          </View>
          <View style={styles.rowState}>
            <FormSelect
              name="state"
              label="Estado"
              placeholder="UF"
              options={STATE_OPTIONS}
              {...formProps(form, 'state')}
            />
          </View>
        </View>

        <View style={styles.field}>
          <FormInput
            name="phone"
            label="Telefone"
            placeholder="(11) 99999-9999"
            keyboardType="phone-pad"
            maxLength={15}
            {...formProps(form, 'phone')}
            onChange={handlePhoneChange}
          />
          <Text style={styles.optionalTag}>opcional</Text>
        </View>

        {/* Email readonly — alteração via Configurações → Segurança (PO-7) */}
        <View style={styles.field}>
          <Text style={styles.label}>Email da conta</Text>
          <View style={styles.readonlyInput}>
            <Text style={styles.readonlyText} numberOfLines={1}>
              {email || '—'}
            </Text>
            <Lock size={16} color={colors.text.muted} strokeWidth={2} />
          </View>
          <Text style={styles.caption}>Para alterar, use Configurações → Segurança.</Text>
        </View>
      </ScrollView>

      <FormActions
        primaryLabel="Salvar"
        onPrimary={handleSubmit}
        primaryLoading={loading}
        secondaryLabel="Cancelar"
        onSecondary={() => navigation.goBack()}
      />
    </SafeAreaView>
  )
}

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
    paddingBottom: spacing[12],
    gap: spacing[4],
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary[700],
    letterSpacing: 0.5,
  },
  field: {
    position: 'relative',
  },
  optionalTag: {
    position: 'absolute',
    right: 0,
    top: 0,
    fontSize: 13,
    color: colors.text.muted,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  rowCity: {
    flex: 2,
  },
  rowState: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: 6,
  },
  readonlyInput: {
    height: 50,
    backgroundColor: colors.neutral[50],
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readonlyText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.secondary,
    marginRight: spacing[2],
  },
  caption: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 6,
  },
})
