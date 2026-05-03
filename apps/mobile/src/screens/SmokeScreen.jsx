// SmokeScreen.jsx — prova que Metro resolve workspaces e @dosiq/core está acessível
// Critério de sucesso: renderiza "SUCCESS" quando medicineSchema.safeParse passa
// R4-005: smoke screen é obrigatória antes de construir telas do produto

import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { medicineSchema } from '@dosiq/core/schemas'
import { ROUTES } from '../navigation/routes'

export default function SmokeScreen({ navigation }) {
  // Valida um medicamento de teste usando o schema compartilhado
  const parsed = medicineSchema.safeParse({
    name: 'Teste',
    dosage: '1 comprimido',
    frequency: 'diario',
    quantity_taken: 1,
    unit: 'comprimido',
  })

  const { result, details } = {
    result: parsed.success ? 'SUCCESS' : 'FAILED',
    details: parsed.success
      ? 'medicineSchema: OK'
      : 'medicineSchema: ' + JSON.stringify(parsed.error.format()),
  }

  const isSuccess = result === 'SUCCESS'

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Smoke Test — Core Schema</Text>

      <View style={[styles.badge, isSuccess ? styles.badgeSuccess : styles.badgeError]}>
        <Text style={styles.badgeText}>{result}</Text>
      </View>

      {details && <Text style={styles.details}>{details}</Text>}

      {isSuccess && (
        <Pressable style={styles.button} onPress={() => navigation.navigate(ROUTES.LOGIN)}>
          <Text style={styles.buttonText}>Ir para Login →</Text>
        </Pressable>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 24,
  },
  badge: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  badgeError: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#166534',
  },
  details: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
})
