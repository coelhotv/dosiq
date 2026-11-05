// apps/web/src/views/admin/useGrowthAdminState.ts
// Estado do painel "Crescimento & Wedge" (spec 115 US1/US2).
//
// A tela não calcula métrica nenhuma: totais, wedge e taxas vêm prontos da RPC (unidade = usuário
// distinto, INV-5). O hook só carrega e filtra a lista de usuários no cliente (busca instantânea).

import { useState, useEffect, useCallback, useMemo, startTransition } from 'react'
import { growthAdminService } from '@services/api/growthAdminService'

export type PlatformFilter = 'all' | 'ios' | 'android' | 'web' | 'none'
export type PushFilter = 'all' | 'active' | 'inactive'

export type GrowthTreatment = {
  protocol_id: string
  protocol_name: string
  therapeutic_class: string | null
  therapeutic_class_code: string | null
  wedge: 'glp1_antiobesidade' | 'antidiabeticos_outros' | 'outras' | 'sem_codigo'
  frequency: string | null
  features: {
    titration: boolean
    tracked_measure: string | null
    critical_alarm: boolean
    stock: boolean
    end_date: boolean
  }
}

export type GrowthUser = {
  user_id: string
  email: string | null
  created_at: string
  last_activity_at: string | null
  /** Canais em que a conta já entrou (D-AN-2): aparelhos ∪ sessões no servidor. */
  platforms: Array<'ios' | 'android' | 'web'>
  /** Canal da atividade mais recente. */
  platform: 'ios' | 'android' | 'web' | null
  app_version: string | null
  push_active: boolean
  onboarding_completed: boolean
  protocols_count: number
  treatments: GrowthTreatment[]
}

export type GrowthRate = { users: number; protocols: number; users_pct: number; protocols_pct?: number }

export type GrowthAnalytics = {
  generated_at: string
  excluded_count: number
  total_users: number
  totals: {
    users: number
    new_7d: number
    new_30d: number
    users_with_protocols: number
    protocols: number
    push_active_users: number
    push_active_pct: number
    stock_users_pct: number
    critical_alarm_users_pct: number
  }
  class_distribution: Array<{ class_code: string; label: string | null; wedge: GrowthTreatment['wedge']; users: number; protocols: number; users_pct: number }>
  wedge: Record<GrowthTreatment['wedge'], GrowthRate>
  frequency_distribution: Array<{ frequency: string | null; users: number; protocols: number }>
  feature_rates: Array<GrowthRate & { feature: string; protocols_pct: number; cohort30: GrowthRate & { protocols_pct: number } }>
  denominators: { users_all: number; protocols_all: number; users_c30: number; protocols_c30: number }
  users: GrowthUser[]
}

export type GrowthFilters = { query: string; platform: PlatformFilter; push: PushFilter }

/** Filtro puro da tabela: busca por e-mail ou id (sem diferenciar caixa) + plataforma já usada + push. */
export function filterGrowthUsers(users: GrowthUser[] = [], { query, platform, push }: GrowthFilters): GrowthUser[] {
  const q = query.trim().toLowerCase()
  return users.filter((u) => {
    if (q && !(u.email ?? '').toLowerCase().includes(q) && !u.user_id.toLowerCase().includes(q)) return false
    const used = u.platforms ?? []
    if (platform === 'none' && used.length > 0) return false
    if (platform !== 'all' && platform !== 'none' && !used.includes(platform)) return false
    if (push === 'active' && !u.push_active) return false
    if (push === 'inactive' && u.push_active) return false
    return true
  })
}

export function useGrowthAdminState() {
  const [data, setData] = useState<GrowthAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all')
  const [pushFilter, setPushFilter] = useState<PushFilter>('all')
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(() => new Set())

  const filteredUsers = useMemo(
    () => filterGrowthUsers(data?.users ?? [], { query: searchQuery, platform: platformFilter, push: pushFilter }),
    [data, searchQuery, platformFilter, pushFilter]
  )
  const hasActiveFilters = searchQuery.trim() !== '' || platformFilter !== 'all' || pushFilter !== 'all'

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const body = await growthAdminService.load()
      setData(body)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    startTransition(() => {
      load()
    })
  }, [load])

  const toggleExpanded = useCallback((userId: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }, [])

  const resetFilters = useCallback(() => {
    setSearchQuery('')
    setPlatformFilter('all')
    setPushFilter('all')
  }, [])

  return {
    data,
    isLoading,
    error,
    reload: load,
    searchQuery,
    setSearchQuery,
    platformFilter,
    setPlatformFilter,
    pushFilter,
    setPushFilter,
    filteredUsers,
    hasActiveFilters,
    resetFilters,
    expandedUserIds,
    toggleExpanded,
  }
}
