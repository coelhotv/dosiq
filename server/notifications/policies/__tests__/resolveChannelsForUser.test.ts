import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveChannelsForUser } from '../resolveChannelsForUser';
import type { NotificationDevice } from '../../repositories/notificationDeviceRepository';
import type { NotificationSettings } from '../../repositories/notificationPreferenceRepository';

// Repos mock: dose crítica deve ir SÓ pelo canal de alarme (mobile_push), com fallback telegram
// quando não há device mobile ativo. Não-crítica segue as preferências normais.
interface MakeReposOptions {
  telegram?: boolean
  expo?: NotificationDevice[]
  web?: NotificationDevice[]
  settings?: Partial<NotificationSettings> | null
}
function makeRepos({ telegram = true, expo = [], web = [], settings = null }: MakeReposOptions = {}) {
  return {
    preferences: {
      hasTelegramChat: vi.fn(() => Promise.resolve(telegram)),
      getSettingsByUserId: vi.fn(() => Promise.resolve(settings)),
      getByUserId: vi.fn(() => Promise.resolve('both' as const)),
    },
    devices: {
      listActiveByUser: vi.fn((_u, kind) => Promise.resolve(kind === 'expo' ? expo : web)),
    },
  };
}

const WAVE_N2 = { channel_mobile_push_enabled: true, channel_web_push_enabled: true, channel_telegram_enabled: true };

describe('resolveChannelsForUser — gate de dose crítica', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { vi.clearAllMocks(); });

  it('crítica + device mobile ativo → SÓ mobile_push (sem telegram)', async () => {
    const repositories = makeRepos({ telegram: true, expo: [{ id: 'd1' } as NotificationDevice], settings: WAVE_N2 });
    const channels = await resolveChannelsForUser({ userId: 'u1', repositories, isCritical: true });
    expect(channels).toEqual(['mobile_push']);
  });

  it('crítica + SEM device mobile → fallback telegram (nunca muda)', async () => {
    const repositories = makeRepos({ telegram: true, expo: [], settings: WAVE_N2 });
    const channels = await resolveChannelsForUser({ userId: 'u1', repositories, isCritical: true });
    expect(channels).toEqual(['telegram']);
  });

  it('crítica + sem device + sem telegram → vazio', async () => {
    const repositories = makeRepos({ telegram: false, expo: [], settings: WAVE_N2 });
    const channels = await resolveChannelsForUser({ userId: 'u1', repositories, isCritical: true });
    expect(channels).toEqual([]);
  });

  it('NÃO-crítica → segue preferências (telegram + mobile_push)', async () => {
    const repositories = makeRepos({ telegram: true, expo: [{ id: 'd1' } as NotificationDevice], settings: WAVE_N2 });
    const channels = await resolveChannelsForUser({ userId: 'u1', repositories, isCritical: false });
    expect(channels).toContain('telegram');
    expect(channels).toContain('mobile_push');
  });
});
