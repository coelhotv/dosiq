import { renderHook, waitFor } from '@testing-library/react-native';
import { useTodayData } from '../useTodayData';
import * as dashboardService from '../../services/dashboardService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock do supabase usando caminho relativo exato para bater com useTodayData.js
jest.mock('../../../../platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      getUserSettings: jest.fn(),
    }
  }
}));

import { supabase } from '../../../../platform/supabase/nativeSupabaseClient';

jest.mock('../../services/dashboardService');
jest.mock('../_useTodayDerived', () => ({
  useTodayDerived: jest.fn(data => data)
}));

describe('useTodayData', () => {
  const mockUser = { id: 'user-123' };

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue();
    dashboardService.getUserSettings.mockResolvedValue({ id: 'u1', name: 'Test' });
  });

  it('loads data successfully from online service', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
    
    dashboardService.getActiveProtocols.mockResolvedValue([{ id: 'p1', medicine_id: 'm1' }]);
    dashboardService.getLogsForPeriod.mockResolvedValue([{ id: 'l1', protocol_id: 'p1' }]);
    dashboardService.getMedicinesData.mockResolvedValue({ 'm1': { name: 'Pills' } });

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });

    expect(result.current.data.protocols).toHaveLength(1);
    expect(result.current.data.medicines['m1'].name).toBe('Pills');
    expect(result.current.stale).toBe(false);

    // Verificar se salvou no cache
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@dosiq/today-snapshot',
      expect.stringContaining('"localDay"')
    );
  }, 10000);

  it('fails online and loads from cache (stale mode)', async () => {
    supabase.auth.getSession.mockRejectedValue(new Error('Network error'));
    
    const mockCache = {
      protocols: [{ id: 'p1' }],
      logs: [],
      medicines: {},
      capturedAt: new Date().toISOString(),
      localDay: new Date().toISOString().split('T')[0]
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockCache));

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });

    expect(result.current.stale).toBe(true);
    expect(result.current.data.protocols).toHaveLength(1);
  }, 20000);

  it('returns error when both online and cache fail', async () => {
    supabase.auth.getSession.mockRejectedValue(new Error('Network error'));
    AsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeNull();
  }, 20000);
});
