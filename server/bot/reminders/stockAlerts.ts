import { _fetchAllPages, _fetchAllPagesByUsers } from './_pagination.js';
import { createLogger } from '../logger.js';
import { parseISO } from '../../utils/dateUtils.js';
import {
  calculateDailyIntake,
  calculateDaysRemaining,
  isLiquidMedicine,
  doseToMl,
  cleanFloat,
} from '@dosiq/core';

const logger = createLogger('StockAlerts');

/**
 * Payload do alerta de estoque baixo de UM medicamento — ou `null` quando não há o que alertar
 * (sem consumo diário, saldo ainda suficiente ou dias não-finitos).
 *
 * Implementação ÚNICA (050 PR 1b): o legado (`_processUserStockAlert`), o enqueue da outbox e o
 * builder do drain chamam esta mesma função. Sem isso o SC-003 compararia duas implementações do
 * alerta em vez de dois caminhos de entrega do MESMO alerta.
 */
export function _computeStockAlertPayload(medicineId, stock, protocols) {
  // 012 B4 / ADR-067: consumo diário via core (líquido → ml + cadência da frequência).
  // Antes somava a dose na unidade de tomada CRUA (UI/gotas) contra o saldo em ml →
  // `floor(ml ÷ UI)` = "0 dias" falso p/ insulina/GLP-1 (FR-013c). `calculateDailyIntake`
  // converte intake→ml via doseToMl (ADR-065 unit-aware) e aplica frequencyDailyFactor.
  const medicine = {
    dosage_unit: stock.dosageUnit,
    units_per_ml: stock.unitsPerMl,
    dosage_per_pill: stock.dosagePerPill,
  };

  const dailyIntake = calculateDailyIntake(medicineId, protocols, medicine);
  if (dailyIntake <= 0) return null;

  const daysRemaining = calculateDaysRemaining(stock.qty, dailyIntake);
  if (!Number.isFinite(daysRemaining) || daysRemaining >= 7) return null;

  // Dose-primário (ADR-067): exibir DOSES restantes (saldo ÷ tamanho de uma tomada),
  // não o saldo cru em ml rotulado "doses". Líquido converte a dose p/ ml (mesma
  // unidade do saldo); sólido usa unidades. Densidade ausente → doseToMl devolve a
  // dose crua (sem chute); fallback p/ saldo cru se não houver tamanho de dose.
  const rep = protocols[0] || {};
  const dosePorTomada = rep.dosage_per_intake || 1;
  const doseSize = isLiquidMedicine(medicine)
    ? doseToMl(dosePorTomada, rep.intake_unit, medicine.units_per_ml, medicine.dosage_per_pill)
    : dosePorTomada;
  // cleanFloat antes do floor (R-277): sem isso a dízima de float (0,3÷0,1=2,9999…)
  // gera off-by-one no nº de doses exibido.
  const dosesRemaining = doseSize > 0
    ? Math.floor(cleanFloat(stock.qty / doseSize))
    : Math.floor(stock.qty);

  return {
    medicineName: stock.name,
    remaining: dosesRemaining,
    daysRemaining
  };
}

async function _processUserStockAlert(userId, medicineId, stock, protocols, dispatcher, correlationId) {
  const data = _computeStockAlertPayload(medicineId, stock, protocols);
  if (!data) return;

  logger.info(`Disparando alerta de estoque baixo: ${data.medicineName} (${data.daysRemaining} dias / ${data.remaining} doses)`, {
    userId, medicineId, correlationId
  });

  await dispatcher.dispatch({
    userId, kind: 'stock_alert', data, context: { correlationId, jobType: 'stock_alert_dispatcher' }
  });
}

export function _buildProtocolsAndStockMaps(allProtocols, allStock) {
  const protocolsByMedicine = {};
  for (const p of allProtocols || []) {
    const key = `${p.user_id}_${p.medicine_id}`;
    if (!protocolsByMedicine[key]) protocolsByMedicine[key] = [];
    protocolsByMedicine[key].push(p);
  }

  const stockByMedicine = {};
  for (const s of allStock || []) {
    const key = `${s.user_id}_${s.medicine_id}`;
    if (!stockByMedicine[key]) {
      // Campos do medicine p/ conversão líquida (012 B4 / R-267): unitsPerMl/dosageUnit/
      // dosagePerPill alimentam calculateDailyIntake + doseToMl no alerta de estoque.
      const med = s.medicine || {};
      stockByMedicine[key] = {
        qty: 0,
        name: med.name || 'Medicamento',
        unitsPerMl: med.units_per_ml,
        dosageUnit: med.dosage_unit,
        dosagePerPill: med.dosage_per_pill,
      };
    }
    stockByMedicine[key].qty += Number(s.quantity || 0);
  }

  return { protocolsByMedicine, stockByMedicine };
}

