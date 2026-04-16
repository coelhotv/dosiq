import { renderHook, waitFor } from '@testing-library/react-native';
import { useTodayData } from '@dashboard/hooks/useTodayData';
import { supabase } from '@/platform/supabase/nativeSupabaseClient';
import * as dashboardService from '@dashboard/services/dashboardService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock do supabase e service
jest.mock('@/platform/supabase/nativeSupabaseClient', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    }
  }
}));

jest.mock('@dashboard/services/dashboardService');

describe('useTodayData', () => {
  const mockUser = { id: 'user-123' };

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  it('loads data successfully from online service', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
    
    dashboardService.getActiveProtocols.mockResolvedValue([{ id: 'p1', medicine_id: 'm1' }]);
    dashboardService.getTodayLogs.mockResolvedValue([{ id: 'l1', protocol_id: 'p1' }]);
    dashboardService.getMedicinesData.mockResolvedValue({ 'm1': { name: 'Pills' } });

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data.protocols).toHaveLength(1);
    expect(result.current.data.medicines['m1'].name).toBe('Pills');
    expect(result.current.stale).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('fails online and loads from cache (stale mode)', async () => {
    // Falha online
    supabase.auth.getSession.mockRejectedValue(new Error('Network error'));
    
    // Sucesso no cache
    const mockCache = {
      protocols: [{ id: 'p1' }],
      logs: [],
      medicines: {},
      capturedAt: new Date().toISOString(),
      localDay: new Date().toISOString().split('T')[0]
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(mockCache));

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stale).toBe(true);
    expect(result.current.data.protocols).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('returns error when both online and cache fail', async () => {
    supabase.auth.getSession.mockRejectedValue(new Error('Network error'));
    AsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });
});
