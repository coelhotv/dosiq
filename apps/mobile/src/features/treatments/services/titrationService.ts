// titrationService.ts — CRUD mobile da Evolução do tratamento (titulação N2, spec 029 / F4).
//
// Thin wrapper sobre createTitrationRepository de @dosiq/core/repositories (mesmo padrão do
// protocolService: DI mobile = nativeSupabaseClient + getUserId via supabase.auth).
//
// 🔴 T019a (AP-301): a ATIVAÇÃO da escada é responsabilidade da UI. A etapa 0 nasce
// `status='current'` COM `started_at` setado — sem isso a titulação nasce ZUMBI (status diz
// "titulando", o relógio nunca começa, nada avança, sem erro). O CHECK
// `titration_steps_current_exige_started_check` (status<>'current' OR started_at IS NOT NULL) já
// recusa o zumbi no banco (23514), mas o smoke, não o teste — o client é mockado. `createFullLadder`
// centraliza a regra pra que nenhum caminho de escrita a esqueça de novo.
//
// 🔴 A5 / CON-032: `titration_steps.protocol_id` é o FILTRO do embed que o motor lê. Toda etapa do
// run same-med a partir da etapa 0 (mesmo `medicine_id` do protocolo) recebe `protocol_id` = o
// protocolo, senão o `dose_change` automático nunca enxerga a próxima etapa (repete o AP-298 em
// silêncio). Etapa de OUTRO medicamento (medicine_switch) fica com `protocol_id` NULL até a RPC de
// confirmação (F5) criar o protocolo executor.

import {
  createTitrationRepository,
  getNow,
  createDoseInstanceRepository,
  resyncProtocolWindow,
  resolveUserTz,
} from '@dosiq/core'
import { supabase } from '@platform/supabase/nativeSupabaseClient'
import type { TitrationStepCreate } from '@dosiq/core'

// TODO(040-strict): mesma duplicata de @supabase/supabase-js do protocolService — cast de fronteira.
 
const typedClient = supabase as any

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  const user = data?.user
  if (error || !user) throw new Error('Sessão expirada. Faça login novamente.')
  return user.id
}

export const titrationRepo = createTitrationRepository({ client: typedClient, getUserId })

/**
 * Unidade de tomada de uma etapa a partir do medicamento (§4.2 "a unidade segue o medicamento").
 *
 * 🔴 AP-299: o vocabulário da ESCADA (`titration_steps.intake_unit` = gotas/ml/UI/mg/**cp**) NÃO é
 * o do protocolo (`protocols.intake_unit` = gotas/ml/UI/mg, comprimido = NULL). Aqui comprimido é
 * `'cp'` explícito. A fronteira inversa (`NULLIF(unit,'cp')`) é da RPC de transição (F5), não da UI.
 *   - sólido → `'cp'` (comprimido)
 *   - líquido → a massa da concentração: `mg/ml`→`'mg'`, `ui/ml`→`'UI'`
 */
 
export function deriveStepIntakeUnit(medicine: any): string {
  const dosageUnit: string = medicine?.dosage_unit ?? ''
  if (!dosageUnit.endsWith('/ml')) return 'cp' // sólido
  const mass = dosageUnit.split('/')[0] // 'mg' | 'ui'
  return mass === 'ui' ? 'UI' : mass
}

/** Etapa como o builder do form a produz (sem campos de servidor). */
export interface LadderStepInput {
  medicine_id: string
  dose: number
  intake_unit: string
  duration_days: number | null // null = etapa contínua (sem fim)
}

/**
 * Cria a escada inteira de um tratamento existente (T019/T019a).
 *
 * - Cria a `titrations` (âncora opcional no plano terapêutico).
 * - Insere as etapas em UM INSERT. A etapa 0 nasce `status='current'` + `started_at=now` (ATIVAÇÃO
 *   — AP-301). As demais nascem `upcoming`.
 * - `protocol_id` (A5): a etapa 0 e toda etapa contígua com o MESMO `medicine_id` do protocolo
 *   recebem `protocol_id`; a primeira etapa de outro medicamento (e as seguintes) ficam NULL.
 *
 * @param protocolId  o tratamento a que a escada se ancora (a etapa vigente executa por ele)
 * @param medicineId  o medicamento do protocolo (define o run same-med da etapa 0)
 * @param steps       etapas do builder, já em ordem de posição
 * @param treatmentPlanId  plano terapêutico do protocolo (opcional)
 */
