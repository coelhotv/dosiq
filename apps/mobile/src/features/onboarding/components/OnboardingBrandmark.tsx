// OnboardingBrandmark — logo "dosiq" (ícone + nome) no topo do passo "Seu primeiro remédio".
// Extraído na spec 066 E (C-5): o passo virou três telas e a Escolha (nova 1ª tela) saiu sem o logo que
// o passo antigo tinha. Escolha e "Confira" mostram; a Busca e o leitor não (PO 2026-10-18 — teclado e
// câmera precisam da altura). Componente puro.

import { View, Text, Image, StyleSheet } from 'react-native'
import { colors, spacing, typography } from '@shared/styles/tokens'

export default function OnboardingBrandmark() {
  return (
    <View style={styles.brandmark}>
      <Image source={require('../../../../assets/icon.png')} style={styles.brandIcon} resizeMode="contain" />
      <Text style={styles.brandText}>dosiq</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  brandmark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
    alignSelf: 'center',
  },
  brandIcon: {
    width: 28,
    height: 28,
  },
  brandText: {
    fontSize: 20,
    fontFamily: typography.fontFamily.brand,
    color: colors.text.brand,
    marginLeft: spacing[1],
    fontWeight: '700',
  },
})
