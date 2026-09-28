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

// TODO(040-strict): jest.mock automock não preserva tipos — jest.mocked() traz de volta
const mockedDashboardService = jest.mocked(dashboardService);
const mockedAsyncStorage = jest.mocked(AsyncStorage);
const mockedSupabase = supabase as any;

describe('useTodayData', () => {
  const mockUser = { id: 'user-123' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAsyncStorage.getItem.mockResolvedValue(null);
    mockedAsyncStorage.setItem.mockResolvedValue();
    mockedDashboardService.getUserSettings.mockResolvedValue({ id: 'u1', name: 'Test' } as any);
    mockedDashboardService.getDoseInstancesForPeriod.mockResolvedValue([]);
  });

  it('loads data successfully from online service', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });

    mockedDashboardService.getActiveProtocols.mockResolvedValue([{ id: 'p1', medicine_id: 'm1' }] as any);
    mockedDashboardService.getLogsForPeriod.mockResolvedValue([{ id: 'l1', protocol_id: 'p1' }] as any);
    mockedDashboardService.getMedicinesData.mockResolvedValue({ 'm1': { name: 'Pills' } });

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });

    expect(result.current.data.protocols).toHaveLength(1);
    expect(result.current.data.medicines['m1'].name).toBe('Pills');
    expect(result.current.stale).toBe(false);

    // Verificar se salvou no cache
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      '@dosiq/today-snapshot',
      expect.stringContaining('"localDay"')
    );
  }, 10000);

  // Spec 091 PO-6 (AC-2.4): só queda de REDE cai no snapshot, e só snapshot do titular da sessão.
  describe('fallback de snapshot (spec 091)', () => {
    // Erro de rede do PostgREST chega como objeto plano — é o formato real que os services relançam.
    const networkErr = { message: 'TypeError: Network request failed', code: '' };
    const snapshotOf = (userId: string | null) => JSON.stringify({
      protocols: [{ id: 'p1' }],
      logs: [],
      medicines: {},
      user: userId ? { id: userId } : undefined,
      capturedAt: new Date().toISOString(),
      localDay: new Date().toISOString().split('T')[0],
    });

    beforeEach(() => {
      mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
      mockedDashboardService.getLogsForPeriod.mockResolvedValue([] as any);
    });

    it('rede + snapshot do titular atual ⇒ snapshot + stale', async () => {
      mockedDashboardService.getActiveProtocols.mockRejectedValue(networkErr);
      mockedAsyncStorage.getItem.mockResolvedValue(snapshotOf('user-123'));
      const { result } = renderHook(() => useTodayData());
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });
      expect(result.current.stale).toBe(true);
      expect(result.current.data.protocols).toHaveLength(1);
    }, 20000);

    it('rede + snapshot de OUTRO titular ⇒ sem snapshot', async () => {
      mockedDashboardService.getActiveProtocols.mockRejectedValue(networkErr);
      mockedAsyncStorage.getItem.mockResolvedValue(snapshotOf('user-OUTRA'));
      const { result } = renderHook(() => useTodayData());
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeTruthy();
    }, 20000);

    it('rede + snapshot sem dono (formato antigo) ⇒ sem snapshot', async () => {
      mockedDashboardService.getActiveProtocols.mockRejectedValue(networkErr);
      mockedAsyncStorage.getItem.mockResolvedValue(snapshotOf(null));
      const { result } = renderHook(() => useTodayData());
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });
      expect(result.current.data).toBeNull();
    }, 20000);

    it('erro de autenticação ⇒ sem snapshot, nem lê o cache', async () => {
      mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
      mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      mockedAsyncStorage.getItem.mockResolvedValue(snapshotOf('user-123'));
      const { result } = renderHook(() => useTodayData());
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });
      expect(result.current.data).toBeNull();
      expect(result.current.stale).toBe(false);
      expect(mockedAsyncStorage.getItem).not.toHaveBeenCalledWith('@dosiq/today-snapshot');
    }, 20000);

    it('erro de servidor (42703) ⇒ sem snapshot, código visível', async () => {
      mockedDashboardService.getActiveProtocols.mockRejectedValue({ message: 'column x does not exist', code: '42703' });
      mockedAsyncStorage.getItem.mockResolvedValue(snapshotOf('user-123'));
      const { result } = renderHook(() => useTodayData());
      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });
      expect(result.current.data).toBeNull();
      expect(result.current.error).toContain('42703');
    }, 20000);
  });

  it('returns error when both online and cache fail', async () => {
    mockedSupabase.auth.getSession.mockRejectedValue(new Error('Network error'));
    mockedAsyncStorage.getItem.mockResolvedValue(null);

    const { result } = renderHook(() => useTodayData());

    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeNull();
  }, 20000);
});