export type LadderRow = TitrationStepCreate & {
  titration_id: string
  // `pending_confirmation`: só no gatilho manual do F5.5 (etapa criada a partir de uma vigente
  // contínua). O cadastro inicial nunca o usa — ali a etapa 0 é `current` e as demais `upcoming`.
  status: 'upcoming' | 'current' | 'pending_confirmation'
  started_at: string | null
  protocol_id: string | null
}

/**
 * Monta as linhas de `titration_steps` de uma escada nova (PURO — sem I/O, testável direto).
 *
 * 🔴 T019a (AP-301): a etapa 0 nasce `status='current'` + `started_at=nowIso`. As demais, `upcoming`
 * + `started_at=null`.
 * 🔴 A5/CON-032: `protocol_id` = o protocolo enquanto a etapa pertence ao run same-med a partir da
 * etapa 0 (mesmo `medicine_id`, contíguo). A primeira etapa de OUTRO medicamento (e as seguintes)
 * fica NULL — a RPC de transição (F5) cria o protocolo executor e preenche o vínculo.
 */
export function buildLadderRows(
  titrationId: string,
  protocolId: string,
  medicineId: string,
  steps: LadderStepInput[],
  nowIso: string,
): LadderRow[] {
  let sameMedRunOpen = true
  return steps.map((s, index): LadderRow => {
    const matchesProtocol = sameMedRunOpen && s.medicine_id === medicineId
    if (!matchesProtocol) sameMedRunOpen = false
    // 🔴 A etapa 0 é a VIGENTE (âncora): SEMPRE pertence ao protocolo, mesmo que o medicamento
    // divirja. Sem isso, uma escada cujo 1º passo não bate com o medicamento do protocolo nasceria
    // ÓRFÃ (protocol_id NULL) — `getLadderForProtocol` (filtra por protocol_id) nunca a acharia:
    // invisível na timeline/badge, sem executor pro motor, e o form voltaria a oferecer cadastro do
    // zero (duplicata). Normalmente o passo 0 já é o medicamento do protocolo (seed do form); isto
    // guarda o caso em que o usuário troca o medicamento do 1º passo (AP-301/CON-032).
    const belongsToProtocol = index === 0 || matchesProtocol
    return {
      titration_id: titrationId,
      position: index,
      medicine_id: s.medicine_id,
      dose: s.dose,
      intake_unit: s.intake_unit,
      duration_days: s.duration_days,
      status: index === 0 ? 'current' : 'upcoming',
      started_at: index === 0 ? nowIso : null,
      protocol_id: belongsToProtocol ? protocolId : null,
    }
  })
}

export async function createFullLadder(
  protocolId: string,
  medicineId: string,
  steps: LadderStepInput[],
  treatmentPlanId: string | null = null,
) {
  if (steps.length === 0) throw new Error('A escada precisa de ao menos uma etapa.')

  const titration = await titrationRepo.create({ treatment_plan_id: treatmentPlanId })
  const rows = buildLadderRows(titration.id, protocolId, medicineId, steps, getNow().toISOString())
  const created = await titrationRepo.createSteps(rows)

  // 052 (FR-007, achado do RC6 no PR #761) — TERCEIRO caminho de escrita fora do repositório, e o
  // de maior impacto: quando a escada é cadastrada, o protocolo JÁ existe e sua janela JÁ foi
  // materializada (~30d, sem escada nenhuma). Todas essas instâncias carregam a dose chapada
  // `dosage_per_intake` e o medicamento do protocolo — inclusive os dias que a etapa 0 nem cobre.
  // Nada as corrigia depois: o `syncInstancesOnWrite` só dispara em `update()` de protocolo, e o
  // cron/rede lazy usam `ON CONFLICT DO NOTHING` (preenchem buraco, não consertam linha existente).
  //
  // Antes da 052 o dano era só na dose; com o medicamento congelado, a instância errada vira
  // permanente também na identidade — ou seja, esta spec AGRAVA o defeito se não o fechar aqui.
  // É literalmente o fluxo do AP-301 ("adicionei a escada depois"), que é o fluxo REAL do usuário.
  await _resyncProtocolInstances(protocolId)

  return { titration, steps: created }
}

// Etapa da escada com o medicamento embutido (pra timeline — T020). O embed do PROTOCOLO
// (createProtocolRepository) traz só id/position/dose/duration_days/status/started_at, SEM o
// medicamento nem intake_unit; a timeline precisa do nome e da unidade, então lê a escada inteira.
export interface LadderStepWithMedicine {
  id: string
  titration_id: string
  medicine_id: string
  protocol_id: string | null
  position: number
  dose: number
  intake_unit: string
  duration_days: number | null
  status: string
  started_at: string | null
  ended_at: string | null

