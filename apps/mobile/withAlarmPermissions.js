// withAlarmPermissions.js — config plugin (Spec 001 / Alarme Nativo Persistente)
//
// Injeta no AndroidManifest as permissões que o Notifee precisa p/ o alarme
// persistente em tela cheia que fura Doze/DND:
//   - SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM → AlarmManager.setExactAndAllowWhileIdle
//   - USE_FULL_SCREEN_INTENT → notificação full-screen na lock screen
//   - POST_NOTIFICATIONS → Android 13+ (runtime, mas declarada no manifest)
//
// RE-001: app.config.js é o formato canônico; este plugin é registrado em `plugins`.
// expo-notifications continua coexistindo (push remoto) — este plugin é aditivo.

const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins')

const ALARM_PERMISSIONS = [
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.POST_NOTIFICATIONS',
]

module.exports = function withAlarmPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults
    manifest['uses-permission'] = manifest['uses-permission'] || []

    for (const name of ALARM_PERMISSIONS) {
      const already = manifest['uses-permission'].some(
        (p) => p?.$?.['android:name'] === name
      )
      if (!already) {
        manifest['uses-permission'].push({ $: { 'android:name': name } })
      }
    }
    return cfg
  })
}

// Mantém a referência usada acima (evita tree-shake do import em alguns linters).
void AndroidConfig
