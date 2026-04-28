import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendNow, isInQuietHours } from './notificationGate.js';

describe('shouldSendNow', () => {
  test('silent → false', () => {
    assert.equal(shouldSendNow({ mode: 'silent', quietHoursStart: null, quietHoursEnd: null, currentHHMM: '10:00' }), false)
  })

  test('digest_morning → false', () => {
    assert.equal(shouldSendNow({ mode: 'digest_morning', quietHoursStart: null, quietHoursEnd: null, currentHHMM: '10:00' }), false)
  })

  test('realtime sem quiet hours → true', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: null, quietHoursEnd: null, currentHHMM: '10:00' }), true)
  })

  test('realtime dentro QH normal (13:00-15:00, current=14:00) → false', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '14:00' }), false)
  })

  test('realtime fora QH normal (13:00-15:00, current=16:00) → true', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '16:00' }), true)
  })

  test('realtime dentro QH cross-midnight (22:00-07:00, current=23:00) → false', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '22:00', quietHoursEnd: '07:00', currentHHMM: '23:00' }), false)
  })

  test('realtime dentro QH cross-midnight (22:00-07:00, current=01:00) → false', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '22:00', quietHoursEnd: '07:00', currentHHMM: '01:00' }), false)
  })

  test('realtime fora QH cross-midnight (22:00-07:00, current=10:00) → true', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '22:00', quietHoursEnd: '07:00', currentHHMM: '10:00' }), true)
  })

  test('QH start=null → não suprime por horário', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: null, quietHoursEnd: '15:00', currentHHMM: '14:00' }), true)
  })

  test('QH end=null → não suprime por horário', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: null, currentHHMM: '14:00' }), true)
  })

  test('current=start (inclusive) → dentro', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '13:00' }), false)
  })

  test('current=end (exclusive) → fora', () => {
    assert.equal(shouldSendNow({ mode: 'realtime', quietHoursStart: '13:00', quietHoursEnd: '15:00', currentHHMM: '15:00' }), true)
  })
})

describe('isInQuietHours', () => {
  test('start e end null → false', () => {
    assert.equal(isInQuietHours('10:00', null, null), false)
  })

  test('janela normal: dentro', () => {
    assert.equal(isInQuietHours('14:00', '13:00', '15:00'), true)
  })

  test('janela normal: fora', () => {
    assert.equal(isInQuietHours('16:00', '13:00', '15:00'), false)
  })

  test('cross-midnight: dentro (após start)', () => {
    assert.equal(isInQuietHours('23:00', '22:00', '07:00'), true)
  })

  test('cross-midnight: dentro (antes de end)', () => {
    assert.equal(isInQuietHours('01:00', '22:00', '07:00'), true)
  })

  test('cross-midnight: fora', () => {
    assert.equal(isInQuietHours('10:00', '22:00', '07:00'), false)
  })
})