  medicine: any
}

// ⚠️ R-295: select NOVO com nomes de coluna + embed `medicines`. Colunas de titration_steps
// verificadas no banco (information_schema, 2026-07-17): titration_id, medicine_id, protocol_id,
// position, dose, intake_unit, duration_days, status, started_at, ended_at existem todas. O embed
// `medicine:medicines(...)` é via FK `titration_steps.medicine_id`. `presentation` (medicines) é
// obrigatório no embed: MedicineIcon prioriza presentation p/ a forma (injetável→seringa); sem ela
// cai no legado dosage_unit LIKE '%/ml'→droplets (Mounjaro ui/ml mostraria gotas). GATE C4: executar
// contra o PostgREST real antes do merge (edição T019 depende de titration_id/medicine_id/protocol_id).
const LADDER_SELECT = `
  id,
  steps:titration_steps(
    id, titration_id, medicine_id, protocol_id, position, dose, intake_unit, duration_days,
    status, started_at, ended_at,
    medicine:medicines(id, name, type, presentation, dosage_unit, dosage_per_pill, concentration_volume_ml, units_per_ml)
  )
`

/**
 * Escada vinculada a um protocolo, com os medicamentos embutidos (timeline T020).
 *
 * Descobre a `titration` pelo primeiro step cujo `protocol_id` = o protocolo (a etapa vigente
 * sempre tem — T019a), depois lê a escada INTEIRA (todas as etapas, inclusive as de outro
 * medicamento ainda sem `protocol_id`) ordenada por `position`.
 *
 * @returns as etapas ordenadas, ou `[]` quando o protocolo não tem escada.
 */
export async function getLadderForProtocol(protocolId: string): Promise<LadderStepWithMedicine[]> {
  const userId = await getUserId()

  const { data: link, error: linkError } = await typedClient
    .from('titration_steps')
    .select('titration_id')
    .eq('protocol_id', protocolId)
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (linkError) throw linkError
  if (!link) return []

  const { data, error } = await typedClient
    .from('titrations')
    .select(LADDER_SELECT)
    .eq('id', link.titration_id)
    .eq('user_id', userId)
    // O embed é ALIASADO (`steps:titration_steps`) — o PostgREST espera o ALIAS aqui; com o nome da
    // tabela o order é silenciosamente ignorado. Consumidores ordenam por `position` no cliente de
    // qualquer forma (defesa em profundidade), então isto é correção de contrato, não de sintoma.
    .order('position', { referencedTable: 'steps', ascending: true })
    .single()

  if (error) throw error
  return (data?.steps ?? []) as LadderStepWithMedicine[]
}

// ─── T019 · edição da escada existente ────────────────────────────────────────
//
// A edição toca SÓ o futuro. Guard (plan A4:247): etapa `current`/`completed` é histórico de doses
// (read-only, congelada). O usuário edita/remove/adiciona etapas `upcoming`/`pending_confirmation`
// — sempre o SUFIXO contíguo depois da vigente. A escada é linear: as congeladas ocupam o prefixo
// de posições (0..k-1), as editáveis o sufixo (k..n).

/** Etapa da escada como o banco a guarda (o que a edição precisa comparar). */
export interface ExistingLadderStep {
  id: string
  position: number
  status: string
  medicine_id: string
  dose: number
  intake_unit: string
  duration_days: number | null
  protocol_id: string | null
}

/** Etapa editável desejada pelo builder. `id` presente = etapa upcoming já persistida; ausente = nova. */
export interface DesiredEditableStep {
  id?: string
  medicine_id: string
  dose: number
  intake_unit: string
  duration_days: number | null
}

export interface StepUpdate {
  id: string
  updates: {
    position?: number
    medicine_id?: string
    dose?: number
    intake_unit?: string
    duration_days?: number | null
    protocol_id?: string | null
  }
}

export interface LadderEditPlan {
  toDelete: string[]
  toUpdate: StepUpdate[]
  toCreate: LadderRow[]
  /**
   * 052 (FR-007b): protocolo DONO da escada, carregado no plano para que `saveLadderEdit` possa
   * reprojetar a janela futura sem receber um segundo argumento. Editar uma etapa futura muda a
   * dose/medicamento que vai reger dias já materializados — sem o resync, as pending futuras
   * ficam com o cronograma antigo congelado (a escrita vai direto em `titration_steps`, fora do
   * `update()` do protocolo, logo o `syncInstancesOnWrite` nunca dispara — classe AP-308).
   */
  protocolId: string
}

