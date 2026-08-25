import { supabase } from '../../services/supabase.js';
import { createLogger } from '../logger.js';
import { getServerTimestamp } from '../../utils/dateUtils.js';
import {
  resolveTitrationAdvance,
  formatMedicineFullName,
  getTodayLocal as getTodayLocalInTz,
  createDoseInstanceRepository,
  resyncProtocolWindow,
  resolveUserTz,
} from '@dosiq/core';

const logger = createLogger('TitrationAlerts');

// ═══════════════════════════════════════════════════════════════════════════════
// 029 F3 (T012) — MOTOR N2: avanço da Evolução do tratamento a partir de titration_steps.
//
// Divisão de trabalho: a DECISÃO é pura e vive no core (`resolveTitrationAdvance`,
// nível A strict, testável sem banco); aqui fica só o I/O + as travas.
//
// CONCORRÊNCIA (R-288 — trace em plans/specs/029.../plan.md §Apêndice F3): cada UPDATE carrega
// o status esperado no WHERE. Esse predicado É o claim (AP-221): 0 linhas ⇒ o estado mudou sob
// o cron (usuário confirmou/editou, tick concorrente) ⇒ aborta SEM notificar.
//
// ⚠️ FALHA PARCIAL (o cron NÃO tem transação — cada UPDATE é uma chamada PostgREST separada;
// a atomicidade da confirmação vem da RPC, aqui não existe): a ORDEM das escritas é o que torna
// o estado intermediário recuperável. Ativa-se a etapa nova ANTES de encerrar a anterior, de modo
// que um crash no meio deixe DUAS etapas 'current' — estado transitório e auto-corrigível (o
// resolver pega a de menor position, recalcula o mesmo plano e converge no tick seguinte). A ordem
// inversa deixaria a escada SEM etapa vigente: o resolver devolveria null para sempre e a titulação
// morreria em silêncio, com a dose caindo para `dosage_per_intake`. É a regra 2 da R-288
// (estado de posse exige recuperação) aplicada por construção, sem timer de stuck.
// ═══════════════════════════════════════════════════════════════════════════════

// Etapas + medicamento de cada escada do usuário. R-267: `started_at`/`duration_days`/`status`
// são o que decide o vencimento; `protocol_id` é o executor; `medicine.name` alimenta a copy.
const TITRATION_STEPS_SELECT = `
  id,
  steps:titration_steps (
    id, position, medicine_id, dose, intake_unit, duration_days, status,
    started_at, protocol_id,
    medicine:medicine_id (name, dosage_unit, dosage_per_pill, concentration_volume_ml)
  )
`;

/**
 * Reprojeta a janela futura do protocolo executor após o `dose_change` automático (052 T006).
 *
 * **BEST-EFFORT (R-245), e isso é deliberado.** A ativação da etapa JÁ está no banco quando esta
 * função roda; falhar aqui não pode abortar o tick nem fazer o push repetir. O cron do dia
 * seguinte e a rede lazy seguem como malha de segurança — a falha degrada para o comportamento
 * ANTIGO (esperar o cron), nunca para um estado que a malha não enxergue.
 *
 * O select carrega o embed `titration_steps(...)` COM `medicine_id` porque o gerador precisa da
 * escada inteira: sem ela a dose cai para `dosage_per_intake` em silêncio (CON-032), e sem o
 * `medicine_id` do step a instância congelaria o medicamento do protocolo em vez do da etapa
 * vigente na data (052 §G1).
 * @private
 */
async function _resyncProtocolAfterDoseChange(protocolId, correlationId) {
  if (!protocolId) return;
  try {
    const { data: protocol, error } = await supabase
      .from('protocols')
      .select('*, titration_steps(id, position, dose, duration_days, status, started_at, medicine_id)')
      .eq('id', protocolId)
      .single();
    if (error || !protocol) return;

    // TODO(040-strict): dual @supabase/supabase-js version (server 2.90.1 vs root 2.105.4) —
    // mesmo cast de fronteira do doseInstanceScheduler.
    const tz = await resolveUserTz(supabase as any, protocol.user_id);
    await resyncProtocolWindow({
      protocol,
      doseInstanceRepo: createDoseInstanceRepository({ client: supabase as any }),
      tz,
    });
  } catch (err) {
    logger.warn('Resync de dose_instances pós-dose_change falhou (cron/rede lazy corrigem)', {
      protocolId,
      correlationId,
      error: err?.message,
    });
  }
}

