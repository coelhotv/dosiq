/**
 * Escape único do template do relatório (spec 097 PO-SEC-3, RC-SEC-F3).
 *
 * Todo texto que entra no HTML passa por AQUI — nome do paciente, medicamento, alergia, rótulos.
 * O template só interpola o retorno destas funções; escape espalhado é o que deixa um campo novo
 * passar cru no futuro. Atributos são sempre escritos entre aspas duplas.
 */
const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Texto → HTML seguro. `null`/`undefined` viram ''. */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, (ch) => ENTITIES[ch])
}

/** Valor de atributo (sempre entre aspas duplas no template). */
export const escapeAttr = escapeHtml
