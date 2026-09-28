import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing } from '../../styles/tokens'
import { AlertCircle } from 'lucide-react-native'

const WARNING_BG_ALPHA = 'rgba(144, 77, 0, 0.08)' // colors.status.warning com alpha
const WARNING_BORDER_ALPHA = 'rgba(144, 77, 0, 0.12)' // colors.status.warning com alpha

// Spec 091 (AC-3.1): texto ÚNICO e curto, sem jargão. Serve às 4 telas com cópia local (Hoje,
// Remédios, Tratamentos, Estoque). Nos dois casos do Hoje (cópia de hoje ou de ontem) a agenda está
// certa — as ocorrências vêm até o fim do dia seguinte — e o que pode atrasar é o status; por isso
// não há mais variante por dia (decisão do PO no smoke de 28/09).
export const STALE_BANNER_MESSAGE =
  'Sem internet. Mostrando a última cópia no aparelho; atualiza quando a conexão voltar.'

/**
 * Banner informativo para indicar que o app está em modo offline
 * e exibindo a cópia salva no aparelho.
 *
 * @param {Object} props
 * @param {string} [props.message] - Mensagem customizada
 */
export default function StaleBanner({ message = undefined }: { message?: string }) {
  const defaultMessage = STALE_BANNER_MESSAGE

  return (
    <View style={styles.container}>
      <AlertCircle size={16} color={colors.status.warning} style={styles.icon} />
      <Text style={styles.text}>{message || defaultMessage}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: WARNING_BG_ALPHA,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: WARNING_BORDER_ALPHA,
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
