import React, { createContext, useContext, useMemo } from 'react';
import { useCachedQueries } from './useCachedQuery';
import { calculateAdherenceStats, getNextDoseTime } from '../utils/adherenceLogic';
import { medicineService } from '../services/api/medicineService';
import { protocolService } from '../services/api/protocolService';
import { logService } from '../services/api/logService';

const DashboardContext = createContext(null);

/**
 * useDashboardContext - Orquestrador de dados do Health Command Center
 * 
 * Centraliza as queries de medicamentos, protocolos e logs para
 * garantir consistência de dados e "custo zero" de queries extras.
 */
export function DashboardProvider({ children }) {
  const thirtyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString();
  }, []);

  const queries = useMemo(() => [
    {
      key: 'medicines:list',
      fetcher: () => medicineService.getAll()
    },
    {
      key: 'protocols:active',
      fetcher: () => protocolService.getActive()
    },
    {
      key: 'logs:last30d',
      fetcher: async () => {
        // getByDateRange usa o padrão de segurança com getUserId() e filtros RLS
        const result = await logService.getByDateRange(
          thirtyDaysAgo.split('T')[0],
          new Date().toISOString().split('T')[0],
          1000
        );
        return result.data;
      }
    }
  ], [thirtyDaysAgo]);

  const { results, isLoading, isFetching, hasError, refetchAll } = useCachedQueries(queries);

  const [medicinesResult, protocolsResult, logsResult] = results;

  const stats = useMemo(() => {
    if (!protocolsResult.data || !logsResult.data) return { score: 0, currentStreak: 0 };
    return calculateAdherenceStats(logsResult.data, protocolsResult.data, 30);
  }, [protocolsResult.data, logsResult.data]);

  const protocolsWithNextDose = useMemo(() => {
    const protocols = protocolsResult.data || [];
    return protocols.map(p => ({
      ...p,
      next_dose: getNextDoseTime(p)
    }));
  }, [protocolsResult.data]);

  const value = useMemo(() => ({
    medicines: medicinesResult.data || [],
    protocols: protocolsWithNextDose,
    logs: logsResult.data || [],
    stats,
    isLoading,
    isFetching,
    hasError,
    refresh: refetchAll,
    lastSync: new Date().toISOString()
  }), [medicinesResult.data, protocolsWithNextDose, logsResult.data, stats, isLoading, isFetching, hasError, refetchAll]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard deve ser usado dentro de um DashboardProvider');
  }
  return context;
}
