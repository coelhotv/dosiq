// skipDoseService.ts — caminho canônico do SKIP de dose (spec 067 Slice B, CON-026, ADR-092)
//
// Antes desta spec o skip era `UPDATE dose_instances SET status='skipped_user'` cru, em duas
// superfícies (mobile e bot). Era a ÚNICA transição que gravava fato clínico **sem declarar a que
// instante se refere** — e foi ela que destruiu a dose do incidente: um alarme 3h37 adiantado virou
// "pulada" sem que nada no caminho pudesse notar que aquilo não era hora de dose nenhuma.
//
// Agora o skip declara o instante (`skippedAt`) e a janela mora no banco, em
// `skip_dose_atomic` (SECURITY DEFINER): a recusa é privilégio, não convenção — vale para qualquer
// superfície, presente ou futura, inclusive as que rodam com `service_role` (o bot).
//
// R-305: 0 linhas afetadas é FALHA, não sucesso. A RPC levanta exceção nomeada em vez de devolver
// um 204 mudo — quem chama traduz a mensagem para a paciente (FR-013), nunca a engole.

/**
 * Só o que este serviço realmente usa. Tipar por CAPACIDADE (e não por `SupabaseClient<Database>`)
 * evita o atrito de versão dupla do supabase-js entre workspaces (mobile 2.x vs root 2.y), que
 * hoje obriga `as any` em outros call sites (ver TODO(040-strict) em `server/bot/callbacks`).
 */
type RpcClient = {
  // `PromiseLike`, não `Promise`: o supabase-js devolve um builder *thenable* (encadeável), que
  // só vira Promise no `await`. Exigir `Promise` rejeitaria o client real.
  rpc(fn: string, params: Record<string, unknown>, ...rest: any[]): PromiseLike<{ data: any; error: { message: string } | null }>
}

/** Prefixo da recusa por janela, usado pelos clients p/ distinguir o motivo sem parsear SQLSTATE. */
export const OUT_OF_WINDOW_MESSAGE_PREFIX = 'Fora da janela da dose'

export interface SkipDoseParams {
  /** Dono das instâncias. No bot vem do binding `telegram_chat_id → user_id`, NUNCA do callback_data (FR-028). */
  userId: string
  /** Uma ou mais instâncias (dose agrupada). Lote é all-or-nothing dentro da transação. */
  instanceIds: string[]
  /** Instante declarado do skip. Default: agora. Limitado por `now()` do servidor na RPC. */
  skippedAt?: string | Date | null
}

export interface SkipDoseResult {
  skipped: number
  skippedAt: string
}

/**
 * Pula uma ou mais ocorrências pelo caminho canônico (RPC transacional).
 *
 * @throws Error com a mensagem da RPC quando a dose está fora da janela, já resolvida, é de outro
 *         dono, ou o instante declarado está no futuro. A mensagem já vem em português e sem
 *         SQLSTATE/stack — pode ir direto para a UI (FR-013 / RC-SEC S-8).
 */
export async function skipDose(
  client: RpcClient,
  { userId, instanceIds, skippedAt = null }: SkipDoseParams,
): Promise<SkipDoseResult> {
  const ids = Array.from(new Set((instanceIds ?? []).filter(Boolean)))
  if (!userId) throw new Error('Usuário não identificado')
  if (ids.length === 0) throw new Error('Nenhuma dose informada para pular')

  const at = skippedAt instanceof Date ? skippedAt.toISOString() : skippedAt

  const { data, error } = await client.rpc('skip_dose_atomic', {
    p_user_id: userId,
    p_dose_instance_ids: ids,
    p_skipped_at: at,
  })

  if (error) throw new Error(error.message)

  const parsed = (data ?? {}) as { skipped?: number; skipped_at?: string }
  return { skipped: parsed.skipped ?? 0, skippedAt: parsed.skipped_at ?? '' }
}

/** `true` quando a recusa veio da guarda de janela (e não de posse/estado). */
export function isOutOfWindowError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.includes(OUT_OF_WINDOW_MESSAGE_PREFIX)
}
