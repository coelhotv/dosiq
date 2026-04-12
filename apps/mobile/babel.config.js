// babel.config.js — apenas o preset Expo
// Resolução de @meus-remedios/* é feita pelo Metro (metro.config.js), não pelo Babel
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
  }
}
