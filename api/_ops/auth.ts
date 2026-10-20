// auth.ts — autenticação do api/ops pelo segredo de cron (spec 107, RC-SEC S-4).
//
// Mesmo segredo do notify (CRON_SECRET), sem segredo novo — mas NÃO o mesmo bloco: o do notify
// compara com `!==` (tempo variável) e loga o header recusado, o que manda um quase-acerto do
// segredo para o log. Aqui: tempo constante, fail-closed sem env, e o header nunca é logado.

import { timingSafeEqual, createHash } from 'node:crypto';

/** `true` só com `Authorization: Bearer <CRON_SECRET>` exato e CRON_SECRET configurado. */
export function isCronAuthorized(authHeader: unknown, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  if (typeof authHeader !== 'string') return false;
  // Hash dos dois lados ⇒ buffers de mesmo tamanho; timingSafeEqual exige isso, e comparar o
  // tamanho antes vazaria o tamanho do segredo.
  const a = createHash('sha256').update(authHeader).digest();
  const b = createHash('sha256').update(`Bearer ${cronSecret}`).digest();
  return timingSafeEqual(a, b);
}
