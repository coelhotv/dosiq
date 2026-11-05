// apps/web/src/views/admin/GrowthAdmin.tsx
// "Crescimento & Wedge" — o wedge GLP-1 se confirma nos novos usuários? Quais features clínicas
// são usadas? (spec 115 US1/US2).
//
// Três camadas (D-RC2-1): KPIs → wedge + adoção de features → tabela de contas com drill-down.
// 🔴 INV-5 / SC-006: todo percentual é de usuários distintos e vem com o n absoluto ao lado.
// 🔴 INV-2: nenhum nome comercial de medicamento — o drill-down mostra nome do tratamento e classe.
// Só leitura (Non-Goal 1). Os números chegam prontos da RPC; a tela só formata (a única conta local é
// a razão "com tratamento / usuários" do KPI, sobre dois totais da própria RPC).

import { Fragment } from 'react'
import { ArrowLeft, RefreshCw, ChevronDown, ChevronRight, Users, Pill, BellRing, Target } from 'lucide-react'
import { FREQUENCY_LABELS } from '@dosiq/core'
import { parseISO } from '@utils/dateUtils'
import { useGrowthAdminState, type GrowthAnalytics, type GrowthTreatment, type GrowthUser } from './useGrowthAdminState'
import './GrowthAdmin.css'

const WEDGE_LABEL: Record<GrowthTreatment['wedge'], string> = {
  glp1_antiobesidade: 'GLP-1 / antiobesidade',
  antidiabeticos_outros: 'Outros antidiabéticos',
  outras: 'Outras classes',
  sem_codigo: 'Sem código de classe',
}
const WEDGE_ORDER: GrowthTreatment['wedge'][] = ['glp1_antiobesidade', 'antidiabeticos_outros', 'outras', 'sem_codigo']

const FEATURE_LABEL: Record<string, string> = {
  titration: 'Titulação',
  biomarker: 'Biomarcador',
  critical_alarm: 'Alarme crítico',
  stock: 'Estoque',
  end_date: 'Data de término',
}
const MEASURE_LABEL: Record<string, string> = { peso: 'peso', glicemia: 'glicemia', pressao_arterial: 'pressão arterial' }
// Rótulos canônicos do core (smoke C-1: o mapa local não tinha `intervalo_dias`, que aparecia cru).
const FREQUENCY_LABEL: Record<string, string> = FREQUENCY_LABELS
const PLATFORM_LABEL: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' }
const TOP_CLASSES = 8

