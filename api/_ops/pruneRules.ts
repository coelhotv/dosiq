// pruneRules.ts — regras puras da fila de exclusão (spec 107). Sem I/O: enqueue, execute e o
// handler do admin decidem pelas MESMAS funções, e os testes as exercitam com relógio fixo.

import { compareSemver } from '@dosiq/core';

const DAY_MS = 86_400_000;

/** Prazo legal após o início do relógio (revogação ou marcação do controlador). */
export const PRUNE_CLOCK_DAYS = 90;
/** Folga prometida pela política v0.4 §9: "apaga em até 15 dias após o prazo de 90 dias". */
export const POLICY_GRACE_DAYS = 15;
/** A ≤ 10 dias do limite da política a pendência vira vermelha (AS-2.2). */
export const RED_MARGIN_DAYS = 10;
/** O admin só pode aprovar quem fica elegível em até 7 dias (S-1). */
export const APPROVAL_WINDOW_DAYS = 7;
/** Onboarding sem consentimento A por 30 dias entra na fila (FR-009). */
export const ONBOARDING_GRACE_DAYS = 30;
/** Legado sem retorno 7 dias após o e-mail da onda 2 entra na fila (FR-007). */
export const WAVE2_GRACE_DAYS = 7;
/**
 * G-5 (C1.5 2026-10-20): a regra contínua do onboarding vale só para contas criadas a partir
 * daqui. As anteriores são LEGADO e entram apenas pela onda 2 — senão as 36 contas legado (todas
 * com mais de 30 dias) cairiam na fila no 1º run, sem e-mail, violando a INV-6.
 */
export const ONBOARDING_RULE_START = '2026-10-20T03:00:00.000Z';
/** Versão mínima do kill switch exigida antes de aprovar/executar legado (FR-011 onda 3, INV-6). */
export const LEGACY_MIN_APP_VERSION = '0.34.0';

export const addDays = (iso: string, days: number): string =>
  // Aritmética sobre instante absoluto (epoch), não parsing de 'YYYY-MM-DD' — R-020 não se aplica.
  // eslint-disable-next-line no-restricted-syntax
  new Date(Date.parse(iso) + days * DAY_MS).toISOString();

/** Dias corridos inteiros entre `fromIso` e `now` (negativo se no futuro). */
export function daysBetween(fromIso: string, now: Date): number {
  return Math.floor((now.getTime() - Date.parse(fromIso)) / DAY_MS);
}

/** Limite da política para uma linha: elegível + 15 dias. */
export const policyLimit = (eligibleAt: string): string => addDays(eligibleAt, POLICY_GRACE_DAYS);

/**
 * Situação de alerta de uma linha viva (PO-4). `overdue` = vencida e ainda sem decisão;
 * `red` = a ≤ 10 dias do limite da política (vale também para adiada — AS-2.2, edge case
 * "adiar além do limite").
 */
export function alertState(
  row: { decision: string; eligible_at: string; executed_at?: string | null },
  now: Date,
): { overdue: boolean; red: boolean } {
  if (row.executed_at || row.decision === 'void' || row.decision === 'approved') {
    return { overdue: false, red: false };
  }
  const eligible = Date.parse(row.eligible_at);
  const redFrom = Date.parse(policyLimit(row.eligible_at)) - RED_MARGIN_DAYS * DAY_MS;
  return {
    overdue: row.decision === 'pending' && now.getTime() >= eligible,
    red: now.getTime() >= redFrom,
  };
}

/** Linha aprovável agora? (S-1: estado + janela de 7 dias) */
export function isApprovable(row: { decision: string; eligible_at: string; executed_at?: string | null }, now: Date): boolean {
  if (row.executed_at) return false;
  if (row.decision !== 'pending' && row.decision !== 'deferred') return false;
  return Date.parse(row.eligible_at) <= now.getTime() + APPROVAL_WINDOW_DAYS * DAY_MS;
}

/**
 * Qual aviso é devido hoje, dado o início do relógio. `null` = nenhum (antes do D+60 ou já no
 * prazo de exclusão). `expected` = quantos `notice_sent` desde o início devem existir com ele.
 */
export function dueNoticeStage(scheduledAt: string, now: Date): { stage: 'd60' | 'd83'; expected: 1 | 2 } | null {
  const days = daysBetween(scheduledAt, now);
  if (!Number.isFinite(days) || days < 60 || days >= PRUNE_CLOCK_DAYS) return null;
  return days >= 83 ? { stage: 'd83', expected: 2 } : { stage: 'd60', expected: 1 };
}

