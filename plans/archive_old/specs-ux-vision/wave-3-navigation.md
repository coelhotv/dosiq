# Specs Atomicas — Onda 3: Navegacao

**Master doc:** [`plans/EXEC_SPEC_UX_EVOLUTION.md`](../EXEC_SPEC_UX_EVOLUTION.md)
**Visao base:** [`plans/UX_VISION_EXPERIENCIA_PACIENTE.md`](../UX_VISION_EXPERIENCIA_PACIENTE.md) v0.5
**Data:** 05/03/2026

**Pre-requisito:** Quality Gate 2 deve ter passado (Ondas 1+2 concluidas).

**AVISO DE RISCO:** Esta e a onda de MAIOR RISCO. Mudancas em navegacao afetam toda a app. Cada task deve ser um PR independente, testado individualmente. NUNCA fazer tudo de uma vez.

---

## Estrategia de migracao

A migracao de 5 → 4 tabs segue a ordem:
1. **PRIMEIRO** criar as novas views (Treatment, Profile)
2. **DEPOIS** atualizar BottomNav para apontar para elas
3. **POR ULTIMO** remover views legadas (se sobrar alguma)

Em nenhum momento a navegacao pode ficar quebrada. O usuario SEMPRE deve conseguir acessar todas as funcionalidades.

---

## W3-01: BottomNav 5 → 4 Tabs

**Objetivo:** Reestruturar o BottomNav de 5 tabs (Inicio, Remedios, Protocolos, Estoque, Historico) para 4 tabs (Hoje, Tratamento, Estoque, Perfil).

**Arquivo:** `src/shared/components/ui/BottomNav.jsx` (EDITAR)
**Arquivo:** `src/App.jsx` (EDITAR)
**Deps:** Nenhuma (mas W3-02 e W3-03 devem ser criados ANTES ou junto).

**ATENCAO:** Esta task so pode ser executada DEPOIS que W3-02 (Treatment view) e W3-03 (Profile view) existirem, mesmo que como placeholders. Caso contrario, as tabs nao terao destino.

**Mudancas em BottomNav.jsx:**

```javascript
// ANTES:
const navItems = [
  { id: 'dashboard', label: 'Inicio', icon: 'grid' },
  { id: 'medicines', label: 'Remedios', icon: 'medicine' },
  { id: 'protocols', label: 'Protocolos', icon: 'checklist' },
  { id: 'stock', label: 'Estoque', icon: 'box' },
  { id: 'history', label: 'Historico', icon: 'clock' },
]

// DEPOIS:
const navItems = [
  { id: 'dashboard', label: 'Hoje', icon: 'calendar-check' },
  { id: 'treatment', label: 'Tratamento', icon: 'heart-pulse' },
  { id: 'stock', label: 'Estoque', icon: 'box' },
  { id: 'profile', label: 'Perfil', icon: 'user' },
]
```

**Mudancas em App.jsx:**

Adicionar rotas para as novas views:
```javascript
// Adicionar
'treatment': <Treatment onNavigate={setCurrentView} />,
'profile': <Profile onNavigate={setCurrentView} />,

// MANTER (acessiveis via cross-navigation, nao via BottomNav):
'medicines': <Medicines ... />,
'protocols': <Protocols ... />,
'history': <History />,
'calendar': <Calendar />,
'settings': <Settings ... />,
```

**O que NAO remover:**
- Nao remover as views existentes (medicines, protocols, history, settings)
- Elas ficam acessiveis via navegacao interna (links dentro de Treatment, Profile, etc.)
- Remocao sera feita numa task futura apos confirmar que tudo migrou

**Testes esperados:** `src/shared/components/ui/__tests__/BottomNav.test.jsx`

```
describe('BottomNav')
  it('renderiza 4 tabs')
  it('tabs sao Hoje, Tratamento, Estoque, Perfil')
  it('marca tab ativa corretamente')
  it('chama setCurrentView ao clicar')
```

**Criterios de aceite:**
- [ ] BottomNav mostra 4 tabs
- [ ] Cada tab navega para a view correta
- [ ] Views antigas (medicines, protocols, history) acessiveis via cross-nav
- [ ] Nenhuma view perdida
- [ ] Testes passam

---

## W3-02: Tab "Tratamento" (fusao Remedios + Protocolos)

**Objetivo:** Criar view que consolida medicamentos e protocolos numa unica tela organizada por contexto.

