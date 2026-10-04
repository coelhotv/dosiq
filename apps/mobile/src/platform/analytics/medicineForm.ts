// medicineForm.ts — forma do medicamento (`medicines.presentation`) para analytics (spec 092 FR-001).
//
// 🔴 Lida NO MOMENTO do evento, sem cache: o evento descreve o fato de agora (INV-2). Cache faria uma
//    forma editada depois aparecer em eventos antigos ou vice-versa.
// 🔴 Fail-silent (CON-021): qualquer falha devolve `{}` e a chave sai do payload (INV-3). Nunca `outro`
//    nem `comprimido` como default — o default do banco já enviesa para comprimido (092 E-7).
// R-295: `medicines.presentation` (text, nullable, CHECK de 7 valores) verificada no banco em
// 2026-10-04; select executado contra o PostgREST (200).
import { PRESENTATIONS } from '@dosiq/core'
import { supabase as supabaseImport } from '@platform/supabase/nativeSupabaseClient'

// TODO(040-strict): mesma duplicata de supabase-js do doseService — nominal typing do client.
const supabase = supabaseImport as any

/**
 * Forma de cada medicamento, numa única query `in()`. Id ausente no resultado ⇒ forma desconhecida.
 *
 * @param ids medicine_ids do fato (nulos e repetidos são ignorados)
 * @returns mapa `medicine_id → presentation` só com valores do enum do banco
 */
export async function getMedicinePresentations(
  ids: Array<string | null | undefined>,
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return {}
  try {
    const { data, error } = await supabase.from('medicines').select('id, presentation').in('id', unique)
    if (error || !Array.isArray(data)) return {}
    const out: Record<string, string> = {}
    for (const row of data) {
      if (PRESENTATIONS.includes(row?.presentation)) out[row.id] = row.presentation
    }
    return out
  } catch {
    return {}
  }
}