// medicine_switch: PENDURA a próxima etapa. A vigente segue 'current' de propósito — os
// lembretes continuam na dose antiga até o usuário confirmar (Decisões §3.2). O app NUNCA
// troca de medicamento sozinho (§10). Escrita única: sem falha parcial possível.
// Retorna false para ABORTAR o plano inteiro (claim perdido); true para seguir (inclui "sem pending").
async function _claimPendingConfirmation(userId, pending) {
  if (!pending) return true;
  const { data: rows, error } = await supabase
    .from('titration_steps')
    .update({ status: 'pending_confirmation', updated_at: getServerTimestamp() })
    .eq('id', pending.id)
    .eq('user_id', userId)
    .eq('status', 'upcoming') // claim: 0 linhas = já pendente/confirmada → sem push
    .select('id');
  if (error) throw error;
  return !!(rows && rows.length > 0);
}

// dose_change: a próxima etapa vigora automaticamente na data (comportamento N1). ANTES de
// encerrar a anterior — ver a nota de FALHA PARCIAL no cabeçalho do arquivo.
// Retorna null p/ ABORTAR (mudança real de outro ator); senão { notify } — notify=false quando
// o estado só está CONVERGINDO (tick anterior já ativou e morreu antes de terminar).
async function _applyActivatedStep(userId, activated, completed, protocolIdByStepId, correlationId) {
  if (!activated) return { notify: true };

  // Escada migrada do N1: toda etapa já aponta pro mesmo protocol (backfill do T013).
  // Escada nova (F4): a etapa futura nasce sem executor → herda o da etapa que encerrou.
  const lastClosed = completed[completed.length - 1];
  const inheritedProtocolId =
    activated.protocolId ?? (lastClosed ? protocolIdByStepId.get(lastClosed.id) ?? null : null);

  const { data: rows, error } = await supabase
    .from('titration_steps')
    .update({
      status: 'current',
      started_at: activated.startedAtIso,
      protocol_id: inheritedProtocolId,
      updated_at: getServerTimestamp(),
    })
    .eq('id', activated.id)
    .eq('user_id', userId)
    .eq('status', 'upcoming') // claim
    .select('id');
  if (error) throw error;

  let notify = true;
  if (!rows || rows.length === 0) {
    // Claim vazio: ou outro ator mexeu de verdade, ou um tick anterior já ativou esta etapa e
    // morreu antes de encerrar a anterior. Distinguir os dois é o que evita a escada travada.
    const { data: atual, error: readErr } = await supabase
      .from('titration_steps')
      .select('status')
      .eq('id', activated.id)
      .eq('user_id', userId)
      .maybeSingle();
    if (readErr) throw readErr;
    if (atual?.status !== 'current') return null; // mudou de verdade → aborta sem notificar
    notify = false; // já ativada: converge o resto do estado, mas não repete o push
  }

  // Dose do executor vigente. `cp` NÃO existe no CHECK de protocols.intake_unit — em
  // protocols o comprimido é NULL (fronteira N2→N1, idêntica à da RPC do T013 — AP-299).
  if (inheritedProtocolId) {
    const { error: protoErr } = await supabase
      .from('protocols')
      .update({
        dosage_per_intake: activated.dose,
        intake_unit: activated.intakeUnit === 'cp' ? null : activated.intakeUnit,
      })
      .eq('id', inheritedProtocolId)
      .eq('user_id', userId);
    if (protoErr) throw protoErr;

    // 052 T006 (FR-007c) — a segunda instância viva do AP-308, no caminho do CRON.
    // O UPDATE acima é a ÚNICA outra escrita em `protocols` fora do repositório (a primeira,
    // a RPC `confirm_titration_switch`, a 029 F5.5 já cobriu do lado do cliente). Escapar do
    // repositório significa escapar do `syncInstancesOnWrite`: as instâncias futuras já
    // materializadas mantêm a `expected_dose` do cronograma ANTERIOR. Como este é o caminho
    // NORMAL da escada (`dose_change` automático na data), o efeito em prod é que TODO avanço
    // automático deixava o tratamento dizendo uma dose e o lembrete entregando outra — pior
    // que a ausência de dose, porque é risco clínico silencioso.
    await _resyncProtocolAfterDoseChange(inheritedProtocolId, correlationId);
  }

  return { notify };
}

