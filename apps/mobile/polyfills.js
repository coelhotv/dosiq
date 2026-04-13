// polyfills.js — deve ser importado ANTES de qualquer outro módulo
// SharedArrayBuffer não existe em JSC/Hermes no ambiente React Native.
// Supabase Realtime usa SharedArrayBuffer internamente — polyfill com ArrayBuffer.
global.SharedArrayBuffer = global.SharedArrayBuffer || global.ArrayBuffer
