// Testes de bundleInfo (spec 051-A · FR-011/FR-016)
// O foco é o caminho DEGENERADO: o estado normal em dev/Expo Go é "tudo null", e é justamente
// esse estado que não pode virar tela quebrada nem tag vazia no Sentry.
import * as Updates from 'expo-updates'
import { getBundleInfo, shortUpdateId, formatBundleLabel, formatChannelLabel } from './bundleInfo'

jest.mock('expo-updates', () => ({
  updateId: null,
  channel: null,
  runtimeVersion: null,
  isEmbeddedLaunch: true,
}))

const mockUpdates = Updates as unknown as {
  updateId: string | null
  channel: string | null
  runtimeVersion: string | null
  isEmbeddedLaunch: boolean
}

afterEach(() => {
  jest.clearAllMocks()
  jest.clearAllTimers()
  mockUpdates.updateId = null
  mockUpdates.channel = null
  mockUpdates.runtimeVersion = null
  mockUpdates.isEmbeddedLaunch = true
})

describe('shortUpdateId', () => {
  it('encurta para 8 caracteres', () => {
    expect(shortUpdateId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('a1b2c3d4')
  })

  it('devolve null quando não há update (bundle embutido)', () => {
    expect(shortUpdateId(null)).toBeNull()
  })

  it('não estoura em id mais curto que o prefixo', () => {
    expect(shortUpdateId('abc')).toBe('abc')
  })
})

describe('getBundleInfo', () => {
  it('reflete o update aplicado', () => {
    mockUpdates.updateId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    mockUpdates.channel = 'preview'
    mockUpdates.runtimeVersion = '0.30.0'
    mockUpdates.isEmbeddedLaunch = false

    expect(getBundleInfo()).toEqual({
      updateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      channel: 'preview',
      runtimeVersion: '0.30.0',
      isEmbedded: false,
    })
  })

  it('devolve estado embutido quando OTA está inativo (dev client / Expo Go)', () => {
    expect(getBundleInfo()).toEqual({
      updateId: null,
      channel: null,
      runtimeVersion: null,
      isEmbedded: true,
    })
  })
})

describe('formatBundleLabel', () => {
  it('mostra o id curto + canal quando há OTA aplicado', () => {
    expect(
      formatBundleLabel({
        updateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        channel: 'production',
        runtimeVersion: '0.30.0',
        isEmbedded: false,
      })
    ).toBe('Atualização a1b2c3d4')
  })

  // Regressão do bug achado no smoke em device real (PR 1.6): o expo-updates atribui updateId
  // TAMBÉM ao bundle embutido, então num build real o id nunca é nulo. Ramificar por updateId
  // fazia todo app dizer "Atualização <id>" sem OTA nenhum aplicado, mandando o suporte procurar
  // no dashboard do EAS um id que não está publicado lá.
  it('diz "versão original" mesmo com updateId PRESENTE, quando isEmbedded é true', () => {
    expect(
      formatBundleLabel({
        updateId: '25d83045-aaaa-bbbb-cccc-ddddeeeeffff',
        channel: 'preview',
        runtimeVersion: '0.30.0',
        isEmbedded: true,
      })
    ).toBe('Versão original')
  })

  it('diz "versão original" em vez de sumir quando nenhum OTA foi aplicado', () => {
    expect(
      formatBundleLabel({ updateId: null, channel: 'production', runtimeVersion: '0.30.0', isEmbedded: true })
    ).toBe('Versão original')
  })

  it('não deixa separador órfão quando nem canal existe', () => {
    expect(
      formatBundleLabel({ updateId: null, channel: null, runtimeVersion: null, isEmbedded: true })
    ).toBe('Versão original')
  })
})

describe('formatChannelLabel', () => {
  it('devolve o canal em linha própria', () => {
    expect(
      formatChannelLabel({ updateId: null, channel: 'preview', runtimeVersion: '0.30.0', isEmbedded: true })
    ).toBe('Canal preview')
  })

  // Regressão do separador órfão achado no smoke do PR 1.6: o nativo devolve STRING VAZIA
  // (não null) quando o canal falta, e a tela exibia um "·" solto, sem nada depois.
  it('devolve null quando o canal é string vazia (ausência que o nativo disfarça)', () => {
    expect(
      formatChannelLabel({ updateId: null, channel: '', runtimeVersion: '0.30.0', isEmbedded: true })
    ).toBeNull()
  })

  it('devolve null quando o canal é só espaço em branco', () => {
    expect(
      formatChannelLabel({ updateId: null, channel: '   ', runtimeVersion: '0.30.0', isEmbedded: true })
    ).toBeNull()
  })

  it('devolve null quando o canal é null', () => {
    expect(
      formatChannelLabel({ updateId: null, channel: null, runtimeVersion: null, isEmbedded: true })
    ).toBeNull()
  })
})
