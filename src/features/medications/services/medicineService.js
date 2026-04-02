import { supabase, getUserId } from '@shared/utils/supabase'
import { validateMedicineCreate, validateMedicineUpdate } from '@schemas/medicineSchema'
import { calculateAvgUnitPrice } from '@stock/services/costAnalysisService'

function getPriceEntries(medicine) {
  if (Array.isArray(medicine.purchases) && medicine.purchases.length > 0) {
    return medicine.purchases
  }

  return medicine.stock || []
}

/**
 * Medicine Service - CRUD operations for medicines
 *
 * VALIDAÇÃO ZOD:
 * - Todos os dados de entrada são validados antes de enviar ao Supabase
 * - Erros de validação retornam mensagens em português
 * - Nenhum payload inválido é enviado ao backend
 */
export const medicineService = {
  /**
   * Get all medicines for the current user
   */
  async getAll() {
    const { data, error } = await supabase
      .from('medicines')
      .select(
        `
        *,
        stock(*),
        purchases(*)
      `
      )
      .eq('user_id', await getUserId())
      .order('created_at', { ascending: false })

    if (error) throw error

    // Usa purchases como fonte canônica de custo médio.
    // Fallback temporário para stock preserva compatibilidade enquanto a migration não foi aplicada.
    return data.map((medicine) => {
      return {
        ...medicine,
        avg_price: calculateAvgUnitPrice(getPriceEntries(medicine)) || null,
      }
    })
  },

  /**
   * Get a single medicine by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('medicines')
      .select(
        `
        *,
        stock(*),
        purchases(*)
      `
      )
      .eq('id', id)
      .eq('user_id', await getUserId())
      .single()

    if (error) throw error

    return {
      ...data,
      avg_price: calculateAvgUnitPrice(getPriceEntries(data)) || null,
    }
  },

  /**
   * Create a new medicine
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de enviar ao Supabase
   * @throws {Error} Se os dados forem inválidos
   */
  async create(medicine) {
    // Validação Zod
    const validation = validateMedicineCreate(medicine)
    if (!validation.success) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    const { data, error } = await supabase
      .from('medicines')
      .insert([{ ...validation.data, user_id: await getUserId() }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update an existing medicine
   *
   * VALIDAÇÃO: Dados são validados com Zod antes de enviar ao Supabase
   * @throws {Error} Se os dados forem inválidos
   */
  async update(id, updates) {
    // Validação Zod
    const validation = validateMedicineUpdate(updates)
    if (!validation.success) {
      const errorMessages = validation.errors.map((e) => `${e.field}: ${e.message}`).join('; ')
      throw new Error(`Erro de validação: ${errorMessages}`)
    }

    const { data, error } = await supabase
      .from('medicines')
      .update(validation.data)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a medicine
   */
  async delete(id) {
    const { error } = await supabase
      .from('medicines')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())

    if (error) throw error
  },
}
