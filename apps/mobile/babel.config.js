// babel.config.js — apenas o preset Expo
// Resolução de @dosiq/* é feita pelo Metro (metro.config.js), não pelo Babel
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@': './src',
            '@shared': './src/shared',
            '@features': './src/features',
            '@utils': './src/utils',
            '@schemas': './src/schemas',
            '@adherence': './src/features/adherence',
            '@medications': './src/features/medications',
            '@protocols': './src/features/protocols',
            '@stock': './src/features/stock',
            '@dashboard': './src/features/dashboard',
            '@navigation': './src/navigation',
            '@platform': './src/platform',
            '@profile': './src/features/profile',
            '@notifications': './src/features/notifications',
            '@treatments': './src/features/treatments',
            '@dose': './src/features/dose',
          },
        },
      ],
    ],
  }
}
