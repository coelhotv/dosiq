// App.js — entrypoint do Expo (expo/AppEntry.js aponta para este arquivo)
import * as Sentry from '@sentry/react-native'
import AppRoot from './src/navigation/AppRoot'

export default Sentry.wrap(AppRoot)
