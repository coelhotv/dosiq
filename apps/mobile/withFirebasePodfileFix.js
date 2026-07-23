// withFirebasePodfileFix.js — config plugin (SDK 54 bump, spec 055 PR 1.1)
//
// `use_frameworks! :static` (app.config.js, expo-build-properties.ios.useFrameworks) faz o
// @react-native-firebase/app expor headers Obj-C (RCTConvert+FIRApp.h, RNFBAppModule.h etc.) que
// dão `#import <React/RCTConvert.h>` — um include NÃO modular dentro de um módulo de framework.
// Sob RN 0.79 isso era warning; sob RN 0.81 (SDK 54) o clang trata como ERRO
// (-Werror,-Wnon-modular-include-in-framework-module), quebrando `xcodebuild`. Não é regressão do
// bump em si — é um warning pré-existente que o toolchain novo aperta pra erro.
//
// Fix padrão da comunidade RN+Firebase+static-frameworks: relaxar a flag SÓ nos Pods via
// post_install (não afeta o app target, não muda comportamento em runtime — é permissão de
// compilação, mesma usada pelo próprio CocoaPods internamente para casos assim).
// `ios/` é efêmero (prebuild regenera) → precisa entrar via plugin, não editando o Podfile à mão.

const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

const POST_INSTALL_BLOCK = `
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
`

module.exports = function withFirebasePodfileFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile')
      let contents = fs.readFileSync(podfilePath, 'utf-8')

      if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
        const marker = /(:ccache_enabled => ccache_enabled\?\(podfile_properties\),?\s*\)\s*\n)/
        if (!marker.test(contents)) {
          throw new Error(
            'withFirebasePodfileFix: react_native_post_install(...) não encontrado no Podfile gerado — ajustar o marcador do plugin.'
          )
        }
        contents = contents.replace(marker, `$1${POST_INSTALL_BLOCK}`)
        fs.writeFileSync(podfilePath, contents)
      }

      return cfg
    },
  ])
}