// 012 Fase A (ADR-059): dias restantes até a expiração biológica do lote.
// Espelha biologicalExpiryDaysLeft do @dosiq/core (server não importa o core).
// null = eixo inativo (lote fechado, sem TTL, data inválida ou clock skew).
// Exportada desde o 050 PR 2: o enqueue e o content builder da outbox usam o MESMO cálculo do
// legado — duas implementações fariam o SC-003 comparar contas diferentes, não caminhos.
export function _biologicalExpiryDaysLeft(stockRow) {
  const openedAt = stockRow?.opened_at;
  const shelfDays = Number(stockRow?.medicine?.shelf_life_days);
  if (!openedAt || !Number.isFinite(shelfDays) || shelfDays <= 0) return null;
  const opened = parseISO(openedAt);
  if (Number.isNaN(opened.getTime())) return null;
  const nowMs = Date.now();
  if (opened.getTime() > nowMs) return null;
  const MS_DAY = 24 * 60 * 60 * 1000;
  const expiresAtMs = opened.getTime() + shelfDays * MS_DAY;
  // Diferença por DATA-CALENDÁRIO em America/Sao_Paulo, não por janelas de 24h
  // sobre o instante do cron (review Gemini #658: atraso do cron fazia floor()
  // pular de 3 pra 2 e silenciar o D-3 — cadência === 3 || === 0 exige dia exato).
  const dayKey = (ms) => {
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
      .format(ms).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((dayKey(expiresAtMs) - dayKey(nowMs)) / MS_DAY);
}

async function _processBiologicalExpiryAlerts(allStock, dispatcher, correlationId) {
  for (const lot of allStock || []) {
    try {
      if (Number(lot.quantity || 0) <= 0) continue;
      const daysLeft = _biologicalExpiryDaysLeft(lot);
      if (daysLeft === null) continue;
      // Cadência D-3 + vencimento (FR-004b): cada condição ocorre 1 dia só.
      if (daysLeft !== 3 && daysLeft !== 0) continue;

      const medicineName = lot.medicine?.name || 'Medicamento';
      logger.info(`Disparando alerta de validade biológica: ${medicineName} (daysLeft=${daysLeft})`, {
        userId: lot.user_id, medicineId: lot.medicine_id, correlationId
      });

      await dispatcher.dispatch({
        userId: lot.user_id,
        kind: 'stock_expiry_alert',
        data: { medicineName, daysLeft },
        context: { correlationId, jobType: 'stock_expiry_alert_dispatcher' }
      });
    } catch (err) {
      // Best-effort por lote (R-245): um lote com erro não derruba a varredura.
      logger.error('Erro ao processar alerta de validade biológica', err, {
        userId: lot?.user_id, medicineId: lot?.medicine_id, correlationId
      });
    }
  }
}

// Página de leitura do PostgREST. AP-186: sem `.range()` a resposta é TRUNCADA em ~1000 linhas
// SEM erro — a varredura simplesmente deixaria de ver o estoque de parte dos usuários, em silêncio.
/**
 * Usuários elegíveis a alerta de estoque (volume e validade).
 *
 * 044 (FR-006 / PO-4): a preferência vem no MESMO fetch de settings — nenhuma query extra.
 * Usuário em modo dose-only não recebe NENHUM alerta de estoque. Fail-safe (AP-277): coluna
 * ausente/NULL → tratado como TRACKING LIGADO (paridade com o COALESCE das RPCs atômicas).
 * A ausência de dado nunca silencia alerta por omissão.
 */
export async function _fetchStockTrackingUsers(correlationId) {
  // Paginado (AP-186): acima de ~1000 linhas o PostgREST TRUNCA sem erro e os usuários do fim da
  // lista perderiam alerta de estoque em silêncio — a falha mais cara possível aqui.
  let users: any[] = [];
  let usersErr: any = null;
  try {
    users = await _fetchAllPages(
      'user_settings',
      'user_id, timezone, notification_mode, stock_tracking_enabled'
    );
  } catch (err) {
    usersErr = err;
  }

  if (usersErr || !users || users.length === 0) {
    logger.info('Nenhum usuário encontrado em user_settings para alertas de estoque', { correlationId });
    return [];
  }

  const trackingUsers = users.filter((u: any) => u.stock_tracking_enabled !== false);
  const doseOnlySkipped = users.length - trackingUsers.length;

  if (trackingUsers.length === 0) {
    logger.info('Nenhum usuário com controle de estoque ativo — alertas de estoque pulados', { correlationId });
    return [];
  }

  logger.info(`Verificando alertas de estoque para ${trackingUsers.length} usuários`, {
    correlationId, doseOnlySkipped
  });
  return trackingUsers;
}

/**
 * Varredura de candidatos a alerta de estoque para um conjunto de usuários já filtrado.
 *
 * 050 PR 1b: extraída de `checkStockAlertsViaDispatcher` para que o LEGADO e o ENQUEUE da outbox
 * chamem a MESMA função — sem isso o SC-003 (nenhum alerta a menos pós-cutover) compararia duas
 * implementações de varredura em vez de dois caminhos de entrega.
 */
export async function _scanStockAlertCandidates(users, correlationId) {
  const userIds = (users || []).map(u => u.user_id);
  if (userIds.length === 0) {
    return { protocolsByMedicine: {}, stockByMedicine: {}, allStock: [], allProtocols: [] };
  }

  // R-267 read-path: intake_unit + active (calculateDailyIntake filtra p.active e
  // converte por intake_unit); units_per_ml/dosage_unit/dosage_per_pill p/ a conversão
  // líquida (ADR-065/ADR-067 — antes o cron contava UI cru contra ml).
  // 050 US4 (FR-009): tratamento ENCERRADO ou PAUSADO não gera alerta de estoque.
  // `active = true` não basta — `end_date` vencida e `paused_at` preenchido convivem com ele
  // (4 protocolos em prod alertavam diariamente desde ~25/07).
  // Data local via Intl (R-020/R-254): `end_date` é `date`; usar `new Date()`/UTC do servidor
  // faria a data virar o dia seguinte às 21h em GMT−3 e encerraria o tratamento cedo demais.
  // ⚠️ UMA data para todos: este select é uma única query com `.in('user_id', ...)`, então não
  // dá para embutir a tz de cada usuário. Hoje é exato — os 42 usuários são UTC−3 sem DST. Se
  // um dia houver usuário fora do BR, a borda é de ≤24h e a correção é filtrar por usuário
  // DEPOIS da query, não trocar a data desta cláusula.
  const todayLocal = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })
    .format(Date.now());

  const allProtocols = await _fetchAllPagesByUsers(
    'protocols',
    'id, user_id, medicine_id, time_schedule, dosage_per_intake, intake_unit, frequency, weekdays, active, end_date, paused_at',
    userIds,
    (q) => q
      .eq('active', true)
      .is('paused_at', null)
      // O `.or` é obrigatório: `end_date IS NULL` é a MAIORIA dos protocolos — um `.gte` sozinho
      // excluiria todos eles e a correção viraria omissão TOTAL dos alertas.
      .or(`end_date.is.null,end_date.gte.${todayLocal}`)
  );

  // 🔴 050 PR 2: o `id` do LOTE é OBRIGATÓRIO no select. Ele é o `subject_id` do alerta de
  // validade (1 alerta por lote). Sem ele o `subject_id` viria `undefined`, todas as linhas do
  // dia colidiriam na UNIQUE como `(user, kind, dia, NULL)` e o usuário receberia UM alerta de
  // validade em vez de N — exatamente o Gap 1 que a spec 050 existe para fechar.
  const allStock = await _fetchAllPagesByUsers(
    'stock',
    'id, user_id, medicine_id, quantity, opened_at, medicine:medicines(name, shelf_life_days, units_per_ml, dosage_unit, dosage_per_pill)',
    userIds
  );

  const { protocolsByMedicine, stockByMedicine } = _buildProtocolsAndStockMaps(allProtocols, allStock);
  logger.info('Varredura de candidatos a alerta de estoque concluída', {
    correlationId, users: userIds.length, protocols: allProtocols.length, stockRows: allStock.length
  });
  return { protocolsByMedicine, stockByMedicine, allStock, allProtocols };
}

