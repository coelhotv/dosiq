// consentSchema.ts — Domínio do consentimento LGPD (spec 046, T003).
//
// Fonte canônica ÚNICA de: vocabulário da trilha, versão da política e a COPY do opt-in.
// Web, mobile e a política publicada citam daqui — duas redações divergentes do mesmo
// consentimento seriam, na prática, dois consentimentos diferentes (e o titular aceitou um só).

import { z } from 'zod'
import { compareSemver } from '../utils/semver'

/**
 * Tipos de consentimento registrados. Espelha o CHECK de `consent_log.consent_type` E a whitelist da
 * RPC `consent_write` (R-271 — os três mudam juntos; migração 20261021_096_consent_policy_v04).
 * `international_transfer` = caixa B (spec 096, art. 33 VIII): opcional, liga o modo completo no
 * servidor (ADR-112).
 */
export const CONSENT_TYPES = ['health_data', 'terms_privacy', 'international_transfer'] as const

/**
 * Ações da trilha. Espelha o CHECK de `consent_log.action`.
 *
 * `granted`/`revoked` são atos do TITULAR — únicos alcançáveis pelas RPCs `consent_grant` /
 * `consent_revoke`. `notice_sent`/`pruned`/`account_deleted`/`scheduled_deletion` são atos do CONTROLADOR: só
 * `service_role` ou função `SECURITY DEFINER` os escreve. O cliente não tem caminho até eles —
 * nem por parâmetro (as RPCs não recebem `action`).
 */
export const CONSENT_ACTIONS = [
  'granted',
  'revoked',
  'notice_sent',
  'pruned',
  'account_deleted',
  // 107: o controlador marcou a conta para exclusão (legado/onboarding). Nunca é `revoked` —
  // revogação é ato do titular, e quem nunca consentiu não revogou nada (INV-3).
  'scheduled_deletion',
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
export const CURRENT_POLICY_VERSION = '0.4'

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
  // Caixa A da v0.4 (spec 096, DESIGN_DECISOES §3) — 18+ (ECA Digital) na MESMA frase do opt-in:
  // mesmo clique, mesmo evento `granted`. A política v0.4 §5 cita este texto VERBATIM — mudou aqui,
  // muda lá (teste de igualdade em consentSchema.test.ts).
  label:
    'Autorizo o uso dos meus dados de saúde para lembretes, histórico, adesão e melhoria do app. ' +
    'Tenho 18 anos ou mais.',
  /** Folha "Detalhes ›" da caixa A (S6-A, DESIGN_DECISOES §4) — camada 2, a 1 toque (guarda 8). */
  detailsTitle: 'Dados de saúde',
  details:
    'A DOSIQ usa o que você cadastra (remédios, tratamentos, doses tomadas, estoque e medidas como ' +
    'peso, glicemia e pressão) para enviar os lembretes, guardar o histórico, calcular a adesão ao ' +
    'tratamento e melhorar o app. Os dados ficam guardados no Brasil. ' +
    'Sem esta autorização o app não funciona, porque é com esses dados que ele lembra e registra. ' +
    'Para retirar: Perfil › Privacidade e dados. Exportar ou excluir: a qualquer momento.',
  helper:
    'Sem essa autorização o dosiq não consegue funcionar — é o dado de saúde que gera os ' +
    'lembretes e o histórico. Você pode retirar o consentimento a qualquer momento em ' +
    'Privacidade e dados.',
  revokeWarning:
    'Ao retirar o consentimento, o dosiq para de enviar lembretes e o app fica bloqueado. ' +
    'Você continua podendo exportar seus dados ou excluir sua conta. Se não voltar a consentir ' +
    'em 90 dias, sua conta e seus dados serão excluídos automaticamente.',
} as const)

/**
 * COPY CANÔNICA da caixa B (spec 096 — envio para fora do Brasil, LGPD art. 33, VIII). Opcional:
 * nunca é condição de cadastro nem de uso (guarda 4). Ligar B em qualquer superfície mostra esta
 * frase + "Detalhes ›" (guarda 11). A política v0.4 §13 cita `label` VERBATIM.
 */
