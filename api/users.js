import { handleBetaSignup } from './users/_handlers/beta-signup.js'
import { handleRegisterWebpush } from './users/_handlers/register-webpush.js'

const ROUTES = {
  'beta-signup': handleBetaSignup,
  'register-webpush': handleRegisterWebpush
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action } = req.query
  const routeHandler = action && Object.hasOwn(ROUTES, action) ? ROUTES[action] : null

  if (!routeHandler) {
    return res.status(404).json({ error: 'Action not found' })
  }

  return routeHandler(req, res)
}
