// TreatmentsStack.jsx — stack aninhado dentro da tab Tratamentos
// Sprint H5.4 pode adicionar TreatmentDetailScreen aqui

import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ROUTES } from './routes'
import TreatmentsScreen from '../features/treatments/screens/TreatmentsScreen'

const Stack = createNativeStackNavigator()

export default function TreatmentsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.TREATMENTS_LIST} component={TreatmentsScreen} />
    </Stack.Navigator>
  )
}
