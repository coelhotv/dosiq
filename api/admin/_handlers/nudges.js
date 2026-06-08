// api/admin/_handlers/nudges.js
// Nudge admin handlers — create, read, update, toggle

import { validateNudgeCreate, validateNudgeUpdate } from '../../packages/core/src/schemas/nudgeSchema.js'

export async function handleListNudges(req, res, supabase) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
    const offset = Math.max(parseInt(req.query.offset) || 0, 0)
    const is_active = req.query.is_active ? req.query.is_active === 'true' : null
    const target_view = req.query.target_view || null

    let query = supabase
      .from('in_app_nudges')
      .select('*', { count: 'exact' })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (is_active !== null) {
      query = query.eq('is_active', is_active)
    }

    if (target_view !== null) {
      query = query.eq('target_view', target_view)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[Nudges API] Database error:', error)
      return res.status(500).json({ error: 'Failed to fetch nudges' })
    }

    return res.status(200).json({
      data: data || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (err) {
    console.error('[Nudges API] Unexpected error (list):', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function handleCreateNudge(req, res, supabase) {
  try {
    const validation = validateNudgeCreate(req.body)

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid nudge data', details: validation.errors })
    }

    const { data, error } = await supabase
      .from('in_app_nudges')
      .insert([validation.data])
      .select()
      .single()

    if (error) {
      console.error('[Nudges API] Insert error:', error)
      return res.status(500).json({ error: 'Failed to create nudge' })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('[Nudges API] Unexpected error (create):', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function handleUpdateNudge(req, res, supabase) {
  try {
    const { id } = req.query

    if (!id) {
      return res.status(400).json({ error: 'Nudge ID is required' })
    }

    const validation = validateNudgeUpdate(req.body)

    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid nudge data', details: validation.errors })
    }

    const { data, error } = await supabase
      .from('in_app_nudges')
      .update(validation.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Nudges API] Update error:', error)
      return res.status(500).json({ error: 'Failed to update nudge' })
    }

    if (!data) {
      return res.status(404).json({ error: 'Nudge not found' })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('[Nudges API] Unexpected error (update):', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export async function handleToggleNudge(req, res, supabase) {
  try {
    const { id } = req.query
    const { is_active } = req.body

    if (!id) {
      return res.status(400).json({ error: 'Nudge ID is required' })
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' })
    }

    const { data, error } = await supabase
      .from('in_app_nudges')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Nudges API] Toggle error:', error)
      return res.status(500).json({ error: 'Failed to toggle nudge' })
    }

    if (!data) {
      return res.status(404).json({ error: 'Nudge not found' })
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('[Nudges API] Unexpected error (toggle):', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
