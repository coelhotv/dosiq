import { act, renderHook } from '@testing-library/react-native'
import { z } from 'zod'
import { useFormState } from '../useFormState'

// Schema mínimo para isolar os testes do hook (sem dependência de schemas reais)
const schema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  age: z.number().int().positive('Idade deve ser positiva'),
  email: z.string().email('Email inválido').optional(),
})

const initialValues = { name: '', age: 0, email: undefined }

describe('useFormState', () => {
  it('inicializa com valores fornecidos e estado limpo', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    expect(result.current.values).toEqual(initialValues)
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toEqual({})
    expect(result.current.isDirty).toBe(false)
    expect(result.current.isValid).toBe(true)
  })

  it('handleChange atualiza valor e marca isDirty', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    act(() => {
      result.current.handleChange('name', 'Ana')
    })

    expect(result.current.values.name).toBe('Ana')
    expect(result.current.isDirty).toBe(true)
  })

  it('handleChange limpa o erro do campo modificado', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    act(() => {
      result.current.validate()
    })
    expect(result.current.errors.name).toBeDefined()

    act(() => {
      result.current.handleChange('name', 'Ana')
    })

    expect(result.current.errors.name).toBeUndefined()
  })

  it('handleBlur marca touched e valida o campo', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    act(() => {
      result.current.handleChange('name', 'A')
    })
    act(() => {
      result.current.handleBlur('name')
    })

    expect(result.current.touched.name).toBe(true)
    expect(result.current.errors.name).toBe(
      'Nome deve ter pelo menos 2 caracteres',
    )
  })

  it('handleBlur com valor válido limpa erro pré-existente do campo', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    act(() => {
      result.current.validate()
    })
    expect(result.current.errors.name).toBeDefined()

    act(() => {
      result.current.handleChange('name', 'Ana')
    })
    act(() => {
      result.current.handleBlur('name')
    })

    expect(result.current.errors.name).toBeUndefined()
  })

  it('validate() retorna false e popula errors quando inválido', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    let isValid
    act(() => {
      isValid = result.current.validate()
    })

    expect(isValid).toBe(false)
    expect(result.current.errors.name).toBeDefined()
    expect(result.current.errors.age).toBeDefined()
    expect(result.current.touched.name).toBe(true)
    expect(result.current.touched.age).toBe(true)
    expect(result.current.isValid).toBe(false)
  })

  it('validate() retorna true e zera errors quando válido', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues: { name: 'Ana', age: 30 } }),
    )

    let isValid
    act(() => {
      isValid = result.current.validate()
    })

    expect(isValid).toBe(true)
    expect(result.current.errors).toEqual({})
    expect(result.current.isValid).toBe(true)
  })

  it('reset() restaura valores iniciais e limpa erros/touched', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    act(() => {
      result.current.handleChange('name', 'Ana')
      result.current.validate()
    })
    expect(result.current.isDirty).toBe(true)
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0)

    act(() => {
      result.current.reset()
    })

    expect(result.current.values).toEqual(initialValues)
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toEqual({})
    expect(result.current.isDirty).toBe(false)
  })

  it('reset(newInitial) atualiza initial e isDirty passa a comparar com novo', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    const next = { name: 'Ana', age: 30, email: undefined }
    act(() => {
      result.current.reset(next)
    })

    expect(result.current.values).toEqual(next)
    expect(result.current.isDirty).toBe(false)
  })

  it('setValues faz merge parcial e limpa erros dos campos sobrescritos', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    act(() => {
      result.current.validate()
    })
    expect(result.current.errors.name).toBeDefined()

    act(() => {
      result.current.setValues({ name: 'Ana' })
    })

    expect(result.current.values.name).toBe('Ana')
    expect(result.current.values.age).toBe(0) // preservado
    expect(result.current.errors.name).toBeUndefined()
    expect(result.current.errors.age).toBeDefined() // não sobrescrito
  })

  it('isDirty retorna false quando valores voltam ao inicial manualmente', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )

    act(() => {
      result.current.handleChange('name', 'Ana')
    })
    expect(result.current.isDirty).toBe(true)

    act(() => {
      result.current.handleChange('name', '')
    })
    expect(result.current.isDirty).toBe(false)
  })

  it('scrollToFirstError é função (NOP na v1)', () => {
    const { result } = renderHook(() =>
      useFormState(schema, { initialValues }),
    )
    expect(typeof result.current.scrollToFirstError).toBe('function')
    expect(() => result.current.scrollToFirstError()).not.toThrow()
  })
})
