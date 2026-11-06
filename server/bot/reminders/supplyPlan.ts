// Spec 105 — plano de compra e aviso de dose mensal: leitura e decisão compartilhadas entre o
// ENQUEUE (10:00 local) e o BUILDER do drain (revalida no envio, FR-005). Uma implementação só:
// se as duas pontas decidissem com código diferente, o builder descartaria o que o enqueue mandou
// (ou deixaria passar o que ele não mandaria) e ninguém veria a divergência.
//
// A REGRA (elegibilidade, data D) mora no core (`stockRunway.ts`, INV-1). Aqui só há I/O e a
// tradução de D em "quantos dias faltam" no fuso do usuário (R-020 / E-6).

import { computeSupplyDate, isStockRunwayAlertExpected } from '@dosiq/core';
import { _fetchAllPagesByUsers } from './_pagination.js';

/** Colunas de `dose_instances` verificadas no banco de prod (R-295, analysis-A C-1/C-2). */
export const DOSE_INSTANCE_SCAN_COLUMNS =
  'id, user_id, protocol_id, medicine_id, scheduled_for, expected_dose, status';

/** Em quais dias antes de D o lembrete de compra sai (FR-004; mensal: D-2 vai no aviso, AC-2). */
export const PURCHASE_OFFSETS: Readonly<Record<'sparse' | 'step_switch', readonly number[]>> = Object.freeze({
  step_switch: [2, 1],
  sparse: [1],
});

/** Antecedência do aviso de dose mensal (US-1). */
export const MONTHLY_HEADS_UP_DAYS = 2;

/** Data local YYYY-MM-DD de um instante no fuso dado. */
export function localDate(at: Date | string, tz: string): string {
  // eslint-disable-next-line no-restricted-syntax -- instante absoluto (timestamptz/Date), não date-only
  const ms = typeof at === 'string' ? new Date(at).getTime() : at.getTime();
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(ms);
}

/** Dias de calendário de `from` até `to` (YYYY-MM-DD), em UTC puro — imune a DST. */
export function daysBetween(from: string, to: string): number {
  const toUtc = (d: string) => {
    const [y, m, day] = d.split('-').map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86400000);
}

/** Saldos do usuário no formato do core (soma dos lotes já feita por `_buildProtocolsAndStockMaps`). */
export function runwayStocksOf(userId: string, stockByMedicine: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  const prefix = `${userId}_`;
  for (const key in stockByMedicine) {
    if (!key.startsWith(prefix)) continue;
    const s = stockByMedicine[key];
    out[key.slice(prefix.length)] = {
      qty: Number(s.qty || 0),
      dosage_unit: s.dosageUnit,
      units_per_ml: s.unitsPerMl,
      dosage_per_pill: s.dosagePerPill,
    };
  }
  return out;
}

/** Pares (usuário, medicamento) em que acabar o estoque é o plano — os únicos que geram compra. */
export function eligiblePurchaseMedicines(
  protocolsByMedicine: Record<string, any[]>,
  stepsByUser: Record<string, any[]>,
): Array<{ userId: string; medicineId: string }> {
  const out: Array<{ userId: string; medicineId: string }> = [];
  for (const key in protocolsByMedicine) {
    const [userId, medicineId] = key.split('_');
    if (!isStockRunwayAlertExpected(medicineId, protocolsByMedicine[key], stepsByUser[userId] || [])) {
      out.push({ userId, medicineId });
    }
  }
  return out;
}

/**
 * Doses pendentes de agora em diante, só dos medicamentos pedidos (C-7: nada de varrer a agenda de
 * todo mundo). Paginado (AP-186). `fromIso` recua 1 dia para não perder a dose de hoje em fuso
 * adiantado; o core descarta o que for de antes de hoje local.
 */
export async function _fetchPendingInstances(
  userIds: string[],
  medicineIds: string[],
  fromIso: string,
  toIso?: string,
): Promise<any[]> {
  if (userIds.length === 0 || medicineIds.length === 0) return [];
  return _fetchAllPagesByUsers('dose_instances', DOSE_INSTANCE_SCAN_COLUMNS, userIds, (q) => {
    let r = q.eq('status', 'pending').in('medicine_id', medicineIds).gte('scheduled_for', fromIso);
    if (toIso) r = r.lt('scheduled_for', toIso);
    return r;
  });
}

export interface PlannedPurchase {
  /** Medicamento a COMPRAR (escada: o da etapa seguinte). */
  medicineId: string;
  date: string;
  reason: 'sparse' | 'step_switch';
  daysUntil: number;
  /** Tratamento de origem (id opaco do push, C-12). */
  protocolId: string;
}

/**
 * Lembretes de compra que vencem HOJE para um usuário (D-2/D-1 conforme o motivo).
 * `onNoDate` recebe os medicamentos elegíveis sem data (AC-4) — o chamador loga, ninguém inventa D.
 */
export function planPurchasesForUser(params: {
  userId: string;
  protocolsByMedicine: Record<string, any[]>;
  stockByMedicine: Record<string, any>;
  steps: any[];
  instances: any[];
  tz: string;
  now: Date;
  onNoDate?: (medicineId: string) => void;
}): PlannedPurchase[] {
  const { userId, protocolsByMedicine, stockByMedicine, steps, instances, tz, now, onNoDate } = params;
  const stocks = runwayStocksOf(userId, stockByMedicine);
  const today = localDate(now, tz);
  const byMedicine = new Map<string, PlannedPurchase>();

  for (const { userId: owner, medicineId } of eligiblePurchaseMedicines(protocolsByMedicine, { [userId]: steps })) {
    if (owner !== userId) continue;
    const r = computeSupplyDate({
      medicineId,
      protocols: protocolsByMedicine[`${userId}_${medicineId}`],
      steps,
      instances,
      stocks,
      tz,
      now,
    });
    if (r.status === 'no_date') onNoDate?.(medicineId);
    if (r.status !== 'due') continue;
    const daysUntil = daysBetween(today, r.date);
    if (!PURCHASE_OFFSETS[r.reason].includes(daysUntil)) continue;
    // Dois remédios de origem apontando para a MESMA compra (ex.: duas escadas trocando para o mesmo
    // medicamento) = um lembrete só (FR-004: no máximo 1 por medicamento por dia).
    if (!byMedicine.has(r.medicineId)) {
      byMedicine.set(r.medicineId, { medicineId: r.medicineId, date: r.date, reason: r.reason, daysUntil, protocolId: r.protocolId });
    }
  }
  return [...byMedicine.values()];
}
