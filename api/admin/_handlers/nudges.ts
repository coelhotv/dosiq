// api/admin/_handlers/nudges.js
// Nudge admin handlers — create, read, update, toggle

// TODO(040-F3): dup local de packages/core/src/schemas/nudgeSchema.ts —
// import direto quebra em Node ESM puro (arquivo .ts sem build step em api/).
// Reconciliar via bundler/loader de F3 e remover esta cópia.
import { z } from 'zod'

const TARGET_VIEW_OPTIONS = ['dashboard', 'profile', 'any']
const ACTION_TYPE_OPTIONS = ['navigate', 'open_url', 'dismiss_only']
const PLATFORM_OPTIONS = ['ios', 'android', 'all']

const nudgeBaseSchema = z.object({
  title: z
    .string({ error: 'Título é obrigatório' })
    .min(2, 'Título deve ter ao menos 2 caracteres')
    .max(100, 'Título não pode ter mais de 100 caracteres')
    .trim(),

  body: z
    .string({ error: 'Descrição é obrigatório' })
    .min(5, 'Descrição deve ter ao menos 5 caracteres')
    .max(200, 'Descrição não pode ter mais de 200 caracteres')
    .trim(),

  target_view: z
    .enum(TARGET_VIEW_OPTIONS, { error: 'Superfície inválida' }),

  action_type: z
    .enum(ACTION_TYPE_OPTIONS, { error: 'Tipo de ação inválida' }),

  platform: z
    .enum(PLATFORM_OPTIONS, { error: 'Plataforma inválida' }),

  priority: z
    .number()
    .int('Prioridade deve ser número inteiro')
    .min(0, 'Prioridade mínima é 0')
    .max(100, 'Prioridade máxima é 100')
    .default(0)
    .nullable()
    .optional(),

  start_at: z
    .string()
    .datetime({ message: 'Data/hora inicial deve ser ISO 8601 com timezone' })
    .nullable()
    .optional(),

  end_at: z
    .string()
    .datetime({ message: 'Data/hora final deve ser ISO 8601 com timezone' })
    .nullable()
    .optional(),

  min_app_version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Versão mínima do app deve ser X.Y.Z')
    .nullable()
    .optional(),

  max_app_version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Versão máxima do app deve ser X.Y.Z')
    .nullable()
    .optional(),

  action_payload: z
    .record(z.string(), z.any())
    .nullable()
    .optional(),
})

const nudgeSchema = nudgeBaseSchema.superRefine((data, ctx) => {
  if (data.action_type === 'navigate') {
    const payload = data.action_payload
    if (!payload || (!payload.screen && !payload.route)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tela ou rota obrigatória para navegação',
        path: ['action_payload'],
      })
    }
  } else if (data.action_type === 'open_url') {
    const payload = data.action_payload
    if (!payload || !payload.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'URL obrigatória para ação de abrir URL',
        path: ['action_payload'],
      })
    } else {
      try {
        new URL(payload.url)
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'URL inválida',
          path: ['action_payload'],
        })
      }
    }
  }
})

function validateNudgeCreate(data) {
  const result = nudgeSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}

function validateNudgeUpdate(data) {
  const partialSchema = nudgeBaseSchema.partial()
  const result = partialSchema.safeParse(data)

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path[0],
        message: issue.message,
      })),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}

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
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Nudge não encontrado' })
      }
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
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Nudge não encontrado' })
      }
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
