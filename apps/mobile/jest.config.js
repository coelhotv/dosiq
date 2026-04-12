module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@meus-remedios/.*)',
  ],
  moduleNameMapper: {
    // Mapeia @meus-remedios/* para os packages do monorepo
    '^@meus-remedios/core(.*)$': '<rootDir>/../../packages/core/src$1',
    '^@meus-remedios/shared-data(.*)$': '<rootDir>/../../packages/shared-data/src$1',
    '^@meus-remedios/storage(.*)$': '<rootDir>/../../packages/storage/src$1',
    '^@meus-remedios/config(.*)$': '<rootDir>/../../packages/config/src$1',
  },
}
