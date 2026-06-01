import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Globe, X } from 'lucide-react-native'
import { colors, spacing, borderRadius } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'

/**
 * TzNudgeCard — convite passivo de reconciliação de fuso horário (F4.3f.0).
 *
 * Espelho mobile do nudge web (R-166): usuários existentes nasceram com
 * `timezone` no DEFAULT (São Paulo) porque a UI nunca capturou o fuso do
 * device. Informa a nova feature e leva ao seletor de fuso nas Configurações.
 * Dispensável; dismiss persiste em AsyncStorage.
 */
const DISMISS_KEY = 'dosiq_tz_nudge_dismissed'

export default function TzNudgeCard() {
  const navigation = useNavigation()
  // Começa oculto até confirmar que não foi dispensado (evita flash).
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let active = true
    AsyncStorage.getItem(DISMISS_KEY)
      .then((v) => {
        if (active && v !== '1') setVisible(true)
      })
      .catch(() => {
        if (active) setVisible(true)
      })
    return () => {
      active = false
    }
  }, [])

  const handleDismiss = useCallback(async () => {
    setVisible(false)
    try {
      await AsyncStorage.setItem(DISMISS_KEY, '1')
    } catch (err) {
      if (__DEV__) console.error('[TzNudgeCard] erro ao salvar dismiss:', err)
    }
  }, [])

  if (!visible) return null

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.iconWrap}>
        <Globe size={22} color={colors.primary[700]} strokeWidth={1.75} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Novidade: fuso horário</Text>
        <Text style={styles.text}>
          Agora o Dosiq respeita o seu fuso horário. Veja nas
          ‘Configurações’ e ajuste se for necessário.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate(ROUTES.SETTINGS)}
          accessibilityRole="button"
          accessibilityLabel="Ajustar fuso horário"
        >
          <Text style={styles.cta}>Ajustar fuso horário</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dispensar aviso"
      >
        <X size={18} color={colors.text.secondary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200] || colors.primary[100],
    padding: spacing[4],
    marginHorizontal: 16,
    marginBottom: spacing[6],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  text: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  cta: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[700],
  },
})
