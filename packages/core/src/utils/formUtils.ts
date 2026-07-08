export const getFieldDescribedBy = (
  fieldName: string,
  errors: Record<string, unknown> | null | undefined,
  hintId: string | null = null
): string | undefined =>
  [hintId, errors?.[fieldName] ? `${fieldName}-error` : null].filter(Boolean).join(' ') || undefined

/**
 * Coerção de decimal PT-BR (R-270/AP-167): o usuário digita "2,5" mas o banco só
 * aceita ponto. Aceita vírgula OU ponto e devolve Number. Inputs decimais na web
 * devem ser `type="text" inputMode="decimal"` (o `type="number"` do HTML bloqueia a
 * vírgula no browser) e normalizar com este helper na hora de persistir.
 * @param {string|number|null|undefined} value
 * @returns {number} NaN quando vazio/ inválido (deixa a validação decidir)
 */
export const coerceDecimal = (value: string | number | null | undefined): number =>
  parseFloat(String(value ?? '').replace(',', '.'))

/**
 * Limpa artefatos de ponto flutuante do JS (012 Fase B3; review Gemini #661).
 * `1.2 * 0.3 === 0.36000000000000004`; `formatNumberPtBR` não arredonda, então a
 * dízima vazaria pro chip/card e seria persistida. `toPrecision(12)` corta o ruído
 * de ~15-17 dígitos mantendo precisão real; `parseFloat` remove zeros à direita.
 * Aplicar em TODA multiplicação/divisão de concentração (amount×volume, amount÷denom)
 * antes de exibir OU persistir. Não-finito passa direto (deixa a validação decidir).
 * @param {number|string|null|undefined} value
 * @returns {number}
 * @example cleanFloat(1.2 * 0.3) → 0.36
 */
export const cleanFloat = (value: number | string | null | undefined): number => {
  const n = Number(value)
  return Number.isFinite(n) ? parseFloat(n.toPrecision(12)) : n
}
