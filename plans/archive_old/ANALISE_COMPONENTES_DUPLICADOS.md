# Análise de Componentes Duplicados/Similares

**Data:** 2026-02-10
**Objetivo:** Identificar componentes com funcionalidades similares que podem ser consolidados

---

## Resumo Executivo

Esta análise identificou **7 grupos de componentes** com funcionalidades duplicadas ou muito similares que podem ser consolidados para reduzir código duplicado, melhorar manutenibilidade e garantir consistência na UI.

**⚠️ Importante:** Mesmo componentes que compartilham o mesmo código podem ter UX diferente devido às props passadas. Veja a seção "0. LogForm - UX Diferente" abaixo.

---

## 0. LogForm - UX Diferente (CRÍTICO)

### Componente Envolvido
- `src/components/log/LogForm.jsx` (332 linhas)

### Problema
O mesmo componente [`LogForm.jsx`](src/components/log/LogForm.jsx) é usado em dois lugares, mas a **UX é diferente** devido às props passadas:

#### Dashboard.jsx (linhas 670-684)
```jsx
<LogForm
  protocols={rawProtocols}
  treatmentPlans={treatmentPlans}  // ✅ PASSADO
  initialValues={prefillData}
  onSave={async (data) => {
    if (Array.isArray(data)) {
      await logService.createBulk(data);  // ✅ Suporta bulk
    } else {
      await logService.create(data);
    }
    setIsModalOpen(false);
    refresh();
  }}
  onCancel={() => setIsModalOpen(false)}
/>
```

#### History.jsx (linhas 290-298)
```jsx
<LogForm
  protocols={protocols}
  // treatmentPlans NÃO é passado  // ❌ NÃO PASSADO
  initialValues={editingLog}
  onSave={handleLogMedicine}  // ❌ Apenas single log
  onCancel={() => {
    setIsModalOpen(false)
    setEditingLog(null)
  }}
/>
```

### Diferenças de UX

| Aspecto | Dashboard | History |
|---------|-----------|---------|
| **Botão "Plano Completo"** | ✅ Visível (treatmentPlans passado) | ❌ Oculto (treatmentPlans não passado) |
| **Registro em lote** | ✅ Suportado (createBulk) | ❌ Não suportado |
| **Edição de logs** | ❌ Não suportado | ✅ Suportado (editingLog) |
| **Pre-fill de dados** | ✅ Suportado (prefillData) | ✅ Suportado (editingLog) |

### Impacto
- **Inconsistência de UX**: Usuário vê funcionalidades diferentes dependendo de onde abre o formulário
- **Confusão**: Usuário pode esperar registrar plano completo no History, mas não pode
- **Manutenção**: Lógica de tratamentoPlans está espalhada entre Dashboard e LogForm

### Causa Raiz
O componente [`LogForm.jsx`](src/components/log/LogForm.jsx) linha 179 controla a visibilidade do botão "Plano Completo":
```jsx
<button
  type="button"
  className={formData.type === 'plan' ? 'active' : ''}
  onClick={() => setFormData(prev => ({ ...prev, type: 'plan' }))}
  disabled={treatmentPlans.length === 0 || formData.id}  // ← Desabilitado se treatmentPlans vazio
>
  📁 Plano Completo
</button>
```

### Recomendação
**Padronizar a UX em ambos os lugares:**

#### Opção A: Habilitar "Plano Completo" no History
```jsx
// History.jsx
const [treatmentPlans, setTreatmentPlans] = useState([])

useEffect(() => {
  async function loadInitialData() {
    const [protocolsData, plansData, logsForMonth] = await Promise.all([
      protocolService.getActive(),
      treatmentPlanService.getAll(),  // ← Adicionar
      logService.getByMonth(new Date().getFullYear(), new Date().getMonth())
    ])
    setProtocols(protocolsData)
    setTreatmentPlans(plansData)  // ← Adicionar
    // ...
  }
  loadInitialData()
}, [])

// No Modal
<LogForm
  protocols={protocols}
  treatmentPlans={treatmentPlans}  // ← Passar
  initialValues={editingLog}
  onSave={handleLogMedicine}
  onCancel={() => {
    setIsModalOpen(false)
    setEditingLog(null)
  }}
/>
```

#### Opção B: Criar modo explícito no LogForm
```jsx
// LogForm.jsx
export default function LogForm({
  protocols,
  treatmentPlans = [],
  initialValues,
  onSave,
  onCancel,
  mode = 'full'  // 'full' | 'simple' (sem plano completo)
}) {
  const showPlanToggle = mode === 'full' && treatmentPlans.length > 0

  return (
    <form className="log-form" onSubmit={handleSubmit}>
      {/* ... */}
      {showPlanToggle && (
        <div className="log-type-toggle">
          {/* ... */}
        </div>
      )}
      {/* ... */}
    </form>
  )
}
```

**Benefícios:**
- UX consistente em toda a aplicação
- Usuário pode registrar planos completos de qualquer lugar
- Reduz confusão sobre funcionalidades disponíveis

---

## 1. Formulários de Medicamento (CRÍTICO)

