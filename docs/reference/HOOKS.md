# 🪝 Hooks Customizados - Dosiq

Documentação completa dos hooks customizados do projeto.

---

## 📑 Índice

- [useCachedQuery](#usecachedquery)
- [useOnboarding](#useonboarding)

---

## useCachedQuery

Local: [`apps/web/src/shared/hooks/useCachedQuery.js`](../../apps/web/src/shared/hooks/useCachedQuery.js)

Hook React para integração com o sistema de cache SWR.

### Assinatura

```typescript
function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options?: UseCachedQueryOptions
): UseCachedQueryResult<T>

interface UseCachedQueryOptions {
  enabled?: boolean        // default: true
  staleTime?: number       // default: 30000 (30s)
  initialData?: T          // default: undefined
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseCachedQueryResult<T> {
  data: T | undefined
  isLoading: boolean       // true na primeira carga
  isFetching: boolean      // true em qualquer fetch (incl. background)
  error: Error | null
  refetch: () => Promise<void>
  invalidate: () => void
}
```

### Uso Básico

```jsx
import { useCachedQuery } from '../hooks/useCachedQuery'
import { cachedMedicineService } from '../services/api/cachedServices'

function MedicineList() {
  const { 
    data: medicines, 
    isLoading, 
    error, 
    refetch 
  } = useCachedQuery(
    'medicines',
    () => cachedMedicineService.getAll()
  )
  
  if (isLoading) return <p>Carregando...</p>
  if (error) return <p>Erro: {error.message}</p>
  
  return (
    <ul>
      {medicines?.map(m => (
        <li key={m.id}>{m.name}</li>
      ))}
    </ul>
  )
}
```

### Com Parâmetros Dinâmicos

```jsx
function MedicineDetail({ medicineId }) {
  const { data: medicine } = useCachedQuery(
    // Chave dinâmica baseada no ID
    medicineId ? `medicine:${medicineId}` : null,
    () => cachedMedicineService.getById(medicineId),
    {
      // Só executa se medicineId existir
      enabled: !!medicineId
    }
  )
  
  if (!medicineId) return <p>Selecione um medicamento</p>
  
  return <div>{medicine?.name}</div>
}
```

### Stale Time Customizado

```jsx
function Dashboard() {
  // Dados do usuário - cache por 5 minutos (mudam pouco)
  const { data: user } = useCachedQuery(
    'user',
    () => userService.getProfile(),
    { staleTime: 5 * 60 * 1000 } // 5 minutos
  )
  
  // Protocolos ativos - cache por 30s (mudam mais)
  const { data: protocols } = useCachedQuery(
    'protocols:active',
    () => cachedProtocolService.getActive(),
    { staleTime: 30 * 1000 } // 30 segundos
  )
  
  // Logs recentes - sem cache (sempre fresh)
  const { data: recentLogs } = useCachedQuery(
    'logs:recent',
    () => logService.getRecent(10),
    { staleTime: 0 } // Sempre fresh
  )
}
```

### Callbacks de Sucesso/Erro

```jsx
function StockManager({ medicineId }) {
  const [lastUpdated, setLastUpdated] = useState(null)
  
  const { data: stock } = useCachedQuery(
    `stock:${medicineId}`,
    () => cachedStockService.getByMedicineId(medicineId),
    {
      onSuccess: (data) => {
        console.log('Estoque carregado:', data)
        setLastUpdated(new Date())
      },
      onError: (error) => {
        toast.error('Erro ao carregar estoque: ' + error.message)
      }
    }
  )
}
```

### Refetch Manual

```jsx
function MedicinePage() {
  const { data: medicines, refetch, isFetching } = useCachedQuery(
    'medicines',
    () => cachedMedicineService.getAll()
  )
  
  const handleRefresh = async () => {
    await refetch() // Força nova requisição
  }
  
  return (
    <div>
      <button onClick={handleRefresh} disabled={isFetching}>
        {isFetching ? 'Atualizando...' : 'Atualizar'}
      </button>
      {/* ... */}
    </div>
  )
}
```

### Dados Iniciais (SSR/Hidratação)

```jsx
function MedicineList({ initialMedicines }) {
  const { data: medicines } = useCachedQuery(
    'medicines',
    () => cachedMedicineService.getAll(),
    {
      // Usa dados do servidor enquanto carrega
      initialData: initialMedicines
    }
  )
  
  // medicines começa como initialMedicines
  // Depois é atualizado com dados frescos
  
  return <List medicines={medicines} />
}
```

### Estados de Loading

```jsx
function Dashboard() {
  const { data, isLoading, isFetching } = useCachedQuery(
    'dashboard',
    () => loadDashboardData()
  )
  
  // isLoading: true apenas na primeira carga
  // isFetching: true em qualquer fetch (incl. background)
  
  return (
    <div>
      {isLoading ? (
        <FullPageLoader />
      ) : (
        <>
          {isFetching && <BackgroundSpinner />}
          <DashboardContent data={data} />
        </>
      )}
    </div>
  )
}
```

### Invalidação Manual

```jsx
function MedicineEditor() {
  const { data, invalidate } = useCachedQuery(
    'medicines',
    () => cachedMedicineService.getAll()
  )
  
  const handleExternalUpdate = () => {
    // Invalida cache sem fazer requisição
    // Próximo useCachedQuery fará fetch fresh
    invalidate()
  }
}
```

### Cache Key Convention

```javascript
// ✅ Use chaves consistentes e previsíveis
useCachedQuery('medicines', ...)
useCachedQuery(`medicine:${id}`, ...)
useCachedQuery(`stock:medicine:${medicineId}`, ...)
useCachedQuery(`logs:month:${year}:${month}`, ...)

// ❌ Evite chaves dinâmicas demais
useCachedQuery(`medicines-${Date.now()}`, ...) // Nunca vai hitar cache
useCachedQuery(`data`, ...) // Muito genérico
```

---

## useOnboarding

Local: [`apps/web/src/shared/components/onboarding/OnboardingProvider.jsx`](../../apps/web/src/shared/components/onboarding/OnboardingProvider.jsx)

Hook para controle do wizard de onboarding.

### Assinatura

```typescript
function useOnboarding(): OnboardingContextValue

interface OnboardingContextValue {
  // Estados
  isOpen: boolean           // Wizard está visível?
  isLoading: boolean        // Verificando status?
  currentStep: number       // Step atual (0-3)
  totalSteps: number        // Total de steps (4)
  onboardingData: {
    medicine: Medicine | null
    protocol: Protocol | null
    telegramConnected: boolean
  }
  
  // Navegação
  nextStep: () => void
  prevStep: () => void
  goToStep: (step: number) => void
  
  // Ações
  skipOnboarding: () => Promise<void>
  completeOnboarding: () => Promise<void>
  updateOnboardingData: (data: Partial<OnboardingData>) => void
  
  // Helpers
  canGoNext: boolean
  canGoPrev: boolean
  isLastStep: boolean
  isFirstStep: boolean
}
```

### Uso Básico

```jsx
import { useOnboarding } from '../components/onboarding'

function SomeComponent() {
  const { isOpen, currentStep, nextStep } = useOnboarding()
  
  if (!isOpen) return null
  
  return (
    <div>
      <p>Step atual: {currentStep + 1}</p>
      <button onClick={nextStep}>Próximo</button>
    </div>
  )
}
```

### Acesso aos Dados do Onboarding

```jsx
function FirstMedicineStep() {
  const { 
    onboardingData, 
    updateOnboardingData,
    nextStep 
  } = useOnboarding()
  
  const handleMedicineCreated = (medicine) => {
    // Salva medicamento criado no contexto
    updateOnboardingData({ medicine })
    nextStep()
  }
  
  return (
    <MedicineForm 
      onSuccess={handleMedicineCreated}
      initialData={onboardingData.medicine}
    />
  )
}
```

### Pular Onboarding

```jsx
function WelcomeStep() {
  const { skipOnboarding, nextStep } = useOnboarding()
  
  const handleSkip = async () => {
    if (confirm('Tem certeza? Você pode configurar depois.')) {
      await skipOnboarding()
      // isOpen vira false, wizard fecha
    }
  }
  
  return (
    <div>
      <h1>Bem-vindo!</h1>
      <button onClick={nextStep}>Começar</button>
      <button onClick={handleSkip}>Pular</button>
    </div>
  )
}
```

### Finalizar Onboarding

```jsx
function TelegramIntegrationStep() {
  const { completeOnboarding, prevStep } = useOnboarding()
  
  const handleFinish = async () => {
    await completeOnboarding()
    // Salva onboarding_completed = true no Supabase
    // isOpen vira false
  }
  
  return (
    <div>
      <h2>Integração com Telegram</h2>
      {/* ... */}
      <button onClick={prevStep}>Voltar</button>
      <button onClick={handleFinish}>Finalizar</button>
    </div>
  )
}
```

### Verificar Disponibilidade do Step

```jsx
function FirstProtocolStep() {
  const { onboardingData, canGoNext, nextStep } = useOnboarding()
  
  // Verifica se tem medicamento antes de prosseguir
  const handleNext = () => {
    if (!onboardingData.medicine) {
      alert('Cadastre um medicamento primeiro')
      return
    }
    nextStep()
  }
  
  return (
    <div>
      <ProtocolForm 
        medicineId={onboardingData.medicine?.id}
      />
      <button 
        onClick={handleNext}
        disabled={!canGoNext}
      >
        Próximo
      </button>
    </div>
  )
}
```

### Provider

O hook deve ser usado dentro do `OnboardingProvider`:

```jsx
// App.jsx
import { OnboardingProvider, OnboardingWizard } from './components/onboarding'

function App() {
  return (
    <OnboardingProvider>
      {/* Seu app */}
      <OnboardingWizard /> {/* Modal do wizard */}
    </OnboardingProvider>
  )
}
```

---

## 📝 Melhores Práticas

### useCachedQuery

1. **Sempre use cache keys consistentes**
   ```javascript
   // ✅ BOM
   useCachedQuery('medicines', ...)
   useCachedQuery(`medicine:${id}`, ...)
   
   // ❌ RUIM
   useCachedQuery('meds', ...)
   useCachedQuery(`med-${id}`, ...)
   ```

2. **Desabilite quando não tiver dados necessários**
   ```javascript
   useCachedQuery(
     userId ? `user:${userId}` : null,
     fetcher,
     { enabled: !!userId }
   )
   ```

3. **Trate todos os estados**
   ```javascript
   const { data, isLoading, error } = useCachedQuery(...)
   
   if (isLoading) return <Loading />
   if (error) return <Error message={error.message} />
   if (!data) return <Empty />
   ```

4. **Use staleTime apropriado**
   ```javascript
   // Dados que mudam pouco: cache maior
   { staleTime: 5 * 60 * 1000 } // 5 min
   
   // Dados em tempo real: cache menor/sem cache
   { staleTime: 10 * 1000 } // 10 seg
   ```

### useOnboarding

1. **Sempre verifique se está dentro do Provider**
   ```javascript
   // O hook já lança erro se usado fora do contexto
   const context = useContext(OnboardingContext)
   if (!context) {
     throw new Error('useOnboarding deve ser usado dentro de OnboardingProvider')
   }
   ```

2. **Persista dados entre steps**
   ```javascript
   // Salve progresso no onboardingData
   updateOnboardingData({ medicine: createdMedicine })
   ```

3. **Permita sair a qualquer momento**
   ```javascript
   // Ofereça skip em todos os steps
   <button onClick={skipOnboarding}>Pular introdução</button>
   ```

---

## 🔗 Veja Também

- [ARQUITETURA.md](./ARQUITETURA.md) - Visão geral da arquitetura
- [SERVICES.md](./SERVICES.md) - Documentação dos services
- [PADROES_CODIGO.md](./PADROES_CODIGO.md) - Convenções de código
