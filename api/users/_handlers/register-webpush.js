import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { notificationDeviceRepository } from '../../../server/notifications/repositories/notificationDeviceRepository.js'

export async function handleRegisterWebpush(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
      { realtime: { transport: ws } }
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

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error registering webpush:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
