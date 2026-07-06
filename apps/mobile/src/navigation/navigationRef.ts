import { createNavigationContainerRef } from '@react-navigation/native'

// Ref de nível de módulo — permite importação externa para deeplink (R-164, N1.4)
// createNavigationContainerRef enfileira ações automaticamente se o navigator não estiver pronto
// TODO(040-strict): sem ParamList tipada — generic any evita "name/navigate" caindo em never
export const navigationRef = createNavigationContainerRef<any>()
