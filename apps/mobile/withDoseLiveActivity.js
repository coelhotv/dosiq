// withDoseLiveActivity.js — config plugin (Spec 039 / Dose State Machine · F0 spike iOS)
//
// ESCOPO (PO-0.1 + Spec 041): o que é automatizável via config plugin —
//   1. NSSupportsLiveActivities = true no Info.plist do app (habilita ActivityKit).
//   2. NSSupportsLiveActivitiesFrequentUpdates = true (Spec 041: push-to-start via APNs exige
//      frequent-updates p/ o SO iniciar a LA com o app fechado — ADR-076. Antes era false na 039
//      server-free; o start por push é aditivo e não precisa aprovação especial da Apple).
//
// O QUE NÃO É AUTOMATIZADO AQUI (feito no Xcode após prebuild — ver SPIKE_iOS.md):
//   - Criar o Widget Extension target (manipular .pbxproj de target novo é frágil
//     p/ um spike descartável; com Mac+Xcode no loop, o wiring manual é mais seguro).
//   - Adicionar os .swift (DoseActivityAttributes/DoseLiveActivityWidget) ao target.
//   - App Group (só necessário no MVP p/ app↔widget escrever registro; spike é display-only).
//
// RE-001: app.config.js é canônico; registrar em `plugins` após './withAlarmPermissions.js'.

const { withInfoPlist } = require('@expo/config-plugins')

module.exports = function withDoseLiveActivity(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSSupportsLiveActivities = true
    cfg.modResults.NSSupportsLiveActivitiesFrequentUpdates = true
    return cfg
  })
}
