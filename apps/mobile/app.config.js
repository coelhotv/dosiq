// app.config.js — identidade do app mobile
// bundleIdentifier/androidPackage são OFICIAIS (Aprovados Google Play Console)
// RE-001: app.config.js é o formato canônico (não app.json)
// RE-006: identidade estável por variante de ambiente

const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'production'

// Canal de OTA gravado NO BINÁRIO (spec 051-A). Default deliberadamente `development` e NÃO
// `production`: um build feito sem EAS_BUILD_PROFILE é, por definição, alguém rodando na mão
// (`expo run:android`, experimento local) — e esse aparelho não pode acabar escutando o canal
// que serve os usuários reais. Os scripts de build exportam EAS_BUILD_PROFILE sempre, então o
// default só vale para os casos em que errar barato é melhor que errar caro.
const UPDATE_CHANNEL = process.env.EAS_BUILD_PROFILE || 'development'

const APP_VERSION = '0.31.4' // R-182: versão semântica (sem prefixo 'v')
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
    // ── OTA / EAS Update (spec 051-A, FR-001/003/005/007) ────────────────────────────────
    // ADR-082: o runtimeVersion de um build É o APP_VERSION dele.
    // Consequência que rege a operação inteira: update publicado só alcança builds do MESMO
    // runtime, e por isso release OTA NUNCA bumpa APP_VERSION (bump = runtime novo = update
    // órfão, sem nenhum build instalado pra receber). Ver docs/operations/GUIA_OTA_EAS_UPDATE.md.
    //
    // ⚠️ VALOR LITERAL, não `{ policy: 'appVersion' }`. Os scripts de build rodam
    // `expo prebuild` antes do `eas build --local`, e a pasta `android/`/`ios/` resultante faz o
    // EAS classificar o projeto como bare workflow — onde política de runtimeVersion NÃO é
    // suportada e o build ABORTA ("runtime version policies are not supported"). Declarar o
    // literal produz exatamente o mesmo valor que a política produziria (é a mesma constante),
    // preservando o ADR-082 sem depender da resolução automática do EAS.
    runtimeVersion: APP_VERSION,
    updates: {
      // `eas update:configure` escreveria isto sozinho em app.json estático; como o config aqui é
      // DINÂMICO (app.config.js, RE-001), o CLI não tem onde escrever e a url entra à mão.
      // Deriva do mesmo projectId de `extra.eas` abaixo — as duas DEVEM apontar pro mesmo projeto.
      url: 'https://u.expo.dev/7d1f6cb7-2fdd-4a5e-9ad3-e3ec56417bba',
      // 🔴 AP-303 (fail-open / offline-first): 0 = NUNCA bloquear o launch esperando download.
      // O app sobe imediatamente com o bundle que já tem; o update baixado aplica no cold start
      // seguinte. Valor > 0 faria o boot esperar a rede — em 4G instável (norma no BR) isso é
      // exatamente o "não sei" virando negação que o AP-303 proíbe.
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
      // 🔴 O canal PRECISA ser declarado aqui, não só no `eas.json`.
      // O `eas update:configure` grava o canal no AndroidManifest/Expo.plist — e o
      // `expo prebuild --clean` dos scripts de build regenera esses arquivos A PARTIR DESTE
      // CONFIG, apagando o que o CLI tinha escrito. Sem esta linha o binário sai SEM
      // `expo-channel-name`, não escuta canal nenhum e nenhum update jamais o alcança —
      // falha silenciosa: o app funciona, só nunca atualiza. (Achado no smoke do PR 1.6:
      // a tela de Perfil mostrava o canal vazio.)
      // O `channel` do `eas.json` continua valendo para o lado do PUBLISH (roteamento
      // branch↔channel no servidor); esta linha é o lado do CLIENTE.
      requestHeaders: {
        'expo-channel-name': UPDATE_CHANNEL,
      },
      // 🔴 CODE SIGNING DESATIVADO — não por escolha de segurança, por barreira de plano.
      // O ADR-083 decidiu habilitá-lo neste slice; a decisão foi tomada sem saber que o EAS
      // cobra o recurso: `eas update` responde "EAS Update code signing requires a subscription
      // to the EAS Enterprise plan". Emenda registrada no ADR-083 (2026-07-27).
      //
      // ⚠️ NÃO reative estas duas linhas sem ter o plano: um binário COM certificado rejeita
      // todo bundle NÃO assinado, e sem plano não há como assinar — o canal OTA trava dos dois
      // lados e só um novo build de loja destrava.
      //
      // O par de chaves já foi gerado e está guardado (certs/certificate.pem versionado; a chave
      // privada fora do repo, em DOSIQ_OTA_PRIVATE_KEY_PATH). Se o plano existir um dia, basta
      // reativar aqui e rebuildar.
      //
      // O que protege o canal enquanto isso (ADR-083 D3, agora defesa principal e não secundária):
      // 2FA obrigatório na conta Expo · publish manual exclusivo do PO no Mac Mini · proibição de
      // EXPO_TOKEN persistente em CI. Risco residual aceito pelo PO: quem comprometer a conta
      // Expo entrega código a 100% da base instalada sem passar por loja.
      // codeSigningCertificate: './certs/certificate.pem',
      // codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' },
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
      // ADR-090: @react-native-firebase saiu (não compila sob Xcode 26.3/RN 0.81 + static).
      // Crash reporting = Sentry. org/project vêm do env (SENTRY_ORG/SENTRY_PROJECT) e o upload
      // de sourcemap exige SENTRY_AUTH_TOKEN no build (segredo EAS, NUNCA EXPO_PUBLIC_*).
      ['@sentry/react-native/expo', {
        // org/project NÃO são segredo (aparecem na URL do dashboard); só o AUTH_TOKEN é.
        organization: process.env.SENTRY_ORG || 'dosiq-d4',
        project: process.env.SENTRY_PROJECT || 'dosiq-app',
        url: 'https://sentry.io/',
      }],
      // PostHog precisa do locale do device (peer dep de posthog-react-native).
      'expo-localization',
      // sounds: copia os .wav p/ android res/raw + iOS bundle → notifee/expo
      // resolvem por nome ('alarm_dose'/'push_chime'). Sem isso o canal cai no
      // som padrão do SO (Spec 001 — bug visto no dumpsys: mSound=default).
      ['expo-notifications', {
        sounds: ['./assets/sounds/alarm_dose.wav', './assets/sounds/push_chime.wav'],
      }],
      'expo-font',
      ['expo-build-properties', {
        ios: {
          // 'static' LIMPO (ADR-090): com o firebase fora, some o conflito de módulo Obj-C que
          // exigia o withFirebasePodfileFix (CLANG_ALLOW_NON_MODULAR_INCLUDES) e some o motivo de
          // cogitar 'dynamic' (que quebrava o link do react-native-netinfo — pod da comunidade não
          // dynamic-framework-safe). Sentry e PostHog são pods RN puros e compilam sob static.
          useFrameworks: 'static'
        },
        android: {
          // Play Store exige targetSdkVersion>=36 (Android 16) a partir de 30/ago/2026 —
          // explícito porque o SDK 54 já default p/ 36, mas não confiar no default (spec 055).
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          // Notifee (Spec 001) distribui o AAR app.notifee:core num maven repo
          // LOCAL dentro do pacote; sem registrá-lo o gradle não resolve
          // (app.notifee:core+ não encontrado). Caminho relativo ao módulo :app
          // (android/app), onde o allprojects avalia a url → sobe 4 níveis até o
          // repo-root node_modules (monorepo hoisted), portável.
          extraMavenRepos: ['../../../../node_modules/@notifee/react-native/android/libs'],
          useLegacyPackaging: true,
          // R8 (minify + shrink de recursos) nos builds de RELEASE. Ficava desligado por default
          // do template Expo (`android.enableMinifyInReleaseBuilds` = false) — o Play Console
          // apontou isso como "Your app is not optimized" no AAB da v0.30.0.
          // 🔴 O que isto NÃO afeta: o bundle JS (Hermes). Minificação é de Java/Kotlin — stack
          // trace de erro JS continua igual. O que muda é o código nativo: some o que ninguém
          // chama, e o que sobra vira nome curto.
          // ⚠️ Por isso o smoke pós-build é obrigatório: R8 quebra o que é resolvido por REFLEXÃO
          // (nome de classe em string), e nada disso aparece em lint/tsc/teste — só em runtime.
          enableProguardInReleaseBuilds: true,
          // 🔴 shrinkResources DESLIGADO (2026-08-01, 2ª medição do APK v0.30.1).
          // Não é preferência: o `res/raw/keep.xml` gerado por withDoseActivityAndroidIcon.js
          // NÃO foi respeitado. Medido no artefato — `raw/keep` estava empacotado (prova de que
          // o arquivo chegou ao build) e `drawable/ic_dosiq_mark` continuava removido: some do
          // dump da tabela exatamente no ID que ocuparia por ordem alfabética (0x7f0800af, entre
          // ic_clock_black_24dp e ic_keyboard_black_24dp) — foi compilado e depois descartado.
          // Sem entender POR QUE o keep é ignorado, ligar isto significa apostar o smallIcon da
          // notificação de dose numa heurística de terceiro (AP-251, duas reincidências). O aviso
          // do Play Console pedia R8/minify de CÓDIGO, que continua ligado; shrink de recursos
          // não fazia parte do pedido e vale ~2 MB. Constituição §II: caminho clínico não paga
          // esse tipo de aposta. Reabrir só com prova no artefato, não com raciocínio.
          enableShrinkResourcesInReleaseBuilds: false,
          // Regras adicionais. A maioria das libs já traz consumer rules dentro do próprio pacote
          // (verificado: @notifee/react-native, expo-updates e expo-modules-core têm
          // `android/proguard-rules.pro`; Sentry e React Native entregam as suas dentro do AAR).
          // O que fica aqui é só o que NENHUMA delas cobre:
          extraProguardRules: [
            // Sentry: sem estes atributos o stack trace nativo perde arquivo/linha e o mapping
            // não tem o que remapear — o crash chega ao dashboard como ruído ofuscado.
            '-keepattributes SourceFile,LineNumberTable',
            '-keepattributes *Annotation*',
            // Notifee resolve classes de evento por nome ao entregar a notificação. O consumer
            // rules do pacote cobre o núcleo; este keep protege os models que atravessam a ponte
            // — perder um deles quebra o ALARME DE DOSE, que é o produto (Constituição §II).
            '-keep class app.notifee.core.** { *; }',
            // Módulos Expo são descobertos por lista gerada + reflexão no boot. Um módulo
            // renomeado pelo R8 não é "erro de compilação": é um módulo que simplesmente não
            // existe em runtime, e o app sobe sem ele.
            '-keep class expo.modules.** { *; }',
            '-keep class * extends expo.modules.core.interfaces.Package { *; }',
            // Nosso código nativo: bridge da Live Activity/alarme + Application/Activity citados
            // por nome no manifest.
            '-keep class com.coelhotv.dosiq.** { *; }',
          ].join('\n'),
        },
      }],
      [
        'expo-tracking-transparency',
        {
          "userTrackingPermission": "Seus dados nos ajudam a manter o Dosiq gratuito por meio de anúncios personalizados e melhorias no app."
        }
      ],
      // Tira o deep link de dev (`exp+dosiq-app`) do manifest de release. A exclusão dos MÓDULOS
      // de dev-client mora em package.json → expo.autolinking.android.exclude, não aqui: a
      // propriedade equivalente do settings.gradle é quebrada upstream (a lista é achatada em um
      // argumento só). O scheme não vem do autolinking, então precisa deste tratamento à parte.
      // Detalhe, evidência e reversão no arquivo do plugin + AP-324.
      './withoutDevSchemeOnRelease.js',
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
      '@react-native-community/datetimepicker',
      // SDK 54: expo install --fix aponta como plugins nativos (config dinâmico não
      // escreve sozinho); sem uso de config custom, entram sem 2º argumento.
      'expo-secure-store',
      'expo-web-browser'
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
