// _fakeSupabase.ts — spec 088: fake de query builder que APLICA os filtros sobre tabelas em memória.
// Os testes de recorrência precisam disso: o pré-filtro de período mora na query (FR-009), então um
// mock que devolve tudo esconderia exatamente o caso em que a query exclui o que o motor aceitaria.
// Cobre só os operadores usados por /hoje, digest e lembrete legado.

type Row = Record<string, any>;
type Pred = (r: Row) => boolean;

function parseOr(expr: string): Pred {
  const preds = expr.split(',').map((term): Pred => {
    const [col, op, ...rest] = term.split('.');
    const val = rest.join('.');
    if (op === 'is' && val === 'null') return (r) => r[col] == null;
    if (op === 'gte') return (r) => r[col] != null && r[col] >= val;
    if (op === 'lte') return (r) => r[col] != null && r[col] <= val;
    throw new Error(`_fakeSupabase: operador .or não suportado: ${term}`);
  });
  return (r) => preds.some((p) => p(r));
}

export function createFakeSupabase(tables: Record<string, Row[]>) {
  const queries: Array<{ table: string; ops: Array<[string, ...unknown[]]> }> = [];

  function from(table: string) {
    const filters: Pred[] = [];
    const ops: Array<[string, ...unknown[]]> = [];
    queries.push({ table, ops });
    const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
    const b: any = {
      select: () => b,
      eq: (c: string, v: unknown) => (ops.push(['eq', c, v]), filters.push((r) => r[c] === v), b),
      in: (c: string, a: unknown[]) => (ops.push(['in', c, a]), filters.push((r) => a.includes(r[c])), b),
      lte: (c: string, v: string) => (ops.push(['lte', c, v]), filters.push((r) => r[c] != null && r[c] <= v), b),
      gte: (c: string, v: string) => (ops.push(['gte', c, v]), filters.push((r) => r[c] != null && r[c] >= v), b),
      or: (expr: string) => (ops.push(['or', expr]), filters.push(parseOr(expr)), b),
      contains: (c: string, json: string) => {
        const wanted = JSON.parse(json) as unknown[];
        ops.push(['contains', c, wanted]);
        filters.push((r) => wanted.every((x) => (r[c] ?? []).includes(x)));
        return b;
      },
      single: () => {
        const r = rows()[0];
        return Promise.resolve(r ? { data: r, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } });
      },
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve({ data: rows(), error: null }).then(onFulfilled, onRejected),
    };
    return b;
  }

  return { from, queries };
}
