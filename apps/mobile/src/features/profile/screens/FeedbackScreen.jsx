// apps/mobile/src/features/profile/screens/FeedbackScreen.jsx
// Tela de formulário móvel nativo para envio de feedback do usuário

import React, { useMemo, useCallback } from 'react'
import { ScrollView, View, Text, Pressable, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { ChevronLeft, Star } from 'lucide-react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { feedbackSchema, createFeedbackRepository } from '@dosiq/core'
import { useFormState } from '@shared/hooks/useFormState'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import FormInput from '@shared/components/form/FormInput'
import FormActions from '@shared/components/form/FormActions'
import { useToast } from '@shared/components/feedback/Toast'
import { colors, spacing, borderRadius, typography, shadows } from '@shared/styles/tokens'

function formProps(form, name) {
  return {
    value: form.values[name] ?? '',
    error: form.touched[name] ? form.errors[name] : undefined,
    onChange: form.handleChange,
    onBlur: form.handleBlur,
  }
}

export default function FeedbackScreen() {
  // 1. States
  const navigation = useNavigation()
  const { show } = useToast()
  const [loading, setLoading] = React.useState(false)

  // 2. Memos
  const initialValues = useMemo(() => {
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other'
    const device = Device.deviceName || Platform.select({ ios: 'iPhone', android: 'Android', default: 'Nativo' })
    const app_version = Constants.expoConfig?.version || '3.3.0'

    return {
      subject: '',
      comment: '',
      rating: null, // inicia vazio (null estrelas)
      platform,
      device,
      app_version
    }
  }, [])

  const form = useFormState(feedbackSchema, { initialValues })

  // 3. Handlers
  const handleRatingSelect = useCallback((value) => {
    form.handleChange('rating', value)
  }, [form])

  const handleSubmit = useCallback(async () => {
    if (!form.validate()) return

    setLoading(true)
    try {
      const getUserId = async () => {
        const { data, error } = await supabase.auth.getUser()
        if (error || !data?.user) throw new Error('Usuário não autenticado')
        return data.user.id
      }

      const repo = createFeedbackRepository({ client: supabase, getUserId })
      
      const payload = {
        subject: form.values.subject.trim(),
        comment: form.values.comment.trim(),
        rating: form.values.rating,
        platform: form.values.platform,
        device: form.values.device,
        app_version: form.values.app_version
      }

      await repo.submitFeedback(payload)

      show('Feedback enviado! Obrigado pela sugestão.', { variant: 'success' })
      navigation.goBack()
    } catch (err) {
      console.error('[FeedbackScreen] Erro ao enviar feedback:', err)
      show(err.message || 'Erro ao enviar feedback. Tente novamente.', { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [form, show, navigation])

  const renderStarSelector = () => {
    const stars = []
    const currentRating = form.values.rating || 0

    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= currentRating
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleRatingSelect(i)}
          style={styles.starTouch}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Avaliar com ${i} estrela${i > 1 ? 's' : ''}`}
        >
          <Star
            size={36}
            color={isFilled ? '#fbbf24' : colors.neutral[300]}
            fill={isFilled ? '#fbbf24' : 'transparent'}
            strokeWidth={1.5}
          />
        </TouchableOpacity>
      )
    }

    return (
      <View style={styles.starsContainer}>
        <View style={styles.starsRow}>
          {stars}
        </View>
        {currentRating > 0 && (
          <Text style={styles.starsLabel}>
            {currentRating === 5 ? 'Excelente!' :
             currentRating === 4 ? 'Muito bom' :
             currentRating === 3 ? 'Bom / Regular' :
             currentRating === 2 ? 'Precisa melhorar' : 'Não gostei'}
          </Text>
        )}
      </View>
    )
  }

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
        <Text style={styles.title}>Enviar Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Sua opinião importa!</Text>
          <Text style={styles.introBody}>
            Encontrou algum problema ou tem sugestões de melhoria para o Dosiq? Compartilhe conosco!
          </Text>
        </View>

        <FormInput
          name="subject"
          label="Assunto"
          required
          showCharacterCount
          placeholder="Ex: Erro ao cadastrar remédio, Sugestão de cor..."
          maxLength={100}
          autoCapitalize="sentences"
          {...formProps(form, 'subject')}
        />

        <FormInput
          name="comment"
          label="Comentário / Detalhes"
          required
          showCharacterCount
          placeholder="Escreva aqui suas sugestões, críticas ou relate um erro com o máximo de detalhes possível..."
          multiline
          numberOfLines={6}
          maxLength={2000}
          autoCapitalize="sentences"
          {...formProps(form, 'comment')}
        />

        {/* Avaliação por Estrelas */}
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Como você avalia nosso app?</Text>
          {renderStarSelector()}
          {form.errors.rating && (
            <Text style={styles.errorText}>{form.errors.rating}</Text>
          )}
        </View>
      </ScrollView>

      <FormActions
        primaryLabel="Enviar Feedback"
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
  introCard: {
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200] || colors.primary[100],
    padding: spacing[4],
    marginBottom: spacing[2],
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  introBody: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  field: {
    marginBottom: spacing[2],
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing[3],
  },
  starsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing[4],
    borderWidth: 1.5,
    borderColor: colors.border.default,
    ...shadows.sm,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  starTouch: {
    padding: spacing[1],
  },
  starsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.primary || colors.text.secondary,
    marginTop: spacing[2],
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.status.error,
    marginTop: 6,
    textAlign: 'center',
  },
})
