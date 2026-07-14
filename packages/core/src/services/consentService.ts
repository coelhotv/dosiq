// consentService.ts — Leitura e escrita da trilha de consentimento (spec 046, T004).
//
// ═══════════════════════════════════════════════════════════════════════════════
// DUAS COISAS QUE PARECEM DETALHE E NÃO SÃO
// ─────────────────────────────────────────────────────────────────────────────
// 1. `grant`/`revoke` são WRAPPERS DE RPC — nunca `.insert()`. O role `authenticated` não tem
//    INSERT em `consent_log` (e nem deve): uma trilha em que o auditado escreve é forjável, e
//    prova forjável não é prova. Se algum dia um `.from('consent_log').insert(...)` aparecer
//    neste arquivo, ele vai falhar com *permission denied* — e isso é o desenho funcionando.
//
// 2. `getStatus` NÃO FILTRA POR `user_id`. Parece bug; é consequência do GRANT de coluna (S4):
//    `authenticated` só enxerga (id, consent_type, action, policy_version, platform, created_at).
//    O Postgres exige privilégio de SELECT também nas colunas usadas no WHERE — um
//    `.eq('user_id', uid)` daria *permission denied*. Quem escopa a leitura ao dono é a RLS
//    (`user_id = auth.uid()`), no servidor. Não "conserte" isso adicionando o filtro.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import {
  CURRENT_POLICY_VERSION,
  deriveConsentState,
  type ConsentEvent,
  type ConsentPlatform,
  type ConsentState,
  type ConsentType,
} from '../schemas/consentSchema'

/** Colunas que o titular pode ler. Espelha o GRANT de coluna — não ampliar sem migração. */
const CONSENT_COLUMNS = 'id, consent_type, action, policy_version, platform, created_at'

/** Formato da intenção de consentimento carregada no `user_metadata` durante o signup. */
export interface ConsentIntent {
  health_consent?: boolean | null
  policy_version?: string | null
}

export interface ConsentService {
  /** Registra o consentimento do titular. Idempotente (anti-flood no servidor). */
  grant(consentType: ConsentType, platform: ConsentPlatform): Promise<{ ok: boolean; error?: string }>
  /** Revoga o consentimento do titular. */
  revoke(consentType: ConsentType, platform: ConsentPlatform): Promise<{ ok: boolean; error?: string }>
  /** Estado corrente de um tipo de consentimento (derivado do último evento). */
  getStatus(consentType: ConsentType): Promise<ConsentState>
  /** Materializa, uma única vez, a intenção capturada no signup. Idempotente. */
  materializeSignupIntent(
    intent: ConsentIntent | null | undefined,
    platform: ConsentPlatform,
  ): Promise<{ materialized: boolean }>
}

interface CreateConsentServiceDeps {
  client: SupabaseClient<Database>
}

export function createConsentService({ client }: CreateConsentServiceDeps): ConsentService {
  if (!client) throw new Error('createConsentService: client é obrigatório')

  async function callRpc(
    fn: 'consent_grant' | 'consent_revoke',
    consentType: ConsentType,
    platform: ConsentPlatform,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      // AP-216: destructuring defensivo — um mock (ou um client mal configurado) pode devolver
      // undefined, e `const { error } = undefined` estoura antes de qualquer checagem de erro.
      const res = await client.rpc(fn, {
        p_consent_type: consentType,
        p_platform: platform,
      })
      const error = res?.error
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  async function getStatus(consentType: ConsentType): Promise<ConsentState> {
    try {
      // Sem `.eq('user_id', ...)` — de propósito. Ver cabeçalho (2).
      const res = await client
        .from('consent_log')
        .select(CONSENT_COLUMNS)
        .eq('consent_type', consentType)
        .order('created_at', { ascending: false })
        .limit(20)

      const error = res?.error
      const data = res?.data
      if (error || !data) {
        // Falha de leitura NÃO é "nunca consentiu". Devolver `missing` aqui faria o guard do
        // Slice B bloquear um usuário que consentiu, só porque a rede piscou. `revoked` seria
        // pior ainda. Propagamos o desconhecimento como `missing` SEM `stale`, e o chamador
        // (guard) trata rede como estado indeterminado — nunca como decisão do titular.
        return { status: 'missing', policyVersion: null, updatedAt: null, stale: false }
      }

      return deriveConsentState(data as unknown as ConsentEvent[])
    } catch {
      return { status: 'missing', policyVersion: null, updatedAt: null, stale: false }
    }
  }

  return {
    grant: (consentType, platform) => callRpc('consent_grant', consentType, platform),
    revoke: (consentType, platform) => callRpc('consent_revoke', consentType, platform),
    getStatus,

    /**
     * O signup marca a intenção em `user_metadata` porque, com confirmação de e-mail ligada, não
     * existe sessão no momento do cadastro — e sem sessão o RPC DEFINER não tem `auth.uid()`.
     *
     * ⚠️ `user_metadata` é CLIENT-WRITABLE (`auth.updateUser`): é CARONA da intenção, jamais
     * prova. Por isso a materialização não "confia" no metadata para gravar o evento — ela chama
     * `consent_grant`, e é o SERVIDOR que deriva o titular, a versão e o hash. Se alguém forjar
     * `health_consent: true` no metadata, o pior que consegue é gravar um consentimento
     * legítimo... para si mesmo. Que é o que aconteceria de qualquer forma clicando no checkbox.
     *
     * Idempotente por duas camadas: só grava se o estado ainda é `missing`, e o servidor tem o
     * anti-flood. Rodar isso a cada bootstrap é seguro.
     */
    async materializeSignupIntent(intent, platform) {
      if (!intent || intent.health_consent !== true) return { materialized: false }

      const current = await getStatus('health_data')
      // Já existe ato do titular (granted OU revoked) — a intenção do signup é história velha.
      // Materializar sobre um `revoked` RESSUSCITARIA um consentimento que o titular retirou.
      if (current.status !== 'missing') return { materialized: false }

      const res = await callRpc('consent_grant', 'health_data', platform)
      return { materialized: res.ok }
    },
  }
}

export { CURRENT_POLICY_VERSION }
export default createConsentService
