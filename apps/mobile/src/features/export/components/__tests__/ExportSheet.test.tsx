// ExportSheet.test.tsx — sheet nativo de export LGPD (spec 008, Adendo 2026-07-13).
// Framework: Jest (jest-expo) — rodar em apps/mobile/
//
// jest.mock é hoisted pelo Babel — factories não referenciam vars externas; usar require()
// após o mock pra acessar os spies (padrão AP-116).

import { Platform } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ExportSheet from '../ExportSheet'
import { useStockTracking as useStockTrackingImport } from '@shared/hooks/useStockTracking'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useStockTracking = useStockTrackingImport as any

const mockBuildExport = jest.fn()

jest.mock('@dosiq/core', () => ({
  createExportService: () => ({ buildExport: (...args) => mockBuildExport(...args) }),
  getNow: () => new Date('2026-07-13T12:00:00-03:00'),
  formatDatePtBR: (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
}))

// Picker imperativo do Android: o teste dispara o onChange como o SO faria.
const mockPickerOpen = jest.fn()
const mockIosPickerProps = { current: null }
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  // O picker iOS é renderizado (overlay); o teste captura as props p/ simular o giro do spinner.
  default: (props) => {
    mockIosPickerProps.current = props
    return null
  },
  DateTimePickerAndroid: { open: (...args) => mockPickerOpen(...args) },
}))

jest.mock('@platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }),
      ),
    },
  },
}))

jest.mock('@shared/hooks/useStockTracking', () => ({
  useStockTracking: jest.fn(),
}))

const mockWriteAsStringAsync = jest.fn()
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: (...args) => mockWriteAsStringAsync(...args),
}))

const mockIsAvailableAsync = jest.fn()
const mockShareAsync = jest.fn()
jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args) => mockShareAsync(...args),
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

