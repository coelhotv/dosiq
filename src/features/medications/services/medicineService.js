import { supabase, getUserId } from '@shared/utils/supabase'
import { validateMedicineCreate, validateMedicineUpdate } from '@medications/constants/medicineSchema'

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
      .select(`
        *,
        stock(*)
      `)
      .eq('user_id', await getUserId())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Calcula o custo médio ponderado baseado no estoque disponível
    return data.map(medicine => {
      const activeStock = (medicine.stock || []).filter(s => s.quantity > 0)
      const totalQuantity = activeStock.reduce((sum, s) => sum + s.quantity, 0)
      const totalValue = activeStock.reduce((sum, s) => sum + ((s.unit_price || 0) * s.quantity), 0)
      
      const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : null
      
      return { 
        ...medicine, 
        avg_price: avgPrice 
      }
    })
  },

  /**
   * Get a single medicine by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('medicines')
      .select(`
        *,
        stock(*)
      `)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .single()
    
    if (error) throw error

    const activeStock = (data.stock || []).filter(s => s.quantity > 0)
    const totalQuantity = activeStock.reduce((sum, s) => sum + s.quantity, 0)
    const totalValue = activeStock.reduce((sum, s) => sum + ((s.unit_price || 0) * s.quantity), 0)
    const avgPrice = totalQuantity > 0 ? totalValue / totalQuantity : null
    
    return { ...data, avg_price: avgPrice }
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
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
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
      const errorMessages = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ')
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
  }
}