/** A política promete 2 avisos (D+60 e D+83) antes de qualquer exclusão (FR-014). */
export const REQUIRED_NOTICES = 2;
/**
 * Quem perdeu os avisos recebe UM reaviso por e-mail; o novo prazo é a marcação + 7 dias
 * (decisão do PO 2026-10-20, mesma folga da onda 2). Sem isso a linha fica bloqueada para sempre.
 */
export const REAVISO_GRACE_DAYS = 7;

/** O titular foi avisado como a política promete? 2 avisos desde o início, ou o reaviso. */
export function noticesComplete(sentSinceStart: number, hasReaviso: boolean): boolean {
  return hasReaviso || sentSinceStart >= REQUIRED_NOTICES;
}

export type PruneSection = 'email' | 'decide' | 'blocked' | 'approved' | 'counting';
export type PruneBlock = 'missing_notices' | 'legacy_gate';
export type PruneNoticeDue = 'd60' | 'd83' | 'reaviso';

/**
 * Em que seção da tela a linha mora HOJE — uma só, pela próxima ação do admin (FR-014):
 *   approved  aprovada, aguarda o executor;
 *   email     aviso D+60/D+83 devido e ainda não enviado (conta sem push);
 *   blocked   no prazo, mas sem os 2 avisos (⇒ reaviso) ou legado sem kill switch 0.34;
 *   decide    no prazo e com tudo em ordem: apagar ou adiar;
 *   counting  nada a fazer hoje.
 * O handler do admin usa ESTA função tanto para a lista quanto para recusar approve/reaviso.
 */
export function pruneSection(
  row: { reason: string; scheduled_at: string; decision: string; eligible_at: string; executed_at?: string | null },
  ctx: { sentSinceStart: number; hasReaviso: boolean; legacyGate: boolean },
  now: Date,
): { section: PruneSection; notice_due: PruneNoticeDue | null; block: PruneBlock | null } {
  if (row.decision === 'approved') return { section: 'approved', notice_due: null, block: null };
  const stage = dueNoticeStage(row.scheduled_at, now);
  if (stage && !ctx.hasReaviso && ctx.sentSinceStart < stage.expected) {
    return { section: 'email', notice_due: stage.stage, block: null };
  }
  if (!isApprovable(row, now)) return { section: 'counting', notice_due: null, block: null };
  if (!noticesComplete(ctx.sentSinceStart, ctx.hasReaviso)) {
    return { section: 'blocked', notice_due: 'reaviso', block: 'missing_notices' };
  }
  if (row.reason === 'legacy_no_consent' && !ctx.legacyGate) {
    return { section: 'blocked', notice_due: null, block: 'legacy_gate' };
  }
  return { section: 'decide', notice_due: null, block: null };
}

/** Próximo marco de uma linha "em contagem", para a tela dizer quando ela volta a pedir ação. */
export function nextMilestone(row: { scheduled_at: string; eligible_at: string }, now: Date): { label: 'D+60' | 'D+83' | 'prazo'; at: string } {
  const days = daysBetween(row.scheduled_at, now);
  if (days < 60) return { label: 'D+60', at: addDays(row.scheduled_at, 60) };
  if (days < 83) return { label: 'D+83', at: addDays(row.scheduled_at, 83) };
  return { label: 'prazo', at: row.eligible_at };
}

/**
 * Kill switch de versão mínima ativo e ≥ 0.34 nas DUAS plataformas (INV-6). Linha ausente,
 * inativa, versão ilegível ⇒ false: na dúvida, o legado não é aprovado nem apagado.
 */
export function legacyGateOpen(gates: Array<{ platform: string; min_supported_version: string | null; is_active: boolean }> | null): boolean {
  if (!Array.isArray(gates)) return false;
  return ['ios', 'android'].every((platform) => {
    const g = gates.find((x) => x.platform === platform);
    if (!g || g.is_active !== true) return false;
    const cmp = compareSemver(g.min_supported_version, LEGACY_MIN_APP_VERSION);
    return cmp !== null && cmp >= 0;
  });
}

/** Máscara do e-mail para a fila (S-3): 3 primeiros caracteres do usuário + domínio. */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 3)}***@${domain}`;
}

/** Prefixo mínimo digitado para confirmar a exclusão (S-2). */
export const APPROVE_PREFIX_MIN = 6;
