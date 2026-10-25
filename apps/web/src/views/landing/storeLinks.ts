/**
 * storeLinks — Helper único de geração de URLs para as lojas mobile e rota /baixar.
 *
 * Garante atribuição consistente em todos os pontos de clique da landing:
 * - App Store: pt=128807500 & ct=landing_home_<point> & mt=8
 * - Google Play: referrer=utm_source%3Dlanding_home%26utm_campaign%3D<point>
 * - Ponte /baixar: /baixar?ct=<point>
 */

export const STORE_POINTS = ['atf', 'header', 'sticky', 'section', 'final', 'qr'] as const

export type StorePoint = (typeof STORE_POINTS)[number]

const APP_STORE_BASE = 'https://apps.apple.com/br/app/id6762740948'
const APP_STORE_PROVIDER_TOKEN = '128807500'

const PLAY_STORE_BASE = 'https://play.google.com/store/apps/details?id=com.coelhotv.dosiq'

/**
 * Gera URL oficial da App Store atribuível no App Store Connect.
 */
export function appStoreUrl(point: StorePoint): string {
  return `${APP_STORE_BASE}?pt=${APP_STORE_PROVIDER_TOKEN}&ct=landing_home_${point}&mt=8`
}

/**
 * Gera URL oficial do Google Play atribuível no Play Console.
 */
export function playStoreUrl(point: StorePoint): string {
  const referrer = `utm_source%3Dlanding_home%26utm_campaign%3D${point}`
  return `${PLAY_STORE_BASE}&referrer=${referrer}`
}

/**
 * Gera URL da página /baixar parametrizada com o ponto de clique.
 */
export function baixarUrl(point: StorePoint): string {
  return `/baixar?ct=${point}`
}

/**
 * Alias de conveniência para BAIXAR_URL.
 */
export const BAIXAR_URL = baixarUrl
