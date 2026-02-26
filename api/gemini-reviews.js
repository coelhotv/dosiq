/**
 * Router para endpoints de reviews do Gemini
 *
 * Consolida 4 handlers em 1 função serverless:
 * - persist: Persiste reviews no Supabase
 * - create-issues: Cria issues no GitHub
 * - update-status: Atualiza status das reviews
 * - batch-update: Atualização em batch (webhook auth)
 *
 * @module api/gemini-reviews
 * @version 2.0.0
 */

import { handlePersist } from './gemini-reviews/_handlers/persist.js'
import { handleCreateIssues } from './gemini-reviews/_handlers/create-issues.js'
import { handleUpdateStatus } from './gemini-reviews/_handlers/update-status.js'
import { handleBatchUpdate } from './gemini-reviews/_handlers/batch-update.js'

const ROUTES = {
  'persist': handlePersist,
  'create-issues': handleCreateIssues,
  'update-status': handleUpdateStatus,
  'batch-update': handleBatchUpdate,
}

/**
 * Handler principal - roteia para o handler apropriado
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
export default async function handler(req, res) {
  const segments = req.url.split('?')[0].split('/')
  const action = segments[segments.length - 1]
  const routeHandler = ROUTES[action]

  if (!routeHandler) {
    return res.status(404).json({
      success: false,
      error: `Unknown action: ${action}. Valid: ${Object.keys(ROUTES).join(', ')}`
    })
  }

  return routeHandler(req, res)
}
