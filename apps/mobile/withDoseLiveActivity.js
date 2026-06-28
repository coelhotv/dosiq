// withDoseLiveActivity.js — config plugin (Spec 039 / Dose State Machine · F0 spike iOS)
//
// ESCOPO SPIKE (PO-0.1): só o que é automatizável via config plugin —
//   1. NSSupportsLiveActivities = true no Info.plist do app (habilita ActivityKit).
//   2. NSSupportsLiveActivitiesFrequentUpdates = false (server-free: sem push de update;
//      o timer é vivo via Text(timerInterval:), conta sozinho — ADR-075 / spec §1).
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
    cfg.modResults.NSSupportsLiveActivitiesFrequentUpdates = false
    return cfg
  })
}