export async function checkStockAlertsViaDispatcher(dispatcher, correlationId) {
  try {
    const trackingUsers = await _fetchStockTrackingUsers(correlationId);
    if (trackingUsers.length === 0) return;

    const { protocolsByMedicine, stockByMedicine, allStock } =
      await _scanStockAlertCandidates(trackingUsers, correlationId);

    for (const key in stockByMedicine) {
      const [userId, medicineId] = key.split('_');
      const stock = stockByMedicine[key];
      const protocols = protocolsByMedicine[key] || [];

      if (protocols.length === 0) continue;

      await _processUserStockAlert(userId, medicineId, stock, protocols, dispatcher, correlationId);
    }

    // 012 Fase A (ADR-059): validade biológica (TTL pós-abertura) — eixo POR LOTE,
    // paralelo ao alerta de volume acima. Cadência sem estado extra: o cron é
    // diário, então daysLeft === 3 (D-3) e daysLeft === 0 (vence hoje) ocorrem em
    // exatamente 1 execução cada. Lote já vencido há dias (daysLeft < 0) não
    // re-alerta (sem spam retroativo). Lote vazio (quantity <= 0) não interessa.
    await _processBiologicalExpiryAlerts(allStock, dispatcher, correlationId);

    logger.info('Verificação de alertas de estoque concluída', { correlationId });
  } catch (err) {
    logger.error('Erro em checkStockAlertsViaDispatcher', err, { correlationId });
  }
}
