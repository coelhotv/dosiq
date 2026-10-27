// Spec 109 Slice A — paridade gate × job no dosiq-qa (RC3 E-3 · PO-2 parte 2).
//
// Para cada categoria de dose/LA, fixture positiva e negativa num instante de 2099 (longe de dado
// real): a RPC `notify_tick_work` e a função de fetch REAL do job (supabase-js contra o QA) têm de
// dar a MESMA resposta. Outbox fica de fora: o fetch do job é o claim (escreve) — coberto pelo
// .test.sql + guarda estrutural. Lifecycle da LA idem (query inline no dispatcher, sem APNs no QA).
//
// Uso (só QA — CON-044):
//   set -a; . apps/web/.env.qa; set +a; npx tsx scripts/qa/109-tick-gate-parity.ts

import { supabase } from '../../server/services/supabase.js';
import { _fetchDueInstancesForReminder } from '../../server/bot/reminders/doseReminders.js';
import { _fetchPendingCriticalInstances } from '../../server/notifications/apns/dispatchLiveActivityStarts.js';

const QA_REF = 'ikcvwxyohmntncanclze';
if (!String(process.env.VITE_SUPABASE_URL).includes(QA_REF)) {
  throw new Error(`recusado: VITE_SUPABASE_URL não é o dosiq-qa (${QA_REF})`);
}

const EMAIL = 't109-parity@dosiq.test';
const minuteWindow = (iso: string) => {
  const start = new Date(iso);
  start.setUTCSeconds(0, 0);
  return [start.toISOString(), new Date(start.getTime() + 60_000).toISOString()] as const;
};

async function rpc(nowIso: string, lead: number) {
  const { data, error } = await supabase.rpc('notify_tick_work', { p_now: nowIso, p_la_lead_minutes: lead });
  if (error) throw new Error(`rpc: ${error.message}`);
  return data as Record<string, boolean>;
}

async function main() {
  const { data: created, error: uErr } = await supabase.auth.admin.createUser({ email: EMAIL, email_confirm: true });
  if (uErr) throw new Error(`createUser: ${uErr.message}`);
  const uid = created.user.id;
  try {
    const { data: med, error: mErr } = await supabase.from('medicines')
      .insert({ user_id: uid, name: 'T109P', dosage_per_pill: 10, dosage_unit: 'mg' }).select('id').single();
    if (mErr) throw new Error(`medicine: ${mErr.message}`);
    const { data: prot, error: pErr } = await supabase.from('protocols')
      .insert({ user_id: uid, medicine_id: med.id, name: 'T109P', frequency: 'diário', time_schedule: ['12:00'],
        dosage_per_intake: 1, start_date: '2099-01-01', active: true }).select('id').single();
    if (pErr) throw new Error(`protocol: ${pErr.message}`);
    const base = { user_id: uid, protocol_id: prot.id, medicine_id: med.id, expected_dose: 1 };
    const { error: dErr } = await supabase.from('dose_instances').insert([
      { ...base, scheduled_for: '2099-03-01T12:00:00Z', status: 'pending', critical_alarm: false },
      { ...base, scheduled_for: '2099-03-02T12:02:00Z', status: 'pending', critical_alarm: false },
      { ...base, scheduled_for: '2099-03-03T11:30:00Z', status: 'pending', critical_alarm: false,
        notified_at: '2099-03-03T11:30:00Z', snoozed_until: '2099-03-03T12:00:10Z' },
      { ...base, scheduled_for: '2099-03-04T12:40:00Z', status: 'pending', critical_alarm: true },
    ]);
    if (dErr) throw new Error(`dose_instances: ${dErr.message}`);

    // `superset`: o gate de lembrete olha 2 minutos e o job 1 (CP-12) — ali só vale "job ⇒ gate".
    const results: Array<{ caso: string; rpc: boolean; job: boolean; esperado: boolean; superset?: boolean }> = [];

    for (const [caso, nowIso, esperado, superset] of [
      ['lembrete (+) 12:00', '2099-03-01T12:00:30Z', true, false],
      ['lembrete (−) dose 12:02 no minuto 12:00', '2099-03-02T12:00:30Z', false, false],
      ['lembrete superconjunto: dose 12:02 no tick de 12:01', '2099-03-02T12:01:30Z', true, true],
      ['soneca (+) com notified_at', '2099-03-03T12:00:59Z', true, false],
    ] as const) {
      const [ws, we] = minuteWindow(nowIso);
      const job = (await _fetchDueInstancesForReminder([uid], ws, we)).length > 0;
      results.push({ caso, rpc: (await rpc(nowIso, 60)).reminders_due, job, esperado, superset });
    }

    for (const [caso, nowIso, lead, esperado] of [
      ['LA start (+) lead 60', '2099-03-04T12:00:00Z', 60, true],
      ['LA start (−) lead 30', '2099-03-04T12:00:00Z', 30, false],
      ['LA start (−) dose não crítica', '2099-03-01T11:30:00Z', 60, false],
    ] as const) {
      const now = new Date(nowIso);
      const end = new Date(now.getTime() + lead * 60_000).toISOString();
      const fetched = await _fetchPendingCriticalInstances(supabase, undefined, now.toISOString(), end);
      if (fetched === null) throw new Error(`job LA start falhou em ${caso}`);
      results.push({ caso, rpc: (await rpc(nowIso, lead)).la_start_due, job: fetched.length > 0, esperado });
    }

    console.table(results);
    const bad = results.filter((r) =>
      r.rpc !== r.esperado || (r.job && !r.rpc) || (!r.superset && r.rpc !== r.job));
    if (bad.length > 0) throw new Error(`PARIDADE FALHOU: ${bad.map((b) => b.caso).join('; ')}`);
    console.log(`PARIDADE OK: ${results.length} casos — RPC = fetch real do job = esperado (superconjunto: job ⇒ RPC)`);
  } finally {
    await supabase.from('dose_instances').delete().eq('user_id', uid);
    await supabase.from('protocols').delete().eq('user_id', uid);
    // `trg_medicines_archive_on_delete` converte o DELETE em arquivamento: sobra 1 medicamento
    // arquivado (nome T109P) por execução — resíduo inerte do QA, sem dono após o deleteUser.
    await supabase.from('medicines').delete().eq('user_id', uid);
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) console.error(`limpeza: deleteUser falhou (${error.message}) — apagar ${EMAIL} à mão no QA`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
