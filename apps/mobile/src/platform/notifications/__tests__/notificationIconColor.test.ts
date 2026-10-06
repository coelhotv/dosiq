// 062 F2 (PO-11 / D-6): a cor do ícone de notificação vem do token da marca mobile, e o plugin que
// escreve ícone/cor padrão roda DEPOIS do plugin do expo-notifications (que os apagaria).

import { colors } from '@shared/styles/tokens'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const iconDefaults = require('../../../../withNotificationIconDefaults')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appConfig = require('../../../../app.config')

const pluginName = (p) => (Array.isArray(p) ? p[0] : p)

describe('ícone de notificação — cor e ordem do plugin', () => {
  it('cor escrita pelo plugin === colors.brand.primary', () => {
    expect(iconDefaults.NOTIFICATION_ICON_COLOR).toBe(colors.brand.primary)
  })

  it('meta-data de ícone apontam para ic_dosiq_mark (fonte única com superfície/alarme)', () => {
    const icons = iconDefaults.META_DATA.filter(([name]) => name.endsWith('_icon')).map(([, v]) => v)
    expect(icons).toEqual(['@drawable/ic_dosiq_mark', '@drawable/ic_dosiq_mark'])
  })

  it('vem ANTES de expo-notifications no array (mods rodam em ordem inversa)', () => {
    const names = appConfig.expo.plugins.map(pluginName)
    const ours = names.indexOf('./withNotificationIconDefaults.js')
    const expo = names.indexOf('expo-notifications')
    expect(ours).toBeGreaterThanOrEqual(0)
    expect(expo).toBeGreaterThan(ours)
  })

  it('o drawable referenciado continua sendo escrito pelo prebuild', () => {
    expect(names()).toContain('./withDoseActivityAndroidIcon.js')
  })
})

function names() {
  return appConfig.expo.plugins.map(pluginName)
}
