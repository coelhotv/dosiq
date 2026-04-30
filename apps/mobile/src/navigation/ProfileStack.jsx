import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from './routes'
import ProfileScreen from '../features/profile/screens/ProfileScreen'
import TelegramLinkScreen from '../features/profile/screens/TelegramLinkScreen'
import NotificationPreferencesScreen from '../features/profile/screens/NotificationPreferencesScreen'
import NotificationInboxScreen from '../features/notifications/screens/NotificationInboxScreen'

const Stack = createStackNavigator()

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.PROFILE_MAIN} component={ProfileScreen} />
      <Stack.Screen name={ROUTES.TELEGRAM_LINK} component={TelegramLinkScreen} />
      <Stack.Screen name={ROUTES.NOTIFICATION_PREFERENCES} component={NotificationPreferencesScreen} />
      <Stack.Screen name={ROUTES.NOTIFICATION_INBOX} component={NotificationInboxScreen} />
    </Stack.Navigator>
  )
}
