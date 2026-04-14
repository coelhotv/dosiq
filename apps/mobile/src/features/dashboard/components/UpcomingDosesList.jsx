// UpcomingDosesList.jsx — lista de doses/protocolos do dia
// Calcula quantas vezes cada protocolo foi tomado e exibe cada item

import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing } from '../../../shared/styles/tokens'
import DoseListItem from './DoseListItem'

/**
 * @param {{
 *   protocols: Array,
 *   logs: Array,
 *   medicines: Record<string, Object>,
 *   onRegister: Function,
 * }} props
 */
export default function UpcomingDosesList({ protocols, logs, medicines, onRegister }) {
  if (!protocols.length) return null

  // Contar quantas vezes cada protocolo foi tomado hoje
  const takenByProtocol = logs.reduce((acc, log) => {
    if (log.protocol_id) {
      acc[log.protocol_id] = (acc[log.protocol_id] ?? 0) + 1
    }
    return acc
  }, {})

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Doses de hoje</Text>
      {protocols.map((protocol) => (
        <DoseListItem
          key={protocol.id}
          protocol={protocol}
          medicine={medicines[protocol.medicine_id]}
          takenCount={takenByProtocol[protocol.id] ?? 0}
          onRegister={onRegister}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[1],
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[2],
  },
})
