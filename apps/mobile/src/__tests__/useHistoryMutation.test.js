/**
 * Testes para useHistoryMutation hook
 * Jest + jest-expo com @testing-library/react-native
 */

import { renderHook, act } from '@testing-library/react-native'
import { useHistoryMutation } from '../features/history/hooks/useHistoryMutation'

jest.mock('../features/dose/services/doseService', () => ({
  registerDose: jest.fn(),
  undoDose: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  removeItem: jest.fn(() => Promise.resolve()),
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
}))

import { registerDose, undoDose } from '../features/dose/services/doseService'
import AsyncStorage from '@react-native-async-storage/async-storage'

describe('useHistoryMutation', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('registerRetro — sucesso — chama onSuccess e limpa cache', async () => {
    // Setup
    registerDose.mockResolvedValue({ success: true })
    const onSuccess = jest.fn()

    const { result } = renderHook(() =>
      useHistoryMutation({ onSuccess })
    )

    // Execute
    await act(async () => {
      await result.current.registerRetro(
        {
          medicine_id: 'med-1',
          taken_at: '2026-01-01T08:00:00',
          quantity_taken: 1,
        },
        'inst-1'
      )
    })

    // Assertions
    expect(registerDose).toHaveBeenCalledWith(
      expect.objectContaining({
        medicine_id: 'med-1',
        taken_at: '2026-01-01T08:00:00',
        quantity_taken: 1,
      }),
      'inst-1'
    )
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@dosiq/today-snapshot'
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  test('registerRetro — falha — seta error', async () => {
    // Setup
    registerDose.mockResolvedValue({
      success: false,
      error: 'Estoque insuficiente',
    })
    const onSuccess = jest.fn()

    const { result } = renderHook(() =>
      useHistoryMutation({ onSuccess })
    )

    // Execute
    await act(async () => {
      await result.current.registerRetro(
        {
          medicine_id: 'med-1',
          taken_at: '2026-01-01T08:00:00',
          quantity_taken: 1,
        },
        'inst-1'
      )
    })

    // Assertions
    expect(result.current.error).toBe('Estoque insuficiente')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('undo — sucesso — chama onSuccess', async () => {
    // Setup
    undoDose.mockResolvedValue({ success: true })
    const onSuccess = jest.fn()

    const { result } = renderHook(() =>
      useHistoryMutation({ onSuccess })
    )

    // Execute
    await act(async () => {
      await result.current.undo('inst-1')
    })

    // Assertions
    expect(undoDose).toHaveBeenCalledWith('inst-1')
    expect(onSuccess).toHaveBeenCalled()
  })

  test('undo — falha — seta error', async () => {
    // Setup
    undoDose.mockResolvedValue({
      success: false,
      error: 'Erro ao desfazer',
    })
    const onSuccess = jest.fn()

    const { result } = renderHook(() =>
      useHistoryMutation({ onSuccess })
    )

    // Execute
    await act(async () => {
      await result.current.undo('inst-1')
    })

    // Assertions
    expect(result.current.error).toBe('Erro ao desfazer')
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
