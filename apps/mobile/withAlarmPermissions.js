// withAlarmPermissions.js — config plugin (Spec 001 / Alarme Nativo Persistente)
//
// Duas coisas, ambas necessárias p/ o alarme full-screen na lock screen:
//
// 1. Permissões no AndroidManifest (helper oficial withPermissions — adiciona no
//    nível certo, idempotente; NÃO editar o manifest na mão, corrompe XML AP-206):
//      - SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM → setExactAndAllowWhileIdle (Doze)
//      - USE_FULL_SCREEN_INTENT → notificação full-screen na lock screen
//      - POST_NOTIFICATIONS → Android 13+
//
// 2. Atributos na MainActivity: `showWhenLocked` + `turnScreenOn`. SEM eles o
//    full-screen intent é postado mas NÃO acorda a tela nem aparece sobre o
//    keyguard (visto no smoke: console dispara, tela não liga). Requisito do
//    Notifee p/ full-screen.
//
// RE-001: app.config.js é o formato canônico; registrado em `plugins`.

const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins')

function withFullScreenActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults)
    activity.$['android:showWhenLocked'] = 'true'
    activity.$['android:turnScreenOn'] = 'true'
    return cfg
  })
}

module.exports = function withAlarmPermissions(config) {
  let cfg = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.USE_FULL_SCREEN_INTENT',
    'android.permission.POST_NOTIFICATIONS',
    // DND bypass do canal só vale com acesso à política de Não Perturbe.
    'android.permission.ACCESS_NOTIFICATION_POLICY',
  ])
  cfg = withFullScreenActivity(cfg)
  return cfg
}
