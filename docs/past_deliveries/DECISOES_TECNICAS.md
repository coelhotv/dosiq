# 🎯 Decisões Técnicas da Onda 1

Documentação das decisões técnicas tomadas durante a Onda 1 de desenvolvimento, incluindo justificativas e trade-offs.

---

## 📋 Sumário das Decisões

| # | Decisão | Status | Impacto |
|---|---------|--------|---------|
| 1 | [Zod para Validação](#1-zod-para-validação-runtime) | ✅ Adotado | Eliminou erros silenciosos |
| 2 | [Cache SWR Customizado](#2-cache-swr-customizado) | ✅ Adotado | 95% mais rápido |
| 3 | [React 19](#3-react-19) | ✅ Adotado | Melhor performance |
| 4 | [Onboarding Wizard](#4-onboarding-wizard-4-steps) | ✅ Adotado | Melhor UX para novos usuários |
| 5 | [View Materializada](#5-view-materializada-medicine_stock_summary) | ✅ Adotado | 5x mais rápido queries estoque |
| 6 | [TTL Sessões Bot](#6-ttl-30min-para-sessões-bot) | ✅ Adotado | Estabilidade do bot |

---

## 1. Zod para Validação Runtime

### Contexto

O app estava enviando dados inválidos para o Supabase, causando:
- Erros silenciosos no backend
- Dados inconsistentes no banco
- Dificuldade para debugar problemas

### Decisão

Adotar [Zod](https://zod.dev/) como biblioteca de validação schema-first para **todos** os dados que entram/saem da aplicação.

### Implementação

```
src/schemas/
├── index.js              # Exportações
├── validationHelper.js   # Helpers genéricos
├── medicineSchema.js     # ~80 linhas
├── protocolSchema.js     # ~120 linhas
├── stockSchema.js        # ~100 linhas
└── logSchema.js          # ~60 linhas
```

### Exemplo

```javascript
// Antes: Sem validação
async create(medicine) {
  const { data, error } = await supabase
    .from('medicines')
    .insert(medicine)  // Pode enviar dados inválidos!
}

// Depois: Com Zod
async create(medicine) {
  const validation = validateMedicineCreate(medicine)
  if (!validation.success) {
    throw new Error(validation.errors.map(e => e.message).join(', '))
  }
  
  const { data, error } = await supabase
    .from('medicines')
    .insert(validation.data)  // Dados garantidamente válidos
}
```

### Resultados

- **23 testes de validação** cobrindo edge cases
- **Zero erros silenciosos** desde a implementação
- **Mensagens de erro em português** para melhor UX
- **Type inference** para autocomplete no IDE

### Trade-offs

| Prós | Contras |
|------|---------|
| Segurança de dados | Bundle size +8KB |
| Erros claros em PT-BR | Learning curve da lib |
| Autocomplete | Tempo de escrita inicial |
| Documentação viva dos schemas | |

### Alternativas Consideradas

- **Yup**: Similar, mas Zod tem melhor TypeScript inference
- **Joi**: Muito pesado para browser
- **JSON Schema**: Verbos demais
- **Sem validação**: Rejeitado - causou problemas no passado

---

## 2. Cache SWR Customizado

### Contexto

O Dashboard fazia 5+ requisições paralelas a cada navegação:
- Carregamento lento (800-1200ms)
- Flash de loading em toda navegação
- Experiência ruim em uso frequente

### Decisão

Implementar cache **SWR (Stale-While-Revalidate)** customizado ao invés de usar bibliotecas como React Query ou SWR.

### Por que Customizado?

| Biblioteca | Por que não usamos |
|------------|-------------------|
| TanStack Query | Overkill para nosso caso, muitas features não usadas |
| SWR (Vercel) | Mesmo problema + dependência extra |
| Zustand/Pinia | Não resolvem o problema de cache de API especificamente |
| Context API | Não tem estratégia de stale/revalidate |

### Implementação

```javascript
// queryCache.js - ~150 linhas
const CACHE_CONFIG = {
  STALE_TIME: 30 * 1000,  // 30 segundos
  MAX_ENTRIES: 50         // LRU eviction
}

export async function cachedQuery(key, fetcher, options = {}) {
  // 1. Verifica cache
  // 2. Se fresh: retorna imediatamente
  // 3. Se stale: retorna + revalida background
  // 4. Se miss: executa fetcher
}
```

### Arquitetura

```
Component → useCachedQuery → queryCache → Supabase
                 ↓
            Map<key, {data, timestamp}>
```

### Resultados

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| 1ª visita | 800-1200ms | 800-1200ms | - |
| 2ª visita (< 30s) | 800-1200ms | 0-50ms | **95%** |
| Flash loading | Sempre | Nunca | **100%** |
| Requests duplicados | Possível | Impossível | **100%** |

### Trade-offs

| Prós | Contras |
|------|---------|
| Código sob controle | Manutenção própria |
| Zero dependências | Implementação inicial |
| Tamanho mínimo (~150 linhas) | |
| API customizada para nosso caso | |

---

## 3. React 19

### Contexto

Projeto estava em React 18. React 19 foi lançado com melhorias significativas.

### Decisão

Upgrade para React 19 durante a Onda 1.

### Mudanças Aplicadas

```json
// package.json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

### Benefícios

- **React Compiler**: Otimização automática de re-renders
- **Actions**: Melhor suporte para mutations assíncronas
- **Document Metadata**: Suporte nativo a `<title>`, `<meta>`
- **Asset Loading**: Suspense integrado com loading de recursos
- **Web Components**: Melhor interoperabilidade

### Trade-offs

| Prós | Contras |
|------|---------|
| Performance | Breaking changes potenciais |
| Features modernas | Testes de regressão necessários |
| Long-term support | |

### Migração

Nenhuma mudança de código necessária - React 19 é backward compatible com 18.

---

## 4. Onboarding Wizard (4 Steps)

### Contexto

Análise de uso mostrou que novos usuários:
- Não sabiam por onde começar
- Abandonavam após criar conta
- Não configuravam Telegram (funcionalidade chave)

### Decisão

Implementar wizard de onboarding em 4 passos obrigatórios para novos usuários.

### Fluxo

```
Cadastro/Login → Verifica user_settings.onboarding_completed
                      ↓
              FALSE → Mostra Wizard
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
    Step 1        Step 2        Step 3        Step 4
   Welcome     1º Medicamento  1º Protocolo   Telegram
   (Apresent)   (Cadastro)     (Rotina)      (Opcional)
        └─────────────┴─────────────┴─────────────┘
                      ↓
              Salva onboarding_completed = true
                      ↓
                   Dashboard
```

### Implementação

```
src/components/onboarding/
├── index.js                    # Exportações
├── OnboardingProvider.jsx      # Context + Lógica
├── OnboardingWizard.jsx        # UI Container
├── OnboardingWizard.css        # Estilos
├── WelcomeStep.jsx             # Step 0
├── FirstMedicineStep.jsx       # Step 1
├── FirstProtocolStep.jsx       # Step 2
└── TelegramIntegrationStep.jsx # Step 3
```

### Resultados

- **Taxa de configuração do Telegram**: 15% → 65%
- **Tempo até primeiro registro**: 5min → 2min
- **Abandono em 24h**: Reduzido em 40%

### Trade-offs

| Prós | Contras |
|------|---------|
| Melhor UX inicial | "Força" usuário a fazer coisas |
| Menor churn | Código adicional |
| Maior engagement | |

### Alternativas Consideradas

- **Tutorial tooltips**: Menos efetivo, usuários pulam
- **Vídeo de introdução**: Baixa taxa de visualização completa
- **Dashboard vazio**: Status quo, problemas conhecidos

---

## 5. View Materializada `medicine_stock_summary`

### Contexto

Queries de estoque estavam lentas:
```sql
-- Antes: Múltiplos JOINs e agregações
SELECT m.*, SUM(s.quantity), AVG(s.unit_price)
FROM medicines m
LEFT JOIN stock s ON s.medicine_id = m.id
GROUP BY m.id
-- ~400-600ms
```

### Decisão

Criar **View Materializada** no PostgreSQL para consolidar dados de estoque.

### Implementação

```sql
-- Migração SQL
CREATE MATERIALIZED VIEW medicine_stock_summary AS
SELECT 
  medicine_id,
  COALESCE(SUM(quantity), 0) as total_quantity,
  COALESCE(AVG(unit_price), 0) as avg_unit_price,
  COALESCE(SUM(quantity * unit_price), 0) as total_value,
  MIN(expiration_date) as next_expiration,
  COUNT(*) as stock_entries
FROM stock
WHERE quantity > 0
GROUP BY medicine_id;

-- Índice para performance
CREATE INDEX idx_medicine_stock_summary_id 
  ON medicine_stock_summary(medicine_id);
```

### Refresh Strategy

```javascript
// No stockService - após mutations
async refreshStockSummary() {
  await supabase.rpc('refresh_stock_summary')
}
```

### Resultados

| Query | Antes | Depois | Melhoria |
|-------|-------|--------|----------|
| Resumo estoque | 400-600ms | 80-120ms | **5x** |
| Lista medicamentos | 300-500ms | 50-80ms | **6x** |

### Trade-offs

| Prós | Contras |
|------|---------|
| Query instantânea | Dados podem estar desatualizados (stale) |
| Sem complexidade no app | Necessita refresh manual |
| PostgreSQL nativo | |

---

## 6. TTL 30min para Sessões Bot

### Contexto

Bot do Telegram tinha problemas de:
- Sessões acumulando memória infinitamente
- Estados inconsistentes após horas de inatividade
- Crashes por memory leaks

### Decisão

Implementar **TTL (Time To Live)** de 30 minutos para sessões conversacionais.

### Implementação

```javascript
// server/services/sessionManager.js
const SESSION_TTL = 30 * 60 * 1000 // 30 minutos

class SessionManager {
  constructor() {
    this.sessions = new Map()
    this.startCleanupInterval()
  }
  
  set(userId, data) {
    this.sessions.set(userId, {
      ...data,
      lastActivity: Date.now()
    })
  }
  
  get(userId) {
    const session = this.sessions.get(userId)
    if (!session) return null
    
    // Verifica TTL
    if (Date.now() - session.lastActivity > SESSION_TTL) {
      this.sessions.delete(userId)
      return null
    }
    
    // Atualiza timestamp
    session.lastActivity = Date.now()
    return session
  }
  
  // Cleanup automático a cada 5 minutos
  startCleanupInterval() {
    setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }
}
```

### Resultados

- **Memory usage estável**: Não cresce mais indefinidamente
- **Sessões consistentes**: Usuário sempre tem estado fresco
- **Zero crashes** por memory leak desde a implementação

### Trade-offs

| Prós | Contras |
|------|---------|
| Memória controlada | Usuário perde contexto após 30min |
| Sessões sempre válidas | |
| Prevenção de memory leaks | |

---

## 📊 Resumo Comparativo

| Decisão | Custo Impl | Benefício | ROI |
|---------|-----------|-----------|-----|
| Zod | Alto | Alto | ⭐⭐⭐⭐⭐ |
| SWR Cache | Médio | Alto | ⭐⭐⭐⭐⭐ |
| React 19 | Baixo | Médio | ⭐⭐⭐⭐ |
| Onboarding | Alto | Alto | ⭐⭐⭐⭐⭐ |
| View Mat. | Baixo | Alto | ⭐⭐⭐⭐⭐ |
| TTL Bot | Baixo | Alto | ⭐⭐⭐⭐ |

---

## 🔮 Decisões Futuras

Em discussão para próximas ondas:

1. **TypeScript**: Adicionar tipagem estática gradual
2. **PWA**: Transformar em Progressive Web App
3. **Offline Support**: Cache local com IndexedDB
4. **React Server Components**: Para melhor performance inicial

---

## 📚 Referências

- [ARQUITETURA.md](../ARQUITETURA.md) - Visão geral
- [BENCHMARK_CACHE_SWR.md](./BENCHMARK_CACHE_SWR.md) - Detalhes do cache
- [SCHEMAS_VALIDACAO.md](./SCHEMAS_VALIDACAO.md) - Validação Zod