**Arquivo:** `src/views/Treatment.jsx`
**CSS:** `src/views/Treatment.css`
**Deps:** W3-01 (precisa da tab no BottomNav)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `onNavigate` | `Function(viewId, params?)` | Sim | Navegacao para outras views |

**Data flow:**
- Importa `useDashboard()` para medicines e protocols
- Importa `treatmentPlanService.getAll()` via `useCachedQuery`
- Importa `protocolService.getActive()` via `useCachedQuery`

**Secoes da view:**

```
+---------------------------------+
| Meu Tratamento         [+ Novo] |
+---------------------------------+
| PLANOS DE TRATAMENTO            |
| > Cardiovascular          3 meds|
|   Losartana . 2x/dia           |
|   Metformina . 2x/dia          |
|   AAS . 1x/dia                 |
|   [Editar] [Pausar]            |
| > Suplementos             1 med |
|   Vitamina D . 1x/dia          |
+---------------------------------+
| PROTOCOLOS AVULSOS              |
|   Omeprazol . diario 22:00     |
|   [Editar] [Pausar]            |
+---------------------------------+
| SEM PROTOCOLO                   |
|   Dipirona                      |
|   [Criar protocolo ->]          |
+---------------------------------+
| INATIVOS (2)             [ver]  |
|   (colapsado)                   |
+---------------------------------+
```

**Implementacao por secao:**

### 1. Planos de Tratamento
```javascript
const plans = useMemo(() =>
  treatmentPlans.map(plan => ({
    ...plan,
    activeProtocols: plan.protocols?.filter(p => p.active) || [],
  })).filter(plan => plan.activeProtocols.length > 0),
  [treatmentPlans]
)
```

Cada plano renderiza como accordion (reutilizar pattern do TreatmentAccordion, mas com cards de protocolo em vez de SwipeRegisterItem):

```jsx
<TreatmentPlanCard plan={plan} onEdit={handleEditPlan}>
  {plan.activeProtocols.map(protocol => (
    <ProtocolListItem
      key={protocol.id}
      protocol={protocol}
      onEdit={() => onNavigate('protocols', { editId: protocol.id })}
      onPause={() => handlePauseProtocol(protocol.id)}
    />
  ))}
</TreatmentPlanCard>
```

### 2. Protocolos Avulsos
```javascript
const standaloneProtocols = useMemo(() =>
  protocols.filter(p => p.active && !p.treatment_plan_id),
  [protocols]
)
```

### 3. Medicamentos Sem Protocolo
```javascript
const medicinesWithoutProtocol = useMemo(() => {
  const medsWithProtocol = new Set(protocols.map(p => p.medicine_id))
  return medicines.filter(m => !medsWithProtocol.has(m.id))
}, [medicines, protocols])
```

CTA: "Criar protocolo" navega para o wizard (W3-05) ou para a tela de protocolos pre-preenchida.

### 4. Inativos
```javascript
const inactiveProtocols = useMemo(() =>
  protocols.filter(p => !p.active),
  [protocols]
)
```

Secao colapsada por padrao. Expand mostra lista simples com botao "Reativar".

**Botao "+ Novo":**
- Abre o TreatmentWizard (W3-05) se disponivel
- Fallback: navega para 'medicines' (criar medicamento) com callback

**Sub-componentes internos (criar no mesmo diretorio):**

| Componente | Arquivo | Proposito |
|-----------|---------|-----------|
| TreatmentPlanCard | `src/views/treatment/TreatmentPlanCard.jsx` | Card expansivel do plano |
| ProtocolListItem | `src/views/treatment/ProtocolListItem.jsx` | Linha de protocolo com acoes |
| MedicineOrphanCard | `src/views/treatment/MedicineOrphanCard.jsx` | Card de med sem protocolo |

**CSS:**
- Layout em secoes com separadores
- Cards com hover/active states
- CTAs proeminentes para "Criar protocolo"
- Usar tokens do design system

**Testes esperados:** `src/views/__tests__/Treatment.test.jsx`

```
describe('Treatment')
  it('renderiza secao de planos de tratamento')
  it('renderiza secao de protocolos avulsos')
  it('renderiza secao de meds sem protocolo')
  it('renderiza secao de inativos colapsada')
  it('botao + Novo chama navegacao correta')
  it('CTA Criar protocolo navega corretamente')
  it('protocolos inativos expandem ao clicar')
  it('mostra empty state quando nao ha tratamentos')
```