const FROZEN_STATUS = new Set(['current', 'completed'])

/** Diff de uma etapa persistida vs. o desejado → só os campos que mudaram (extraído p/ baixar a
 * complexidade de `buildLadderEditPlan`). Retorna `null` quando nada mudou. */
function diffEditableStep(
  prev: ExistingLadderStep,
  desired: DesiredEditableStep,
  position: number,
  protocolId: string | null,
): StepUpdate['updates'] | null {
  const updates: StepUpdate['updates'] = {}
  if (prev.position !== position) updates.position = position
  if (prev.medicine_id !== desired.medicine_id) updates.medicine_id = desired.medicine_id
  if (Number(prev.dose) !== desired.dose) updates.dose = desired.dose
  if (prev.intake_unit !== desired.intake_unit) updates.intake_unit = desired.intake_unit
  if ((prev.duration_days ?? null) !== (desired.duration_days ?? null)) updates.duration_days = desired.duration_days
  if ((prev.protocol_id ?? null) !== protocolId) updates.protocol_id = protocolId
  return Object.keys(updates).length > 0 ? updates : null
}

/**
 * Monta o plano de reconciliação de uma edição da escada (PURO — sem I/O, testável direto).
 *
 * 🔴 Guard: as etapas `current`/`completed` (prefixo congelado) NUNCA entram no plano — nem update,
 * nem delete. Só o sufixo editável (`upcoming`/`pending_confirmation`) é reconciliado.
 * 🔴 A5/CON-032: `protocol_id` recalculado no caminho — enquanto o run same-med (mesmo `medicine_id`
 * do protocolo) segue aberto a partir da etapa 0, a etapa recebe `protocol_id`; a primeira etapa de
 * OUTRO medicamento (e as seguintes) fica NULL. O prefixo congelado abre/fecha o run antes do sufixo.
 * 🔴 As novas etapas nascem `upcoming` + `started_at=null` (a ativação foi da etapa 0 no cadastro —
 * a edição não mexe na vigente, então o CHECK `current⇒started_at` nunca é tocado aqui).
 *
 * 🔴 EXCEÇÃO F5.5 (`firstNewStepPending`): quando a etapa vigente é CONTÍNUA, a PRIMEIRA etapa
 * criada nasce `pending_confirmation` — só ela. É o gatilho manual de saída da manutenção
 * (Decisões §7.4): contínua nunca vence, então o cron jamais marcaria essa pendência sozinho, e
 * sem ela a etapa nasceria `upcoming` inalcançável (o beco). As DEMAIS seguem `upcoming`: ao
 * iniciar a primeira (se tiver duração), o motor reassume e o resto volta a ser automático — o
 * gatilho manual serve só para SAIR da contínua.
 * A etapa fica INERTE até o toque (`resolveTitrationAdvance` → null com vigente contínua).
 *
 * Posições: reindex do sufixo a partir de `basePos` (= última congelada + 1). Como o builder só faz
 * append/remove/edit-in-place (sem reorder nem insert no meio), o sufixo só desloca PARA BAIXO ou
 * mantém — a ordem de escrita delete → update(asc position) → create em `saveLadderEdit` não colide
 * com o índice único `(titration_id, position)`.
 */
