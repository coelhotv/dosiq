// TzIntentSheet.jsx — bottom sheet de intenção na troca de fuso (F4.3f.2).
// Espelha LogoutSheet (R-233: statusBarTranslucent + spacer Android).
//
// Ambas as opções PERSISTEM o tz novo; a diferença é o destino das doses:
//  - "Estou aqui só de viagem": mantém a agenda original (instante absoluto), só muda o render;
//  - "Me mudei": re-ancora todas as doses futuras no fuso local.
// Fechar/backdrop = cancelar (nada muda).

import { View, Text, Modal, Pressable, StyleSheet, Platform, StatusBar, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plane, Home } from 'lucide-react-native'
import { colors, spacing, borderRadius, typography } from '@shared/styles/tokens'
import { TIMEZONE_OPTIONS } from '@dosiq/core'

/** Nome curto da cidade a partir do label de TIMEZONE_OPTIONS (nunca o IANA cru). */
function cityLabel(value) {
  const opt = TIMEZONE_OPTIONS.find((o) => o.value === value)
  return opt ? opt.label.split(',')[0].trim() : value
}

export default function TzIntentSheet({ prompt, applying, onTravel, onMove, onCancel }) {
  if (!prompt) return null
  const cidadeNova = cityLabel(prompt.toTz)
  const cidadeAntiga = cityLabel(prompt.fromTz)

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      {Platform.OS === 'android' ? (
        <View style={{ height: StatusBar.currentHeight ?? 0 }} />
      ) : null}
      <Pressable style={styles.backdrop} onPress={applying ? undefined : onCancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.handle} />

        <Text style={styles.title}>Seu fuso horário mudou</Text>
        <Text style={styles.description}>
          Você alterou para {cidadeNova}, antes era {cidadeAntiga}. O que fazer com os
          horários das suas doses?
        </Text>

        <Pressable
          onPress={onTravel}
          disabled={applying}
          style={({ pressed }) => [styles.optionPrimary, (pressed || applying) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Estou aqui só de viagem"
        >
          {applying ? (
            <ActivityIndicator size="small" color={colors.text.inverse} />
          ) : (
            <View style={styles.optionInner}>
              <Plane size={20} color={colors.text.inverse} strokeWidth={2} />
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionPrimaryLabel}>Estou aqui só de viagem</Text>
                <Text style={styles.optionPrimaryDesc}>
                  Mantemos a agenda original das suas doses, mas elas aparecem no fuso horário daqui.
                </Text>
              </View>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={onMove}
          disabled={applying}
          style={({ pressed }) => [styles.optionSecondary, (pressed || applying) && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Me mudei para ${cidadeNova}`}
        >
          <View style={styles.optionInner}>
            <Home size={20} color={colors.primary[600]} strokeWidth={2} />
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionSecondaryLabel}>Me mudei para {cidadeNova}</Text>
              <Text style={styles.optionSecondaryDesc}>
                Alteramos a agenda de todas as suas doses para o horário local daqui.
              </Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          onPress={onCancel}
          disabled={applying}
          style={({ pressed }) => [styles.btnCancel, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        >
          <Text style={styles.btnCancelText}>Cancelar</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg.card,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[6],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginBottom: spacing[4],
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
    marginBottom: spacing[5],
  },
  optionPrimary: {
    minHeight: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  optionSecondary: {
    minHeight: 64,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  optionTextWrap: {
    flex: 1,
  },
  optionPrimaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.inverse,
    marginBottom: 2,
  },
  optionPrimaryDesc: {
    fontSize: 12,
    color: colors.text.inverse,
    opacity: 0.9,
    lineHeight: 16,
  },
  optionSecondaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[700],
    marginBottom: 2,
  },
  optionSecondaryDesc: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  btnCancel: {
    height: 52,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  pressed: {
    opacity: 0.85,
  },
})
