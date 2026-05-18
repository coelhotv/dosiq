import { createTreatmentPlanRepository } from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'

export const treatmentPlanService = createTreatmentPlanRepository({
  client: supabase,
  getUserId,
})
