// LayoutSection.tsx — Layout: telas isoladas para validar safe-area/edge-to-edge (spec 055).
// MedicineFormScreen no root stack (sem tab bar), modo create — valida FormActions sem depender
// de onboarding novo nem de conta em consent-locked.

import { useNavigation } from '@react-navigation/native'
import { ROUTES } from '@navigation/routes'
import { DevSection, DevButton } from '@features/_dev/components/DevSection'

export function LayoutSection() {
  const navigation = useNavigation()
  return (
    <DevSection title="Layout" note="Spec 055 · edge-to-edge (Android 16) e safe-area.">
      <DevButton
        label="📐 Formulário de medicamento SEM tab bar"
        // TODO(040-strict): navigate tipado exige o ParamList do root stack (nível B)
        onPress={() => (navigation.navigate as (route: string) => void)(ROUTES.DEV_FORM_NO_TABBAR)}
      />
    </DevSection>
  )
}
