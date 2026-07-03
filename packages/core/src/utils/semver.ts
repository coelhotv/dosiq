/**
 * Comparação SemVer pura — sem dependências externas.
 * Suporta formato MAJOR.MINOR.PATCH (ex: "1.2.3").
 * Ignora pre-release e build metadata.
 */

function parseSemver(version) {
  if (!version || typeof version !== 'string') return null
  const clean = version.trim().split('-')[0].split('+')[0]
  const parts = clean.split('.')
  if (parts.length < 2) return null
  const [major, minor, patch = '0'] = parts
  const nums = [Number(major), Number(minor), Number(patch)]
  if (nums.some(isNaN)) return null
  return nums
}

/**
 * Compara duas versões semver.
 * Retorna -1 se a < b, 0 se a == b, 1 se a > b.
 * Retorna null se alguma versão for inválida.
 */
export function compareSemver(a, b) {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1
    if (pa[i] > pb[i]) return 1
  }
  return 0
}

/**
 * Verifica se `version` está no intervalo [min, max].
 * `min` e `max` são opcionais (null/undefined = sem limite).
 * Retorna false para versões inválidas.
 */
export function satisfiesSemver(version, min, max) {
  const pv = parseSemver(version)
  if (!pv) return false
  if (min) {
    const cmp = compareSemver(version, min)
    if (cmp === null || cmp < 0) return false
  }
  if (max) {
    const cmp = compareSemver(version, max)
    if (cmp === null || cmp > 0) return false
  }
  return true
}
