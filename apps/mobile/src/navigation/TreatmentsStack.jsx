// TreatmentsStack.jsx — stack aninhado dentro da tab Tratamentos
// Fase 1: inclui MedicinesList + MedicineDetail (CRUD Medicamentos — Sprint M1.1)
//
// ADR-036: usa `@react-navigation/stack` (JS) em vez de native-stack
// — evita crash em Android API 24 (rn-screens IndexOutOfBoundsException)
// reproduzido no fluxo Treatments → MedicinesList → back

import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from './routes'
import TreatmentsScreen from '../features/treatments/screens/TreatmentsScreen'
import MedicinesListScreen from '../features/medications/screens/MedicinesListScreen'
import MedicineDetailScreen from '../features/medications/screens/MedicineDetailScreen'
import MedicineFormScreen from '../features/medications/screens/MedicineFormScreen'

const Stack = createStackNavigator()

export default function TreatmentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.TREATMENTS_LIST} component={TreatmentsScreen} />
      <Stack.Screen name={ROUTES.MEDICINES_LIST} component={MedicinesListScreen} />
      <Stack.Screen name={ROUTES.MEDICINE_DETAIL} component={MedicineDetailScreen} />
      <Stack.Screen name={ROUTES.MEDICINE_CREATE} component={MedicineFormScreen} />
      <Stack.Screen name={ROUTES.MEDICINE_EDIT} component={MedicineFormScreen} />
    </Stack.Navigator>
  )
}
