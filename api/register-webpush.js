import { createClient } from '@supabase/supabase-js'
import { notificationDeviceRepository } from '../server/notifications/repositories/notificationDeviceRepository.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

    const { pushToken, provider, appKind, platform, deviceName } = req.body

    await notificationDeviceRepository.upsert({
      userId: user.id,
      appKind,
      platform,
      provider,
      pushToken,
      deviceName
    })

    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error registering webpush:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