**Criterios de aceite:**
- [ ] 4 secoes renderizam corretamente
- [ ] Planos mostram seus protocolos agrupados
- [ ] Avulsos listados separadamente
- [ ] Meds sem protocolo tem CTA "Criar protocolo"
- [ ] Inativos colapsados por padrao
- [ ] Botao "+ Novo" funciona
- [ ] Editar protocolo navega corretamente
- [ ] Empty state quando nao ha dados
- [ ] Testes passam

---

## W3-03: Tab "Perfil" (evolucao Settings)

**Objetivo:** Evoluir a tela Settings em um Perfil completo que agrupa saude, relatorios, configuracoes e features de alto valor.

**Arquivo:** `src/views/Profile.jsx`
**CSS:** `src/views/Profile.css`
**Deps:** W3-01 (precisa da tab no BottomNav)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `onNavigate` | `Function(viewId, params?)` | Sim | Navegacao |

**Data flow:**
- Importa `useDashboard()` para stats basicos (score, streak — header)
- Session data via Supabase Auth (email, user_id)

**Secoes da view:**

```
+---------------------------------+
| user Andre                      |
| andre@email.com                 |
+---------------------------------+
| SAUDE & HISTORICO               |
| chart Minha Saude ->            |
| sos Cartao de Emergencia ->     |
| doctor Modo Consulta ->         |
+---------------------------------+
| RELATORIOS & DADOS              |
| chart Relatorio PDF ->          |
| export Exportar Dados ->        |
| link Compartilhar ->            |
+---------------------------------+
| CONFIGURACOES                   |
| bot Telegram [Conectado check]  |
| theme Tema (claro/escuro)       |
| lock Alterar Senha              |
| density Densidade da interface  |
| admin Admin DLQ                 |
+---------------------------------+
| [Sair da Conta]                 |
+---------------------------------+
```

**Implementacao:**

A view reutiliza TODA a logica existente de Settings.jsx. A principal diferenca e a reorganizacao visual:

```jsx
function Profile({ onNavigate }) {
  // Reutilizar logica de Settings
  const { session } = useAuth() // ou equivalente existente
  const { stats } = useDashboard()

  return (
    <div className="profile">
      {/* Header */}
      <ProfileHeader
        name={session?.user?.user_metadata?.name || 'Paciente'}
        email={session?.user?.email}
      />

      {/* Saude & Historico */}
      <ProfileSection title="Saude & Historico">
        <ProfileLink icon="chart" label="Minha Saude" onClick={() => onNavigate('health-history')} />
        <ProfileLink icon="sos" label="Cartao de Emergencia" onClick={() => onNavigate('emergency')} />
        <ProfileLink icon="doctor" label="Modo Consulta" onClick={() => onNavigate('consultation')} />
      </ProfileSection>

      {/* Relatorios */}
      <ProfileSection title="Relatorios & Dados">
        <ProfileLink icon="pdf" label="Relatorio PDF" onClick={handleOpenReport} />
        <ProfileLink icon="export" label="Exportar Dados" onClick={handleOpenExport} />
        <ProfileLink icon="share" label="Compartilhar" onClick={handleShare} />
      </ProfileSection>

      {/* Configuracoes — reutilizar logica de Settings.jsx */}
      <ProfileSection title="Configuracoes">
        {/* Mesma logica de Settings: Telegram, Tema, Senha, Admin DLQ */}
        <TelegramSection ... />
        <ThemeToggle ... />
        <PasswordChange ... />
        <ComplexityOverride mode={complexityMode} setOverride={setOverride} />
        <AdminDLQLink ... />
      </ProfileSection>

      {/* Logout */}
      <LogoutButton onLogout={handleLogout} />
    </div>
  )
}
```

**Nova opcao em Configuracoes: Densidade da interface**
- Usa `useComplexityMode().setOverride()`
- Opcoes: "Automatico" (null) | "Confortavel" (simple) | "Normal" (moderate) | "Compacto" (complex)
- Persiste em localStorage

**Sub-componentes internos:**

| Componente | Arquivo | Proposito |
|-----------|---------|-----------|
| ProfileHeader | `src/views/profile/ProfileHeader.jsx` | Avatar, nome, email |
| ProfileSection | `src/views/profile/ProfileSection.jsx` | Secao com titulo |
| ProfileLink | `src/views/profile/ProfileLink.jsx` | Link com icone e chevron |

**Relacao com Settings.jsx:**
- Profile.jsx NAO importa Settings.jsx
- Profile.jsx reimplementa o layout mas reutiliza os handlers/logica inline
- Settings.jsx continua existindo como rota acessivel (para compatibilidade)
- Futuramente Settings sera removido quando Profile cobrir tudo

