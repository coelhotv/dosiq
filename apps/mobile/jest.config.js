module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@schemas/(.*)$': '<rootDir>/src/schemas/$1',
    '^@adherence/(.*)$': '<rootDir>/src/features/adherence/$1',
    '^@medications/(.*)$': '<rootDir>/src/features/medications/$1',
    '^@protocols/(.*)$': '<rootDir>/src/features/protocols/$1',
    '^@stock/(.*)$': '<rootDir>/src/features/stock/$1',
    '^@dashboard/(.*)$': '<rootDir>/src/features/dashboard/$1',
    '^@meus-remedios/core(.*)$': '<rootDir>/../../packages/core/src$1',
    '^@meus-remedios/shared-data(.*)$': '<rootDir>/../../packages/shared-data/src$1',
    '^@meus-remedios/storage(.*)$': '<rootDir>/../../packages/storage/src$1',
    '^@meus-remedios/config(.*)$': '<rootDir>/../../packages/config/src$1',
  },
}
