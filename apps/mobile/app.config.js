// app.config.js — identidade do app mobile
// bundleIdentifier/androidPackage são OFICIAIS (Aprovados Google Play Console)
// RE-001: app.config.js é o formato canônico (não app.json)
// RE-006: identidade estável por variante de ambiente

const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'production'

const APP_VERSION = '0.23.3' // R-182: versão semântica (sem prefixo 'v')
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
      backgroundColor: '#F0FDFB',
    },
    ios: {
      bundleIdentifier: current.iosBundleIdentifier,
      // appleTeamId: exigido pelo @bacons/apple-targets p/ assinar o widget target (DoseActivity) de
      // forma determinística — sem ele o EAS/CI pode falhar (no local o auto-signing resolve, mas warna).
      // Team ID não é segredo (consta em todo provisioning profile).
      appleTeamId: 'LU8V56S7QF',
      buildNumber: BUILD_NUMBER,
      supportsTablet: false,
      jsEngine: 'hermes',
      minimumOSVersion: '15.5',
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST_PATH || `./GoogleService-Info.plist`,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ['remote-notification'],
        // App é pt-BR nativo: declara a região/localização no binário p/ a App
        // Store e o iOS tratarem como Português (Brasil), não inglês (default).
        CFBundleDevelopmentRegion: 'pt-BR',
        CFBundleLocalizations: ['pt-BR'],
      },
      // UL-S1: Universal Links iOS
      associatedDomains: ['applinks:dosiq.app'],
      // Time Sensitive Notifications (Spec 001 — alarme fura Focus/DND no iOS via
      // interruptionLevel:'timeSensitive'). EAS sincroniza capabilities do portal
      // a partir DESTE entitlement: sem ele declarado aqui, o `eas credentials`
      // DESATIVA a capability no Apple Developer ("Disabled: Time Sensitive
      // Notifications"). Declarado → EAS mantém habilitado e gera o profile com ela.
      entitlements: {
        'com.apple.developer.usernotifications.time-sensitive': true,
        // 039/F3: App Group compartilhado app↔Widget Extension (Live Activity). O App Intent
        // (Registrar/Adiar) escreve o pedido de ação aqui; o RN lê e registra via CON-026
        // (PO-SEC-2: revalidar sessão VIVA, nunca usar userId cacheado). Mesmo id no target.
        'com.apple.security.application-groups': ['group.com.coelhotv.dosiq'],
        // Spec 010: Critical Alerts — fura mudo físico iOS para doses inegociáveis.
        // AGUARDANDO APROVAÇÃO APPLE — não descomentar antes da aprovação ser concedida.
        // Quando aprovado: descomentar a linha abaixo + restaurar no Dosiq.entitlements.
        // R-259: declarar aqui após aprovação; EAS credentials sincroniza com Apple Developer portal.
        // 'com.apple.developer.usernotifications.critical-alerts': true,
      },
    },
    android: {
      package: current.androidPackage,
      versionCode: Number(BUILD_NUMBER),
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON_PATH || `./google-services.json`,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F0FDFB',
      },
      edgeToEdgeEnabled: true,
      // UL-S1: App Links Android
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'dosiq.app', pathPrefix: '/auth' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-firebase/crashlytics',
      // sounds: copia os .wav p/ android res/raw + iOS bundle → notifee/expo
      // resolvem por nome ('alarm_dose'/'push_chime'). Sem isso o canal cai no
      // som padrão do SO (Spec 001 — bug visto no dumpsys: mSound=default).
      ['expo-notifications', {
        sounds: ['./assets/sounds/alarm_dose.wav', './assets/sounds/push_chime.wav'],
      }],
      'expo-font',
      ['expo-build-properties', {
        ios: {
          useFrameworks: 'static'
        },
        android: {
          // Notifee (Spec 001) distribui o AAR app.notifee:core num maven repo
          // LOCAL dentro do pacote; sem registrá-lo o gradle não resolve
          // (app.notifee:core+ não encontrado). Caminho relativo ao módulo :app
          // (android/app), onde o allprojects avalia a url → sobe 4 níveis até o
          // repo-root node_modules (monorepo hoisted), portável.
          extraMavenRepos: ['../../../../node_modules/@notifee/react-native/android/libs'],
        },
      }],
      [
        'expo-tracking-transparency',
        {
          "userTrackingPermission": "Seus dados nos ajudam a manter o Dosiq gratuito por meio de anúncios personalizados e melhorias no app."
        }
      ],
      './withFirebaseFix.js',
      './withAlarmPermissions.js',
      // 039/F3: NSSupportsLiveActivities no Info.plist (habilita ActivityKit).
      './withDoseLiveActivity.js',
      // 039/F3: cria o Widget Extension target (Live Activity + App Intents) de forma
      // reproduzível no prebuild/EAS a partir de targets/dose-activity/ (ADR-075 emenda).
      // appleTeamId resolvido via EAS managed credentials.
      '@bacons/apple-targets',
      // 039/F3: injeta o bridge nativo do app (start/update/end/drain) + struct compartilhada
      // no target principal (ios-native/ é versionado; ios/ é efêmero no prebuild).
      './withDoseActivityBridge.js',
      // 039/F2: escreve o vector drawable ic_dosiq_mark (smallIcon da superfície Android) no
      // prebuild — sem ele displayNotification lança e a superfície não aparece no device.
      './withDoseActivityAndroidIcon.js',
      '@react-native-community/datetimepicker'
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
