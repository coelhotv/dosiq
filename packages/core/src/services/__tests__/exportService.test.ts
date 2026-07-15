// Testes do coletor do export LGPD (spec 008 — PO-1/PO-2/PO-4).
// O foco é o CONTRATO de coleta: escopo desmarcado não busca a tabela, dose-only não
// exporta lote, perfil sai pela allowlist (sem verification_token) e o e-mail entra no metadata.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createExportService, FULL_EXPORT_SCOPE } from '../exportService'

const FAKE_USER = 'user-uuid-1'

/** Builder fluente e "thenable" — igual ao do supabase-js. */
function makeBuilder(table: string, rowsByTable: Record<string, unknown[]>, calls: string[]) {
  const rows = rowsByTable[table] ?? []
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
  }
  for (const method of ['select', 'eq', 'order', 'limit', 'gte', 'lte']) {
    builder[method] = vi.fn((...args: unknown[]) => {
      if (method === 'select') calls.push(`${table}:select:${String(args[0]).replace(/\s+/g, ' ').trim()}`)
      if (method === 'gte' || method === 'lte') calls.push(`${table}:${method}:${String(args[1])}`)
      return builder
    })
  }
  return builder
}

function makeClient(rowsByTable: Record<string, unknown[]>) {
  const calls: string[] = []
  const tables: string[] = []
  return {
    calls,
    tables,
    client: {
      from: vi.fn((table: string) => {
        tables.push(table)
        return makeBuilder(table, rowsByTable, calls)
      }),
      auth: { getUser: vi.fn(async () => ({ data: { user: { email: 'maria@example.com' } } })) },
    } as never,
  }
}

const PROFILE_ROW = { display_name: 'Maria', stock_tracking_enabled: true, stock_paused_at: null }

const ROWS = {
  user_settings: [PROFILE_ROW],
  medicines: [{ id: 'med-1', name: 'Mounjaro', stock: [], purchases: [] }],
  protocols: [{ id: 'prot-1', medicine_id: 'med-1' }],
  medicine_logs: [{ id: 'log-1', medicine_id: 'med-1', quantity_taken: 1, taken_at: '2026-07-08T08:00:00-03:00' }],
  biomarkers_log: [{ id: 'bio-1', type: 'peso', value: 82, measured_at: '2026-07-10T07:00:00-03:00' }],
}

const getUserId = async () => FAKE_USER

describe('createExportService.collectBundle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('busca todas as seções do escopo completo e identifica o titular', async () => {
    const { client, tables } = makeClient(ROWS)
    const bundle = await createExportService({ client, getUserId }).collectBundle(FULL_EXPORT_SCOPE)

    expect(tables).toEqual(
      expect.arrayContaining(['user_settings', 'medicines', 'protocols', 'medicine_logs', 'biomarkers_log']),
    )
    expect(bundle.subject).toEqual({ userId: FAKE_USER, email: 'maria@example.com' })
    expect(bundle.biomarkers).toHaveLength(1)
    expect(bundle.stockTracked).toBe(true)
  })

  it('não toca a tabela de uma seção desmarcada (US2 — seletividade)', async () => {
    const { client, tables } = makeClient(ROWS)
    await createExportService({ client, getUserId }).collectBundle({
      ...FULL_EXPORT_SCOPE,
      includeBiomarkers: false,
      includeProfile: false,
      includeProtocols: false,
    })

    expect(tables).not.toContain('biomarkers_log')
    expect(tables).not.toContain('protocols')
  })

  it('perfil é lido pela allowlist — verification_token nunca é selecionado', async () => {
    const { client, calls } = makeClient(ROWS)
    await createExportService({ client, getUserId }).collectBundle(FULL_EXPORT_SCOPE)

    const profileSelect = calls.find((c) => c.startsWith('user_settings:select:display_name'))
    expect(profileSelect).toBeDefined()
    expect(profileSelect).not.toContain('verification_token')
  })

  it('046 Slice D: controle off vira metadado, mas os dados de estoque SÃO coletados (R-291)', async () => {
    const { client } = makeClient({
      ...ROWS,
      user_settings: [{ ...PROFILE_ROW, stock_tracking_enabled: false }],
    })
    const bundle = await createExportService({ client, getUserId }).collectBundle(FULL_EXPORT_SCOPE)

    // `stockTracked` reflete a preferência (metadado), mas NÃO gateia os dados: `stock` traz os
    // medicamentos com lotes/compras congelados — dado do titular, art. 18.
    expect(bundle.stockTracked).toBe(false)
    expect(bundle.stock).not.toBeNull()
    expect(Array.isArray(bundle.stock)).toBe(true)
  })

  it('período filtra SOMENTE os registros de dose', async () => {
    const { client, calls } = makeClient(ROWS)
    await createExportService({ client, getUserId }).collectBundle(FULL_EXPORT_SCOPE, {
      start: new Date(2026, 6, 1),
      end: new Date(2026, 6, 31),
    })

    expect(calls.filter((c) => c.includes(':gte:') || c.includes(':lte:')).every((c) => c.startsWith('medicine_logs:'))).toBe(true)
    expect(calls.some((c) => c.startsWith('medicine_logs:gte:'))).toBe(true)
  })

  it('borda solta: só "de" aplica gte, sem lte (paridade com o dialog web)', async () => {
    const { client, calls } = makeClient(ROWS)
    await createExportService({ client, getUserId }).collectBundle(FULL_EXPORT_SCOPE, {
      start: new Date(2026, 6, 1),
      end: null,
    })

    expect(calls.some((c) => c.startsWith('medicine_logs:gte:'))).toBe(true)
    expect(calls.some((c) => c.includes(':lte:'))).toBe(false)
  })

  it('borda solta: só "até" aplica lte, sem gte', async () => {
    const { client, calls } = makeClient(ROWS)
    await createExportService({ client, getUserId }).collectBundle(FULL_EXPORT_SCOPE, {
      start: null,
      end: new Date(2026, 6, 31),
    })

    expect(calls.some((c) => c.startsWith('medicine_logs:lte:'))).toBe(true)
    expect(calls.some((c) => c.includes(':gte:'))).toBe(false)
  })
})

describe('createExportService.buildExport', () => {
  it('JSON: nome de arquivo com timestamp local + conteúdo parseável', async () => {
    const { client } = makeClient(ROWS)
    const file = await createExportService({ client, getUserId }).buildExport({
      format: 'json',
      scope: FULL_EXPORT_SCOPE,
      now: new Date(2026, 6, 13, 9, 5),
    })

    expect(file.filename).toBe('dosiq_export_20260713_0905.json')
    expect(file.mimeType).toBe('application/json;charset=utf-8')
    expect(JSON.parse(file.content).metadata.userId).toBe(FAKE_USER)
  })

  it('CSV: BOM + seção de medidas presente', async () => {
    const { client } = makeClient(ROWS)
    const file = await createExportService({ client, getUserId }).buildExport({
      format: 'csv',
      scope: FULL_EXPORT_SCOPE,
      now: new Date(2026, 6, 13, 9, 5),
    })

    expect(file.filename).toBe('dosiq_export_20260713_0905.csv')
    expect(file.content.startsWith('﻿')).toBe(true)
    expect(file.content).toContain('=== MEDIDAS ===')
  })
})