const fmtDate = (iso?: string | null) => (iso ? parseISO(iso).toLocaleDateString('pt-BR') : '—')
/** Smoke C-2/C-3: "1 tratamentos", "1 contas". */
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const fmtPct = (pct: number) => `${Number(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** Barra proporcional em CSS (D-RC2-2): largura = percentual, rótulo com o n ao lado. */
function Bar({ label, pct, n, of, tone = 'brand', secondary }: { label: string; pct: number; n: number; of: number; tone?: string; secondary?: string }) {
  return (
    <div className="growth-bar">
      <div className="growth-bar__head">
        <span className="growth-bar__label">{label}</span>
        <span className="growth-bar__value">
          {fmtPct(pct)} <span className="growth-bar__n">({n} de {of})</span>
        </span>
      </div>
      <div className="growth-bar__track" role="presentation">
        <div className={`growth-bar__fill growth-bar__fill--${tone}`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      </div>
      {secondary && <p className="growth-bar__secondary">{secondary}</p>}
    </div>
  )
}

function Kpi({ icon, label, value, detail }) {
  return (
    <div className="growth-kpi">
      <span className="growth-kpi__label">{icon} {label}</span>
      <span className="growth-kpi__value">{value}</span>
      <span className="growth-kpi__detail">{detail}</span>
    </div>
  )
}

function KpiHeader({ data }: { data: GrowthAnalytics }) {
  const t = data.totals
  const glp1 = data.wedge.glp1_antiobesidade
  return (
    <section className="growth-kpis" aria-label="Indicadores">
      <Kpi icon={<Users size={14} />} label="Usuários" value={t.users} detail={`+${t.new_7d} em 7 dias · +${t.new_30d} em 30 dias`} />
      <Kpi
        icon={<Pill size={14} />}
        label="Com tratamento"
        value={t.users_with_protocols}
        detail={`${fmtPct(t.users ? (100 * t.users_with_protocols) / t.users : 0)} dos usuários · ${plural(t.protocols, 'tratamento', 'tratamentos')}`}
      />
      <Kpi icon={<BellRing size={14} />} label="Push ativo" value={fmtPct(t.push_active_pct)} detail={`${t.push_active_users} de ${t.users} usuários`} />
      <Kpi
        icon={<Target size={14} />}
        label="Wedge GLP-1"
        value={fmtPct(glp1.users_pct)}
        detail={`${glp1.users} de ${t.users_with_protocols} usuários com tratamento`}
      />
    </section>
  )
}

function WedgePanel({ data }: { data: GrowthAnalytics }) {
  const of = data.denominators.users_all
  const classes = data.class_distribution.slice(0, TOP_CLASSES)
  return (
    <section className="growth-panel" aria-labelledby="growth-wedge-title">
      <h2 id="growth-wedge-title">Wedge por classe terapêutica</h2>
      <p className="growth-panel__hint">Usuários distintos com ≥1 tratamento ativo na classe. Um usuário pode estar em mais de um grupo.</p>
      {WEDGE_ORDER.map((bucket) => {
        const w = data.wedge[bucket]
        return (
          <Bar
            key={bucket}
            label={WEDGE_LABEL[bucket]}
            pct={w.users_pct}
            n={w.users}
            of={of}
            tone={bucket === 'glp1_antiobesidade' ? 'brand' : bucket === 'sem_codigo' ? 'muted' : 'neutral'}
            secondary={plural(w.protocols, 'tratamento', 'tratamentos')}
          />
        )
      })}
      <h3 className="growth-panel__subtitle">Classes mais frequentes</h3>
      {classes.length === 0 ? (
        <p className="growth-panel__hint">Nenhum tratamento ativo ainda.</p>
      ) : (
        <ol className="growth-classes">
          {classes.map((c) => (
            <li key={c.class_code} className="growth-classes__item">
              <span className={`growth-badge growth-badge--${c.wedge === 'glp1_antiobesidade' ? 'glp1' : 'code'}`}>
                {c.class_code === 'sem_codigo' ? 'sem código' : c.class_code}
              </span>
              <span className="growth-classes__label" title={c.label ?? undefined}>{c.label ?? (c.class_code === 'sem_codigo' ? 'Várias classes' : '—')}</span>
              <span className="growth-classes__n">
                {c.users} usu. · {fmtPct(c.users_pct)} · {c.protocols} trat.
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function FeaturePanel({ data }: { data: GrowthAnalytics }) {
  const d = data.denominators
  return (
    <section className="growth-panel" aria-labelledby="growth-features-title">
      <h2 id="growth-features-title">Adoção de features clínicas</h2>
      <p className="growth-panel__hint">
        Usuários com ≥1 tratamento ativo usando a feature, sobre {d.users_all} usuários com tratamento. Entre parênteses, a coorte de 30 dias.
      </p>
      {data.feature_rates.map((f) => (
        <Bar
          key={f.feature}
          label={FEATURE_LABEL[f.feature] ?? f.feature}
          pct={f.users_pct}
          n={f.users}
          of={d.users_all}
          tone={f.feature}
          secondary={`${fmtPct(f.protocols_pct)} dos tratamentos (${f.protocols} de ${d.protocols_all}) · coorte 30d: ${fmtPct(f.cohort30.users_pct)} (${f.cohort30.users} de ${d.users_c30})`}
        />
      ))}
      <h3 className="growth-panel__subtitle">Frequências</h3>
      <ul className="growth-freq">
        {data.frequency_distribution.map((f) => (
          <li key={f.frequency ?? 'sem'}>
            <span>{FREQUENCY_LABEL[f.frequency ?? ''] ?? f.frequency ?? '—'}</span>
            <span className="growth-classes__n">{f.users} usu. · {f.protocols} trat.</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TreatmentCard({ t }: { t: GrowthTreatment }) {
  return (
    <li className="growth-treatment">
      <div className="growth-treatment__head">
        <strong>{t.protocol_name}</strong>
        <span className="growth-treatment__freq">{FREQUENCY_LABEL[t.frequency ?? ''] ?? t.frequency ?? '—'}</span>
      </div>
      <div className="growth-treatment__class">
        <span className={`growth-badge growth-badge--${t.wedge === 'glp1_antiobesidade' ? 'glp1' : 'code'}`}>
          {t.therapeutic_class_code ?? 'sem código'}
        </span>
        {t.therapeutic_class ?? 'Classe não informada'}
      </div>
      <div className="growth-treatment__badges">
        {t.features.titration && <span className="growth-badge growth-badge--titration">Titulação</span>}
        {t.features.tracked_measure && (
          <span className="growth-badge growth-badge--biomarker">Biomarcador: {MEASURE_LABEL[t.features.tracked_measure] ?? t.features.tracked_measure}</span>
        )}
        {t.features.critical_alarm && <span className="growth-badge growth-badge--critical_alarm">Alarme crítico</span>}
        {t.features.stock && <span className="growth-badge growth-badge--stock">Estoque</span>}
        {t.features.end_date && <span className="growth-badge growth-badge--end_date">Data de término</span>}
      </div>
    </li>
  )
}

const COLUMNS = 9

function UserRow({ u, expanded, onToggle }: { u: GrowthUser; expanded: boolean; onToggle: () => void }) {
  const drawerId = `growth-drawer-${u.user_id}`
  return (
    <Fragment>
      <tr className={expanded ? 'growth-table__row growth-table__row--open' : 'growth-table__row'}>
        <td>
          <button
            type="button"
            className="growth-table__toggle"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={drawerId}
            disabled={u.protocols_count === 0}
            aria-label={expanded ? 'Recolher tratamentos' : 'Ver tratamentos'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="growth-table__email" title={u.user_id}>{u.email ?? u.user_id.slice(0, 8)}</td>
        <td>{fmtDate(u.created_at)}</td>
        <td>{fmtDate(u.last_activity_at)}</td>
        {/* D-AN-2: canais já usados (aparelhos + sessões no servidor); o mais recente primeiro, em negrito */}
        <td className={u.platforms.length ? undefined : 'growth-table__muted'}>
          {u.platforms.length === 0
            ? 'Sem registro'
            : [...u.platforms]
                .sort((p1, p2) => Number(p2 === u.platform) - Number(p1 === u.platform))
                .map((p, i) => (
                  <Fragment key={p}>
                    {i > 0 && ' · '}
                    {p === u.platform ? <strong>{PLATFORM_LABEL[p]}</strong> : PLATFORM_LABEL[p]}
                  </Fragment>
                ))}
        </td>
        <td className="growth-table__mono">{u.app_version ?? '—'}</td>
        <td><span className={`growth-status growth-status--${u.push_active ? 'on' : 'off'}`}>{u.push_active ? 'Ativo' : 'Inativo'}</span></td>
        <td>{u.onboarding_completed ? 'Concluído' : 'Pendente'}</td>
        <td className="growth-table__num">{u.protocols_count}</td>
      </tr>
      {expanded && (
        <tr className="treatment-drawer-row" id={drawerId}>
          <td colSpan={COLUMNS}>
            <ul className="growth-treatments">
              {u.treatments.map((t) => <TreatmentCard key={t.protocol_id} t={t} />)}
            </ul>
          </td>
        </tr>
      )}
    </Fragment>
  )
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando analytics">
      <div className="growth-kpis">
        {[0, 1, 2, 3].map((i) => <div key={i} className="growth-kpi growth-skeleton growth-skeleton--kpi" />)}
      </div>
      <div className="growth-panels">
        {[0, 1].map((i) => <div key={i} className="growth-panel growth-skeleton growth-skeleton--panel" />)}
      </div>
      <div className="growth-skeleton growth-skeleton--table" />
    </div>
  )
}

export default function GrowthAdmin({ onBack }: { onBack?: () => void }) {
  const state = useGrowthAdminState()
  const { data } = state

  return (
    <div className="growth-admin">
      <header className="growth-admin__header">
        <div>
          <h1>Crescimento &amp; Wedge</h1>
          {data && (
            <p className="growth-admin__meta">
              {data.excluded_count > 0 ? `${plural(data.excluded_count, 'conta interna excluída', 'contas internas excluídas')} · ` : ''}
              Atualizado em {parseISO(data.generated_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
        <div className="growth-admin__actions">
          <button type="button" className="growth-admin__btn" onClick={state.reload} disabled={state.isLoading}>
            <RefreshCw size={16} /> Atualizar
          </button>
          {onBack && (
            <button type="button" className="growth-admin__btn" onClick={onBack}>
              <ArrowLeft size={16} /> Voltar
            </button>
          )}
        </div>
      </header>

      {state.error && (
        <div className="growth-admin__error" role="alert">
          <span>Não foi possível carregar o painel: {state.error}</span>
          <button type="button" className="growth-admin__btn" onClick={state.reload}>Tentar de novo</button>
        </div>
      )}

      {state.isLoading && !data && <Skeleton />}

      {data && (
        <div className="growth-admin__content">
          <KpiHeader data={data} />
          <div className="growth-panels">
            <WedgePanel data={data} />
            <FeaturePanel data={data} />
          </div>

          <section className="growth-panel growth-cohort" aria-labelledby="growth-users-title">
            <div className="growth-cohort__head">
              <h2 id="growth-users-title">
                Contas <span className="growth-cohort__count">{state.filteredUsers.length} de {data.users.length}</span>
              </h2>
              <div className="growth-filters">
                <input
                  type="search"
                  className="growth-filters__search"
                  placeholder="Buscar por e-mail ou ID"
                  aria-label="Buscar por e-mail ou ID"
                  value={state.searchQuery}
                  onChange={(e) => state.setSearchQuery(e.target.value)}
                />
                <select aria-label="Plataforma" value={state.platformFilter} onChange={(e) => state.setPlatformFilter(e.target.value as any)}>
                  <option value="all">Todas as plataformas</option>
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                  <option value="web">Web</option>
                  <option value="none">Sem registro</option>
                </select>
                <select aria-label="Push" value={state.pushFilter} onChange={(e) => state.setPushFilter(e.target.value as any)}>
                  <option value="all">Push: todos</option>
                  <option value="active">Push ativo</option>
                  <option value="inactive">Push inativo</option>
                </select>
              </div>
            </div>
            {data.total_users > data.users.length && (
              <p className="growth-panel__hint">Mostrando as {data.users.length} contas mais recentes de {data.total_users}.</p>
            )}

            {state.filteredUsers.length === 0 ? (
              <div className="growth-empty">
                <p>{state.hasActiveFilters ? 'Nenhuma conta corresponde aos filtros aplicados.' : 'Nenhuma conta para mostrar ainda.'}</p>
                {state.hasActiveFilters && (
                  <button type="button" className="growth-admin__btn" onClick={state.resetFilters}>Limpar filtros</button>
                )}
              </div>
            ) : (
              <div className="growth-table__scroll">
                <table className="growth-table">
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Detalhes</span></th>
                      <th scope="col">E-mail</th>
                      <th scope="col">Criada em</th>
                      <th scope="col">Última atividade</th>
                      <th scope="col" title="Canais em que a conta já entrou; em negrito, o mais recente">Plataformas</th>
                      <th scope="col">Versão</th>
                      <th scope="col">Push</th>
                      <th scope="col">Onboarding</th>
                      <th scope="col">Tratamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.filteredUsers.map((u) => (
                      <UserRow key={u.user_id} u={u} expanded={state.expandedUserIds.has(u.user_id)} onToggle={() => state.toggleExpanded(u.user_id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
