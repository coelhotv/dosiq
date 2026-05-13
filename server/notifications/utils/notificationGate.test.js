// Migrado de node:test → vitest (Gate 6 — R-276)
// Vitest é o test runner canônico deste projeto. node:test não é reconhecido pelo vitest.

import { describe, it, expect } from 'vitest'
import { shouldSendNow, isInQuietHours } from './notificationGate.js'

describe('shouldSendNow', () => {
  it('silent → false', () => {
    expect(shouldSendNow({ mode: 'silent', quietHoursStart: null, quietHoursEnd: null, currentHHMM: '10:00' })).toBe(false)
  })

  it('digest_morning → false', () => {
    expect(shouldSendNow({ mode: 'digest_morning', quietHoursStart: null, quietHoursEnd: null, currentHHMM: '10:00' })).toBe(false)
  })

  it('realtime sem quiet hours → true', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: null, quietHoursEnd: null, currentHHMM: '10:00' })).toBe(true)
  })

  it('realtime dentro QH normal (13:00-15:00, current=14:00) → false', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '14:00' })).toBe(false)
  })

  it('realtime fora QH normal (13:00-15:00, current=16:00) → true', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '16:00' })).toBe(true)
  })

  it('realtime dentro QH cross-midnight (22:00-07:00, current=23:00) → false', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '22:00', quietHoursEnd: '07:00', currentHHMM: '23:00' })).toBe(false)
  })

  it('realtime dentro QH cross-midnight (22:00-07:00, current=01:00) → false', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '22:00', quietHoursEnd: '07:00', currentHHMM: '01:00' })).toBe(false)
  })

  it('realtime fora QH cross-midnight (22:00-07:00, current=10:00) → true', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '22:00', quietHoursEnd: '07:00', currentHHMM: '10:00' })).toBe(true)
  })

  it('QH start=null → não suprime por horário', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: null, quietHoursEnd: '15:00', currentHHMM: '14:00' })).toBe(true)
  })

  it('QH end=null → não suprime por horário', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: null, currentHHMM: '14:00' })).toBe(true)
  })

  it('current=start (inclusive) → dentro', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '13:00' })).toBe(false)
  })

  it('current=end (exclusive) → fora', () => {
    expect(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '15:00' })).toBe(true)
  })
})

describe('isInQuietHours', () => {
  it('start e end null → false', () => {
    expect(isInQuietHours('10:00', null, null)).toBe(false)
  })

  it('janela normal: dentro', () => {
    expect(isInQuietHours('14:00', '13:00', '15:00')).toBe(true)
  })

  it('janela normal: fora', () => {
    expect(isInQuietHours('16:00', '13:00', '15:00')).toBe(false)
  })

  it('cross-midnight: dentro (após start)', () => {
    expect(isInQuietHours('23:00', '22:00', '07:00')).toBe(true)
  })

  it('cross-midnight: dentro (antes de end)', () => {
    expect(isInQuietHours('01:00', '22:00', '07:00')).toBe(true)
  })

  it('cross-midnight: fora', () => {
    expect(isInQuietHours('10:00', '22:00', '07:00')).toBe(false)
  })
})
