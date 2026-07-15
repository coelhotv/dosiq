// ConsentPromptScreen.tsx — versão NAVEGÁVEL do ConsentPrompt (spec 046, T012).
//
// O ConsentPrompt "de verdade" aparece como trava do guard (overlay/navigator). Esta rota existe
// para o caminho OPT-IN VOLUNTÁRIO: quem deu "Agora não" no prompt dismissível e depois volta ao
// hub de privacidade querendo autorizar. O botão do card de consentimento navega para cá.
//
// Por que não conceder direto de um botão no card: consentimento tem que ser INFORMADO (art. 11) —
// o titular precisa VER e marcar a copy destacada que está aceitando. Um "aprovar" silencioso
// gravaria um consentimento que ele nunca leu. Então reusamos a tela completa, com o checkbox.

import { useNavigation } from '@react-navigation/native'
import { createConsentService } from '@dosiq/core'
import ConsentPrompt from '@features/consent/components/ConsentPrompt'
import { useConsentGate } from '@platform/consent/useConsentGate'
import { supabase } from '../../../platform/supabase/nativeSupabaseClient'

const consentService = createConsentService({ client: supabase as never })

export default function ConsentPromptScreen() {
  const navigation = useNavigation()
  const gate = useConsentGate()

  // Sempre não-bloqueante aqui: o titular chegou por vontade própria e pode desistir (voltar).
  // A cortesia/bloqueio do prompt automático é decisão do guard, não desta rota.
  return (
    <ConsentPrompt
      blocking={false}
      onGrant={() => consentService.grant('health_data', 'mobile')}
      onDismiss={() => navigation.goBack()}
      onGranted={async () => {
        // Reavalia o gate compartilhado (o card do hub e o guard passam a ver `granted`) e volta.
        await gate.refresh()
        navigation.goBack()
      }}
    />
  )
}
