/**
 * Partição de doses por bloco semântico para notificações agrupadas.
 *
 * Regra (Master Plan §3 P2 — Wave N1):
 *   1. Planos com ≥2 doses → 1 bloco `by_plan` por plano
 *   2. Sobra (sem plano OU plano com 1 dose só):
 *      - Se cada item da sobra tem treatment_plan_id próprio E sobra ≤ 3
 *        → individuais (preserva identidade do plano — cenário G)
 *      - Se sobra ≥ 2 (sem planos próprios por item) → 1 bloco `misc`
 *      - Se sobra = 1 → 1 bloco `individual`
 *      - Se sobra = 0 → nada
 *   3. Caso especial: 1 dose total no minuto → sempre `individual`
 *
 * @typedef {Object} DoseEntry
 * @property {string} protocolId
 * @property {string} protocolName
 * @property {string} medicineName
 * @property {string|null} treatmentPlanId
 * @property {string|null} treatmentPlanName
 * @property {number} dosagePerIntake
 * @property {string} medicineId
 *
 * @typedef {Object} DoseBlock
 * @property {'by_plan'|'misc'|'individual'} kind
 * @property {string|null} planId
 * @property {string|null} planName
 * @property {DoseEntry[]} doses
 *
 * @param {DoseEntry[]} doses - Todas as doses do minuto corrente para 1 usuário
 * @returns {DoseBlock[]}
 */
export function partitionDoses(doses) {
  if (!doses || doses.length === 0) return [];

  // Caso especial: 1 dose total → individual (não vale agrupar)
  if (doses.length === 1) {
    return [{ kind: 'individual', planId: null, planName: null, doses }];
  }

  // Agrupar doses por treatment_plan_id (apenas com plan)
  const byPlan = new Map(); // planId → { planName, doses[] }
  const orphans = []; // doses sem plano OU de planos com apenas 1 dose (definido após agrupamento)

  for (const dose of doses) {
    if (dose.treatmentPlanId) {
      if (!byPlan.has(dose.treatmentPlanId)) {
        byPlan.set(dose.treatmentPlanId, { planName: dose.treatmentPlanName, doses: [] });
      }
      byPlan.get(dose.treatmentPlanId).doses.push(dose);
    } else {
      orphans.push(dose);
    }
  }

  const blocks = [];

  // Planos com ≥2 doses → bloco by_plan; planos com 1 dose → vão para sobra
  for (const [planId, { planName, doses: planDoses }] of byPlan.entries()) {
    if (planDoses.length >= 2) {
      blocks.push({ kind: 'by_plan', planId, planName, doses: planDoses });
    } else {
      // Plano com 1 dose cai na sobra
      orphans.push(...planDoses);
    }
  }

  // Processar sobra (orphans)
  if (orphans.length === 0) {
    return blocks;
  }

  if (orphans.length === 1) {
    blocks.push({ kind: 'individual', planId: null, planName: null, doses: orphans });
    return blocks;
  }

  // Cenário G: sobra ≤ 3 e cada item tem treatment_plan_id próprio distinto
  // → emitir individuais para preservar identidade do plano
  const allHaveOwnPlan = orphans.every(d => d.treatmentPlanId !== null && d.treatmentPlanId !== undefined);
  const allDistinctPlans = allHaveOwnPlan &&
    new Set(orphans.map(d => d.treatmentPlanId)).size === orphans.length;

  if (allDistinctPlans && orphans.length <= 3) {
    for (const dose of orphans) {
      blocks.push({
        kind: 'individual',
        planId: dose.treatmentPlanId,
        planName: dose.treatmentPlanName,
        doses: [dose],
      });
    }
    return blocks;
  }

  // Caso geral: sobra ≥ 2 → 1 bloco misc consolidado
  blocks.push({ kind: 'misc', planId: null, planName: null, doses: orphans });
  return blocks;
}
