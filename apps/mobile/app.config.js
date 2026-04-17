// app.config.js — identidade do app mobile
// bundleIdentifier/androidPackage são OFICIAIS (Aprovados Google Play Console)
// RE-001: app.config.js é o formato canônico (não app.json)
// RE-006: identidade estável por variante de ambiente

const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'development'

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
    version: '0.2.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#E9F3EA',
    },
    ios: {
      bundleIdentifier: current.iosBundleIdentifier,
      buildNumber: '1',
      supportsTablet: false,
      jsEngine: 'hermes',
    },
    android: {
      package: current.androidPackage,
      googleServicesFile: `./google-services-${BUILD_PROFILE}.json`,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#E9F3EA',
      },
      edgeToEdgeEnabled: true,
    },
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
