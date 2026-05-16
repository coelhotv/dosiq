// MedicineEmptyState.jsx — Estado vazio da biblioteca de medicamentos
// Componente puro (sem state, sem effects) exibido quando a lista está vazia.
// Single CTA — paradoxo da escolha evitado (decisão PO M1.2).

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Pill } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import { colors, spacing } from '@shared/styles/tokens'
import { ROUTES } from '@navigation/routes'
import { lightTap } from '@shared/utils/haptics'

export function MedicineEmptyState() {
  const navigation = useNavigation()

  const handleCreateMedicine = () => {
    lightTap()
    navigation.navigate(ROUTES.MEDICINE_CREATE)
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Pill size={48} color={colors.primary[500]} strokeWidth={1.5} />
      </View>

      <Text style={styles.title}>Biblioteca vazia</Text>

      <Text style={styles.subtitle}>
        Cadastre medicamentos para começar a gerenciar tratamentos
      </Text>

      <View style={{ height: spacing[6] }} />

      <Pressable style={styles.button} onPress={handleCreateMedicine}>
        <Text style={styles.buttonText}>+ Cadastrar primeiro medicamento</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[6],
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  button: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: spacing[3],
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: 15,
  },
})
