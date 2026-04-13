// index.js — Entrypoint do Expo
// Polyfills globais PRIMEIRO — antes de qualquer lib que dependa deles
import './polyfills'
import 'expo-dev-client'
// Polyfill de URL deve vir antes do Supabase — depende de new URL()
import 'react-native-url-polyfill/auto'
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
