// transferRedaction.ts — Modo "sem B" no servidor (spec 096 T052 · ADR-112 · PO-13).
//
// A caixa B (`international_transfer`, LGPD art. 33, VIII) autoriza que conteúdo ligado à saúde saia
// do país pelos operadores de entrega (Expo/Apple/Google, Telegram). Sem ela, o servidor continua
// AVISANDO — o lembrete é dado comum (art. 33, IX c/c 7º, V) —, mas o aviso chega GENÉRICO:
// nenhum remédio, plano, dose ou % no título, no corpo nem no `data` do push.
//
// ═══════════════════════════════════════════════════════════════════════════════
// DIREÇÃO DO DEFAULT — inversa da `consentSuppression`, segura pelo MESMO motivo
// ─────────────────────────────────────────────────────────────────────────────
// Lá, ausência de dado ENVIA (calar por omissão silenciaria o alerta clínico de toda a base). Aqui,
// ausência de dado REDIGE: flag NULL, linha ausente ou `_read_failed` ⇒ genérico. Redigir não cala
// nada — kind, canal, som, `critical_alarm` e ações seguem intactos; só sai o nome. O erro de leitura
// custa um aviso menos detalhado, nunca um aviso perdido e nunca um vazamento.
//
// ALLOWLIST, NUNCA DENYLIST: um campo novo no `metadataSchema` nasce FORA do push sem B até alguém
// provar que não carrega conteúdo clínico (mesmo critério de CONSENT_LIFECYCLE_KINDS).
//
// Alarme local (notifee) não passa por aqui: é gerado no aparelho e não sai do país (CON-031).

import { escapeMarkdownV2 } from '../../utils/formatters.js'

/** Fatia de `user_settings` que interessa a esta política (o dispatcher já a tem em mãos). */
export interface TransferRedactionSettings {
  international_transfer_granted_at?: string | null
  /** Leitura de `user_settings` DESTE usuário falhou (ver `consentSuppression.ts`). */
  _read_failed?: boolean
}

/** Sem B vigente (ou sem saber) ⇒ redige. */
export function isTransferRedacted(settings: TransferRedactionSettings | null | undefined): boolean {
  if (!settings) return true
  if (settings._read_failed === true) return true
  return !settings.international_transfer_granted_at
}

/**
 * Kinds cuja copy já é neutra por contrato de schema (sem campo onde dado clínico caiba) — passam
 * intactos. Um kind só entra aqui com a mesma prova de CONSENT_LIFECYCLE_KINDS.
 */
export const TRANSFER_NEUTRAL_KINDS = Object.freeze(['consent_prune_notice', 'prune_admin_alert'])

const DOSE_GENERIC = { title: '💊 Hora do seu remédio', body: 'Abra o dosiq para ver a dose.' }

/**
 * Genérico por kind (Q-3: dose = "💊 Hora do seu remédio", crítico idem — "Remédio essencial"
 * revelaria a criticidade). Kind fora da tabela cai no FALLBACK, nunca no payload original.
 */
const GENERIC_BY_KIND: Readonly<Record<string, { title: string; body: string }>> = Object.freeze({
  dose_reminder: DOSE_GENERIC,
  dose_reminder_by_plan: DOSE_GENERIC,
  dose_reminder_misc: DOSE_GENERIC,
  stock_alert: { title: '📦 Aviso de estoque', body: 'Abra o dosiq para ver os detalhes.' },
  stock_expiry_alert: { title: '📦 Aviso de estoque', body: 'Abra o dosiq para ver os detalhes.' },
  prescription_alert: { title: '📋 Aviso de receita', body: 'Abra o dosiq para ver os detalhes.' },
  titration_alert: { title: '📈 Aviso do tratamento', body: 'Abra o dosiq para ver os detalhes.' },
  daily_digest: { title: '📊 Resumo disponível', body: 'Abra o dosiq para ver o resumo.' },
  adherence_report: { title: '📊 Resumo disponível', body: 'Abra o dosiq para ver o resumo.' },
  weekly_adherence: { title: '📊 Resumo disponível', body: 'Abra o dosiq para ver o resumo.' },
  monthly_report: { title: '📊 Resumo disponível', body: 'Abra o dosiq para ver o resumo.' },
})
const FALLBACK_GENERIC = { title: '🔔 Aviso do dosiq', body: 'Abra o dosiq para ver os detalhes.' }

/** Campos de `metadata` que podem viajar sem B: só roteamento, ids opacos e instrução de canal. */
const METADATA_ALLOWLIST = Object.freeze([
  'kind',
  'builtAt',
  'correlationId',
  'protocolId',
  'protocolIds',
  'planId',
  'critical_alarm', // instrução de som/canal (o alarme crítico do aparelho depende dele) — não é dado clínico
  'suppress_push_reason',
  'notificationLogId',
])

/** `navigation.params` sem B: só ids e o instante (o app resolve o resto localmente). */
const NAVIGATION_PARAM_ALLOWLIST = Object.freeze(['protocolId', 'protocolIds', 'planId', 'at', 'stepId'])

function pick(source: Record<string, unknown> | undefined, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!source) return out
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key]
  return out
}

function redactMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) return metadata
  const out = pick(metadata, METADATA_ALLOWLIST)
  const navigation = metadata.navigation as { screen?: unknown; params?: Record<string, unknown> } | undefined
  if (navigation && typeof navigation.screen === 'string') {
    out.navigation = { screen: navigation.screen, params: pick(navigation.params, NAVIGATION_PARAM_ALLOWLIST) }
  }
  return out
}

/**
 * Troca título/corpo pelo genérico da kind e reduz `metadata` à allowlist. `actions` e `deeplink`
 * seguem: rótulos fixos ("✅ Tomar") e parâmetros de id — tocar neles quebraria o registro da dose
 * pela notificação. Puro: não muta o payload recebido (a inbox, no Brasil, guarda o original).
 */
export function redactForNoTransfer<T extends { title: string; body: string; pushBody?: string; metadata?: unknown }>(
  payload: T,
): T {
  const kind = (payload.metadata as { kind?: string } | undefined)?.kind
  if (kind != null && TRANSFER_NEUTRAL_KINDS.includes(kind)) return payload
  const generic = (kind != null && GENERIC_BY_KIND[kind]) || FALLBACK_GENERIC
  return {
    ...payload,
    title: generic.title,
    // `body` é MarkdownV2 pré-escapado (o Telegram o envia cru); push/web push leem `pushBody`, texto puro.
    body: escapeMarkdownV2(generic.body),
    pushBody: generic.body,
    metadata: redactMetadata(payload.metadata as Record<string, unknown> | undefined),
  }
}
