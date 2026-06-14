// measuresRepo.js — instância web do repositório de biomarcadores (012 Fase C · ADR-060).
// Espelho do measuresRepo mobile: reusa a factory canônica do @dosiq/core (R-231), ligada
// ao client Supabase web + getUserId cacheado (@shared/utils/supabase).

import { createBiomarkerRepository } from '@dosiq/core'
import { supabase, getUserId } from '@shared/utils/supabase'

export const measuresRepo = createBiomarkerRepository({ client: supabase, getUserId })
