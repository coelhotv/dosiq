// index.js — Entrypoint do Expo
// Polyfills globais PRIMEIRO — antes de qualquer lib que dependa deles
import './polyfills'
// Polyfill de URL: Hermes RN 0.79 tem URL parcial (new URL() ok, .protocol não)
// Supabase usa URL.protocol na inicialização — polyfill necessário
import 'react-native-url-polyfill/auto'
// AppRegistry direto do RN: bypass do registerRootComponent do Expo SDK 53
// O registerRootComponent detecta transform.routerRoot=app do Expo Go e tenta
// inicializar expo-router — que não está instalado — causando crash (AP-H09)
import { AppRegistry } from 'react-native'
import App from './App'

AppRegistry.registerComponent('main', () => App)
