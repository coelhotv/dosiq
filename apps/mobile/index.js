// index.js — Entrypoint do Expo
// Polyfills globais PRIMEIRO — antes de qualquer lib que dependa deles
import './polyfills'
// DEBUG: url-polyfill removido temporariamente para isolar crash
// AppRegistry direto do RN: bypass do registerRootComponent do Expo SDK 53
// O registerRootComponent detecta transform.routerRoot=app do Expo Go e tenta
// inicializar expo-router — que não está instalado — causando crash (AP-H09)
import { AppRegistry } from 'react-native'
import App from './App'

AppRegistry.registerComponent('main', () => App)
