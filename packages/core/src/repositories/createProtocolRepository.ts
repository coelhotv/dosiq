// createProtocolRepository.js — Factory CRUD canônico de tratamentos (Fase 2 G2).
//
// Espelha o pattern de createMedicineRepository (Fase 1).
// Web e mobile injetam: client Supabase, getUserId, e (opcional) selects/transforms.
// Defaults cobrem o caso real (web/mobile precisam de medicine + treatment_plan aninhados).
// Validação Zod create/update é canônica (via @dosiq/core protocolSchema).
//
// Métodos:
// - getAll / getById / create / update / delete  → CRUD CRUD básico
// - getActive(date)                              → filtro por janela period (active=true ∧ start ≤ date ∧ end ≥ date|null)
// - getByMedicineId(medicineId)                  → lista protocolos vinculados a um medicamento

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@dosiq/shared-data'
import {
  validateProtocolCreate,
  validateProtocolUpdate,
} from '../schemas/protocolSchema'
import { getTodayLocal, getServerTimestamp, parseISO } from '../utils/dateUtils'
import { createDoseInstanceRepository } from './createDoseInstanceRepository'
import { planWindow, computeWindowEnd } from '../services/doseInstancePlanner'
import { resolveUserTz } from '../services/resolveUserTz'

// Campos cuja alteração invalida a janela futura de dose_instances → wipe + regen.
// critical_alarm incluído: mudar o flag de criticidade deve re-materializar as pending futuras.
//
// 052 (FR-007a): `medicine_id` entra aqui porque o congelamento INVERTE o acidente do futuro.
// Antes da 052 o join deixava as instâncias futuras "certas de graça" quando o usuário trocava o
// medicamento do tratamento na UI — elas não guardavam medicamento nenhum. Congelado, uma pending
// futura já materializada guardaria o medicamento ANTIGO para sempre. O passado segue protegido
// por construção: `wipeFuturePending` nunca toca não-pending nem o passado.
const SCHEDULING_FIELDS = ['time_schedule', 'dosage_per_intake', 'frequency', 'weekdays', 'start_date', 'end_date', 'critical_alarm', 'medicine_id']

/**
 * Sincroniza dose_instances após escrita de protocolo (ADR-048, S2.5).
 * BEST-EFFORT: nunca propaga erro — cron diário (generateDoseInstances) e a rede
 * lazy (ensureInstancesUpTo) são a malha de segurança. Um erro de geração não pode
 * bloquear a criação/edição do protocolo em si.
 *
 * @param params.client    client Supabase (mesmo da factory)
 * @param params.protocol  linha do protocolo recém-escrita
 * @param params.updates   updates do update() (null em create)
 */
async function syncInstancesOnWrite({
  client,
  protocol,
  updates,
}: {
  client: SupabaseClient<Database>
  protocol: { id: string; user_id: string; end_date?: string | null; [key: string]: unknown }
  updates: Record<string, unknown> | null
}) {
  try {
    if (!protocol?.id) return
    const repo = createDoseInstanceRepository({ client })

    // Pausa: marca paused_at + TODAS as futuras pending como skipped_paused imediatamente.
    // Elimina dependência do cron para limpar o restante — crítico para ciclos curtos
    // (ex: anticoncepcional 7d de pausa entre cartelas) onde o sweep de missed corre
    // antes do cron e converte pending→missed indevidamente (AP-221).
    if (updates && updates.active === false) {
      await repo.setPausedAt(protocol.id, getServerTimestamp())
      await repo.markAllFutureSkippedPaused(protocol.user_id, protocol.id)
      return
    }

    const isResume = updates && updates.active === true
    if (isResume) {
      await repo.setPausedAt(protocol.id, null)
      // Reverte as instâncias marcadas na pausa (skipped_paused → pending). O regen via
      // upsert (ON CONFLICT DO NOTHING) não reverteria — sem isto, toggle rápido
      // (pausa <1d + religa) deixaria as próximas 24h mortas. (S2.5 DoD)
      await repo.reactivateFuturePaused(protocol.user_id, protocol.id)
    }

    const schedulingChanged = updates && SCHEDULING_FIELDS.some((f) => f in updates)
    if (schedulingChanged) await repo.wipeFuturePending(protocol.id)

    // (Re)gera a janela em: create (updates null), resume, ou mudança de agendamento.
    const shouldRegen = !updates || isResume || schedulingChanged
    if (shouldRegen) {
      const now = parseISO(getServerTimestamp())
      // F4.3f.1: materializa `scheduled_for` no fuso do DONO do protocolo (não SP).
      // best-effort com fallback SP (resolveUserTz nunca lança).
      const tz = await resolveUserTz(client, protocol.user_id)
      await planWindow({
        protocol,
        doseInstanceRepo: repo,
        fromTs: now.toISOString(),
        toTs: computeWindowEnd(protocol, now, tz),
        tz,
      })
    }
  } catch {
    // best-effort — silencioso; cron + rede lazy corrigem eventualmente
  }
}

