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
// - advanceTitrationStage(id, markAsCompleted)   → web-only (mobile v1 não expõe; mantido na factory pra paridade)

import {
  validateProtocolCreate,
  validateProtocolUpdate,
} from '../schemas/protocolSchema.js'
import { getTodayLocal, getServerTimestamp } from '../utils/dateUtils.js'

const DEFAULT_SELECT = `
        *,
        medicine:medicines(*),
        treatment_plan:treatment_plans(id, name, emoji, color)
      `

const FULL_SELECT_AFTER_WRITE = `
        *,
        medicine:medicines(*),
        treatment_plan:treatment_plans(*)
      `

const DETAIL_SELECT = `
        *,
        medicine:medicines(*)
      `

const identity = (x) => x

function formatValidationError(errors) {
  const msg = errors.map((e) => `${e.field}: ${e.message}`).join('; ')
  return new Error(`Erro de validação: ${msg}`)
}

/**
 * Cria um repositório CRUD de tratamentos (protocols) parametrizado por plataforma.
 *
 * @param {Object} deps
 * @param {Object} deps.client       Cliente Supabase (`createClient(...)` ou nativeSupabaseClient).
 * @param {Function} deps.getUserId  Async () => string. Resolve user_id da sessão.
 * @param {string}   [deps.listSelect]    Select fragment usado em getAll/getActive/getByMedicineId.
 * @param {string}   [deps.detailSelect]  Select fragment usado em getById.
 * @param {string}   [deps.writeSelect]   Select fragment usado após create/update/advance.
 * @param {Function} [deps.listTransform]     (rows) => rows. Pós-processamento de getAll.
 * @param {Function} [deps.detailTransform]   (row) => row. Pós-processamento de getById/create/update.
 */
// NOTA: factory excede max-lines-per-function por agregar 7 métodos CRUD +
// advanceTitrationStage no mesmo objeto (pattern canônico de createMedicineRepository).
// Quebrar prejudica leitura; warning aceito (R-221 SQP).
export function createProtocolRepository({
  client,
  getUserId,
  listSelect = DEFAULT_SELECT,
  detailSelect = DETAIL_SELECT,
  writeSelect = FULL_SELECT_AFTER_WRITE,
  listTransform = identity,
  detailTransform = identity,
}) {
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

    async getActive(date = getTodayLocal()) {
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

    async getById(id) {
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

    async getByMedicineId(medicineId) {
      const userId = await getUserId()
      const { data, error } = await client
        .from('protocols')
        .select('*')
        .eq('medicine_id', medicineId)
        .eq('user_id', userId)

      if (error) throw error
      return data ?? []
    },

    async create(protocol) {
      const validation = validateProtocolCreate(protocol)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()
      const validated = validation.data

      const payload = {
        ...validated,
        user_id: userId,
        // Defaults para titração (web usa, mobile v1 não expõe — mas factory mantém)
        titration_schedule: validated.titration_schedule || [],
        current_stage_index: validated.current_stage_index || 0,
        stage_started_at:
          validated.titration_schedule?.length > 0 ? getServerTimestamp() : null,
      }

      const { data, error } = await client
        .from('protocols')
        .insert([payload])
        .select(writeSelect)
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async update(id, updates) {
      const validation = validateProtocolUpdate(updates)
      if (!validation.success) throw formatValidationError(validation.errors)

      const userId = await getUserId()
      const { data, error } = await client
        .from('protocols')
        .update(validation.data)
        .eq('id', id)
        .eq('user_id', userId)
        .select(writeSelect)
        .single()

      if (error) throw error
      return detailTransform(data)
    },

    async delete(id) {
      const userId = await getUserId()
      const { error } = await client
        .from('protocols')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },

    /**
     * Avança para o próximo estágio de titulação. Web-only no v1 (mobile não
     * expõe UI). Se markAsCompleted=true, força status alvo_atingido mesmo
     * antes de esgotar o schedule.
     */
    async advanceTitrationStage(id, markAsCompleted = false) {
      const protocol = await this.getById(id)

      if (!protocol.titration_schedule || protocol.titration_schedule.length === 0) {
        throw new Error('Este protocolo não possui regime de titulação')
      }

      // user_id já veio em getById (que validou posse via getUserId interno).
      // Reutilizar evita 2º await desnecessário.
      const userId = protocol.user_id
      const currentStageIndex = protocol.current_stage_index || 0
      const nextStageIndex = currentStageIndex + 1

      // Esgotou o schedule — marca como alvo_atingido e fixa no último stage
      if (nextStageIndex >= protocol.titration_schedule.length) {
        const { data, error } = await client
          .from('protocols')
          .update({
            titration_status: 'alvo_atingido',
            current_stage_index: protocol.titration_schedule.length - 1,
            stage_started_at: getServerTimestamp(),
          })
          .eq('id', id)
          .eq('user_id', userId)
          .select(writeSelect)
          .single()

        if (error) throw error
        return detailTransform(data)
      }

      // Avança normalmente — pega dose do próximo stage do schedule
      const nextStage = protocol.titration_schedule[nextStageIndex]
      const updates = {
        current_stage_index: nextStageIndex,
        stage_started_at: getServerTimestamp(),
        dosage_per_intake: nextStage.dosage,
        titration_status: markAsCompleted ? 'alvo_atingido' : 'titulando',
      }

      const { data, error } = await client
        .from('protocols')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select(writeSelect)
        .single()

      if (error) throw error
      return detailTransform(data)
    },
  }
}