// Etapas encerradas (as intermediárias de uma cadeia de dose_change + a vigente).
// 0 linhas aqui NÃO aborta: significa que um tick anterior já encerrou (convergência) — EXCETO
// quando não há activated/pending: aí o encerramento É o claim do push (target_reached).
async function _closeCompletedSteps(userId, completed, hasActivatedOrPending) {
  for (const closure of completed) {
    const { data: rows, error } = await supabase
      .from('titration_steps')
      .update({ status: 'completed', ended_at: closure.endedAtIso, updated_at: getServerTimestamp() })
      .eq('id', closure.id)
      .eq('user_id', userId)
      .eq('status', 'current') // trava otimista (AP-221)
      .select('id');
    if (error) throw error;
    if ((!rows || rows.length === 0) && !hasActivatedOrPending) return false;
  }
  return true;
}

// Trilha auditável (CON-031 aditivo). actor 'system': foi o cron, não o usuário. Best-effort: a
// auditoria não pode desfazer uma transição já aplicada (R-245).
async function _auditTitrationTransition(userId, titrationId, plan, correlationId) {
  const { error: auditErr } = await supabase.from('dose_critical_events').insert({
    user_id: userId,
    dose_instance_id: null, // a transição é do TRATAMENTO, não de uma ocorrência
    event: 'titration_transitioned',
    platform: 'server',
    actor: 'system',
    detail: {
      titration_id: titrationId,
      transition: plan.transition,
      completed_step_ids: plan.completed.map((c) => c.id),
      activated_step_id: plan.activated?.id ?? null,
      pending_step_id: plan.pending?.id ?? null,
    },
  });
  if (auditErr) logger.error('Falha ao auditar transição de titulação', auditErr, { userId, titrationId, correlationId });
}

// Aplica o plano do motor. Retorna true só se o CLAIM da transição pegou a linha —
// é o gate da notificação (sem isto, tick repetido = push duplicado).
// `protocolIdByStepId`: executor de cada etapa (o motor puro não faz I/O nem conhece joins).
export async function _applyTitrationPlan(userId, titrationId, plan, protocolIdByStepId, correlationId) {
  // 1) medicine_switch
  const pendingOk = await _claimPendingConfirmation(userId, plan.pending);
  if (!pendingOk) return false;

  // 2) dose_change — `notify` fica false quando o estado só está CONVERGINDO.
  const activatedResult = await _applyActivatedStep(userId, plan.activated, plan.completed, protocolIdByStepId, correlationId);
  if (activatedResult === null) return false;

  // 3) Etapas encerradas
  const hasActivatedOrPending = !!plan.activated || !!plan.pending;
  const closedOk = await _closeCompletedSteps(userId, plan.completed, hasActivatedOrPending);
  if (!closedOk) return false;

  // 4) Trilha auditável — só na transição de fato (convergência de estado não é evento novo).
  if (!activatedResult.notify) return false;
  await _auditTitrationTransition(userId, titrationId, plan, correlationId);

  return true;
}

// Notificação por tipo de transição (FR-004 / Decisões §8):
//   dose_change     → push PADRÃO, informativo, sem botões.
//   medicine_switch → push TIME-SENSITIVE (as AÇÕES interativas são F5/T025).
//   target_reached  → informativo (espelha 'alvo_atingido' do legado).
async function _dispatchTitrationN2Alert(userId, plan, medicineName, dispatcher, correlationId) {
  const target = plan.pending ?? plan.activated;

  const data = {
    medicineName: medicineName || 'Medicamento',
    // target_reached não tem etapa-alvo (a escada acabou) → a etapa em curso é a ÚLTIMA.
    // Sem isto o push diria "etapa 1 de N" ao atingir o alvo.
    currentStage: target ? target.position + 1 : plan.totalSteps,
    totalStages: plan.totalSteps,
    // 029 F5 (T025): `transition` é a fonte da copy §8 — cobre single-med e multi-med pela
    // mesma porta. O par N1 `status`/`requiresNewMedicine` NÃO é mais escrito (segue aceito
    // no schema só p/ payload já enfileirado no outbox — R-193).
    transition: plan.transition,
    // Argumento de `confirm_titration_switch(p_step_id)`: é o que a ação [Iniciar etapa] confirma.
    stepId: target?.id,
    dose: target?.dose,
    intakeUnit: target?.intakeUnit ?? null,
  };

  await dispatcher.dispatch({
    userId,
    kind: 'titration_alert',
    data,
    context: { correlationId, jobType: 'titration_alert' },
  });
}