### Componentes Envolvidos
- `src/components/medicine/MedicineForm.jsx` (209 linhas)
- `src/components/onboarding/FirstMedicineStep.jsx` (257 linhas)

### Problema
Ambos os componentes implementam o mesmo formulário de cadastro de medicamento com:
- Mesmos campos: name, laboratory, active_ingredient, dosage_per_pill, dosage_unit, type
- Mesma validação usando `medicineCreateSchema`
- Mesma lógica de submissão
- Mesma estrutura de UI

### Diferenças
- **MedicineForm**: Componente reutilizável com props `medicine`, `onSave`, `onCancel`
- **FirstMedicineStep**: Integrado ao fluxo de onboarding, usa `useOnboarding` context, avança automaticamente para próximo passo após salvar

### Impacto
- **Duplicação de código**: ~200 linhas duplicadas
- **Risco de inconsistência**: Mudanças em um componente não refletem no outro
- **Manutenção duplicada**: Bugs precisam ser corrigidos em dois lugares

### Recomendação
**Consolidar em um único componente reutilizável:**

```jsx
// src/components/medicine/MedicineForm.jsx
export default function MedicineForm({ 
  medicine, 
  onSave, 
  onCancel,
  // Novas props para suportar onboarding
  onSuccess, // Callback após salvar com sucesso
  autoAdvance = false, // Se true, chama onSuccess após salvar
  showSuccessMessage = true // Se true, mostra mensagem de sucesso
}) {
  // ... implementação unificada
}
```

**Benefícios:**
- Redução de ~200 linhas de código
- Manutenção centralizada
- Consistência garantida
- Reutilização em outros contextos

---

## 2. Formulários de Protocolo (CRÍTICO)

### Componentes Envolvidos
- `src/components/protocol/ProtocolForm.jsx` (406 linhas)
- `src/components/onboarding/FirstProtocolStep.jsx` (330 linhas)

### Problema
Ambos os componentes implementam formulário de cadastro de protocolo com:
- Mesmos campos: medicine_id, name, frequency, time_schedule, dosage_per_intake, notes
- Mesma validação usando `protocolCreateSchema`
- Mesma lógica de adição/remoção de horários
- Mesma estrutura de UI

### Diferenças
- **ProtocolForm**: Mais completo, suporta titration, treatment plans, edição
- **FirstProtocolStep**: Simplificado, integrado ao onboarding, auto-avança após salvar

### Impacto
- **Duplicação de código**: ~300 linhas duplicadas
- **Risco de inconsistência**: Validações e lógica podem divergir
- **Manutenção duplicada**: Mudanças precisam ser replicadas

### Recomendação
**Consolidar em um único componente com modo simplificado:**

```jsx
// src/components/protocol/ProtocolForm.jsx
export default function ProtocolForm({ 
  medicines, 
  treatmentPlans = [], 
  protocol, 
  initialValues, 
  onSave, 
  onCancel,
  // Novas props para suportar onboarding
  mode = 'full', // 'full' | 'simple' (onboarding)
  onSuccess, // Callback após salvar com sucesso
  autoAdvance = false
}) {
  // ... implementação unificada
}
```

**Benefícios:**
- Redução de ~300 linhas de código
- Validação consistente
- Manutenção centralizada
- Suporte a diferentes modos de uso

---

## 3. Componentes de Calendário (MÉDIO)

### Componentes Envolvidos
- `src/components/ui/Calendar.jsx` (80 linhas)
- `src/components/ui/CalendarWithMonthCache.jsx` (198 linhas)

### Problema
Dois componentes de calendário com funcionalidades sobrepostas:
- Ambos renderizam calendário mensal
- Ambos suportam markedDates, selectedDate, onDayClick
- Mesma lógica de cálculo de dias

### Diferenças
- **Calendar**: Simples, sem lazy loading
- **CalendarWithMonthCache**: Avançado, com lazy loading, swipe, month picker, loading states

### Impacto
- **Duplicação de código**: ~80 linhas de lógica de calendário duplicadas
- **Confusão**: Qual componente usar em cada situação?
- **Manutenção**: Bugs de cálculo de dias precisam ser corrigidos em ambos

### Recomendação
**Consolidar em um único componente com features opcionais:**

```jsx
// src/components/ui/Calendar.jsx
export default function Calendar({ 
  markedDates = [], 
  selectedDate, 
  onDayClick,
  // Features opcionais
  enableLazyLoad = false,
  onLoadMonth,
  enableSwipe = false,
  enableMonthPicker = false,
  monthPickerRange = { start: -12, end: 3 } // meses antes/depois de hoje
}) {
  // ... implementação unificada
}
```

**Benefícios:**
- Redução de ~80 linhas de código
- API consistente
- Features opcionais via props
- Manutenção centralizada

---

## 4. Widgets de Alertas (MÉDIO)

### Componentes Envolvidos
- `src/components/dashboard/SmartAlerts.jsx`
- `src/components/dashboard/StockAlertsWidget.jsx`

### Problema
Ambos exibem alertas com estrutura similar:
- Header com título e badge de contagem
- Lista de itens com status (critical/warning)
- Botões de ação
- Estado de expandido/colapsado

