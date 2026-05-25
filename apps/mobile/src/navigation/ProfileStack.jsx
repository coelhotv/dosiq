import { createStackNavigator } from '@react-navigation/stack'
import { ROUTES } from './routes'
import ProfileScreen from '../features/profile/screens/ProfileScreen'
import ProfileEditScreen from '../features/profile/screens/ProfileEditScreen'
import SettingsScreen from '../features/profile/screens/SettingsScreen'
import ChangePasswordScreen from '../features/profile/screens/ChangePasswordScreen'
import TelegramLinkScreen from '../features/profile/screens/TelegramLinkScreen'
import NotificationPreferencesScreen from '../features/profile/screens/NotificationPreferencesScreen'
import NotificationInboxScreen from '../features/notifications/screens/NotificationInboxScreen'

const Stack = createStackNavigator()

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.PROFILE_MAIN} component={ProfileScreen} />
      <Stack.Screen name={ROUTES.PROFILE_EDIT} component={ProfileEditScreen} />
      <Stack.Screen name={ROUTES.SETTINGS} component={SettingsScreen} />
      <Stack.Screen name={ROUTES.CHANGE_PASSWORD} component={ChangePasswordScreen} />
      <Stack.Screen name={ROUTES.TELEGRAM_LINK} component={TelegramLinkScreen} />
      <Stack.Screen name={ROUTES.NOTIFICATION_PREFERENCES} component={NotificationPreferencesScreen} />
      <Stack.Screen name={ROUTES.NOTIFICATION_INBOX} component={NotificationInboxScreen} />
    </Stack.Navigator>
  )
}
