import { supabase } from '../../services/supabase.js';

const STOCK_SCAN_PAGE_SIZE = 1000;

/**
 * Lê uma tabela inteira para uma lista de usuários, paginando (AP-186). Mesmo padrão de
 * `fetchAllUserSettings` (`server/notifications/outbox/enqueueReports.ts`) — não inventar outro.
 * A `.order('id')` é obrigatória: sem ordenação estável o `.range()` é não-determinístico
 * (pula/duplica linhas entre páginas).
 */
export async function _fetchAllPages(table, columns, applyFilters = (q) => q, orderColumn = 'user_id') {
  const out: any[] = [];
  for (let page = 0; ; page++) {
    const from = page * STOCK_SCAN_PAGE_SIZE;
    const query = applyFilters(
      supabase.from(table).select(columns).order(orderColumn)
    ).range(from, from + STOCK_SCAN_PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw new Error(`_fetchAllPages(${table}): ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < STOCK_SCAN_PAGE_SIZE) break;
  }
  return out;
}

/**
 * Mesma paginação, restrita a uma lista de usuários.
 *
 * Ordena por `id` — chave primária de `protocols` e de `stock`, ambas verificadas no banco
 * (R-295: `curl .../protocols?select=id&order=id&limit=1` e `.../stock?select=id&order=id&limit=1`,
 * 200 nas duas). `stock.id` também vai no `select()` da varredura desde o 050 PR 2 — é o
 * `subject_id` do alerta de validade (por LOTE).
 */
export async function _fetchAllPagesByUsers(table, columns, userIds, applyFilters = (q) => q) {
  return _fetchAllPages(table, columns, (q) => applyFilters(q.in('user_id', userIds)), 'id');
}
