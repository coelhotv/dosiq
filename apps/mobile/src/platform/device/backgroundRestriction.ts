// backgroundRestriction.ts — casca JS do módulo Expo local `modules/background-restriction`, Android-only (spec 082 D2 · smoke T101).
// Lê `ActivityManager.isBackgroundRestricted()`. Fora do Android, ou sem o módulo no binário
// (build anterior), devolve null: desconhecido nunca vira negativo.

import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

type NativeBackgroundRestriction = { isBackgroundRestricted(): boolean | null }

const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<NativeBackgroundRestriction>('BackgroundRestriction') : null

export function isBackgroundRestricted(): boolean | null {
  try {
    const value = native?.isBackgroundRestricted()
    return typeof value === 'boolean' ? value : null
  } catch {
    return null
  }
}
