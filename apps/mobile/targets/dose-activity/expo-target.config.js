/** @type {import('@bacons/apple-targets').Config} */
// 039/F3 — Widget Extension da Live Activity (ADR-075 emenda: @bacons/apple-targets).
// Gera o target de forma reproduzível no prebuild/EAS. Os .swift desta pasta entram NESTE target.
// Live Activity = widget no iOS. App Group compartilha o pedido de ação do App Intent com o app RN.
//
// ⚠️ Membership compartilhada: `DoseActivityAttributes.swift` PRECISA compilar TAMBÉM no target do
// APP (o bridge RN chama Activity.request com o MESMO tipo). É injetado no app por
// `withDoseActivityBridge.js` (copia attributes+bridge p/ ios/<app> e adiciona ao target do app).
module.exports = {
  type: 'widget',
  name: 'DoseActivity',
  deploymentTarget: '16.2',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.coelhotv.dosiq'],
  },
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AppIntents'],
}
