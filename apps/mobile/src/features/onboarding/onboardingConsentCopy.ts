// onboardingConsentCopy.ts — textos do fim do onboarding (spec 096 B3, DESIGN_DECISOES §4 "Mobile —
// onboarding (A)"). VERBATIM do contrato de design; só o mobile tem onboarding, por isso não vive no core.

export const ONBOARDING_CONSENT_COPY = Object.freeze({
  title: 'Salvar o tratamento',
  body: 'Está tudo pronto. Para guardar e lembrar, o dosiq precisa desta autorização.',
  cta: 'Salvar e começar',
  later: 'Agora não',
  errorNoHealth: 'Marque esta autorização para salvar. Sem ela, nada é guardado.',
  emptyTitle: 'Antes de entrar no app',
  emptyBody:
    'Para lembrar e registrar as doses, o dosiq precisa desta autorização. Dá para cadastrar os remédios depois, pelas abas.',
  emptyCta: 'Entrar no app',
  grantError: 'Não foi possível registrar a autorização agora. Confira a conexão e tente de novo.',
  transferNotSaved:
    'A autorização opcional não foi registrada agora. Dá para ligar depois em Perfil › Privacidade e dados.',
})

export const ONBOARDING_REFUSE_COPY = Object.freeze({
  title: 'Sem esta autorização, nada é salvo',
  body:
    'O dosiq funciona a partir de dados de saúde (remédios, doses, etc). Sem essa autorização, o que foi configurado até agora é perdido.',
  back: 'Voltar e autorizar',
  discard: 'Descartar e sair da conta',
  delete: 'Excluir a conta',
  note: 'Ao entrar de novo, o cadastro recomeça do início. Contas sem autorização por 30 dias entram na fila de exclusão.',
})

/** Welcome · item "Seguro e Privado" (texto substituído, sem bloco novo). */
export const WELCOME_PRIVACY_COPY =
  'Nada é guardado antes de você autorizar o uso dos dados de saúde no fim do cadastro.'
