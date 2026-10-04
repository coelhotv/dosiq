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

// 092 FR-002: persona registrada no mesmo ponto do `mode`, fora do caminho da agenda.
const mockSetTreatmentCountBucket = jest.fn();
jest.mock('@platform/analytics/productAnalytics', () => ({
  setMode: jest.fn(),
  setTreatmentCountBucket: (...a: unknown[]) => mockSetTreatmentCountBucket(...a),
}));
const mockGetAllProtocols = jest.fn();
jest.mock('@treatments/services/protocolService', () => ({
  protocolService: { getAll: (...a: unknown[]) => mockGetAllProtocols(...a) },
}));
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
    mockedDashboardService.getScheduledProtocols.mockResolvedValue([]); // 086 D-13
    mockGetAllProtocols.mockResolvedValue([]);
  });

  it('092: registra a persona com TODOS os protocolos (getAll) e o dia local do fuso do perfil', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
    mockedDashboardService.getUserSettings.mockResolvedValue({ timezone: 'America/Sao_Paulo' } as any);
    mockedDashboardService.getActiveProtocols.mockResolvedValue([] as any);
    mockedDashboardService.getLogsForPeriod.mockResolvedValue([] as any);
    mockedDashboardService.getMedicinesData.mockResolvedValue({});
    const rows = [{ id: 'p1', active: false, start_date: '2026-01-01', end_date: null }];
    mockGetAllProtocols.mockResolvedValue(rows);

    const { result } = renderHook(() => useTodayData());
    await waitFor(() => expect(mockSetTreatmentCountBucket).toHaveBeenCalled(), { timeout: 5000 });

    expect(mockSetTreatmentCountBucket).toHaveBeenCalledWith(rows, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    await waitFor(() => expect(result.current.loading).toBe(false));
  }, 10000);

  it('092: getAll falha → não registra e o Hoje carrega igual (AC-2.2)', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
    mockedDashboardService.getActiveProtocols.mockResolvedValue([{ id: 'p1', medicine_id: 'm1' }] as any);
    mockedDashboardService.getLogsForPeriod.mockResolvedValue([] as any);
    mockedDashboardService.getMedicinesData.mockResolvedValue({ m1: { name: 'Pills' } });
    mockGetAllProtocols.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useTodayData());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });

    expect(result.current.error).toBeNull();
    expect(result.current.data.protocols).toHaveLength(1);
    expect(mockSetTreatmentCountBucket).not.toHaveBeenCalled();
  }, 10000);

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

  // 086 D-13 / RC6 #845: agendados carregam o medicamento (a "Próxima dose … · <nome>" usa o nome dele).
  it('agendados vêm enriquecidos com o medicamento, buscado junto dos ativos', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
    mockedDashboardService.getActiveProtocols.mockResolvedValue([] as any);
    mockedDashboardService.getScheduledProtocols.mockResolvedValue([{ id: 'p9', medicine_id: 'm9', name: 'Meu tratamento' }] as any);
    mockedDashboardService.getLogsForPeriod.mockResolvedValue([] as any);
    mockedDashboardService.getMedicinesData.mockResolvedValue({ m9: { name: 'Mesigyna' } });

    const { result } = renderHook(() => useTodayData());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });

    expect(mockedDashboardService.getMedicinesData).toHaveBeenCalledWith(['m9']);
    expect(result.current.data.scheduledProtocols[0].medicine.name).toBe('Mesigyna');
  }, 10000);

  // 090 D-1 / PO-1: conta nova (antes do consentimento) não tem linha em user_settings. O serviço
  // devolve `null`; o Hoje carrega ONLINE com os defaults (fuso SP) — nem erro, nem snapshot.
  it('conta sem configuração (settings null) carrega online com defaults (090 PO-1)', async () => {
    mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: mockUser } }, error: null });
    mockedDashboardService.getUserSettings.mockResolvedValue(null as any);
    mockedDashboardService.getActiveProtocols.mockResolvedValue([{ id: 'p1', medicine_id: 'm1' }] as any);
    mockedDashboardService.getLogsForPeriod.mockResolvedValue([] as any);
    mockedDashboardService.getMedicinesData.mockResolvedValue({ m1: { name: 'Pills' } });

    const { result } = renderHook(() => useTodayData());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });

    expect(result.current.error).toBeFalsy();
    expect(result.current.stale).toBe(false);
    expect(result.current.data.protocols).toHaveLength(1);
    expect(result.current.data.timezone).toBe('America/Sao_Paulo');
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

    // Spec 077 PO-9 (AC-5.2): sem localDay, o dia do snapshot sai do capturedAt no fuso do snapshot —
    // o corte do ISO dava o dia UTC (22:30 de SP = 01:30Z do dia seguinte) e descartava os registros.
    it('snapshot sem localDay capturado às 22:30 de SP, aberto no mesmo dia ⇒ não segrega', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-02T01:45:00Z'), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask'] });
      try {
        mockedDashboardService.getActiveProtocols.mockRejectedValue(networkErr);
        mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify({
          protocols: [{ id: 'p1' }],
          logs: [{ id: 'l1' }],
          medicines: {},
          user: { id: 'user-123' },
          timezone: 'America/Sao_Paulo',
          capturedAt: '2026-09-02T01:30:00.000Z',
        }));
        const { result } = renderHook(() => useTodayData());
        await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 10000 });
        expect(result.current.isDaySegregated).toBe(false);
        expect(result.current.data.logs).toHaveLength(1);
      } finally {
        jest.useRealTimers();
      }
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