**Testes esperados:** `src/views/__tests__/Profile.test.jsx`

```
describe('Profile')
  it('renderiza header com nome e email')
  it('renderiza secao Saude & Historico com 3 links')
  it('renderiza secao Relatorios & Dados com 3 links')
  it('renderiza secao Configuracoes')
  it('Minha Saude navega para health-history')
  it('Cartao de Emergencia navega para emergency')
  it('Modo Consulta navega para consultation')
  it('Logout funciona')
  it('Densidade da interface mostra opcoes')
```

**Criterios de aceite:**
- [ ] Header mostra dados do usuario
- [ ] 3 secoes organizadas corretamente
- [ ] Links navegam para as views corretas
- [ ] Features de alto valor (Emergency, Consulta) em destaque
- [ ] Configuracoes funciona (Telegram, tema, senha)
- [ ] Densidade da interface com override de complexidade
- [ ] Logout funciona
- [ ] Testes passam

---

## W3-04: Sub-view "Minha Saude"

**Objetivo:** Criar sub-view acessivel via Perfil que consolida historico de adesao, calendario heat map, sparkline 30d, insights e timeline de doses.

**Arquivo:** `src/views/HealthHistory.jsx`
**CSS:** `src/views/HealthHistory.css`
**Deps:** W3-03 (acessivel via Perfil), W1-08 (Calendar heat map), W1-03 (Sparkline expanded)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `onNavigate` | `Function(viewId)` | Sim | Navegacao (voltar para profile, etc.) |

**Data flow:**
- `useDashboard()` para stats, logs, stockSummary
- `adherenceService.getDailyAdherence(30)` para sparkline 30d
- `adherenceService.getAdherenceSummary('30d')` para resumo
- `useInsights()` para insights dinamicos
- Logs filtrados para timeline (ultimos 30 dias, agrupados por data)

**Secoes da view:**

```
+---------------------------------+
| <- Minha Saude                  |
+---------------------------------+
| ADESAO 30D          85% (+3%)  |
| progressbar cheia              |
| fire 12d streak . Melhor: 28d  |
+---------------------------------+
| <- Fev 2026 ->                  |
| D  S  T  Q  Q  S  S           |
|       G  G  Y  G              |  <- Calendar heat map (W1-08)
| G  G  R  G  G  Y  G           |
| G  .  .  .  .  .  .           |
+---------------------------------+
| SPARKLINE 30D                   |
| sparkline expandida com tooltip |  <- SparklineAdesao size='expanded'
| 28/01--------------27/02       |
+---------------------------------+
| INSIGHTS                        |
| bulb Quartas: -15% vs media    |  <- do useInsights()
| bulb Horario noturno: +8%      |
+---------------------------------+
| TIMELINE DE DOSES               |
| 27/02 -- 3 doses               |  <- reutiliza logica do History
|   Losartana 08:00 check [edit] |
|   Metformina 08:00 check       |
|   Losartana 22:00 check        |
| 26/02 -- 2 doses               |
| [ver mais...]                   |
+---------------------------------+
| STATS DO MES                    |
| 68 doses . 24 dias . 136cp     |
+---------------------------------+
| [check Registrar Dose]          |
+---------------------------------+
```

**Implementacao — reutilizacao maxima:**

O History.jsx existente ja tem boa parte desta logica. A abordagem e:

1. Extrair a logica de timeline do History.jsx em um componente reutilizavel `DoseTimeline`
2. Extrair as stats do History.jsx em `MonthStats`
3. HealthHistory.jsx compoe esses componentes com Calendar heat map e Sparkline

```javascript
// Se possivel, importar componentes do History
// Se nao, copiar a logica (e limpar History depois)
```

**Navegacao:**
- Botao "<-" volta para 'profile'
- Click num dia do calendario pode abrir DailyDoseModal (existente)
- "Registrar Dose" abre LogForm

**Testes esperados:** `src/views/__tests__/HealthHistory.test.jsx`

```
describe('HealthHistory')
  it('renderiza header com botao voltar')
  it('renderiza resumo de adesao 30d')
  it('renderiza calendario com heat map')
  it('renderiza sparkline expanded')
  it('renderiza insights')
  it('renderiza timeline de doses')
  it('renderiza stats do mes')
  it('botao voltar navega para profile')
  it('registrar dose abre modal')
```

**Criterios de aceite:**
- [ ] Todas as secoes renderizam com dados reais
- [ ] Calendar heat map com cores de adesao (W1-08)
- [ ] Sparkline 30 dias com tooltip (W1-03)
- [ ] Timeline reutiliza logica existente do History
- [ ] Navegacao voltar funciona
- [ ] Registrar dose funciona
- [ ] Testes passam

