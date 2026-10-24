#!/usr/bin/env node
/**
 * check-landing-budget.mjs
 *
 * Verificação do orçamento de bytes do caminho crítico da Landing do Dosiq (PO-110-1).
 * Lê apps/web/dist/index.html, identifica todos os assets locais referenciados
 * (scripts, modulepreloads e stylesheets locais), calcula o tamanho gzip real
 * e assegura que nenhuma view de produto (Estoque, Histórico, Onboarding, Dashboard)
 * vaze para o caminho crítico do visitante anônimo.
 *
 * Baseline main: 356 kB gz
 * Meta PO-110-1: <= 200 kB gz
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST_DIR = path.resolve(ROOT, 'apps/web/dist')
const INDEX_HTML = path.join(DIST_DIR, 'index.html')

// Orçamento máximo permitido em kB gzip (medido 163.42 kB + folga <= 5% = 172 kB, teto máximo 200 kB)
const BUDGET_CEILING_KB = 172
const BASELINE_KB = 356

// Marcadores de domínio restrito que sobrevivem à minificação e NUNCA devem estar no caminho crítico anônimo
const FORBIDDEN_MARKERS = [
  'feature-stock',
  'feature-history',
  'Registrar medida',
  'Sistólica',
  'Diastólica',
  'mr:open-measure-log',
  'mr:measure-saved',
  'admin-dlq',
  'admin-nudges',
  'health_measures',
  'dose_logs',
]

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(2) + ' kB'
}

function getLocalAssetsFromHtml(html) {
  const assets = new Set()

  // 1. Scripts: <script ... src="...">
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    const src = match[1]
    if (!src.startsWith('http') && !src.startsWith('//')) {
      assets.add(src)
    }
  }

  // 2. Modulepreloads e Stylesheets: <link ... href="...">
  const linkRegex = /<link[^>]+(?:rel=["'](?:modulepreload|stylesheet)["'][^>]+href=["']([^"']+)["']|href=["']([^"']+)["'][^>]+rel=["'](?:modulepreload|stylesheet)["'])/gi
  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1] || match[2]
    if (href && !href.startsWith('http') && !href.startsWith('//')) {
      assets.add(href)
    }
  }

  return Array.from(assets)
}

function run() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`[check-landing-budget] Erro: arquivo ${INDEX_HTML} não encontrado. Execute o build antes.`)
    process.exit(1)
  }

  const htmlContent = fs.readFileSync(INDEX_HTML, 'utf-8')
  const assetPaths = getLocalAssetsFromHtml(htmlContent)

  if (assetPaths.length === 0) {
    console.error('[check-landing-budget] Erro: nenhum asset local encontrado em index.html.')
    process.exit(1)
  }

  console.log('\n=============================================================')
  console.log('  Dosiq Landing Critical Path Budget Checker (PO-110-1)')
  console.log('=============================================================\n')

  let totalRawBytes = 0
  let totalGzipBytes = 0
  const forbiddenViolations = []

  console.log('Assets referenciados no caminho crítico (dist/index.html):')
  console.log('-------------------------------------------------------------')

  for (const assetPath of assetPaths) {
    // Remove leading slash para resolver dentro de DIST_DIR
    const relativePath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath
    const fullPath = path.resolve(DIST_DIR, relativePath)

    if (!fs.existsSync(fullPath)) {
      console.error(`  [!] Asset referenciado não encontrado em disco: ${fullPath}`)
      process.exit(1)
    }

    const content = fs.readFileSync(fullPath)
    const rawBytes = content.length
    const gzipBytes = zlib.gzipSync(content).length

    totalRawBytes += rawBytes
    totalGzipBytes += gzipBytes

    // Checar marcadores proibidos
    const contentStr = content.toString('utf-8')
    for (const marker of FORBIDDEN_MARKERS) {
      if (assetPath.includes(marker) || contentStr.includes(marker)) {
        forbiddenViolations.push({ asset: assetPath, marker })
      }
    }

    console.log(`  - ${relativePath.padEnd(45)} raw: ${formatBytes(rawBytes).padStart(10)} | gz: ${formatBytes(gzipBytes).padStart(10)}`)
  }

  const totalGzipKb = totalGzipBytes / 1024
  const deltaVsBaseline = ((totalGzipKb - BASELINE_KB) / BASELINE_KB * 100).toFixed(1)

  console.log('-------------------------------------------------------------')
  console.log(`  TOTAL CAMINHO CRÍTICO: ${formatBytes(totalRawBytes)} raw | ${formatBytes(totalGzipBytes)} gzip`)
  console.log(`  TETO PERMITIDO (PO-110-1): <= ${BUDGET_CEILING_KB.toFixed(2)} kB gzip`)
  console.log(`  BASELINE MAIN:           ${BASELINE_KB.toFixed(2)} kB gzip (${deltaVsBaseline}% vs baseline)`)
  console.log('-------------------------------------------------------------\n')

  let hasError = false

  // 1. Verificação de violações de marcadores
  if (forbiddenViolations.length > 0) {
    hasError = true
    console.error('❌ VIOLAÇÃO DE FRONTEIRA DE DOMÍNIO:')
    for (const v of forbiddenViolations) {
      console.error(`   - Asset "${v.asset}" contém código/marcador proibido: "${v.marker}"`)
    }
    console.error('   Código de views privadas/onboarding/providers não pode estar no caminho crítico.\n')
  }

  // 2. Verificação do teto de bytes
  if (totalGzipKb > BUDGET_CEILING_KB) {
    hasError = true
    console.error(`❌ ORÇAMENTO ESTOURADO: total medido (${totalGzipKb.toFixed(2)} kB gz) excede o teto (${BUDGET_CEILING_KB} kB gz).\n`)
  }

  if (hasError) {
    process.exit(1)
  }

  console.log(`✅ APROVADO: Caminho crítico dentro do orçamento (${totalGzipKb.toFixed(2)} kB gz <= ${BUDGET_CEILING_KB} kB gz) e isolado de código autenticado.\n`)
  process.exit(0)
}

run()