export const TRANSFER_CONSENT_COPY = Object.freeze({
  label:
    'Autorizo enviar meus dados de saúde para fora do Brasil (EUA) para notificações detalhadas, ' +
    'assistente IA e medições de uso. Opcional.',
  sheetTitle: 'Envio para fora do Brasil',
  withoutTitle: 'Sem a autorização',
  without:
    'O app funciona normalmente. Os alarmes do próprio celular continuam completos, porque não saem ' +
    'do aparelho. As notificações push chegam com texto genérico; assistente e medições ficam desligados.',
  contrastWith: '💊 Losartana 50 mg • 1 comprimido — 08:00',
  contrastWithout: '💊 Hora do seu remédio',
  table: [
    {
      use: 'Notificações detalhadas',
      data: 'remédio, concentração, dose e horário; avisos de estoque, receita e adesão',
      to: 'Expo, Apple, Google; Telegram, se vinculado',
    },
    { use: 'Assistente IA', data: 'a pergunta e um resumo dos tratamentos', to: 'Groq' },
    { use: 'Medições de uso', data: 'telas e ações, sem remédio, dose ou medida', to: 'PostHog' },
  ],
  howToChange: 'Para mudar depois: Perfil › Privacidade e dados.',
} as const)

/**
 * Reconsentimento da v0.4 (S5, web e mobile — DESIGN_DECISOES §4; DQ-5 título A). Bloqueante (DQ-1):
 * sem "Agora não"; a recusa é "Não concordo" → tela de revogação existente.
 */
export const REGULARIZATION_V04_COPY = Object.freeze({
  title: 'O dosiq agora é uma empresa',
  body:
    'A DOSIQ DIGITAL HEALTH WEB DESIGN LTDA passou a ser a responsável pelos dados. ' +
    'O que o app faz com eles não mudou.',
  changedLink: 'O que mudou ›',
  changed: [
    'Quem responde pelos dados: a DOSIQ DIGITAL HEALTH WEB DESIGN LTDA (CNPJ 68.335.606/0001-11).',
    'Duas autorizações separadas: uma para usar os dados de saúde, obrigatória; outra para enviá-los para fora do Brasil, opcional.',
    'Usos agora escritos: estoque e medição de uso do app já existiam e passaram a constar no texto.',
    'Idade mínima: 18 anos.',
    'O que não mudou: os dados que o app usa, onde ficam guardados (no Brasil) e o que ele faz com eles.',
  ],
  termsFooter: 'Ao confirmar, você aceita os Termos de Uso e a Política de Privacidade (v0.4).',
  confirm: 'Confirmar',
  decline: 'Não concordo',
  errorNoHealth: 'Marque a autorização de dados de saúde para confirmar.',
} as const)

/**
 * Chat sem B (S8b `E-ChatSemB`, web e mobile — DESIGN_DECISOES §4). O assistente abre este aviso em vez
 * do chat e NUNCA chama a API. "Ver a autorização" leva à autorização completa da caixa B (guarda 11),
 * nunca a um botão "ativar assistente".
 */
export const CHAT_WITHOUT_TRANSFER_COPY = Object.freeze({
  title: 'O assistente está desligado',
  body:
    'As perguntas e um resumo dos tratamentos vão para um serviço nos EUA. Para usar o assistente, é ' +
    'preciso a autorização de processamento fora do Brasil, que também liga os lembretes detalhados e as ' +
    'medições de uso.',
  enable: 'Ver a autorização',
  close: 'Fechar',
} as const)

// ─── Spec 107 — fila de exclusão com aprovação manual ─────────────────────────────────────

/** Motivo da linha na fila. Espelha o CHECK de `prune_queue.reason`. */
export const PRUNE_REASONS = ['revoked_90d', 'legacy_no_consent', 'onboarding_no_consent', 'unconfirmed_signup'] as const
/** Decisão da linha. Espelha o CHECK de `prune_queue.decision`. */
export const PRUNE_DECISIONS = ['pending', 'approved', 'deferred', 'void'] as const

export type PruneReason = (typeof PRUNE_REASONS)[number]
export type PruneDecision = (typeof PRUNE_DECISIONS)[number]

/** Linha da `public.prune_queue` como o servidor a lê (service role). */
export const pruneQueueRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  reason: z.enum(PRUNE_REASONS),
  scheduled_at: z.string(),
  eligible_at: z.string(),
  decision: z.enum(PRUNE_DECISIONS),
  decided_at: z.string().nullable().optional(),
  decided_by: z.string().uuid().nullable().optional(),
  note: z.string().nullable().optional(),
  reevaluate_at: z.string().nullable().optional(),
  executed_at: z.string().nullable().optional(),
  void_reason: z.string().nullable().optional(),
  created_at: z.string(),
})
export type PruneQueueRow = z.infer<typeof pruneQueueRowSchema>

/** Placeholder ÚNICO aceito no texto da trava (S-5). */
export const CONSENT_COPY_DATE_PLACEHOLDER = '{data}'

