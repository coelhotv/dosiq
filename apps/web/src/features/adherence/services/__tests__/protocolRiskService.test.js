// src/features/adherence/services/__tests__/protocolRiskService.test.js

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calculateProtocolRisk,
  calculateAllProtocolRisks,
  RISK_LEVELS,
} from '@/features/adherence/services/protocolRiskService'

describe('protocolRiskService', () => {
  beforeEach(() => {
    // Usar data fixa para evitar flakiness perto de meia-noite (fix: Gemini issue #7)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-08T12:00:00Z'))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  describe('calculateProtocolRisk', () => {
    it('classifica como STABLE com adesao >=80% e trend >= -5%', () => {
      // 14/14 doses tomadas (100%), trend 0%
      // Result: adherence >= 80% AND trend >= -5% = STABLE

      const now = new Date()
      const logs = []

      // Days 1-14: 14 doses = 100% adherence
      for (let i = 1; i <= 14; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      const protocol = {
        id: 'proto-1',
        medicine_id: 'med-1',
        frequency: 'diário',
        time_schedule: ['08:00'],
        active: true,
      }

      const result = calculateProtocolRisk({ protocolId: 'proto-1', logs, protocol })

      expect(result.riskLevel).toBe(RISK_LEVELS.STABLE)
      expect(result.adherence14d).toBe(100)
      expect(result.trend7d).toBe(0)
    })

    it('classifica como ATTENTION com adesao 50-79%', () => {
      // 9/14 doses = 64% adherence = ATTENTION (not CRITICAL, not STABLE)

      const now = new Date()
      const logs = []
      // Create 9 doses spread across 14 days
      for (let i = 1; i <= 9; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      const protocol = {
        id: 'proto-1',
        medicine_id: 'med-1',
        frequency: 'diário',
        time_schedule: ['08:00'],
        active: true,
      }

      const result = calculateProtocolRisk({ protocolId: 'proto-1', logs, protocol })

      expect(result.riskLevel).toBe(RISK_LEVELS.ATTENTION)
      expect(result.adherence14d).toBe(64)
    })

    it('classifica como CRITICAL com adesao <50%', () => {
      // 5/14 doses = 36% adherence = CRITICAL

      const now = new Date()
      const logs = []
      // Create 5 doses spread across 14 days
      for (let i = 1; i <= 5; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      const protocol = {
        id: 'proto-1',
        medicine_id: 'med-1',
        frequency: 'diário',
        time_schedule: ['08:00'],
        active: true,
      }

      const result = calculateProtocolRisk({ protocolId: 'proto-1', logs, protocol })

      expect(result.riskLevel).toBe(RISK_LEVELS.CRITICAL)
      expect(result.adherence14d).toBe(36)
    })

    it('classifica como CRITICAL com trend < -15%', () => {
      // Week 1: 0 doses (0%), Week 2 (previous): 7 doses (100%) → trend = -100% = CRITICAL

      const now = new Date()
      const logs = []

      // Days 8-14 (previous week): 7 doses = 100%
      for (let i = 8; i <= 14; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      // Days 1-7 (recent week): 0 doses = 0%
      // (no logs added for this period)

      const protocol = {
        id: 'proto-1',
        medicine_id: 'med-1',
        frequency: 'diário',
        time_schedule: ['08:00'],
        active: true,
      }

      const result = calculateProtocolRisk({ protocolId: 'proto-1', logs, protocol })

      expect(result.trend7d).toBeLessThan(-15)
      expect(result.riskLevel).toBe(RISK_LEVELS.CRITICAL)
    })

    it('retorna STABLE quando dados insuficientes', () => {
      // Use 'quando_necessário' frequency: expected14d = 0 → hasEnoughData = false

      const now = new Date()
      const logs = []
      // Add some logs
      for (let i = 1; i <= 2; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      const protocol = {
        id: 'proto-1',
        medicine_id: 'med-1',
        frequency: 'quando_necessário',
        time_schedule: ['08:00'],
        active: true,
      }

      const result = calculateProtocolRisk({ protocolId: 'proto-1', logs, protocol })

      expect(result.hasEnoughData).toBe(false)
      expect(result.riskLevel).toBe(RISK_LEVELS.STABLE)
    })

    it('calcula trend corretamente', () => {
      // Week 1: 7 doses (100%), Week 2: 7 doses (100%) → trend = 0
      // Fix: remove duplicate logs (fix: Gemini issue #8)

      const now = new Date()
      const logs = []

      // Days 1-7 (recent week): 7 doses = 100%
      for (let i = 1; i <= 7; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      // Days 8-14 (previous week): 7 doses = 100%
      for (let i = 8; i <= 14; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      const protocol = {
        id: 'proto-1',
        medicine_id: 'med-1',
        frequency: 'diário',
        time_schedule: ['08:00'],
        active: true,
      }

      const result = calculateProtocolRisk({ protocolId: 'proto-1', logs, protocol })

      expect(result.trend7d).toBe(0)
      expect(result.adherence14d).toBe(100)
    })

    it('cap adherence at 100%', () => {
      // 20 doses in 14 days (more than expected 14) → capped at 100%

      const now = new Date()
      const logs = []
      // 20 doses in 14 days
      for (let i = 1; i <= 20; i++) {
        const date = new Date(now)
        date.setDate(date.getDate() - (i % 14 || 14))
        date.setHours(10, 0, 0, 0)
        logs.push({
          protocol_id: 'proto-1',
          medicine_id: 'med-1',
          taken_at: date.toISOString(),
          quantity_taken: 1,
        })
      }

      const protocol = {
        id: 'proto-1',
        medicine_id: 'med-1',
        frequency: 'diário',
        time_schedule: ['08:00'],
        active: true,
      }

      const result = calculateProtocolRisk({ protocolId: 'proto-1', logs, protocol })

      expect(result.adherence14d).toBe(100)
    })
  })

  describe('calculateAllProtocolRisks', () => {
    it('filtra protocolos inativos', () => {
      const protocols = [
        {
          id: 'proto-1',
          medicine_id: 'med-1',
          frequency: 'diário',
          time_schedule: ['08:00'],
          active: true,
        },
        {
          id: 'proto-2',
          medicine_id: 'med-2',
          frequency: 'diário',
          time_schedule: ['08:00'],
          active: false,
        },
      ]
      const logs = []

      const result = calculateAllProtocolRisks({ protocols, logs })

      expect(result.length).toBe(1)
      expect(result[0].protocolId).toBe('proto-1')
    })

    it('retorna array vazio sem protocolos', () => {
      const protocols = []
      const logs = []

      const result = calculateAllProtocolRisks({ protocols, logs })

      expect(result).toEqual([])
    })
  })
})
