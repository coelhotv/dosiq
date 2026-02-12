import { supabase, getUserId } from '../../lib/supabase'

/**
 * Treatment Plan Service - Manage groups of protocols (e.g. "Fantastic Four")
 */
export const treatmentPlanService = {
  /**
   * Get all plans with their protocols
   */
  async getAll() {
    const { data, error } = await supabase
      .from('treatment_plans')
      .select(`
        *,
        protocols:protocols(
          *,
          medicine:medicines(*)
        )
      `)
      .eq('user_id', await getUserId())
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  /**
   * Create a new treatment plan
   */
  async create(plan) {
    const { data, error } = await supabase
      .from('treatment_plans')
      .insert([{ ...plan, user_id: await getUserId() }])
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Update a treatment plan
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from('treatment_plans')
      .update(updates)
      .eq('id', id)
      .eq('user_id', await getUserId())
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  /**
   * Delete a treatment plan
   */
  async delete(id) {
    // Note: Protocols will have their treatment_plan_id set to NULL due to ON DELETE SET NULL
    const { error } = await supabase
      .from('treatment_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', await getUserId())
    
    if (error) throw error
  }
}