// 029 F3 (T014): `titration_steps(...)` é o embed da escada N2 DESTE protocolo — a FK
// `titration_steps.protocol_id → protocols.id` faz o filtro por protocolo sair de graça, sem
// query extra. É o recorte que o gerador exige (a escada inteira vazaria a dose de outro
// medicamento no caso cross-med). Sem o embed, `TITRATION_SOURCE=n2` degradaria a dose de
// titulação para `dosage_per_intake` em SILÊNCIO — por isso ele vive nos selects, não num if.
const TITRATION_STEPS_EMBED = `titration_steps(id, position, dose, duration_days, status, started_at, medicine_id)`

const DEFAULT_SELECT = `
        *,
        medicine:medicines(*),
        treatment_plan:treatment_plans(id, name, emoji, color),
        ${TITRATION_STEPS_EMBED}
      `

const FULL_SELECT_AFTER_WRITE = `
        *,
        medicine:medicines(*),
        treatment_plan:treatment_plans(*),
        ${TITRATION_STEPS_EMBED}
      `

// O embed também aqui (029 F3.1): sem ele, `getById` devolve um protocolo cuja escada é
// `undefined` — e qualquer caminho que leve esse objeto ao gerador materializa a dose de
// titulação como `dosage_per_intake`, EM SILÊNCIO (nem erro, nem log: só a dose errada).
// Hoje nenhum consumidor de `getById` faz isso, mas a assimetria entre os selects é uma
// armadilha armada para o próximo slice. O contrato é "a escada vem nos selects" (CON-032).
const DETAIL_SELECT = `
        *,
        medicine:medicines(*),
        ${TITRATION_STEPS_EMBED}
      `

const identity = <T,>(x: T) => x

interface ValidationError {
  field: string
  message: string
}

function formatValidationError(errors: ValidationError[]) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

interface CreateProtocolRepositoryDeps {
  client: SupabaseClient<Database>
  getUserId: () => Promise<string>
  listSelect?: string
  detailSelect?: string
  writeSelect?: string
  listTransform?: (rows: unknown) => unknown
  detailTransform?: (row: unknown) => unknown
}

/**
 * Cria um repositório CRUD de tratamentos (protocols) parametrizado por plataforma.
 */