---

## W3-05: Wizard de Cadastro Unificado

**Objetivo:** Substituir o fluxo window.confirm cascade (Med→Prot→Stock) por um wizard de 3 passos com UI propria.

**Arquivo:** `src/features/protocols/components/TreatmentWizard.jsx`
**CSS:** `src/features/protocols/components/TreatmentWizard.css`
**Deps:** W3-02 (acessivel via tab Tratamento)

**Props:**

| Prop | Tipo | Obrigatoria | Descricao |
|------|------|-------------|-----------|
| `onComplete` | `Function(result)` | Sim | Callback quando wizard completa |
| `onCancel` | `Function` | Sim | Callback quando usuario cancela |
| `preselectedMedicine` | `Object` | Nao | Se veio de "Criar protocolo" (med ja selecionado) |
| `treatmentPlanId` | `string` | Nao | Se adicionando a um plano existente |

**State interno:**
- `step` (number) — 1, 2 ou 3
- `medicineData` (Object) — dados do step 1
- `protocolData` (Object) — dados do step 2
- `stockData` (Object) — dados do step 3
- `isSubmitting` (boolean)

**Steps:**

### Step 1: Medicamento
- Campos: name (obrigatorio), type (select), dosage_per_pill (number), dosage_unit (select)
- Validacao: medicineSchema (create)
- Se `preselectedMedicine` existe, preencher e pular para step 2

### Step 2: Como Tomar (Protocolo)
- Campos: frequency (select), time_schedule (time pickers), dosage_per_intake (number), start_date
- Validacao: protocolSchema (parcial)
- Botao "Pular" permite criar so o medicamento sem protocolo

### Step 3: Estoque Atual
- Campos: quantity (number), purchase_date, unit_price, expiration_date (opcional)
- Validacao: stockSchema (parcial)
- Botao "Pular" permite criar sem estoque

### Step 4: Conclusao
- Resumo do que foi criado
- CTAs: "Ir para Hoje" | "Cadastrar outro"

**Indicador de progresso:**

```jsx
<div className="wizard-progress">
  {[1, 2, 3].map(s => (
    <div
      key={s}
      className={`wizard-progress__dot ${s <= step ? 'wizard-progress__dot--active' : ''}`}
    />
  ))}
</div>
```

**Fluxo de submissao:**

```javascript
async function handleComplete() {
  setIsSubmitting(true)
  try {
    // 1. Criar medicamento
    const medicine = await medicineService.create(medicineData)

    // 2. Criar protocolo (se nao pulou)
    let protocol = null
    if (protocolData) {
      protocol = await protocolService.create({
        ...protocolData,
        medicine_id: medicine.id,
        treatment_plan_id: treatmentPlanId || null,
      })
    }

    // 3. Criar estoque (se nao pulou)
    if (stockData) {
      await stockService.create({
        ...stockData,
        medicine_id: medicine.id,
      })
    }

    // 4. Invalidar cache
    refresh()

    onComplete({ medicine, protocol })
  } catch (error) {
    // Mostrar erro sem perder dados preenchidos
    setError(error.message)
  } finally {
    setIsSubmitting(false)
  }
}
```

**Animacoes:**
- Transicao entre steps: slide horizontal (Framer Motion `AnimatePresence` + `x: [300, 0]` / `x: [-300, 0]`)
- Progresso dots: scale animation no dot ativo

**Testes esperados:** `src/features/protocols/components/__tests__/TreatmentWizard.test.jsx`

```
describe('TreatmentWizard')
  describe('Step 1 - Medicamento')
    it('renderiza campos do medicamento')
    it('valida campos obrigatorios')
    it('avanca para step 2 com dados validos')
    it('preenche automaticamente com preselectedMedicine')
  describe('Step 2 - Protocolo')
    it('renderiza campos do protocolo')
    it('Pular cria so o medicamento')
    it('avanca para step 3 com dados validos')
  describe('Step 3 - Estoque')
    it('renderiza campos de estoque')
    it('Pular cria sem estoque')
    it('submete tudo ao Concluir')
  describe('Step 4 - Conclusao')
    it('mostra resumo do que foi criado')
    it('Ir para Hoje navega corretamente')
    it('Cadastrar outro reseta o wizard')
  describe('Error handling')
    it('mostra erro sem perder dados preenchidos')
    it('permite retry apos erro')
```

