// consentSchema.ts — Domínio do consentimento LGPD (spec 046, T003).
//
// Fonte canônica ÚNICA de: vocabulário da trilha, versão da política e a COPY do opt-in.
// Web, mobile e a política publicada citam daqui — duas redações divergentes do mesmo
// consentimento seriam, na prática, dois consentimentos diferentes (e o titular aceitou um só).

import { z } from 'zod'

/** Tipos de consentimento registrados. Espelha o CHECK de `consent_log.consent_type`. */
export const CONSENT_TYPES = ['health_data', 'terms_privacy'] as const

/**
 * Ações da trilha. Espelha o CHECK de `consent_log.action`.
 *
 * `granted`/`revoked` são atos do TITULAR — únicos alcançáveis pelas RPCs `consent_grant` /
 * `consent_revoke`. `notice_sent`/`pruned`/`account_deleted` são atos do CONTROLADOR: só
 * `service_role` ou função `SECURITY DEFINER` os escreve. O cliente não tem caminho até eles —
 * nem por parâmetro (as RPCs não recebem `action`).
 */
export const CONSENT_ACTIONS = [
  'granted',
  'revoked',
  'notice_sent',
  'pruned',
  'account_deleted',
] as const

/** Plataformas de origem do evento. Espelha o CHECK de `consent_log.platform`. */
export const CONSENT_PLATFORMS = ['web', 'mobile', 'server'] as const

export type ConsentType = (typeof CONSENT_TYPES)[number]
export type ConsentAction = (typeof CONSENT_ACTIONS)[number]
export type ConsentPlatform = (typeof CONSENT_PLATFORMS)[number]

/**
 * Versão vigente da política de privacidade.
 *
 * ⚠️ ESTE VALOR É CONTRATO — vive em TRÊS lugares que têm que bater exatamente:
 *   1. esta constante (@dosiq/core);
 *   2. a versão impressa em `apps/web/public/politica-de-privacidade.html`;
 *   3. a linha de `public.consent_policy` no Postgres — é ELA que os RPCs carimbam.
 * Divergiu, a trilha registra o aceite de uma versão que ninguém consegue exibir, e o
 * consentimento volta a ser inauditável — que é exatamente o que a spec 046 existe pra resolver.
 * Bump = T019b (sincroniza os três de uma vez).
 *
 * NOTA: o cliente NÃO envia esta versão ao gravar. Quem carimba é o servidor (senão o próprio
 * auditado escolheria a versão que diz ter aceitado). Ela serve para EXIBIR ("você aceitou a
 * versão X") e para detectar política nova.
 */
export const CURRENT_POLICY_VERSION = '0.3'

/**
 * COPY CANÔNICA do opt-in de dado de saúde (LGPD art. 11 — consentimento específico e destacado).
 *
 * "Destacado" é requisito legal, não estética: não pode estar embutido num aceite genérico de
 * termos. Daí `label` ser um checkbox próprio, separado do aceite de Termos/Política.
 * A política publicada cita `label` VERBATIM (T017) — se os textos divergirem, o titular
 * consentiu com uma redação e a política descreve outra.
 */
export const HEALTH_CONSENT_COPY = Object.freeze({
  title: 'Consentimento para dados de saúde',
  // Declaração de idade (16+) embutida na MESMA frase do opt-in (spec 046, item C das TAREFAS):
  // mesmo clique, mesmo evento `granted` no consent_log — a prova de diligência nasce
  // correlacionada ao ato que tratou o dado sensível, sem UI nova. A política cita este texto
  // VERBATIM (T017) — mudou aqui, muda no HTML.
  label:
    'Autorizo o dosiq a tratar meus dados de saúde (medicamentos, doses, adesão e biomarcadores) ' +
    'para me enviar lembretes, registrar meu histórico e calcular minha adesão ao tratamento, ' +
    'e declaro ter 16 anos ou mais.',
  helper:
    'Sem essa autorização o dosiq não consegue funcionar — é o dado de saúde que gera os ' +
    'lembretes e o histórico. Você pode retirar o consentimento a qualquer momento em ' +
    'Privacidade e dados.',
  revokeWarning:
    'Ao retirar o consentimento, o dosiq para de enviar lembretes e o app fica bloqueado. ' +
    'Você continua podendo exportar seus dados ou excluir sua conta. Se não voltar a consentir ' +
    'em 90 dias, sua conta e seus dados serão excluídos automaticamente.',
} as const)

/** Estado derivado do consentimento = último evento daquele tipo. */
export const CONSENT_STATUSES = ['granted', 'revoked', 'missing'] as const
export type ConsentStatus = (typeof CONSENT_STATUSES)[number]

/**
 * Evento como o TITULAR o enxerga.
 *
 * Não tem `subject_hash` nem `user_id` — e isso não é omissão de conveniência: o GRANT de coluna
 * (S4) não dá essas duas ao role `authenticated`. Selecioná-las de um client resulta em
 * *permission denied*. O schema reflete o que o banco de fato entrega.
 */
export const consentEventSchema = z.object({
  id: z.string().uuid(),
  consent_type: z.enum(CONSENT_TYPES),
  action: z.enum(CONSENT_ACTIONS),
  policy_version: z.string().nullable().optional(),
  platform: z.enum(CONSENT_PLATFORMS),
  created_at: z.string(),
})

export type ConsentEvent = z.infer<typeof consentEventSchema>

/** Estado corrente de um tipo de consentimento, derivado do último evento. */
export interface ConsentState {
  status: ConsentStatus
  /** Versão aceita no último `granted` (null se nunca consentiu). */
  policyVersion: string | null
  /** Data do último evento (ISO), null se não há evento. */
  updatedAt: string | null
  /** `true` quando consentiu, mas numa versão anterior à vigente (pede re-consentimento). */
  stale: boolean
}

/**
 * Deriva o estado a partir dos eventos de UM tipo de consentimento.
 * `events` pode vir em qualquer ordem — a função ordena por `created_at` desc.
 *
 * Lista vazia ⇒ `missing`. É o estado de toda conta anterior ao 046: não existe consentimento
 * retroativo (inventar um seria a fraude que a trilha existe para impedir).
 */
export function deriveConsentState(events: ConsentEvent[]): ConsentState {
  const list = Array.isArray(events) ? events : []
  if (list.length === 0) {
    return { status: 'missing', policyVersion: null, updatedAt: null, stale: false }
  }

  // `Date.parse` em vez de `new Date(...)` (R-020). Aqui não há o risco de meia-noite UTC que a
  // regra persegue — `created_at` é timestamptz ISO completo, com hora e offset, não 'YYYY-MM-DD'.
  const sorted = [...list].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  // Só granted/revoked definem o estado do titular. account_deleted/notice_sent/pruned são atos
  // do controlador e não dizem nada sobre a vontade dele.
  const last = sorted.find((e) => e.action === 'granted' || e.action === 'revoked')
  if (!last) {
    return { status: 'missing', policyVersion: null, updatedAt: null, stale: false }
  }

  const granted = last.action === 'granted'
  const policyVersion = last.policy_version ?? null

  return {
    status: granted ? 'granted' : 'revoked',
    policyVersion,
    updatedAt: last.created_at,
    stale: granted && policyVersion !== CURRENT_POLICY_VERSION,
  }
}

export default consentEventSchema
