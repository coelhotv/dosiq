// withNotificationIconDefaults.js — config plugin (Spec 062 F2, D-6)
//
// O push do servidor (expo-notifications/FCM) caía no ícone do launcher reduzido a máscara alpha,
// enquanto alarme/superfície mostravam a marca. Fonte ÚNICA: o mesmo drawable `ic_dosiq_mark` que
// withDoseActivityAndroidIcon.js escreve a cada prebuild, apontado pelos meta-data de ícone padrão do
// FCM e do expo-notifications, + a cor da marca mobile.
//
// 🔴 ORDEM IMPORTA — este plugin fica ANTES de 'expo-notifications' no array de `app.config.js`.
// O plugin do expo, sem `icon`/`color` nas props, REMOVE estes 4 meta-data
// (`setNotificationConfig`, ramos `else`). E os mods rodam em ordem INVERSA à de registro
// (`withMod`: a ação do último registrado roda primeiro e chama o anterior via `nextMod`). Listado
// depois do expo, este plugin escreveria e o expo apagaria em seguida. O teste
// `notificationIconColor.test.ts` trava a ordem; a prova final é o manifest do APK (PO-9, R-308).

const { withAndroidManifest, withAndroidColors, AndroidConfig } = require('@expo/config-plugins')

// Espelho de `colors.brand.primary` (apps/mobile/src/shared/styles/tokens.ts). O config plugin é CJS
// e não importa o TS dos tokens — a igualdade é travada por teste (PO-11), não por convenção.
const NOTIFICATION_ICON_COLOR = '#006A5E'
const COLOR_NAME = 'dosiq_notification_color'
const ICON_RESOURCE = '@drawable/ic_dosiq_mark'
const COLOR_RESOURCE = `@color/${COLOR_NAME}`

const META_DATA = [
  ['com.google.firebase.messaging.default_notification_icon', ICON_RESOURCE],
  ['expo.modules.notifications.default_notification_icon', ICON_RESOURCE],
  ['com.google.firebase.messaging.default_notification_color', COLOR_RESOURCE],
  ['expo.modules.notifications.default_notification_color', COLOR_RESOURCE],
]

function withNotificationIconDefaults(config) {
  config = withAndroidColors(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: COLOR_NAME,
      value: NOTIFICATION_ICON_COLOR,
    })
    return cfg
  })
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults)
    // Idempotente: addMetaDataItemToMainApplication substitui pelo `android:name`.
    for (const [name, value] of META_DATA) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, value, 'resource')
    }
    return cfg
  })
}

module.exports = withNotificationIconDefaults
module.exports.NOTIFICATION_ICON_COLOR = NOTIFICATION_ICON_COLOR
module.exports.META_DATA = META_DATA
