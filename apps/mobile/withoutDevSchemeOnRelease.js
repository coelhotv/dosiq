// withoutDevSchemeOnRelease.js — tira o deep link de desenvolvimento do manifest de release.
//
// CONTEXTO — este arquivo é METADE de um fix; a outra metade vive no package.json.
//
// O `expo-dev-client` ia parar no binário Android de produção (no iOS ele se declara `debugOnly`
// e some sozinho; no Android o campo não existe). Isso rendeu dois avisos do Play Console sobre o
// AAB da v0.30.0 e arrastava ML Kit, Compose, Koin e Apollo como peso morto. Ver AP-324.
//
// A exclusão dos MÓDULOS mora em `package.json` → `expo.autolinking.android.exclude`, e NÃO aqui.
// Motivo (medido em 2026-07-30): a propriedade `expoAutolinking.exclude` do settings.gradle **não
// funciona** — o plugin gradle do Expo achata a lista com `joinToString(" ")` e a entrega como UM
// argumento (`AutolinkigCommandBuilder.kt:44-46`), enquanto a flag do CLI é variádica
// (`--exclude <exclude...>`). O autolinking recebe o nome literal
// "expo-dev-client expo-dev-launcher expo-dev-menu expo-dev-menu-interface", que não casa com
// módulo nenhum, e exclui zero. Bug upstream; o caminho do package.json é lido direto pelo CLI e
// não passa por esse builder.
//
// ⚠️ Lição que custou um APK: o CLI aceita `--exclude a --exclude b` e o gradle passa
// `--exclude "a b"`. Validar o mecanismo pelo CLI e presumir equivalência é como o fix passou por
// todos os gates e só caiu na inspeção do artefato (R-308).
//
// O QUE SOBROU AQUI: o scheme `exp+<slug>`, que não vem do autolinking e por isso sobrevive à
// exclusão dos módulos — ele é injetado pelo CONFIG PLUGIN do dev-client
// (expo-dev-client/plugin/build/getDefaultScheme.js), que roda por o pacote estar em
// `dependencies`. Sem isto, o binário de produção continuaria anunciando um deep link de
// desenvolvimento que nada mais atende.
//
// REVERSÃO: tirar da lista em app.config.js. O manifest é regenerado a cada `expo prebuild`.

const { withAndroidManifest } = require('expo/config-plugins')

/** Perfil de build que PODE manter o scheme de dev. Qualquer outro perfil declarado o perde. */
const DEV_PROFILE = 'development'

/**
 * ⚠️ Cirúrgico de propósito: remove SÓ os `data` cujo scheme começa com `exp+`, e aborta se o
 * scheme `dosiq` não sobreviver. Deep link é o fluxo de autenticação (055/PO-3) — quebrá-lo aqui
 * seria trocar higiene de manifest por um bug de login.
 */
const withoutDevSchemeOnRelease = (config) => {
  const profile = process.env.EAS_BUILD_PROFILE

  // Sem env = prebuild na mão (`expo run:android`, experimento local). Errar barato é melhor que
  // errar caro.
  if (!profile || profile === DEV_PROFILE) {
    return config
  }

  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0]
    const activity = app?.activity?.find((a) => a.$?.['android:name'] === '.MainActivity')

    // Falha ruidosa em vez de no-op silencioso: se o template do Expo renomear a Activity, o
    // scheme de dev voltaria ao manifest de produção sem que nada acusasse (Constituição §IX —
    // omissão não é neutra).
    if (!activity) {
      throw new Error(
        '[withoutDevSchemeOnRelease] `.MainActivity` não encontrada no AndroidManifest — o ' +
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
          '[withoutDevSchemeOnRelease] remover o scheme de dev deixaria o intent-filter sem o ' +
            'scheme `dosiq` — abortando: isso quebraria o deep link de autenticação (055/PO-3).'
        )
      }

      filter.data = kept
    }

    return cfg
  })
}

module.exports = withoutDevSchemeOnRelease