export function buildLadderEditPlan(
  titrationId: string,
  protocolId: string,
  protocolMedicineId: string,
  existing: ExistingLadderStep[],
  desired: DesiredEditableStep[],
  /** F5.5: vigente contínua → a 1ª etapa CRIADA nasce `pending_confirmation` (ver doc acima). */
  firstNewStepPending = false,
): LadderEditPlan {
  const ordered = [...existing].sort((a, b) => a.position - b.position)
  const frozen = ordered.filter((s) => FROZEN_STATUS.has(s.status))
  const editableExisting = ordered.filter((s) => !FROZEN_STATUS.has(s.status))

  const basePos = frozen.length > 0 ? Math.max(...frozen.map((s) => s.position)) + 1 : 0
  // Run same-med ainda aberto depois do prefixo congelado? Só se toda etapa congelada é do
  // medicamento do protocolo (o prefixo começa na posição 0 = etapa vigente/histórico do protocolo).
  let runOpen = frozen.every((s) => s.medicine_id === protocolMedicineId)

  const existingById = new Map(editableExisting.map((s) => [s.id, s]))
  // 🔴 Uma pendência por escada. Sem este guard, a SEGUNDA edição de uma escada já em manutenção
  // (`firstNewStepPending` segue true enquanto a vigente for contínua) criaria uma 2ª etapa
  // `pending_confirmation`: dois candidatos ao mesmo `[Iniciar etapa N]`, e a que o usuário NÃO
  // tocasse ficaria pendente para sempre. A pendente que sobrevive à edição já é a saída da
  // manutenção — a nova entra `upcoming`, atrás dela, e o motor a assume depois do toque.
  const keepsPending = desired.some((d) => d.id && existingById.get(d.id)?.status === 'pending_confirmation')
  const keptIds = new Set<string>()
  const toUpdate: StepUpdate[] = []
  const toCreate: LadderRow[] = []

  desired.forEach((d, i) => {
    const position = basePos + i
    const belongs = runOpen && d.medicine_id === protocolMedicineId
    if (!belongs) runOpen = false
    const protocol_id = belongs ? protocolId : null

    const prev = d.id ? existingById.get(d.id) : undefined
    if (prev) {
      keptIds.add(prev.id)
      const updates = diffEditableStep(prev, d, position, protocol_id)
      if (updates) toUpdate.push({ id: prev.id, updates })
    } else {
      toCreate.push({
        titration_id: titrationId,
        position,
        medicine_id: d.medicine_id,
        dose: d.dose,
        intake_unit: d.intake_unit,
        duration_days: d.duration_days,
        // Só a PRIMEIRA criada (toCreate ainda vazio) pode nascer pendente — ver doc da função.
        status:
          firstNewStepPending && !keepsPending && toCreate.length === 0
            ? 'pending_confirmation'
            : 'upcoming',
        started_at: null,
        protocol_id,
      })
    }
  })

  const toDelete = editableExisting.filter((s) => !keptIds.has(s.id)).map((s) => s.id)
  return { toDelete, toUpdate, toCreate, protocolId }
}

/** `true` se o plano não altera nada (evita I/O e toast de sucesso vazio). */
export function isEmptyEditPlan(plan: LadderEditPlan): boolean {
  return plan.toDelete.length === 0 && plan.toUpdate.length === 0 && plan.toCreate.length === 0
}

/**
 * Erro sentinela: uma etapa que a edição ia tocar avançou (o cron ativou upcoming→current) entre o
 * load e o save → o claim de status voltou vazio (guard A4). A UI pede recarregar em vez de insistir.
 */
export class LadderStepAdvancedError extends Error {
  constructor() {
    super('Uma etapa avançou enquanto você editava. Recarregue a evolução e tente de novo.')
    this.name = 'LadderStepAdvancedError'
  }
}

// Só o sufixo futuro é editável (plan A4:247). O claim `status IN (...)` no UPDATE/DELETE impede
// que a edição client-side toque uma etapa que o cron já ativou (upcoming→current) — sem ele,
// reabriríamos a classe zumbi (AP-301). `pending_confirmation` é editável (troca ainda não confirmada).
const EDITABLE_STATUSES: ('upcoming' | 'pending_confirmation')[] = ['upcoming', 'pending_confirmation']

/**
 * Executa o plano de edição. Ordem colisão-safe com o índice único `(titration_id, position)`:
 * delete (libera posições) → update (posições em ordem ASC, deslocando para baixo em slots já
 * livres) → create (posições mais altas, no fim do sufixo). Ver invariante em `buildLadderEditPlan`.
 *
 * Cada delete/update carrega o CLAIM `status IN EDITABLE_STATUSES` (guard A4): se algum voltar vazio,
 * a etapa avançou sob a edição → aborta com `LadderStepAdvancedError` (a vigente nunca é clobberada).
 * Nota: o claim é por-statement, não transacional — um avanço concorrente pode deixar parte do plano
 * aplicada antes do abort; o estado permanece consistente (nada toca `current`) e o reload mostra a
 * verdade. Uma RPC atômica de edição é o endurecimento futuro se a corrida provar ser frequente.
 */
