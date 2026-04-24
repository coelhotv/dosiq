// app.config.js — identidade do app mobile
// bundleIdentifier/androidPackage são OFICIAIS (Aprovados Google Play Console)
// RE-001: app.config.js é o formato canônico (não app.json)
// RE-006: identidade estável por variante de ambiente

const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'production'

const APP_VERSION = '0.1.6'
const [major, minor, patch] = APP_VERSION.split('.').map(Number)
// buildNumber/versionCode derivado da versão semântica: major*10000 + minor*100 + patch
// 0.2.4 → 204 | 0.3.0 → 300 | 1.0.0 → 10000
const BUILD_NUMBER = String(major * 10000 + minor * 100 + patch)

const variants = {
  development: {
    name: 'Dosiq dev',
    slug: 'dosiq-app',
    iosBundleIdentifier: 'com.coelhotv.dosiq',
    androidPackage: 'com.coelhotv.dosiq',
  },
  production: {
    name: 'Dosiq',
    slug: 'dosiq-app',
    iosBundleIdentifier: 'com.coelhotv.dosiq',
    androidPackage: 'com.coelhotv.dosiq',
  },
}

const current = variants[BUILD_PROFILE] || variants.production

module.exports = {
  expo: {
    name: current.name,
    owner: 'coelhotv',
    slug: current.slug,
    // DL-001: scheme canônico do projeto
    scheme: 'dosiq',
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
      buildNumber: BUILD_NUMBER,
      supportsTablet: false,
      jsEngine: 'hermes',
      minimumOSVersion: '15.5',
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST_PATH || `./GoogleService-Info.plist`,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      package: current.androidPackage,
      versionCode: Number(BUILD_NUMBER),
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH || `./google-services.json`,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#E9F3EA',
      },
      edgeToEdgeEnabled: true,
    },
    plugins: [
      '@react-native-firebase/app',
      'expo-notifications',
      ['expo-build-properties', {
        ios: {
          useFrameworks: 'static'
        }
      }],
      [
        'expo-tracking-transparency',
        {
          "userTrackingPermission": "Seus dados nos ajudam a manter o Dosiq gratuito por meio de anúncios personalizados e melhorias no app."
        }
      ],
      './withFirebaseFix.js'
    ],
    extra: {
      // RE-004: variáveis públicas via EXPO_PUBLIC_*
      // Pacotes compartilhados NÃO leem estas vars diretamente
      appEnv: process.env.EXPO_PUBLIC_APP_ENV || BUILD_PROFILE,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: {
        projectId: '7d1f6cb7-2fdd-4a5e-9ad3-e3ec56417bba',
      },
      owner: "coelhotv"
    },
  },
}
