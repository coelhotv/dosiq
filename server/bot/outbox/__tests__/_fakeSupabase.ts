// Banco falso que FILTRA de verdade (spec 105). Os testes do eixo de compra/aviso mensal dependem de
// qual linha cada query devolve (status pendente, intervalo de datas, protocolo esparso); um mock por
// fila devolveria a mesma coisa para qualquer filtro e o teste mediria o mock (R-288).
// Suporta o subconjunto que o código usa: select/eq/is/in/gte/lt/or(end_date)/order/range/maybeSingle.

type Row = Record<string, any>;

export function makeFakeSupabase(tables: Record<string, Row[]>) {
  const calls: string[] = [];

  function query(table: string) {
    const preds: Array<(r: Row) => boolean> = [];
    let from = 0;
    let to = Infinity;
    const q: any = {
      select: () => q,
      order: () => q,
      eq: (c: string, v: any) => { preds.push((r) => r[c] === v); return q; },
      is: (c: string, v: any) => { preds.push((r) => (v === null ? r[c] == null : r[c] === v)); return q; },
      in: (c: string, vs: any[]) => { preds.push((r) => vs.includes(r[c])); return q; },
      gte: (c: string, v: any) => { preds.push((r) => r[c] != null && r[c] >= v); return q; },
      lt: (c: string, v: any) => { preds.push((r) => r[c] != null && r[c] < v); return q; },
      // Só a forma usada no código: `end_date.is.null,end_date.gte.YYYY-MM-DD`.
      or: (expr: string) => {
        const m = /end_date\.is\.null,end_date\.gte\.(\S+)/.exec(expr);
        if (m) preds.push((r) => r.end_date == null || r.end_date >= m[1]);
        return q;
      },
      range: (a: number, b: number) => { from = a; to = b; return q; },
      rows: () => (tables[table] || []).filter((r) => preds.every((p) => p(r))).slice(from, to + 1),
      maybeSingle: async () => ({ data: q.rows()[0] ?? null, error: null }),
      then: (ok: any, ko?: any) => Promise.resolve({ data: q.rows(), error: null }).then(ok, ko),
    };
    return q;
  }

  return {
    calls,
    tables,
    from: (table: string) => { calls.push(table); return query(table); },
  };
}

/** Repo falso com a UNIQUE (user_id, kind, period_key, subject_id) — a idempotência é da constraint. */
export function makeUniqueRepo() {
  const seen = new Set<string>();
  const inserted: any[] = [];
  return {
    inserted,
    async enqueue(entries: any[]) {
      let n = 0;
      for (const e of entries) {
        const key = `${e.userId}|${e.kind}|${e.periodKey}|${e.subjectId ?? 'NULL'}`;
        if (seen.has(key)) continue;
        seen.add(key);
        inserted.push(e);
        n++;
      }
      return n;
    },
  };
}