// Varredura N2 por usuário: escadas → plano puro → aplica → notifica (só se o claim pegou).
async function _processUserTitrationsN2(userId, tz, dispatcher, correlationId) {
  const { data: titrations, error } = await (supabase as any)
    .from('titrations')
    .select(TITRATION_STEPS_SELECT)
    .eq('user_id', userId);

  if (error) {
    logger.error('Erro ao buscar escadas de titulação', error, { userId, correlationId });
    return;
  }
  if (!titrations || titrations.length === 0) return;

  const todayLocal = getTodayLocalInTz(tz);

  for (const titration of titrations) {
    try {
      const steps = Array.isArray(titration.steps) ? titration.steps : [];
      const plan = resolveTitrationAdvance(steps, todayLocal, tz);
      if (!plan) continue; // nada venceu (inclui a titulação dormente: 'current' sem started_at)

      // O join só existe aqui: o motor é puro e não conhece nomes nem executores.
      const protocolIdByStepId = new Map(steps.map((s) => [s.id, s.protocol_id ?? null]));
      const target = plan.pending ?? plan.activated;
      // Nome + concentração: o push diz qual caneta/cartela pegar. Numa escada o NOME se repete
      // em todas as etapas ("Mounjaro" em todas), então só a concentração identifica (029 F5).
      const targetMedicine = target
        ? steps.find((s) => s.id === target.id)?.medicine
        : undefined;
      const medicineName = targetMedicine ? formatMedicineFullName(targetMedicine) : undefined;

      const claimed = await _applyTitrationPlan(userId, titration.id, plan, protocolIdByStepId, correlationId);
      if (!claimed) continue; // outro ator chegou antes → nunca notificar sobre estado obsoleto

      logger.info(
        `Evolução do tratamento: ${plan.transition} (escada ${titration.id}, ${plan.totalSteps} etapas)`,
        { userId, correlationId }
      );
      await _dispatchTitrationN2Alert(userId, plan, medicineName, dispatcher, correlationId);
    } catch (err) {
      // Best-effort por escada (R-245): erro numa não derruba a varredura das outras.
      logger.error('Erro ao processar avanço de titulação N2', err, {
        userId, titrationId: titration?.id, correlationId,
      });
    }
  }
}

export async function checkTitrationAlertsViaDispatcher(dispatcher, correlationId) {
  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, timezone');

    if (userError) throw userError;
    if (!users || users.length === 0) return;

    logger.info(`Iniciando alertas de titulação via Dispatcher para ${users.length} usuários`, { correlationId });

    for (const user of users) {
      const userId = user.user_id;
      const tz = user.timezone || 'America/Sao_Paulo'; // fallback idêntico ao resolveUserTz (R-254)

      // 029 F3.1 (T017b): a escada vive em `titration_steps` e é a fonte ÚNICA. O caminho N1
      // (jsonb em `protocols`) e a flag `TITRATION_SOURCE` foram removidos: a titulação N1
      // nunca avançou em produção (AP-298 matou a varredura em 2026-05-06 e o AP-301 já a
      // deixava zumbi antes disso) e a feature tinha zero usuários — não havia rollback a
      // preservar. As colunas N1 são dropadas no F6.
      await _processUserTitrationsN2(userId, tz, dispatcher, correlationId);
    }
  } catch (err) {
    logger.error('Erro em checkTitrationAlertsViaDispatcher', err, { correlationId });
  }
}
