// Testes para resolveChannelsForUser policy
// 9 casos obrigatórios cobrindo todas as preferências e disponibilidades

import { describe, it, expect, vi } from 'vitest'
import { resolveChannelsForUser } from './resolveChannelsForUser.js'

describe('resolveChannelsForUser', () => {
  const mockRepositories = {
    preferences: {
      getByUserId: vi.fn(),
      hasTelegramChat: vi.fn(),
    },
    devices: {
      listActiveByUser: vi.fn(),
    },
  }

  const userId = 'user-123'

  // Caso 1: preference='telegram' + hasTelegram → ['telegram']
  it('case 1: telegram preference with telegram available', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('telegram')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(true)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual(['telegram'])
  })

  // Caso 2: preference='telegram' + !hasTelegram → []
  it('case 2: telegram preference without telegram available', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('telegram')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(false)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual([])
  })

  // Caso 3: preference='mobile_push' + devices ativos → ['mobile_push']
  it('case 3: mobile_push preference with active devices', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('mobile_push')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(false)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { id: 'dev-1', push_token: 'token-1' },
    ])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual(['mobile_push'])
  })

  // Caso 4: preference='mobile_push' + sem devices → []
  it('case 4: mobile_push preference without active devices', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('mobile_push')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(false)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual([])
  })

  // Caso 5: preference='both' + hasTelegram + devices ativos → ['telegram', 'mobile_push']
  it('case 5: both preference with telegram and devices available', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('both')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(true)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { id: 'dev-1', push_token: 'token-1' },
    ])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual(['telegram', 'mobile_push'])
  })

  // Caso 6: preference='both' + hasTelegram + sem devices → ['telegram']
  it('case 6: both preference with telegram but no devices', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('both')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(true)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual(['telegram'])
  })

  // Caso 7: preference='both' + !hasTelegram + devices ativos → ['mobile_push']
  it('case 7: both preference with devices but no telegram', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('both')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(false)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { id: 'dev-1', push_token: 'token-1' },
    ])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual(['mobile_push'])
  })

  // Caso 8: preference='none' → []
  it('case 8: none preference', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('none')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(true)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([
      { id: 'dev-1', push_token: 'token-1' },
    ])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual([])
  })

  // Caso 9: preference='both' + !hasTelegram + sem devices → []
  it('case 9: both preference with no channels available', async () => {
    mockRepositories.preferences.getByUserId.mockResolvedValue('both')
    mockRepositories.preferences.hasTelegramChat.mockResolvedValue(false)
    mockRepositories.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: mockRepositories })
    expect(result).toEqual([])
  })
})

describe('resolveChannelsForUser — flags explícitas Wave N2', () => {
  const userId = 'user-n2'

  const makeRepositories = (overrides = {}) => ({
    preferences: {
      getByUserId: vi.fn(),
      hasTelegramChat: vi.fn(),
      getSettingsByUserId: vi.fn(),
      ...(overrides.preferences || {}),
    },
    devices: {
      listActiveByUser: vi.fn(),
      ...(overrides.devices || {}),
    },
  })

  it('channel_mobile_push_enabled=true + expo device ativo → inclui mobile_push', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(false)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: true,
      channel_web_push_enabled: false,
      channel_telegram_enabled: false,
    })
    repos.devices.listActiveByUser.mockImplementation((uid, type) =>
      type === 'expo' ? [{ id: 'dev-1' }] : []
    )

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).toContain('mobile_push')
  })

  it('channel_mobile_push_enabled=true + sem expo device → não inclui mobile_push', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(false)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: true,
      channel_web_push_enabled: false,
      channel_telegram_enabled: false,
    })
    repos.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).not.toContain('mobile_push')
  })

  it('channel_web_push_enabled=true + webpush device ativo → inclui web_push', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(false)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: false,
      channel_web_push_enabled: true,
      channel_telegram_enabled: false,
    })
    repos.devices.listActiveByUser.mockImplementation((uid, type) =>
      type === 'webpush' ? [{ id: 'web-1' }] : []
    )

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).toContain('web_push')
  })

  it('channel_web_push_enabled=true + sem webpush device → não inclui web_push', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(false)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: false,
      channel_web_push_enabled: true,
      channel_telegram_enabled: false,
    })
    repos.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).not.toContain('web_push')
  })

  it('channel_telegram_enabled=true + hasTelegram=true → inclui telegram', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(true)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: false,
      channel_web_push_enabled: false,
      channel_telegram_enabled: true,
    })
    repos.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).toContain('telegram')
  })

  it('channel_telegram_enabled=false + hasTelegram=true → não inclui telegram', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(true)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: false,
      channel_web_push_enabled: false,
      channel_telegram_enabled: false,
    })
    repos.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).not.toContain('telegram')
  })

  it('todos os 3 canais enabled + todos devices → retorna todos', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(true)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: true,
      channel_web_push_enabled: true,
      channel_telegram_enabled: true,
    })
    repos.devices.listActiveByUser.mockImplementation((uid, type) => {
      if (type === 'expo') return [{ id: 'expo-1' }]
      if (type === 'webpush') return [{ id: 'web-1' }]
      return []
    })

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).toEqual(['mobile_push', 'web_push', 'telegram'])
  })

  it('flags presentes e completas → NÃO usa fallback legado', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(true)
    repos.preferences.getSettingsByUserId.mockResolvedValue({
      channel_mobile_push_enabled: false,
      channel_web_push_enabled: false,
      channel_telegram_enabled: false,
    })
    repos.devices.listActiveByUser.mockResolvedValue([{ id: 'dev-1' }])
    repos.preferences.getByUserId.mockResolvedValue('both')

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).toEqual([])
    expect(repos.preferences.getByUserId).not.toHaveBeenCalled()
  })

  it('flags ausentes em settings → usa fallback legado', async () => {
    const repos = makeRepositories()
    repos.preferences.hasTelegramChat.mockResolvedValue(true)
    repos.preferences.getSettingsByUserId.mockResolvedValue({}) // sem flags
    repos.preferences.getByUserId.mockResolvedValue('telegram')
    repos.devices.listActiveByUser.mockResolvedValue([])

    const result = await resolveChannelsForUser({ userId, repositories: repos })
    expect(result).toEqual(['telegram'])
    expect(repos.preferences.getByUserId).toHaveBeenCalled()
  })
})
