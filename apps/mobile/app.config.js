// app.config.js — identidade do app mobile
// bundleIdentifier/androidPackage são OFICIAIS (Aprovados Google Play Console)
// RE-001: app.config.js é o formato canônico (não app.json)
// RE-006: identidade estável por variante de ambiente

const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'development'

const APP_VERSION = '0.1.0'
const [major, minor, patch] = APP_VERSION.split('.').map(Number)
// versionCode derivado da versão semântica: major*10000 + minor*100 + patch
// 0.2.4 → 204 | 0.3.0 → 300 | 1.0.0 → 10000
const VERSION_CODE = major * 10000 + minor * 100 + patch

const variants = {
  development: {
    name: 'Meus Remedios Dev',
    slug: 'meus-remedios-dev',
    iosBundleIdentifier: 'com.coelhotv.meusremedios.dev',
    androidPackage: 'com.coelhotv.meusremedios.dev',
  },
  preview: {
    name: 'Meus Remedios Preview',
    slug: 'meus-remedios-dev',
    iosBundleIdentifier: 'com.coelhotv.meusremedios.preview',
    androidPackage: 'com.coelhotv.meusremedios.preview',
  },
  production: {
    name: 'Meus Remedios',
    slug: 'meus-remedios-dev',
    iosBundleIdentifier: 'com.coelhotv.meusremedios',
    androidPackage: 'com.coelhotv.meusremedios',
  },
}

const current = variants[BUILD_PROFILE] || variants.development

module.exports = {
  expo: {
    name: current.name,
    owner: 'coelhotv',
    slug: current.slug,
    // DL-001: scheme canônico do projeto
    scheme: 'meusremedios',
    version: APP_VERSION,
    cli: {
      appVersionSource: 'local',
    },
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#E9F3EA',
    },
    ios: {
      bundleIdentifier: current.iosBundleIdentifier,
      buildNumber: '2',
      supportsTablet: false,
      jsEngine: 'hermes',
      minimumOSVersion: '15.5',
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST_PATH || `./GoogleService-Info-${BUILD_PROFILE}.plist`,
    },
    android: {
      package: current.androidPackage,
      versionCode: VERSION_CODE,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH || `./google-services-${BUILD_PROFILE}.json`,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#E9F3EA',
      },
      edgeToEdgeEnabled: true,
    },
    plugins: [
      '@react-native-firebase/app',
      ['expo-build-properties', {
        ios: {
          useFrameworks: 'static'
        }
      }],
      './withFirebaseFix.js'
    ],
    extra: {
      // RE-004: variáveis públicas via EXPO_PUBLIC_*
      // Pacotes compartilhados NÃO leem estas vars diretamente
      appEnv: process.env.EXPO_PUBLIC_APP_ENV || BUILD_PROFILE,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: {
        projectId: '7169f55a-6de7-465f-b007-f5eb6034c8e6',
      },
      owner: "coelhotv"
    },
  },
}