// NOTA: factory excede max-lines-per-function por agregar 7 métodos CRUD +
// no mesmo objeto (pattern canônico de createMedicineRepository).
// Quebrar prejudica leitura; warning aceito (R-221 SQP).
// Retorno anotado explicitamente (TS2742 — declaration emit não nomeia o tipo
// inferido do `.select()` dinâmico sem referenciar caminho interno de @dosiq/shared-data).
export function createProtocolRepository({
  client,
  getUserId,
  listSelect = DEFAULT_SELECT,
  detailSelect = DETAIL_SELECT,
  writeSelect = FULL_SELECT_AFTER_WRITE,
  listTransform = identity,
  detailTransform = identity,
}: CreateProtocolRepositoryDeps): {
  getAll(): Promise<any>
  getActive(date?: string): Promise<any>
  getById(id: string): Promise<any>
  getByMedicineId(medicineId: string): Promise<any[]>
  create(protocol: Record<string, unknown>): Promise<any>
  update(id: string, updates: Record<string, unknown>): Promise<any>
  delete(id: string): Promise<void>
} {
  if (!client) throw new Error('createProtocolRepository: client é obrigatório')
  if (typeof getUserId !== 'function') {
    throw new Error('createProtocolRepository: getUserId deve ser função async')
  }

  return {
    async getAll() {
      const userId = await getUserId()
      const { data, error } = await client
        .from('protocols')
        .select(listSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return listTransform(data ?? [])
    },

    async getActive(date: string = getTodayLocal()) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('protocols')
        .select(listSelect)
        .eq('user_id', userId)
        .eq('active', true)
        .lte('start_date', date)
        .or(`end_date.is.null,end_date.gte.${date}`)
        .order('created_at', { ascending: false })

      if (error) throw error
      return listTransform(data ?? [])
    },

    async getById(id: string) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('protocols')
        .select(detailSelect)
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async getByMedicineId(medicineId: string) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('protocols')
        .select('*')
        .eq('medicine_id', medicineId)
        .eq('user_id', userId)

      if (error) throw error
      return data ?? []
    },

    async create(protocol: Record<string, unknown>) {
      const validation = validateProtocolCreate(protocol)
      if (!validation.success || !validation.data) throw formatValidationError(validation.errors ?? [])

      const userId = await getUserId()
      // _medicineIsLiquid é flag transiente de validação (refine intake_unit), não
      // é coluna de protocols — remover antes do insert (022 Fase C).
      const { _medicineIsLiquid: _omit, ...validated } = validation.data

      // 029 F6: os defaults de titulação N1 (`titration_schedule`/`current_stage_index`/
      // `stage_started_at`) saíram daqui com o DROP das colunas. Este era o ÚNICO escritor
      // vivo das 3 — mantê-lo daria `42703` em TODO cadastro de tratamento, web e mobile.
      // A escada não nasce mais no insert do protocolo: é `titrations` + `titration_steps`,
      // criada pelo fluxo próprio (ADR-084). Não reintroduzir campo de titulação aqui.
      const payload = {
        ...validated,
        user_id: userId,
      }

      const { data, error } = await client
        .from('protocols')
        .insert([payload])
        .select(writeSelect)
        .single()

      if (error) throw error
      // ADR-048 S2.5: materializa a janela inicial de dose_instances (best-effort)
      await syncInstancesOnWrite({ client, protocol: data as unknown as { id: string; user_id: string; end_date?: string | null; [key: string]: unknown }, updates: null })
      return detailTransform(data)
    },

    async update(id: string, updates: Record<string, unknown>) {
      const validation = validateProtocolUpdate(updates)
      if (!validation.success || !validation.data) throw formatValidationError(validation.errors ?? [])

      const userId = await getUserId()
      // 🔴 Persistir SÓ as chaves que o chamador ENVIOU (com o valor já validado/transformado).
      // `protocolUpdateSchema = protocolSchema.partial()` NÃO tira os `.default()`: parsear um update
      // parcial injeta defaults para campos ausentes (`weekdays:[]`, `titration_status:'estável'`,
      // `current_stage_index:0`, `time_schedule:[]`, `critical_alarm:false`…). Escrever `validation.data`
      // cru sobrescreve dados que o usuário não tocou — bug real: pausar (só `{active}`) um tratamento
      // semanal ZERAVA `weekdays` (o dia sumia e não voltava). O `updates` cru é a intenção; o
      // `validation.data`, a validação de tipos. Interseção das duas = o que de fato deve ir ao banco.
      const sentKeys = new Set(Object.keys(updates))
      // Strip flag transiente (não é coluna) — idem create (022 Fase C).
      const { _medicineIsLiquid: _omit, ...validated } = validation.data
      const cleanUpdates = Object.fromEntries(
        Object.entries(validated).filter(([key]) => sentKeys.has(key)),
      ) as typeof validated
      const { data, error } = await client
        .from('protocols')
        .update(cleanUpdates)
        .eq('id', id)
        .eq('user_id', userId)
        .select(writeSelect)
        .single()

      if (error) throw error
      // ADR-048 S2.5: pausa/resume/mudança de agendamento → sincroniza instâncias (best-effort).
      // Usa `updates` CRU (não validation.data) — Zod pode injetar defaults e fazer toda
      // edição parecer mudança de agendamento.
      await syncInstancesOnWrite({ client, protocol: data as unknown as { id: string; user_id: string; end_date?: string | null; [key: string]: unknown }, updates })
      return detailTransform(data)
    },

    async delete(id: string) {
      const userId = await getUserId()
      const { error } = await client
        .from('protocols')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },

  }
}