describe('ExportSheet', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    useStockTracking.mockReturnValue({ enabled: true, pausedAt: null, ready: true, refresh: jest.fn() })
    mockIsAvailableAsync.mockResolvedValue(true)
    mockBuildExport.mockResolvedValue({
      filename: 'dosiq_export_20260713.json',
      mimeType: 'application/json;charset=utf-8',
      content: '{}',
    })
  })

  it('escopo default: todos os checkboxes marcados (incl. estoque quando controlado)', () => {
    const { getByLabelText } = render(<ExportSheet visible onClose={onClose} />)

    expect(getByLabelText('Perfil e configurações').props.accessibilityState.checked).toBe(true)
    expect(getByLabelText('Estoque').props.accessibilityState.checked).toBe(true)
    expect(getByLabelText('Medidas e biomarcadores').props.accessibilityState.checked).toBe(true)
  })

  it('desmarcar uma seção reflete no scope passado ao core', async () => {
    const { getByLabelText, getByText } = render(<ExportSheet visible onClose={onClose} />)

    fireEvent.press(getByLabelText('Tratamentos'))
    fireEvent.press(getByText('Exportar'))

    await waitFor(() => expect(mockBuildExport).toHaveBeenCalled())

    const call = mockBuildExport.mock.calls[0][0]
    expect(call.scope.includeProtocols).toBe(false)
    expect(call.scope.includeProfile).toBe(true)
    expect(call.dateRange).toBeNull()
  })

  it('046 Slice D: checkbox de estoque PRESENTE mesmo dose-only — dado do titular (R-291)', () => {
    // Antes, o checkbox sumia quando o controle estava off, escondendo os lotes/compras congelados
    // do titular. Agora ele é permanente: exportar é acesso (art. 18), não uma feature ligável.
    useStockTracking.mockReturnValue({ enabled: false, pausedAt: null, ready: true, refresh: jest.fn() })

    const { getByLabelText } = render(<ExportSheet visible onClose={onClose} />)

    expect(getByLabelText('Estoque').props.accessibilityState.checked).toBe(true)
  })

  it('046 Slice D: dose-only inclui estoque no scope passado ao core (não recorta mais)', async () => {
    useStockTracking.mockReturnValue({ enabled: false, pausedAt: null, ready: true, refresh: jest.fn() })

    const { getByText } = render(<ExportSheet visible onClose={onClose} />)
    fireEvent.press(getByText('Exportar'))

    await waitFor(() => expect(mockBuildExport).toHaveBeenCalled())
    expect(mockBuildExport.mock.calls[0][0].scope.includeStock).toBe(true)
  })

  it('caminho de sucesso: writeAsStringAsync + shareAsync com o filename do core', async () => {
    const { getByText } = render(<ExportSheet visible onClose={onClose} />)

    fireEvent.press(getByText('Exportar'))

    await waitFor(() => expect(mockShareAsync).toHaveBeenCalled())

    expect(mockWriteAsStringAsync).toHaveBeenCalledWith(
      'file:///cache/dosiq_export_20260713.json',
      '{}',
      expect.objectContaining({ encoding: 'utf8' }),
    )
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///cache/dosiq_export_20260713.json',
      expect.objectContaining({ mimeType: 'application/json;charset=utf-8' }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  // O picker de data é imperativo no Android (DateTimePickerAndroid) e inline no iOS; o
  // jest-expo roda como iOS por padrão, então o caminho Android precisa ser pedido.
  describe('período (Android)', () => {
    const originalOS = Platform.OS

    beforeEach(() => {
      Platform.OS = 'android'
    })

    afterEach(() => {
      Platform.OS = originalOS
    })

  it('período opcional: só "de" preenchido chega ao core com a borda solta', async () => {
    const { getByLabelText, getByText } = render(<ExportSheet visible onClose={onClose} />)

    fireEvent.press(getByLabelText('De: sem data'))
    // Simula o usuário confirmando a data no picker do SO.
    act(() => mockPickerOpen.mock.calls[0][0].onChange({ type: 'set' }, new Date(2026, 6, 1)))

    expect(getByLabelText('De: 01/07/2026')).toBeTruthy()

    fireEvent.press(getByText('Exportar'))
    await waitFor(() => expect(mockBuildExport).toHaveBeenCalled())

    expect(mockBuildExport.mock.calls[0][0].dateRange).toEqual({
      start: new Date(2026, 6, 1),
      end: null,
    })
  })

  it('período invertido (De > Até) bloqueia o export com mensagem', async () => {
    const { getByLabelText, getByText, findByText } = render(<ExportSheet visible onClose={onClose} />)

    fireEvent.press(getByLabelText('De: sem data'))
    act(() => mockPickerOpen.mock.calls[0][0].onChange({ type: 'set' }, new Date(2026, 6, 31)))
    fireEvent.press(getByLabelText('Até: sem data'))
    act(() => mockPickerOpen.mock.calls[1][0].onChange({ type: 'set' }, new Date(2026, 6, 1)))

    fireEvent.press(getByText('Exportar'))

    expect(await findByText('A data inicial não pode ser depois da final.')).toBeTruthy()
    expect(mockBuildExport).not.toHaveBeenCalled()
  })

  it('cancelar o picker do SO não altera o período', () => {
    const { getByLabelText } = render(<ExportSheet visible onClose={onClose} />)

    fireEvent.press(getByLabelText('De: sem data'))
    act(() => mockPickerOpen.mock.calls[0][0].onChange({ type: 'dismissed' }, undefined))

    expect(getByLabelText('De: sem data')).toBeTruthy()
  })
  })

  // iOS: overlay com spinner + Cancelar/Confirmar (o picker inline empurrava o sheet pra fora
  // da tela; Modal-sobre-Modal engole os gestos). Só o Confirmar grava a data.
  describe('período (iOS)', () => {
    it('confirmar o overlay grava a data escolhida', async () => {
      const { getByLabelText, getByText } = render(<ExportSheet visible onClose={onClose} />)

      fireEvent.press(getByLabelText('De: sem data'))
      act(() => mockIosPickerProps.current.onChange({ type: 'set' }, new Date(2026, 6, 1)))
      fireEvent.press(getByText('Confirmar'))

      expect(getByLabelText('De: 01/07/2026')).toBeTruthy()

      fireEvent.press(getByText('Exportar'))
      await waitFor(() => expect(mockBuildExport).toHaveBeenCalled())

      expect(mockBuildExport.mock.calls[0][0].dateRange).toEqual({
        start: new Date(2026, 6, 1),
        end: null,
      })
    })

    it('cancelar o overlay descarta a data em edição', () => {
      const { getByLabelText, queryByText } = render(<ExportSheet visible onClose={onClose} />)

      fireEvent.press(getByLabelText('De: sem data'))
      act(() => mockIosPickerProps.current.onChange({ type: 'set' }, new Date(2026, 6, 1)))
      fireEvent.press(getByLabelText('Cancelar data'))

      expect(getByLabelText('De: sem data')).toBeTruthy()
      expect(queryByText('Confirmar')).toBeNull()
    })
  })

  it('erro de share mostra mensagem amigável', async () => {
    mockIsAvailableAsync.mockResolvedValue(false)

    const { getByText, findByText } = render(<ExportSheet visible onClose={onClose} />)

    fireEvent.press(getByText('Exportar'))

    expect(await findByText('Compartilhamento não disponível neste dispositivo.')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
