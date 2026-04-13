// ProfileStack.jsx — stack aninhado dentro da tab Perfil
// Sprint H5.6/H5.7 pode adicionar TelegramLinkScreen aqui

import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ROUTES } from './routes'
import ProfileScreen from '../features/profile/screens/ProfileScreen'

const Stack = createNativeStackNavigator()

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.PROFILE_MAIN} component={ProfileScreen} />
    </Stack.Navigator>
  )
}
