// index.js — Entrypoint do Expo
// Polyfills globais PRIMEIRO — antes de qualquer lib que dependa deles
import './polyfills'
// react-native-url-polyfill removido: RN 0.79 + Hermes suporta URL nativo
// O polyfill sobrescrevia URL.searchParams com implementação quebrada (AP-H08)
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