/**
 * Texto da trava de quem nunca consentiu (FR-010, editável no admin). Texto PURO: o app e a web
 * o renderizam como nó de texto, e ainda assim nada que pareça marcação entra — o admin é uma
 * conta, e conta pode ser comprometida. Espelha o CHECK `consent_copy_body_chk` (20–600 chars,
 * `{data}` exatamente 1×) e acrescenta o que o CHECK não vê: outros placeholders e `<`/`>`.
 */
export const consentCopyBodySchema = z
  .string()
  .trim()
  .min(20, 'Texto curto demais (mínimo 20 caracteres)')
  .max(600, 'Texto longo demais (máximo 600 caracteres)')
  .refine((s) => !/[<>]/.test(s), 'Texto não pode conter < ou >')
  .refine((s) => s.split(CONSENT_COPY_DATE_PLACEHOLDER).length === 2, 'O texto precisa ter {data} exatamente uma vez')
  .refine(
    (s) => !/\{[^}]*\}/.test(s.split(CONSENT_COPY_DATE_PLACEHOLDER).join('')),
    'Só o marcador {data} é permitido',
  )

/**
 * Fallback embarcado (OQ-2). Usado quando o servidor não responde ou devolve texto inválido —
 * o aviso legal NUNCA some por causa de rede ou de edição ruim.
 */
export const NEVER_CONSENTED_DEADLINE_COPY = Object.freeze({
  title: 'Precisamos da sua autorização',
  body:
    'Para guardar e organizar suas informações, o dosiq precisa que você autorize o uso desses ' +
    'dados. Sem essa autorização, sua conta e tudo o que está nela serão excluídos em {data}.',
  deleteNow: 'Prefiro excluir minha conta agora',
} as const)

/** Troca `{data}` pela data já formatada. Texto inválido ⇒ fallback embarcado. */
export function renderDeadlineCopy(body: string | null | undefined, formattedDate: string): string {
  const parsed = consentCopyBodySchema.safeParse(body ?? '')
  const source = parsed.success === false ? NEVER_CONSENTED_DEADLINE_COPY.body : parsed.data
  return source.replace(CONSENT_COPY_DATE_PLACEHOLDER, formattedDate)
}

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
  /**
   * Ordem de inserção (T013e). Opcional DE PROPÓSITO: `authenticated` não tem GRANT de coluna
   * sobre `seq` — é um contador global e diria ao titular quantos eventos de consentimento
   * existem no sistema inteiro. Quem lê com `service_role` (o prune) recebe; o client não.
   */
  seq: z.number().nullable().optional(),
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
  //
  // T013e — o desempate não é preciosismo: dois eventos gravados na MESMA transação empatam em
  // `created_at` (`now()` é constante dentro dela), e um sort sem desempate deixa a eleição do
  // "último ato" ao critério do algoritmo. `seq` (ordem real de inserção) resolve quando vem;
  // sem ele, `id` garante ao menos ESTABILIDADE — a mesma entrada sempre produz a mesma saída.
  // Estabilidade basta aqui: quem decide exclusão de conta é o prune, que lê `seq` no servidor.
  const sorted = [...list].sort((a, b) => {
    const byTime = Date.parse(b.created_at) - Date.parse(a.created_at)
    if (byTime !== 0) return byTime
    const seqA = typeof a.seq === 'number' ? a.seq : null
    const seqB = typeof b.seq === 'number' ? b.seq : null
    if (seqA !== null && seqB !== null && seqA !== seqB) return seqB - seqA
    return b.id.localeCompare(a.id)
  })
  // Só granted/revoked definem o estado do titular. account_deleted/notice_sent/pruned são atos
  // do controlador e não dizem nada sobre a vontade dele.
  const last = sorted.find((e) => e.action === 'granted' || e.action === 'revoked')
  if (!last) {
    return { status: 'missing', policyVersion: null, updatedAt: null, stale: false }
  }

  const granted = last.action === 'granted'
  const policyVersion = last.policy_version ?? null
  const cmp = compareSemver(policyVersion, CURRENT_POLICY_VERSION)

  return {
    status: granted ? 'granted' : 'revoked',
    policyVersion,
    updatedAt: last.created_at,
    // Só versão aceita MENOR que a do app pede regularização. O servidor carimba a vigente: um app
    // com constante antiga recebe aceite mais novo e não pode tratá-lo como pendente (loop — 096).
    // Versão ilegível (null) cai no lado seguro: pede regularização, como sempre pediu.
    stale: granted && (cmp === null || cmp < 0),
  }
}

export default consentEventSchema
