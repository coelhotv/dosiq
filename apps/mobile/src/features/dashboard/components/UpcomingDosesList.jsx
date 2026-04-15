import { View, Text, StyleSheet } from 'react-native'
import DoseListItem from './DoseListItem'

/**
 * @param {{
 *   zones: { late: Array, now: Array, upcoming: Array, done: Array },
 *   onRegister: Function,
 * }} props
 */
export default function UpcomingDosesList({ zones, onRegister }) {
  if (!zones) return null

  const renderSection = (title, doses) => {
    if (!doses || doses.length === 0) return null
    return (
      <View style={styles.section} key={title}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {doses.map((dose) => (
          <DoseListItem
            key={dose.id}
            dose={dose}
            onRegister={onRegister}
          />
        ))}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {renderSection('Em Atraso', zones.late)}
      {renderSection('Próximas Doses', zones.upcoming)}
      {renderSection('Concluídas Hoje', zones.done)}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8e9199', // Variant
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
    marginHorizontal: 20,
  },
})
