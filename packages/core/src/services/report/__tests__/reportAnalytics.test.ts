// Allowlist do evento de relatório (spec 097 A2 — PO-SEC-5).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildReportModel } from '../reportModel'
import { REPORT_EVENT_KEYS, reportSectionsOf, reportSizeBucket, toReportEventPayload } from '../reportAnalytics'
import { fixture, GEN } from './reportFixture'

describe('toReportEventPayload', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  it('só passam as chaves da allowlist', () => {
    const payload = toReportEventPayload({
      platform: 'web',
      period: 30,
      sections: 'medications,intakes',
      duration_ms: 812,
      size_bucket: 'lt_100k',
      error_code: 'collect',
      error: 'Glifage 850 mg — falhou',
      patientName: 'Ana',
      html: '<html>',
      fileSize: 1234,
    })
    expect(Object.keys(payload).sort()).toEqual([...REPORT_EVENT_KEYS].sort())
    expect(JSON.stringify(payload)).not.toMatch(/Ana|Glifage|<html/)
  })

  it('valor não primitivo é descartado mesmo com chave permitida', () => {
    expect(toReportEventPayload({ sections: { medications: ['Glifage'] } as unknown as string })).toEqual({})
  })

  it('error_code fora do vocabulário vira "unknown" (mensagem livre nunca passa)', () => {
    expect(toReportEventPayload({ error_code: 'Erro ao ler Glifage' }).error_code).toBe('unknown')
  })

  it('sections lista só as seções presentes, por nome técnico', () => {
    const sections = reportSectionsOf(buildReportModel(fixture({ stockTrackingEnabled: false }), { generatedAt: GEN }))
    expect(sections).toContain('medications')
    expect(sections).not.toContain('stock')
  })

  it.each([
    [0, 'lt_100k'],
    [99_999, 'lt_100k'],
    [300_000, 'lt_500k'],
    [2_000_000, 'gte_1m'],
  ])('reportSizeBucket(%i) = %s', (bytes, bucket) => {
    expect(reportSizeBucket(bytes)).toBe(bucket)
  })
})
