// protocolService.js — CRUD web de tratamentos (Fase 2 G3: adopt factory).
//
// G3: thin wrapper sobre createProtocolRepository de @dosiq/core/repositories.
// Defaults da factory já cobrem os selects historicamente usados aqui:
//   - listSelect: medicine + treatment_plan(id,name,emoji,color)
//   - detailSelect: medicine
//   - writeSelect (após create/update/advance): medicine + treatment_plan(*)
//
// Callsites consumidores (calendar, dashboard, stock, export, reports, etc.)
// não precisam mudar — API e shape de retorno permanecem idênticos.

import { createProtocolRepository } from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'

export const protocolService = createProtocolRepository({
  client: supabase,
  getUserId,
})
