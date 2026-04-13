// index.js — Entrypoint do Expo
// Polyfill de URL deve ser o PRIMEIRO import — Supabase depende de new URL()
import 'react-native-url-polyfill/auto'
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
