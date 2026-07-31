// withoutDevClientOnRelease.js — tira o expo-dev-client do binário Android de release.
//
// PROBLEMA (medido no Play Console, aviso sobre o AAB da v0.30.0):
// no iOS o `expo-dev-client` se declara `debugOnly: true` no seu `expo-module.config.json` e some
// sozinho do build de release. No **Android não existe esse campo** — o módulo é autolinkado em
// TODA variante. O gradle plugin do dev-launcher só deixa de *instrumentar* classes fora de debug
// (DevLauncherPlugin.kt: `if (!isDebugVariant(...)) return`), mas o AAR inteiro continua linkado.
//
// O que isso custa no AAB que vai pra loja:
//   1. `expo.modules.devlauncher...DevLauncherExpoActivityConfigurator.setColor` aparece no aviso
//      de "deprecated APIs for edge-to-edge" — código de dev disparando aviso sobre o app de prod.
//   2. `GmsBarcodeScanningDelegateActivity android:screenOrientation="PORTRAIT"` aparece no aviso
//      de restrição de orientação. O dosiq NÃO tem leitor de código de barras: essa Activity vem de
//      `play-services-code-scanner` + `mlkit:barcode-scanning`, dependências exclusivas do
//      dev-launcher (expo-dev-launcher/android/build.gradle:111-112) usadas pelo QR do dev menu.
//   3. peso morto: o dev-launcher arrasta Compose, Koin, Apollo, okhttp, gson, commons-io.
//   4. superfície: o manifest de produção declara o scheme `exp+dosiq-app`.
//
// COMO: `expoAutolinking.exclude` é propriedade pública da extensão do settings plugin
// (ExpoAutolinkingSettingsExtension.kt:51) e vira `--exclude` no comando de autolinking
// (AutolinkigCommandBuilder.kt:65). Escrevemos a linha ANTES do `useExpoModules()`, que é quem
// consome a propriedade. Medido: 27 módulos → 23, sem nenhum `expo-dev-*`.
//
// Excluir NÃO quebra a compilação: `MainActivity.kt`/`MainApplication.kt` gerados não referenciam
// DevLauncher (o dev-client se instala por autolinking, não por chamada no template).
//
// QUANDO: só quando `EAS_BUILD_PROFILE` está definido e é diferente de `development`. Isso cobre
// `production` (AAB da loja) e `preview` (APK de teste interno) — os dois builds que o
// `build-android.sh` produz exportando a env antes do prebuild (build-android.sh:91).
// `npx expo run:android` local NÃO define a env ⇒ o dev build fica intacto, com dev menu e tudo.
// A decisão de incluir `preview` é deliberada: sem ela o APK que o PO smoka não reproduz o binário
// que vai à loja, e nem F1 nem R8 são pegos por lint/teste/tsc — só por build real.
//
// REVERSÃO: tirar este plugin da lista em app.config.js. Nada aqui é destrutivo — o settings.gradle
// é regenerado a cada `expo prebuild --clean`.

const { withSettingsGradle, withAndroidManifest } = require('expo/config-plugins')

/** Módulos de dev que não têm razão de existir num binário de release. */
const DEV_MODULES = [
  'expo-dev-client',
  'expo-dev-launcher',
  'expo-dev-menu',
  'expo-dev-menu-interface',
]

/** Perfil de build que PODE conter o dev-client. Qualquer outro perfil declarado o perde. */
const DEV_PROFILE = 'development'

/**
 * Tira o `<data android:scheme="exp+<slug>"/>` do manifest de release.
 *
 * O scheme não vem do autolinking — vem do CONFIG PLUGIN do expo-dev-client
 * (expo-dev-client/plugin/build/getDefaultScheme.js), que é auto-aplicado por o pacote estar em
 * `dependencies`. Excluir o módulo do gradle portanto NÃO o remove: o binário de produção
 * continuaria anunciando um deep link de dev que nada mais atende.
 *
 * ⚠️ Cirúrgico de propósito: remove SÓ os `data` cujo scheme começa com `exp+`, e valida que o
 * scheme `dosiq` sobreviveu. Deep link é fluxo de autenticação (055/PO-3) — quebrá-lo aqui seria
 * trocar higiene de manifest por um bug de login.
 */
const withoutDevSchemeOnRelease = (config) =>
  withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0]
    const activity = app?.activity?.find(
      (a) => a.$?.['android:name'] === '.MainActivity'
    )

    // Falha ruidosa em vez de no-op silencioso: se o template do Expo renomear a Activity, o
    // scheme de dev voltaria ao manifest de produção sem que nada acusasse (Constituição §IX —
    // omissão não é neutra). O exclude do gradle continuaria valendo, mas quem lê o build
    // acreditaria que o manifest também foi limpo.
    if (!activity) {
      throw new Error(
        '[withoutDevClientOnRelease] `.MainActivity` não encontrada no AndroidManifest — o ' +
          'template do prebuild mudou. Revalidar o plugin: sem isto o scheme `exp+<slug>` de dev ' +
          'volta ao manifest de produção em silêncio.'
      )
    }

    if (!activity['intent-filter']) {
      return cfg
    }

    for (const filter of activity['intent-filter']) {
      if (!Array.isArray(filter.data)) continue

      const kept = filter.data.filter(
        (d) => !String(d.$?.['android:scheme'] ?? '').startsWith('exp+')
      )

      if (kept.length === filter.data.length) continue

      const stillHasAppScheme = kept.some((d) => d.$?.['android:scheme'] === 'dosiq')
      if (!stillHasAppScheme) {
        throw new Error(
          '[withoutDevClientOnRelease] remover o scheme de dev deixaria o intent-filter sem o ' +
            'scheme `dosiq` — abortando: isso quebraria o deep link de autenticação (055/PO-3).'
        )
      }

      filter.data = kept
    }

    return cfg
  })

const withoutDevClientOnRelease = (config) => {
  const profile = process.env.EAS_BUILD_PROFILE

  // Sem env = prebuild na mão (`expo run:android`, experimento local). Errar barato é melhor que
  // errar caro: mantém o dev-client, porque tirá-lo de um dev build tira o dev menu do PO.
  if (!profile || profile === DEV_PROFILE) {
    return config
  }

  return withSettingsGradle(withoutDevSchemeOnRelease(config), (cfg) => {
    const excludeLine = `expoAutolinking.exclude = [${DEV_MODULES.map((m) => `'${m}'`).join(', ')}]`

    // Idempotente: o prebuild pode rodar mais de uma vez sobre o mesmo arquivo.
    if (cfg.modResults.contents.includes('expoAutolinking.exclude')) {
      return cfg
    }

    // A propriedade precisa estar setada ANTES do useExpoModules() que a lê.
    if (!cfg.modResults.contents.includes('expoAutolinking.useExpoModules()')) {
      throw new Error(
        '[withoutDevClientOnRelease] `expoAutolinking.useExpoModules()` não encontrado no ' +
          'settings.gradle — o template do Expo mudou. Revalidar o plugin antes de buildar: sem ' +
          'esta âncora o exclude não é aplicado e o dev-client volta ao AAB em silêncio.'
      )
    }

    cfg.modResults.contents = cfg.modResults.contents.replace(
      'expoAutolinking.useExpoModules()',
      `// perfil de build: ${profile} — dev-client fora do binário (withoutDevClientOnRelease.js)\n${excludeLine}\nexpoAutolinking.useExpoModules()`
    )

    return cfg
  })
}

module.exports = withoutDevClientOnRelease
