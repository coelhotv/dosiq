// Testes para resolveChannelsForUser policy
// 9 casos obrigatórios cobrindo todas as preferências e disponibilidades

import { describe, it, expect, vi } from 'vitest'
import { resolveChannelsForUser } from './resolveChannelsForUser'

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
