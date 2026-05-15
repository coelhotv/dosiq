jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  multiRemove: jest.fn().mockResolvedValue(undefined),
}))

import { act, renderHook, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { useMutation } from '../useMutation'

afterEach(() => {
  jest.clearAllMocks()
})

// 1. Estado inicial
test('estado inicial: isLoading=false, error=null', () => {
  const { result } = renderHook(() => useMutation())
  expect(result.current.isLoading).toBe(false)
  expect(result.current.error).toBeNull()
})

// 2. Caminho de sucesso
test('sucesso: onSuccess chamado, isLoading volta false, retorna resultado', async () => {
  const onSuccess = jest.fn()
  const { result } = renderHook(() => useMutation({ onSuccess }))

  let returnValue
  await act(async () => {
    returnValue = await result.current.mutate(async () => 'ok')
  })

  expect(onSuccess).toHaveBeenCalledWith('ok')
  expect(returnValue).toBe('ok')
  expect(result.current.isLoading).toBe(false)
})

// 3. Caminho de erro
test('erro: onError chamado, error state definido, retorna undefined', async () => {
  const onError = jest.fn()
  const { result } = renderHook(() => useMutation({ onError }))

  const boom = new Error('fail')
  let returnValue
  await act(async () => {
    returnValue = await result.current.mutate(async () => { throw boom })
  })

  expect(onError).toHaveBeenCalledWith(boom)
  expect(result.current.error).toBe(boom)
  expect(returnValue).toBeUndefined()
  expect(result.current.isLoading).toBe(false)
})

// 4. Guard double-submit
test('double-submit: segunda chamada retorna undefined, fn executada uma vez', async () => {
  const { result } = renderHook(() => useMutation())

  let resolveFn
  const slowFn = jest.fn(() => new Promise((r) => { resolveFn = r }))

  let firstReturn
  let secondReturn

  // Inicia primeira chamada sem await
  act(() => {
    result.current.mutate(slowFn).then((v) => { firstReturn = v })
  })

  // Segunda chamada síncrona enquanto a primeira ainda está em voo
  await act(async () => {
    secondReturn = await result.current.mutate(slowFn)
  })

  expect(secondReturn).toBeUndefined()
  expect(slowFn).toHaveBeenCalledTimes(1)

  // Resolve a primeira para limpeza
  await act(async () => {
    resolveFn('done')
  })

  expect(firstReturn).toBe('done')
})

// 5. invalidateKeys: multiRemove chamado com chaves corretas
test('invalidateKeys: AsyncStorage.multiRemove chamado com as chaves', async () => {
  const { result } = renderHook(() =>
    useMutation({ invalidateKeys: ['k1', 'k2'] }),
  )

  await act(async () => {
    await result.current.mutate(async () => 'dados')
  })

  expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['k1', 'k2'])
})

// 6. Falha em invalidateKeys não impede sucesso
test('falha em multiRemove não derruba onSuccess', async () => {
  AsyncStorage.multiRemove.mockRejectedValueOnce(new Error('storage falhou'))
  const onSuccess = jest.fn()

  const { result } = renderHook(() =>
    useMutation({ onSuccess, invalidateKeys: ['k1'] }),
  )

  let returnValue
  await act(async () => {
    returnValue = await result.current.mutate(async () => 'resultado')
  })

  expect(onSuccess).toHaveBeenCalledWith('resultado')
  expect(returnValue).toBe('resultado')
})

// 7. Haptics no sucesso
test('haptics: notificationAsync chamado com Success no sucesso', async () => {
  const { result } = renderHook(() => useMutation())

  await act(async () => {
    await result.current.mutate(async () => 42)
  })

  expect(Haptics.notificationAsync).toHaveBeenCalledWith(
    Haptics.NotificationFeedbackType.Success,
  )
})

// 8. Haptics no erro
test('haptics: notificationAsync chamado com Error no erro', async () => {
  const { result } = renderHook(() => useMutation())

  await act(async () => {
    await result.current.mutate(async () => { throw new Error('x') })
  })

  expect(Haptics.notificationAsync).toHaveBeenCalledWith(
    Haptics.NotificationFeedbackType.Error,
  )
})

// 9. reset() limpa error
test('reset: limpa estado de erro', async () => {
  const { result } = renderHook(() => useMutation())

  await act(async () => {
    await result.current.mutate(async () => { throw new Error('err') })
  })

  expect(result.current.error).not.toBeNull()

  act(() => {
    result.current.reset()
  })

  expect(result.current.error).toBeNull()
})

// 10. Timeout: rejeita após timeoutMs
test('timeout: error.message contém "Timeout: operação excedeu"', async () => {
  const onError = jest.fn()
  const { result } = renderHook(() =>
    useMutation({ onError, timeoutMs: 50 }),
  )

  // Promise que nunca resolve
  await act(async () => {
    await result.current.mutate(() => new Promise(() => {}))
  })

  expect(result.current.error).not.toBeNull()
  expect(result.current.error.message).toMatch(/Timeout: operação excedeu/)
  expect(onError).toHaveBeenCalled()
}, 3000)

// 11. onSuccess e onError opcionais: não lança quando omitidos
test('callbacks opcionais: não lança sem onSuccess/onError', async () => {
  const { result } = renderHook(() => useMutation())

  // Sucesso sem callbacks
  await expect(
    act(async () => {
      await result.current.mutate(async () => 'sem callback')
    }),
  ).resolves.not.toThrow()

  // Erro sem callbacks
  await expect(
    act(async () => {
      await result.current.mutate(async () => { throw new Error('sem handler') })
    }),
  ).resolves.not.toThrow()
})
