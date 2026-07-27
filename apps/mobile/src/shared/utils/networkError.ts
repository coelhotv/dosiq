// networkError.ts — reconhece falha de rede para trocar erro cru por texto em PT.
//
// Achado no smoke do 055 (PR 1.6): em modo avião o Perfil mostrava
// "Erro ao carregar dados: TypeError: Network request failed" — texto do runtime RN,
// em inglês, na cara do usuário.
//
// A W1.4 já havia corrigido isso em useStock/useTodayData/useTreatments, mas ancorando a
// mensagem no ponto onde cada hook tenta o cache. Telas sem cache (o Perfil) ficaram de fora.
// Este util separa a DETECÇÃO da estratégia de cache, para que qualquer `catch` possa
// distinguir "sem internet" de "quebrou de verdade" sem precisar ter cache.

// Fetch nativo do RN, Supabase e undici falham com mensagens diferentes para a mesma causa.
// Casar por substring é frágil por natureza — o critério aqui é ser CONSERVADOR: na dúvida,
// tratar como erro real. Classificar bug de código como "sem internet" esconderia o defeito
// do usuário e de nós; o inverso apenas mostra uma mensagem técnica a mais.
const NETWORK_ERROR_PATTERNS = [
  'network request failed', // React Native (fetch nativo)
  'failed to fetch',        // undici / web
  'network error',
  'econnrefused',
  'enotfound',
  'etimedout',
]

export function isNetworkError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (!message) return false
  const normalized = message.toLowerCase()
  return NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))
}

// Mensagem única para falha de rede em tela que NÃO depende de cache para renderizar:
// o conteúdo já está lá, só um pedaço não carregou. Deliberadamente diferente da mensagem
// de useStock/useTodayData ("nem dados salvos neste aparelho"), que é bloqueante — ali a
// tela não tem o que mostrar. Prometer a mesma coisa nos dois casos confundiria.
export const OFFLINE_PARTIAL_MESSAGE =
  'Não identificamos conexão com a Internet. Alguns dados podem estar desatualizados.'

/**
 * Converte um erro em texto exibível: mensagem em PT quando é falha de rede,
 * mensagem original caso contrário.
 */
export function describeError(err: unknown): string {
  if (isNetworkError(err)) return OFFLINE_PARTIAL_MESSAGE
  if (err instanceof Error) return err.message
  return typeof err === 'string' ? err : 'Erro inesperado.'
}
