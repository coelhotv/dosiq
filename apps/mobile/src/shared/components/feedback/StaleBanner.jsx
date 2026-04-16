import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing } from '../../styles/tokens'
import { AlertCircle } from 'lucide-react-native'

/**
 * Banner informativo para indicar que o app está em modo offline
 * e exibindo dados em cache (stale).
 * 
 * @param {Object} props
 * @param {string} [props.message] - Mensagem customizada
 * @param {boolean} [props.isDaySegregated] - Se verdadeiro, indica que logs são de ontem
 */
export default function StaleBanner({ 
  message, 
  isDaySegregated = false 
}) {
  const defaultMessage = isDaySegregated
    ? "Sem conexão. Mostrando agenda (logs de hoje não disponíveis)."
    : "Sem conexão. Mostrando última sincronização disponível."

  return (
    <View style={styles.container}>
      <AlertCircle size={16} color={colors.status.warning} style={styles.icon} />
      <Text style={styles.text}>{message || defaultMessage}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(144, 77, 0, 0.08)', // colors.status.warning com alpha
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(144, 77, 0, 0.12)',
  },
  icon: {
    marginRight: spacing[2],
  },
  text: {
    fontSize: 12,
    color: colors.status.warning,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
})