export async function saveLadderEdit(plan: LadderEditPlan): Promise<void> {
  for (const id of plan.toDelete) {
    const deleted = await titrationRepo.deleteStep(id, EDITABLE_STATUSES)
    if (!deleted) throw new LadderStepAdvancedError()
  }
  const updates = [...plan.toUpdate].sort(
    (a, b) => (a.updates.position ?? Number.MAX_SAFE_INTEGER) - (b.updates.position ?? Number.MAX_SAFE_INTEGER),
  )
  for (const u of updates) {
    const updated = await titrationRepo.updateStep(u.id, u.updates, EDITABLE_STATUSES)
    if (!updated) throw new LadderStepAdvancedError()
  }
  if (plan.toCreate.length > 0) {
    await titrationRepo.createSteps(plan.toCreate)
  }

  // 052 (FR-007b) — a escada nova só vale se o calendário a refletir.
  // Reusa o `resyncProtocolWindow` da F5.5 em vez de um segundo helper: o problema é o mesmo
  // (escrita fora do repositório do protocolo não dispara o `syncInstancesOnWrite`), então a
  // resposta é a mesma. Best-effort (R-245): a edição JÁ está persistida quando isto roda —
  // falhar aqui não pode virar erro na cara de quem acabou de salvar; o cron e a rede lazy
  // convergem, que é exatamente o comportamento pré-052.
  if (!isEmptyEditPlan(plan)) {
    await _resyncProtocolInstances(plan.protocolId)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMAÇÃO DO SWITCH (029 F5 / T024-T025 / FR-002 · PO-1)
//
// A transição NÃO é reimplementada aqui: quem pausa o protocolo antigo, ativa/cria o novo e
// escreve a trilha é a RPC `confirm_titration_switch(p_step_id)`, viva em prod desde o F3
// (contrato em CON-032, verificado contra `docs/migrations/20260716_titration_switch_rpc.sql`).
//
// 🔴 IDEMPOTÊNCIA É POR ESTADO, NÃO POR TOKEN (AP-221 / R-288): o claim
// `WHERE status='pending_confirmation'` DENTRO da RPC É a exclusão mútua. Por isso este módulo
// NÃO tem lock, flag de "confirmando" nem fila — um segundo primitivo de concorrência no cliente
// competiria com o do banco e reabriria a classe de bug que o claim fecha. Double-tap e retry
// caem em `already_confirmed:true`, que é o caminho NORMAL e NÃO é erro: a UI converge para
// "etapa iniciada", nunca mostra falha (Decisões §10 / Constituição IX).
// ═══════════════════════════════════════════════════════════════════════════════

/** Motivos de recusa da RPC (verbatim do contrato — CON-032). */
export type ConfirmSwitchReason = 'nao_pendente' | 'step_obsoleto' | 'nao_autenticado'

export type ConfirmSwitchResult =
  | { ok: true; alreadyConfirmed: boolean; transition: string | null; protocolActivated: string | null; protocolPaused: string | null }
  | { ok: false; reason: ConfirmSwitchReason | 'erro_rede'; message: string }

/** Copy de recusa — factual, diz o que NÃO aconteceu (Constituição IX). @private */
const _REASON_COPY: Record<ConfirmSwitchReason, string> = {
  // A etapa mudou de estado sob o usuário (outro device confirmou, o cron avançou, edição).
  nao_pendente: 'Esta etapa não está mais aguardando confirmação. Abra o tratamento para ver a evolução atualizada.',
  step_obsoleto: 'Esta etapa já foi concluída. Abra o tratamento para ver a evolução atualizada.',
  nao_autenticado: 'Sua sessão expirou. Entre de novo para iniciar a etapa.',
}

/**
 * Inicia a etapa pendente (o que o `[Iniciar etapa]` faz, no card do Hoje e no push).
 *
 * ⚠️ Sem fila offline (decisão do PO no C2 gate do F5): o write-path clínico é online-first
 * (R5-008) e o padrão "REGISTRADO LOCAL" do 039 não existe no app. Sem rede, devolve `erro_rede`
 * com a verdade — a etapa NÃO foi iniciada e nada mudou — em vez de fingir sucesso local.
 */
/**
 * Materializa a janela de doses de um protocolo (029 F5.5 · ampliado na 052).
 *
 * TRÊS chamadores, mesma causa: escrita que muda o cronograma FORA do `update()` do protocolo,
 * logo sem `syncInstancesOnWrite` (classe AP-308).
 *   1. `confirmTitrationSwitch` — a transição de etapa acontece dentro da RPC (SQL);
 *   2. `saveLadderEdit` (052/FR-007b) — a edição de etapas futuras escreve em `titration_steps`;
 *   3. `createFullLadder` (052/RC6) — o CADASTRO da escada sobre um protocolo cuja janela já
 *      estava materializada sem escada nenhuma.
 *
 * **BEST-EFFORT, e isso é deliberado (R-245).** A escrita JÁ aconteceu no banco quando esta
 * função roda: falhar aqui não pode transformar uma operação bem-sucedida em erro na cara do
 * usuário — ele tentaria de novo e receberia "não pendente" (ou salvaria a escada duas vezes). O
 * cron diário e a rede lazy seguem como malha de segurança; o atraso volta a ser o comportamento
 * antigo, que é o pior caso aceitável.
 *
 * O select carrega o embed `titration_steps` porque o gerador PRECISA da escada: sem ela a dose
 * cai para `dosage_per_intake` em silêncio (CON-032 / `generateInstances`), e sem o `medicine_id`
 * do step a instância congela o medicamento do PROTOCOLO em vez do da etapa vigente na data
 * (052 §G1 — o campo é invisível a tsc/lint por ser string de select, AP-300). A FK
 * `titration_steps.protocol_id` já filtra por protocolo — é exatamente o recorte certo.
 * @private
 */
async function _resyncProtocolInstances(protocolId: string | null): Promise<void> {
  if (!protocolId) return // `dose_change` sem executor vinculado: nada a materializar.
  try {
    const { data: protocol, error } = await typedClient
      .from('protocols')
      .select('*, titration_steps(id, position, dose, duration_days, status, started_at, medicine_id)')
      .eq('id', protocolId)
      .single()
    if (error || !protocol) return

    const tz = await resolveUserTz(typedClient, protocol.user_id)
    await resyncProtocolWindow({
      protocol,
      doseInstanceRepo: createDoseInstanceRepository({ client: typedClient }),
      tz,
    })
  } catch {
    // silencioso — cron + rede lazy corrigem eventualmente (mesma política do write-path)
  }
}

export async function confirmTitrationSwitch(stepId: string): Promise<ConfirmSwitchResult> {
  if (!stepId) return { ok: false, reason: 'nao_pendente', message: _REASON_COPY.nao_pendente }

  try {
    const { data, error } = await typedClient.rpc('confirm_titration_switch', { p_step_id: stepId })
    if (error) throw error

    if (data?.success === true) {
      // 🔴 PARIDADE COM O WRITE-PATH (029 F5.5, smoke do PO). A RPC é a única escrita em
      // `protocols` que não passa pelo repositório, logo a única que escapa do
      // `syncInstancesOnWrite`. Sem este resync o protocolo recém-criado nasce SEM instância
      // (calendário vazio até o cron das ~03:00) e o `dose_change` deixa as futuras já
      // materializadas com a dose ANTIGA (lembrete divergindo do tratamento).
      //
      // Aqui e não na tela: são 3 chamadores (detalhe do tratamento, card do Hoje e a ação do
      // push) — atrás da RPC, todos herdam.
      await _resyncProtocolInstances(data.protocol_activated ?? null)
      return {
        ok: true,
        // Caminho normal do double-tap/retry — convergir, nunca sinalizar erro.
        alreadyConfirmed: data.already_confirmed === true,
        transition: data.transition ?? null,
        protocolActivated: data.protocol_activated ?? null,
        protocolPaused: data.protocol_paused ?? null,
      }
    }

    const reason: ConfirmSwitchReason = _REASON_COPY[data?.reason as ConfirmSwitchReason]
      ? (data.reason as ConfirmSwitchReason)
      : 'nao_pendente'
    return { ok: false, reason, message: _REASON_COPY[reason] }
  } catch {
    return {
      ok: false,
      reason: 'erro_rede',
      message: 'Sem conexão agora — a etapa não foi iniciada e nada mudou no seu tratamento. Tente de novo quando a internet voltar.',
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PENDÊNCIA NO HOJE (029 F5 / T024)
// ═══════════════════════════════════════════════════════════════════════════════

// Só os 2 estados que o CTA precisa: a PENDENTE (o que o botão inicia) e a VIGENTE (a âncora do
// "aguardando desde" e quem segue regendo os lembretes). Etapas passadas/futuras não entram.
//
// R-295 — gate de saída EXECUTADO (2026-07-18, service role): HTTP 200.
//   curl "$SUPABASE_URL/rest/v1/titration_steps?select=<abaixo, sem whitespace>&limit=1"
// `presentation` no embed é obrigatória (R-267): sem ela o MedicineIcon cai no legado
// `dosage_unit LIKE '%/ml'` e injetável vira gotas.
const PENDING_SWITCH_SELECT = `
  id, titration_id, position, status, started_at, duration_days, dose, intake_unit, protocol_id,
  medicine:medicines(id, name, presentation, dosage_unit, dosage_per_pill, units_per_ml, concentration_volume_ml)
`

export interface PendingSwitchStep {
  id: string
  titration_id: string
  position: number
  status: string
  started_at: string | null
  duration_days: number | null
  dose: number
  intake_unit: string | null
  protocol_id: string | null
  medicine: {
    id: string
    name: string
    presentation: string | null
    dosage_unit: string | null
    dosage_per_pill: number | null
    units_per_ml: number | null
    // Denominador do rótulo do líquido: sem ele o Mounjaro vira "5 mg/ml" (razão normalizada) em
    // vez de "2,5 mg / 0,5 mL" (o que está escrito na caneta) — e é justamente a concentração que
    // distingue uma etapa da outra numa escada do mesmo medicamento.
    concentration_volume_ml: number | null
  } | null
}

/**
 * Etapas vigente+pendente de TODAS as escadas do usuário (o Hoje não tem protocolo em mão).
 * O agrupamento por escada e a decisão de exibir ficam no hook — aqui é só I/O.
 */
export async function getPendingSwitchSteps(): Promise<PendingSwitchStep[]> {
  const userId = await getUserId()
  const { data, error } = await typedClient
    .from('titration_steps')
    .select(PENDING_SWITCH_SELECT)
    .eq('user_id', userId)
    .in('status', ['current', 'pending_confirmation'])
    .order('position', { ascending: true })

  if (error) throw error
  return (data ?? []) as PendingSwitchStep[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSPARÊNCIA PÓS-CONFIRMAÇÃO (029 F5 / T024 · Decisões §3.3 · PO-1)
// ═══════════════════════════════════════════════════════════════════════════════

// R-295 — gate de saída EXECUTADO (2026-07-18, service role): HTTP 200.
// ⚠️ A coluna de horários é `time_schedule` (jsonb), NÃO `times`: a 1ª tentativa deste select
// levou `42703 column protocols.times does not exist` no gate — o nome "times" veio da memória,
// não do banco. É exatamente a classe do AP-300: o select é string, tsc/lint/teste não pegam.
const SWITCH_OUTCOME_SELECT = `
  id, frequency, time_schedule, weekdays, dosage_per_intake, intake_unit, active,
  medicine:medicines(id, name, dosage_unit, dosage_per_pill, units_per_ml, presentation, concentration_volume_ml)
`

export interface SwitchOutcomeProtocol {
  id: string
  frequency: string | null
  time_schedule: string[] | null
  // pt-BR por extenso ('segunda', 'quinta'), NÃO índice numérico — conferido em prod.
  weekdays: string[] | null
  dosage_per_intake: number | null
  intake_unit: string | null
  active: boolean

  medicine: any
}

/**
 * Lê os 2 protocolos que a transição mexeu, para o sheet listar o que o app fez MECANICAMENTE
 * (o pausado e o ativado). Best-effort: se falhar, o sheet degrada para a versão sem detalhes —
 * a transição JÁ aconteceu no servidor e não pode ser desfeita por erro de leitura (R-245).
 */
export async function getSwitchOutcomeProtocols(ids: string[]): Promise<SwitchOutcomeProtocol[]> {
  const wanted = ids.filter(Boolean)
  if (wanted.length === 0) return []
  const userId = await getUserId()
  const { data, error } = await typedClient
    .from('protocols')
    .select(SWITCH_OUTCOME_SELECT)
    .eq('user_id', userId)
    .in('id', wanted)

  if (error) throw error
  return (data ?? []) as SwitchOutcomeProtocol[]
}

/**
 * Fuso IANA do DONO (`user_settings.timezone`), com o mesmo fallback do `resolveUserTz` (R-254).
 *
 * Por que existe: o vencimento de uma etapa é dia de CALENDÁRIO LOCAL (R-253). O Hoje já usava o
 * fuso real (vem do `useTodayData`), mas a timeline do tratamento chamava `resolvePendingSwitch`
 * com o default — a MESMA pendência exibia "aguardando desde" e contagem de dias diferentes nas
 * duas telas para quem não está em São Paulo (achado do RC6 do F5).
 */
export async function getUserTimezone(): Promise<string> {
  const userId = await getUserId()
  const { data, error } = await typedClient
    .from('user_settings')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as { timezone?: string | null } | null)?.timezone || 'America/Sao_Paulo'
}
