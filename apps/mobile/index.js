// index.js — Entrypoint do Expo
// Polyfills globais PRIMEIRO — antes de qualquer lib que dependa deles
import './polyfills'
// AppRegistry direto do RN: bypass do registerRootComponent do Expo SDK 53
// O registerRootComponent detecta transform.routerRoot=app do Expo Go e tenta
// inicializar expo-router — que não está instalado — causando crash (AP-H09)
import { AppRegistry } from 'react-native'
import App from './App'
// Handler de background do alarme (Spec 001) — registrar no top-level antes do
// app montar, p/ processar "Tomei"/"Pular" com o app fechado (lock screen).
import { registerAlarmBackgroundHandler } from './src/platform/alarms/registerAlarmBackgroundHandler'

registerAlarmBackgroundHandler()

AppRegistry.registerComponent('main', () => App)
