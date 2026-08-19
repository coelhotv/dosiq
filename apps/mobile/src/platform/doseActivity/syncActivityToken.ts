// syncActivityToken.ts — sincroniza o token push per-Activity da Live Activity em
// `dose_instances.la_push_token`, para o backend empurrar update/end com o app fechado (spec 041).
//
// Extraído do DoseLiveActivityBridge no 067 C.1 (FR-041): a regra de quando ESCREVER a coluna
// virou lógica com failure modes próprios (reposição de token morto, falha de rede no meio) e
// precisa de teste direto — dentro do componente ela só era alcançável montando a árvore inteira.

import { createCriticalAuditService } from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import { getActivityPushToken } from './liveActivityService'

// Auditoria (042 Slice B): token_captured emitido no foreground (online) — NUNCA grava o token no
// detail (SEC-3), só marca que a captura ocorreu. Fail-open: emit nunca lança.
const tokenAudit = createCriticalAuditService({
  client: supabase as any,
  getUserId: async () => {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  },
})

// Dedupe da SINCRONIZAÇÃO do token (067 C.1 / FR-041 — antes governava só o `token_captured`):
// syncActivityToken roda a cada foreground/derive e quase sempre re-lê o MESMO token. Sem o dedupe
// no UPDATE: (a) o trail enche de token_captured idênticos (rajada observada: 4× em 40s) e, pior,
// (b) a coluna é reescrita, REPONDO o token morto que o servidor acabou de limpar
// (dispatchLiveActivityLifecycle:82) — ping-pong medido em prod: 81 push_failed numa única
// ocorrência, com `la_push_token` ainda não-nulo no fim (as retentativas só pararam quando a janela
// de 24h da varredura expirou).
//
// In-memory (sem storage/bloat); no restart re-sincroniza no máx 1×/dose/sessão — o que é correto,
// porque um processo novo não sabe o que o anterior escreveu. Cap com evicção FIFO (Map preserva
// ordem de inserção) — evita crescimento sem limite em sessões longas (review #700/#701).
// Chave = instanceId (escopo por dose; o app é single-user por sessão).
const LAST_TOKEN_CAP = 200
const lastSyncedToken = new Map<string, string>()

/** Este token JÁ foi sincronizado com sucesso p/ esta instância? @private */
function isTokenAlreadySynced(instanceId: string, token: string): boolean {
  return lastSyncedToken.get(instanceId) === token
}

/** Registra o token sincronizado, com cap FIFO. Chamar só APÓS a escrita confirmar. @private */
function markTokenSynced(instanceId: string, token: string): void {
  lastSyncedToken.set(instanceId, token)
  while (lastSyncedToken.size > LAST_TOKEN_CAP) {
    lastSyncedToken.delete(lastSyncedToken.keys().next().value as string) // entrada mais antiga
  }
}

/**
 * Solta o dedupe da instância: encerrada a LA local, uma Activity NOVA da mesma dose deve poder
 * sincronizar mesmo que o SO reemita um token igual (a FR-041 barra REPOSIÇÃO, não recriação).
 */
export function forgetSyncedToken(instanceId: string): void {
  if (!instanceId) return
  lastSyncedToken.delete(instanceId)
}

/**
 * Sincroniza o token per-Activity da instância. Best-effort: nunca lança, nunca derruba o derive.
 *
 * O token é emitido de forma ASSÍNCRONA pelo iOS após `Activity.request` — logo após o start quase
 * sempre ainda está vazio. Retry curto com backoff linear aguarda a emissão; se falhar, o próximo
 * derive (foreground/intervalo) tenta de novo.
 */
export async function syncActivityToken(instanceId: string, { attempts = 5 } = {}): Promise<void> {
  if (!instanceId) return
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const token = await getActivityPushToken(instanceId)
      if (token) {
        // FR-041: token idêntico ao último sincronizado não reescreve nada. Token DIFERENTE
        // (nova Activity / rotação do iOS) escreve normalmente.
        if (isTokenAlreadySynced(instanceId, token)) return

        const { error } = await supabase.from('dose_instances').update({ la_push_token: token }).eq('id', instanceId)
        // Só marca DEPOIS de a escrita confirmar: marcar antes transformaria uma falha de rede em
        // token permanentemente ausente no servidor (a próxima sync veria "já sincronizado" e não
        // tentaria de novo) — a LA pararia de receber push, em silêncio.
        if (error) return

        markTokenSynced(instanceId, token)
        // Marca a captura SEM gravar o valor do token (SEC-3).
        await tokenAudit.emit({
          doseInstanceId: instanceId,
          event: 'token_captured',
          platform: 'ios',
          actor: 'system',
        })
        return
      }
    } catch {
      // best-effort
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)))
  }
}