### Diferenças
- **SmartAlerts**: Alertas de doses atrasadas e estoque, com ações contextuais (TOMAR, ADIAR, COMPRAR, ESTOQUE)
- **StockAlertsWidget**: Apenas alertas de estoque, com ação de adicionar estoque

### Impacto
- **Duplicação de estrutura UI**: Layout similar implementado duas vezes
- **Inconsistência visual**: Pequenas diferenças de estilo
- **Manutenção duplicada**: Mudanças de layout precisam ser replicadas

### Recomendação
**Criar componente base de alerta reutilizável:**

```jsx
// src/components/ui/AlertList.jsx
export default function AlertList({ 
  alerts = [], 
  onAction,
  variant = 'default', // 'default' | 'stock' | 'dose'
  showExpandButton = true,
  maxVisible = 3
}) {
  // ... implementação unificada
}
```

**Benefícios:**
- Componente base reutilizável
- Consistência visual garantida
- Manutenção centralizada
- Fácil adicionar novos tipos de alertas

---

## 5. Widget de Adesão (BAIXO)

### Componentes Envolvidos
- `src/components/adherence/AdherenceWidget.jsx` (178 linhas)
- `src/components/adherence/AdherenceProgress.jsx` (85 linhas)

### Problema
**AdherenceWidget** já usa **AdherenceProgress** internamente, então não há duplicação real. No entanto, há potencial de confusão sobre quando usar cada componente.

### Situação Atual
- **AdherenceProgress**: Componente de progresso circular puro (apenas visualização)
- **AdherenceWidget**: Widget completo com dados, período selector, streak, protocol scores

### Recomendação
**Manter separação, mas documentar melhor:**
- Adicionar JSDoc claro explicando quando usar cada componente
- Considerar renomear para `AdherenceCircularProgress` para maior clareza

**Benefícios:**
- Clareza na API
- Separação de responsabilidades mantida
- Documentação melhorada

---

## 6. Widgets do Dashboard (BAIXO)

### Componentes Envolvidos
- `src/components/dashboard/DashboardWidgets.jsx` (123 linhas)
- `src/components/dashboard/QuickActionsWidget.jsx` (79 linhas)
- `src/components/dashboard/StockAlertsWidget.jsx` (140 linhas)

### Problema
**DashboardWidgets** é um container que orquestra **QuickActionsWidget** e **StockAlertsWidget**. Não há duplicação real, mas há acoplamento.

### Situação Atual
- **DashboardWidgets**: Container que busca dados e renderiza widgets
- **QuickActionsWidget**: Widget de ações rápidas
- **StockAlertsWidget**: Widget de alertas de estoque

### Recomendação
**Manter arquitetura atual, mas considerar:**
- Remover **DashboardWidgets** e renderizar widgets diretamente no Dashboard
- Isso simplificaria a arquitetura e removeria um nível de indireção

**Benefícios:**
- Arquitetura mais simples
- Menos indireção
- Melhor performance (menos re-renders)

---

## Priorização de Refatoração

### Alta Prioridade (P0)
1. **LogForm - UX Diferente** - Alto impacto na experiência do usuário, inconsistência crítica
2. **Formulários de Medicamento** - Alto impacto, alto risco de inconsistência
3. **Formulários de Protocolo** - Alto impacto, alto risco de inconsistência

### Média Prioridade (P1)
4. **Componentes de Calendário** - Impacto médio, confusão de API
5. **Widgets de Alertas** - Impacto médio, inconsistência visual

### Baixa Prioridade (P2)
6. **Widget de Adesão** - Apenas documentação
7. **Widgets do Dashboard** - Opcional, arquitetura

---

## Estimativa de Esforço

| Tarefa | Esforço | Risco | Benefício |
|--------|---------|-------|-----------|
| Padronizar LogForm UX | 2-3h | Baixo | Alto |
| Consolidar MedicineForm | 4-6h | Médio | Alto |
| Consolidar ProtocolForm | 6-8h | Médio | Alto |
| Consolidar Calendar | 4-6h | Baixo | Médio |
| Criar AlertList base | 3-4h | Baixo | Médio |
| Documentar Adherence | 1-2h | Nenhum | Baixo |
| Simplificar DashboardWidgets | 2-3h | Baixo | Baixo |

**Total estimado:** 22-32 horas

---

## Próximos Passos

1. **Validação com equipe:** Confirmar prioridades e abordagem
2. **Planejamento detalhado:** Criar specs técnicas para cada refatoração
3. **Implementação incremental:** Começar com P0, depois P1, depois P2
4. **Testes abrangentes:** Garantir que refatorações não quebram funcionalidades existentes
5. **Documentação:** Atualizar docs após cada refatoração

---

## Conclusão

A análise identificou oportunidades significativas de consolidação de componentes, especialmente nos formulários de Medicine e Protocol. A refatoração proposta pode reduzir o código duplicado em ~500 linhas, melhorar a manutenibilidade, garantir consistência na UI e padronizar a experiência do usuário em toda a aplicação.

A priorização sugerida foca primeiro nos componentes de maior impacto e risco, seguidos por melhorias de arquitetura e documentação.