**Criterios de aceite:**
- [ ] 3 steps + tela de conclusao
- [ ] Navegacao frente/tras entre steps
- [ ] "Pular" funciona em steps 2 e 3
- [ ] Validacao Zod em cada step
- [ ] Submissao cria med + protocolo + estoque atomicamente
- [ ] Erro nao perde dados preenchidos
- [ ] preselectedMedicine preenche step 1
- [ ] Animacao de transicao entre steps
- [ ] Indicador de progresso (dots)
- [ ] Testes passam

---

## W3-06: Migrar History → Saude

**Objetivo:** Garantir que toda a funcionalidade do History.jsx esta disponivel no HealthHistory.jsx, e redirecionar acessos antigos.

**Arquivo:** `src/views/History.jsx` (EDITAR)
**Deps:** W3-04 (HealthHistory precisa existir)

**Mudancas:**

1. History.jsx se torna um redirect simples:

```jsx
function History({ onNavigate }) {
  useEffect(() => {
    onNavigate('health-history')
  }, [onNavigate])

  return null // ou loading spinner breve
}
```

2. Verificar que TODA funcionalidade de History esta em HealthHistory:

| Funcionalidade History | Presente em HealthHistory? |
|----------------------|---------------------------|
| Calendario mensal | Sim (Calendar heat map) |
| Timeline de doses por dia | Sim (DoseTimeline) |
| Editar/deletar dose | Sim (mesmos handlers) |
| Stats do mes | Sim (MonthStats) |
| Registrar dose (FAB) | Sim (botao no final) |
| Navegacao entre meses | Sim (Calendar nav) |

**Criterios de aceite:**
- [ ] History.jsx redireciona para health-history
- [ ] Toda funcionalidade preservada no HealthHistory
- [ ] Nenhum dead-link para History
- [ ] Testes do History redirecionam corretamente

---

## W3-07: Cross-navigation (alertas → telas)

**Objetivo:** Garantir que alertas, CTAs e links em toda a app navegam para os destinos corretos no novo layout de 4 tabs.

**Arquivo:** Multiplos (edits cirurgicos)
**Deps:** W3-01, W3-02, W3-03

**Mapa de redirecionamentos:**

| Origem | Acao | Destino ANTES | Destino DEPOIS |
|--------|------|---------------|----------------|
| SmartAlerts | "ESTOQUE" click | stock | stock (sem mudanca) |
| SmartAlerts | "TOMAR" click (dose atrasada) | LogForm | LogForm (sem mudanca) |
| SmartAlerts | "RENOVAR" click (prescricao) | protocols | treatment |
| StockBars | Click no item | stock | stock (sem mudanca) |
| Dashboard header | "Remedios" link (se existir) | medicines | treatment |
| Insight "estoque baixo" | "Ver estoque" | stock | stock (sem mudanca) |
| LogForm | Apos registrar | (fecha modal) | (fecha modal, sem mudanca) |
| Wizard (W3-05) | "Ir para Hoje" | — | dashboard |
| Profile | "Minha Saude" | — | health-history |
| Emergency Card | Link qualquer | settings | profile |

**Implementacao:**

Buscar por `setCurrentView('medicines')`, `setCurrentView('protocols')`, `setCurrentView('history')`, `setCurrentView('settings')` em todo o codebase e avaliar se deve mudar:

```bash
grep -r "setCurrentView\|onNavigate" src/ --include="*.jsx" --include="*.js"
```

Regras de migracao:
- `'medicines'` → `'treatment'` (na maioria dos casos)
- `'protocols'` → `'treatment'` (na maioria dos casos)
- `'history'` → `'health-history'` (redirect no W3-06 ja cobre, mas melhor atualizar)
- `'settings'` → `'profile'`
- `'stock'` → `'stock'` (sem mudanca)
- `'dashboard'` → `'dashboard'` (sem mudanca)

**Testes esperados:** Nenhum teste novo especifico — rodar `npm run validate:agent` para garantir que nada quebrou.

**Criterios de aceite:**
- [ ] Nenhum link aponta para view inexistente
- [ ] Alertas navegam para destinos corretos
- [ ] Nenhum dead-end na navegacao
- [ ] grep por 'medicines', 'protocols', 'history', 'settings' em onNavigate/setCurrentView retorna 0 resultados (todos migrados)
- [ ] `npm run validate:agent` passa
- [ ] `npm run build` passa

---

*Ultima atualizacao: 05/03/2026*
*Esta e a onda final do plano de evolucao UX.*
