/**
 * profile.js — Helpers puros de perfil (web↔mobile, sem deps de plataforma).
 *
 * Derivações de exibição do perfil: idade a partir de birth_date e iniciais a
 * partir do display_name. Canônico — web/mobile reusam (evita duplicar lógica
 * que hoje vive inline em useProfileState web).
 */

import { parseLocalDate, getSaoPauloTime } from './dateUtils'

/**
 * Calcula idade (anos completos) a partir de uma data de nascimento YYYY-MM-DD.
 * Usa horário local de São Paulo como referência (R-020 — parseLocalDate).
 *
 * @param {string|null|undefined} birthDate - YYYY-MM-DD
 * @returns {number|null} idade em anos, ou null se ausente/inválida
 */
export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  try {
    const birth = parseLocalDate(birthDate)
    if (Number.isNaN(birth.getTime())) return null
    const today = getSaoPauloTime()
    let years = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) years--
    return years >= 0 ? years : null
  } catch {
    return null
  }
}

/**
 * Deriva iniciais (até 2 letras maiúsculas) de um nome de exibição.
 * Ex: "Antonio Coelho" → "AC"; "Maria" → "M"; vazio → "".
 *
 * @param {string|null|undefined} name
 * @returns {string}
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return ''
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
