import type { PatientUid } from './identity';

/**
 * Contexto ativo de navegação (épico 009 — Modo Cuidador).
 * `self`: usuário opera nos próprios dados. `managed`: cuidador opera nos
 * dados de um paciente gerenciado, identificado por PatientUid.
 */
export type ActiveContext =
  | { readonly kind: 'self' }
  | { readonly kind: 'managed'; readonly patientUid: PatientUid };

export function isManagedContext(
  context: ActiveContext
): context is Extract<ActiveContext, { kind: 'managed' }> {
  return context.kind === 'managed';
}

export function isSelfContext(
  context: ActiveContext
): context is Extract<ActiveContext, { kind: 'self' }> {
  return context.kind === 'self';
}
