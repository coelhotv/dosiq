// loadFailure.ts — decide QUAL erro o usuário vê quando o fetch falha e o fallback de cache
// também falha (AP-314).
//
// O padrão dos hooks offline-first do mobile é: tenta rede → falhou, tenta cache → cache velho
// ou ausente → mostra erro. O bug é que o erro exibido era SEMPRE o do fallback ("Cache
// expirado"), e o erro ORIGINAL (o motivo real da rede ter falhado) era descartado.
//
// Isso tornou um `42703` — coluna dropada, app legado, quebra permanente — indistinguível de
// "você está offline há mais de um dia". No outage de 2026-07-22 o usuário via "Cache expirado
// (> 24h)" com wifi funcionando, e o diagnóstico custou horas.
//
// A discriminação é simples e confiável: erro que veio do PostgREST carrega `code` (SQLSTATE ou
// código PGRST*). Erro de rede/timeout não carrega. Se há `code`, o servidor RESPONDEU e o
// problema não é conectividade — esse erro tem de aparecer, porque nenhuma ação do usuário
// (esperar, trocar de rede, reabrir) vai resolvê-lo.

/** Erro em formato PostgREST/supabase-js. */
interface CodedError {
  code?: unknown
  message?: unknown
}

/**
 * `true` se o erro veio do servidor (PostgREST respondeu), não da rede.
 *
 * Erros com `code` são respostas do banco: `42703` (coluna inexistente), `42501` (grant),
 * `23514` (CHECK), `PGRST200` (FK do embed)... Todos indicam contrato quebrado entre o cliente
 * e o schema — nunca conectividade.
 */
export function isServerError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as CodedError).code
  return typeof code === 'string' && code.length > 0
}

/**
 * Mensagem a exibir quando o fetch falhou E o fallback de cache também falhou.
 *
 * Erro de servidor tem precedência sobre o erro do cache: "Cache expirado" descreve o sintoma,
 * o `code` descreve a causa. Sem isso, uma quebra de schema em produção se disfarça de app
 * offline e ninguém investiga (AP-314).
 *
 * @param originalErr - o erro que derrubou o fetch online
 * @param fallbackErr - o erro que derrubou o fallback de cache
 * @param defaultMessage - texto quando nenhum dos dois tem mensagem utilizável
 */
export function describeLoadFailure(
  originalErr: unknown,
  fallbackErr: unknown,
  defaultMessage = 'Erro ao carregar dados.',
): string {
  if (isServerError(originalErr)) {
    const { code, message } = originalErr as CodedError
    const detail = typeof message === 'string' && message.length > 0 ? message : defaultMessage
    // O código vai VISÍVEL de propósito: é o que o usuário consegue reportar e o que torna o
    // diagnóstico imediato para quem recebe o print.
    return `Erro no servidor (${String(code)}): ${detail}`
  }

  const fallbackMessage = (fallbackErr as CodedError | undefined)?.message
  if (typeof fallbackMessage === 'string' && fallbackMessage.length > 0) return fallbackMessage

  const originalMessage = (originalErr as CodedError | undefined)?.message
  if (typeof originalMessage === 'string' && originalMessage.length > 0) return originalMessage

  return defaultMessage
}
