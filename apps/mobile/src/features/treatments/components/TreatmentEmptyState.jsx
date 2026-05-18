// TreatmentEmptyState.jsx — empty state customizado da tela de tratamentos (Fase 2)
// Spec: EXEC_SPEC_FASE2_PROTOCOLOS.md §3.1

import { View, Text, StyleSheet } from 'react-native'
import { CalendarPlus } from 'lucide-react-native'
import PrimaryButton from '../../../shared/components/ui/PrimaryButton'
import { colors, spacing } from '../../../shared/styles/tokens'

export default function TreatmentEmptyState({ onCreatePress }) {
  // (sem state/memo/effect — componente puro)
  return (
    <View style={styles.container}>
      <View style={styles.illustration}>
        <CalendarPlus size={56} color={colors.primary[500]} />
      </View>

      <Text style={styles.title}>Comece seu primeiro tratamento</Text>

      <Text style={styles.body}>
        Configure doses, horários e duração para receber lembretes e acompanhar a adesão.
      </Text>

      <PrimaryButton
        label="+ Criar primeiro tratamento"
        onPress={onCreatePress}
        style={styles.cta}
      />

      <Text style={styles.hint}>
        Você pode organizar tratamentos em planos terapêuticos depois
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginTop: spacing[6],
  },
  body: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing[3],
    maxWidth: 320,
    lineHeight: 22,
  },
  cta: {
    width: '80%',
    height: 52,
    marginTop: spacing[6],
  },
  hint: {
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing[4],
  },
})
