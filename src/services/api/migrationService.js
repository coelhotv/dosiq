import { supabase } from '../../lib/supabase'

/**
 * Migration Service
 */
export const migrationService = {
  async migratePilotData() {
    const { error } = await supabase.rpc('migrate_pilot_data')
    if (error) throw error
  },
}
