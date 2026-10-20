// Fake do Supabase em memória para os jobs da fila (spec 107). Avalia filtros de verdade — um mock
// que só registrasse chamadas não provaria QUEM foi selecionado para ser apagado (lição da 046).
// As RPCs reproduzem o contrato do banco (migração 20261020_107): exclusão some com a conta,
// `consent_controller_event` exige a conta viva, `prune_unconsented_accounts` = sem `granted`.

type Row = Record<string, any>;

export interface FakeState {
  /** `email_confirmed` ausente = confirmado (o caso comum; FR-016 testa o `false`). */
  users: Array<{ id: string; email: string; created_at: string; email_confirmed?: boolean }>;
  tables: Record<string, Row[]>;
  failures?: Partial<Record<string, boolean>>;
}

let seq = 1000;

function get(row: Row, col: string) {
  if (col.includes('->>')) {
    const [base, key] = col.split('->>');
    return row[base]?.[key];
  }
  return row[col];
}

export function createFakeSupabase(state: FakeState, clock: () => string = () => new Date().toISOString()) {
  const rpcCalls: Array<{ fn: string; args: any }> = [];
  const tables = state.tables;
  for (const t of ['prune_queue', 'prune_queue_audit', 'consent_log', 'user_settings', 'notification_devices', 'app_version_gate', 'consent_copy', 'consent_copy_history']) {
    tables[t] = tables[t] ?? [];
  }

  class Query {
    private filters: Array<(r: Row) => boolean> = [];
    private op: 'select' | 'insert' | 'update' = 'select';
    private payload: any;
    private wantSingle = false;
    private headCount = false;
    private returning = false;
    private orderBy?: { col: string; asc: boolean };
    private limitN?: number;
    constructor(private table: string) {}
    select(_c?: string, opts?: { head?: boolean }) { if (opts?.head) this.headCount = true; if (this.op !== 'select') this.returning = true; return this; }
    insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
    update(p: any) { this.op = 'update'; this.payload = p; return this; }
    eq(c: string, v: any) { this.filters.push((r) => get(r, c) === v); return this; }
    in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(get(r, c))); return this; }
    is(c: string, v: any) { this.filters.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
    not(c: string, _op: string, _v: any) { this.filters.push((r) => r[c] != null); return this; }
    lte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] <= v); return this; }
    gte(c: string, v: any) { this.filters.push((r) => r[c] != null && r[c] >= v); return this; }
    order(c: string, o?: { ascending?: boolean }) { this.orderBy = { col: c, asc: o?.ascending !== false }; return this; }
    limit(n: number) { this.limitN = n; return this; }
    single() { this.wantSingle = true; return this; }
    maybeSingle() { this.wantSingle = true; return this; }
    private run() {
      if (state.failures?.[`${this.table}:${this.op}`]) return { data: null, error: { message: 'boom', code: 'XX000' }, count: null };
      const rows = tables[this.table];
      if (this.op === 'insert') {
        const items: Row[] = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: Row): Row => ({
          id: p.id ?? `id-${seq++}`, created_at: clock(), decision: this.table === 'prune_queue' ? 'pending' : undefined, ...p,
        }));
        if (this.table === 'prune_queue') {
          for (const it of items) {
            const live = rows.some((r) => r.user_id === it.user_id && ['pending', 'approved', 'deferred'].includes(r.decision) && r.executed_at == null);
            if (live) return { data: null, error: { message: 'duplicate', code: '23505' }, count: null };
          }
        }
        rows.push(...items);
        const data = this.wantSingle ? items[0] : items;
        return { data, error: null, count: items.length };
      }
      let hit = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.op === 'update') {
        hit.forEach((r) => Object.assign(r, this.payload));
        return { data: this.returning ? hit.map((r) => ({ ...r })) : null, error: null, count: hit.length };
      }
      if (this.orderBy) {
        const { col, asc } = this.orderBy;
        hit = [...hit].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      if (this.limitN != null) hit = hit.slice(0, this.limitN);
      if (this.headCount) return { data: null, error: null, count: hit.length };
      return { data: this.wantSingle ? (hit[0] ?? null) : hit.map((r) => ({ ...r })), error: null, count: hit.length };
    }
    then(resolve: (v: any) => void, reject?: (e: any) => void) {
      try { resolve(this.run()); } catch (e) { reject?.(e); }
    }
  }

  const supabase = {
    from: (t: string) => new Query(t),
    rpc: async (fn: string, args: any = {}) => {
      if (state.failures?.[`rpc:${fn}`]) return { data: null, error: { message: 'boom' } };
      if (fn === 'prune_account_emails') {
        return { data: state.users.filter((u) => args.p_user_ids.includes(u.id)).map((u) => ({ user_id: u.id, email: u.email, email_confirmed: u.email_confirmed !== false })), error: null };
      }
      if (fn === 'prune_unconsented_accounts') {
        const granted = new Set(tables.consent_log.filter((c) => c.action === 'granted').map((c) => c.user_id));
        return { data: state.users.filter((u) => !granted.has(u.id)).map((u) => ({ user_id: u.id, created_at: u.created_at, email_confirmed: u.email_confirmed !== false })), error: null };
      }
      rpcCalls.push({ fn, args });
      if (fn === 'consent_controller_event') {
        if (!state.users.some((u) => u.id === args.p_user_id)) return { data: null, error: { message: 'consent_subject_email_missing' } };
        tables.consent_log.push({ id: `c-${seq++}`, user_id: args.p_user_id, consent_type: args.p_consent_type, action: args.p_action, created_at: clock(), seq: seq++ });
        return { data: `c-${seq}`, error: null };
      }
      if (fn === 'delete_user_account_by_id') {
        state.users = state.users.filter((u) => u.id !== args.p_user_id);
        tables.consent_log.push({ id: `c-${seq++}`, user_id: null, consent_type: 'health_data', action: 'account_deleted', created_at: clock(), seq: seq++ });
        for (const c of tables.consent_log) if (c.user_id === args.p_user_id) c.user_id = null;
        return { data: null, error: null };
      }
      return { data: null, error: { message: `rpc desconhecida: ${fn}` } };
    },
  };
  return { supabase: supabase as any, rpcCalls, state };
}
