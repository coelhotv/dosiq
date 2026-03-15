# 🏃‍♂️ Sumário de Sprints: Otimização Mobile & Escalabilidade

### Resumo dos Sprints e Necessidades

| Sprint | Foco Principal | Função Técnica | Necessidade / Justificativa |
| --- | --- | --- | --- |
| **A: Virtualização UI** | **Camada React** | Implementar `react-virtuoso` e paginação por cursor no histórico. | **Evitar Crash OOM:** Androids antigos travam ao tentar renderizar mais de 100 itens no DOM. A virtualização mantém apenas ~10 ativos. |
| **B: Performance Crítica** | **Experiência Mobile** | Reciclagem de nós, memoização de componentes e otimização de "Paint" (CSS). | **Fluidez (60 FPS):** Garante que o scroll não tenha "engasgos" e que a thread principal esteja livre para interações rápidas. |
| **C: Offload de Dados** | **Infra Supabase** | Criar Views, Índices e Funções RPC (PL/pgSQL) no banco de dados. | **Economia de CPU:** Move o cálculo matemático de adesão (40k+ registros) do telemóvel para o servidor. O dispositivo recebe apenas o resultado. |
| **D: Sincronização** | **Integração RPC** | Implementar o Hook `useDashboardSync` para consumo centralizado de dados. | **Bateria e Rede:** Reduz o "Network Waterfall" e o consumo de rádio do celular, trocando 5-6 requests por 1 único pacote JSON otimizado. |

---

# SPRINT A -- PLANO DE EXECUÇÃO: ESCALABILIDADE DE DADOS (HEALTHHISTORY)

**Objetivo:** Transicionar o processamento de logs de "Client-Side" para "Server-Side/Database-Centric" para suportar >100 doses diárias sem degradação de performance em dispositivos móveis.

---

## 💾 FASE 1: OTIMIZAÇÃO DE BANCO DE DADOS (SUPABASE)

### 1.1 Índices Compostos
Executar o seguinte comando no SQL Editor do Supabase para otimizar buscas temporais:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_logs_user_date_desc" 
ON "public"."medication_logs" ("user_id", "created_at" DESC);

```

### 1.2 View de Agregação de Adesão

Criar uma View para evitar que o React processe milhares de linhas apenas para calcular a porcentagem diária:

```sql
CREATE OR REPLACE VIEW daily_adherence_summary AS
SELECT 
    user_id,
    DATE(created_at) as log_date,
    COUNT(*) as total_doses,
    COUNT(*) FILTER (WHERE status = 'taken') as taken_doses
FROM medication_logs
GROUP BY user_id, DATE(created_at);

```

---

## 🌐 FASE 2: CAMADA DE SERVIÇO (DATA FETCHING)

### 2.1 Implementação de Paginação por Cursor

**Arquivo:** `src/shared/services/paginationService.js` (Criar novo)

* **Função**: `fetchLogsPaginated(userId, lastTimestamp, limit = 50)`
* **Lógica**: Utilizar `.gt('created_at', lastTimestamp)` para buscar apenas os próximos registros, evitando o overhead de `OFFSET`.

### 2.2 Refatoração do `logService.js`

**Arquivo:** `src/shared/services/api/logService.js`

* Substituir `getLogs()` por `getLogsIncremental()`.
* Implementar cache local via `SWR` ou `React Query` para manter os registros já carregados em memória.

---

## 🖥️ FASE 3: REFATORAÇÃO DA UI (REACT VIRTUALIZATION)

### 3.1 Substituição de Map por Virtualização

**Arquivo:** `src/views/HealthHistory.jsx`

* **Componente**: Instalar e importar `react-virtuoso` (ou similar como `react-window`).
* **Implementação**:
```jsx
import { Virtuoso } from 'react-virtuoso';

// No render:
<Virtuoso
  style={{ height: '500px' }}
  data={memoizedLogs}
  endReached={loadMoreLogs}
  itemContent={(index, log) => <LogEntry key={log.id} log={log} />}
/>

```



### 3.2 Memoização de Agregados

**Arquivo:** `src/views/HealthHistory.jsx`

* Envolver o cálculo de `stats` em `useMemo`.
* **Importante**: O cálculo de estatísticas pesadas deve ser movido para uma RPC (Remote Procedure Call) no Supabase se o histórico exceder 12 meses.

---

## ✅ FASE 4: PROTOCOLO DE VALIDAÇÃO (GATES)

1. **DB Performance**: Verificar no Supabase Dashboard se o `Execution Plan` do índice está sendo utilizado (Index Scan).
2. **Memory Leak Test**: Abrir o Chrome DevTools > Memory. Realizar scroll infinito na lista e garantir que o heap de memória não cresce indefinidamente.
3. **FPS Baseline**: Garantir 60fps durante o scroll em modo "Low CPU Throttling" (simulando o MacBook 2013).
4. **Integração**: Executar `npm run test:services` para validar que a paginação não omitiu registros.

---

## 📄 REFERÊNCIAS PARA O CODER

* **Padrão de Data**: ISO 8601 (UTC).
* **Limite de Payload**: Máximo 100kb por request de paginação.
* **Hardware Alvo**: iPhone 13 (Reduzir processamento de strings em loops).

---

### Explicação de raciocínio
Para o seu volume de dados, o maior vilão não é o banco de dados, mas o **DOM do Navegador**. Inserir 40.000 nós `<div>` no HTML travaria qualquer computador. A **Virtualização** resolve isso criando apenas os elementos visíveis. A **Paginação por Cursor** garante que o Supabase não precise re-ler o passado a cada "carregar mais".

### Perspectivas Adicionais
**Edge Aggregation**: Podemos usar as Vercel Edge Functions para gerar os relatórios de adesão, enviando o JSON pronto para o componente de gráfico (Sparkline), economizando ciclos de CPU no seu celular.

---

### Foco: dispositivos móveis
Especialmente Androids mais antigos, possuem restrições severas de **Main Thread** e **Gerenciamento de Memória (OOM)**. O scroll de uma lista com milhares de elementos é o ponto onde apps híbridas/PWAs geralmente falham. 

Para garantir 60 FPS no iPhone 13 e estabilidade em Androids legados, o plano de execução para o agente coder agora prioriza a **reciclagem de nós do DOM** e a **redução de pressão sobre o Garbage Collector**.


---

# SPRINT B -- PLANO DE EXECUÇÃO: REFATORAÇÃO DE PERFORMANCE MOBILE (HEALTHHISTORY)

**Hardware Alvo:** Mobile (iPhone 13 / Android Legacy).
**Foco:** Virtualização de Lista, Cursor Pagination e Estabilidade de Memória.

---

## 🏗️ 1. INFRAESTRUTURA DE DADOS (API LAYER)

**Arquivo:** `src/shared/services/api/logService.js`

O agente deve implementar a lógica de "Busca por Cursor" para evitar que o banco de dados e o payload JSON cresçam a cada página.

### Especificação:

1. **Função `getLogsPaginated**`:
* **Input**: `userId`, `lastCreatedAt` (string ISO), `pageSize` (default: 40).
* **Lógica**:
```javascript
const { data, error } = await supabase
  .from('medication_logs')
  .select('*')
  .eq('user_id', userId)
  .lt('created_at', lastCreatedAt) // Cursor: busca itens mais antigos que o último carregado
  .order('created_at', { ascending: false })
  .limit(pageSize);

```


2. **Validação**: Garantir que o `lastCreatedAt` inicial seja `new Date().toISOString()`.

---

## ⚛️ 2. HOOK DE GERENCIAMENTO DE ESTADO (MEMORY SAFE)

**Arquivo:** `src/shared/hooks/useInfiniteLogs.js`

O agente deve criar um hook que gerencia o estado da lista sem causar re-renders globais pesados.

### Especificação:

1. **Tecnologia**: TanStack Query (`useInfiniteQuery`).
2. **Configurações de Cache**:
* `staleTime`: 5 minutos.
* `cacheTime`: 30 minutos (para evitar refetch ao alternar abas no mobile).


3. **Transformação**: Retornar uma lista `flattened` memoizada via `useMemo`.

---

## 📱 3. INTERFACE VIRTUALIZADA (MOBILE OPTIMIZED)

**Arquivo:** `src/views/HealthHistory.jsx`

A substituição do `.map()` por uma lista virtualizada é mandatória para evitar o crash do navegador mobile.

### Especificação:

1. **Biblioteca**: `react-virtuoso` (suporta alturas dinâmicas, comum em logs de medicação).
2. **Configuração do Componente**:
```jsx
<Virtuoso
  useWindowScroll // Melhora a performance em navegadores mobile
  data={allLogs}
  endReached={loadMore}
  initialTopMostItemIndex={0}
  itemContent={(index, log) => (
    <div style={{ paddingBottom: '8px' }}>
      <LogEntry key={log.id} log={log} />
    </div>
  )}
  components={{
    Footer: () => isFetchingNextPage ? <LoadingSpinner /> : null
  }}
/>

```


3. **CSS Optimization**: Adicionar `content-visibility: auto;` no container dos itens para auxiliar o motor de renderização do WebKit/Chromium.

---

## ⚡ 4. OTIMIZAÇÃO DE COMPONENTES DE LINHA

**Arquivo:** `src/shared/components/log/LogEntry.jsx`

Cada item da lista deve ser o mais "burro" possível para economizar ciclos de CPU.

### Especificação:

1. **React.memo**: Envolver o componente `LogEntry` em `React.memo` com uma função de comparação customizada (comparar apenas `log.id` e `log.status`).
2. **Imagens/Ícones**: Substituir ícones complexos por caminhos SVG simples ou icon-fonts para reduzir o peso do layer de pintura (Paint).
3. **Event Handlers**: Evitar funções anônimas no onClick; usar funções referenciadas para não quebrar a memoização.

---

## 🧪 5. PROTOCOLO DE ACEITE (GATES DE PERFORMANCE)

O agente coder deve validar o comportamento no Chrome DevTools (Mobile Emulation):

1. **Interaction to Next Paint (INP)**: Ao clicar em "Registrar Dose", o feedback visual deve ocorrer em menos de 100ms.
2. **Cumulative Layout Shift (CLS)**: O carregamento de novas páginas da lista não deve "pular" o scroll do usuário.
3. **Memory Limit**: O uso de memória Heap não deve ultrapassar 80MB após carregar 500 registros.

---

### Foco: dispositivos móveis

Se o iPhone 13 ou o Android antigo tentarem calcular a adesão de 40.000 registos, a interface vai travar. O plano abaixo foca em mover toda a lógica matemática para o **PostgreSQL (Supabase)**, entregando para o telemóvel apenas o resultado final mastigado.

O banco de dados não pode ser apenas um depósito de informações; ele precisa de ser a **unidade de processamento principal**.


---

# SPRINT C -- PLANO DE EXECUÇÃO: INFRAESTRUTURA SUPABASE (HEALTHHISTORY)

**Objetivo:** Otimizar a camada de persistência para lidar com >43k logs/ano, garantindo que o processamento pesado ocorra no servidor e não no dispositivo móvel.

---

## 🏗️ 1. OTIMIZAÇÃO DE ÍNDICES (SEARCH PERFORMANCE)

**Ação:** Criar índices b-tree compostos para acelerar a filtragem por utilizador e tempo, que são as operações mais comuns.

### Instruções para o Coder:

Executar o seguinte SQL para garantir que a busca por logs não degrade com o tempo:

```sql
-- Índice para histórico e paginação por cursor
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_logs_pagination" 
ON "public"."medication_logs" ("user_id", "created_at" DESC);

-- Índice para busca de adesão por protocolo específico
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_logs_protocol_status" 
ON "public"."medication_logs" ("protocol_id", "status", "created_at");

```

---

## 📊 2. CAMADA DE AGREGAÇÃO (DATABASE VIEWS)

**Ação:** Criar uma View que pré-calcula a adesão diária. O mobile consultará esta View em vez da tabela bruta de logs.

### Instruções para o Coder:

Criar a View `v_daily_adherence` para alimentar os gráficos de Sparkline e Heatmaps:

```sql
CREATE OR REPLACE VIEW v_daily_adherence AS
SELECT 
    user_id,
    (created_at AT TIME ZONE 'UTC')::date as log_date,
    COUNT(*) as total_expected,
    COUNT(*) FILTER (WHERE status = 'taken') as total_taken,
    ROUND((COUNT(*) FILTER (WHERE status = 'taken') * 100.0) / COUNT(*), 2) as adherence_percentage
FROM medication_logs
GROUP BY user_id, log_date;

```

---

## ⚙️ 3. LÓGICA DE NEGÓCIO NO SERVER-SIDE (RPC/FUNCTIONS)

**Ação:** Criar funções PL/pgSQL para cálculos complexos que seriam proibitivos no processador do telemóvel.

### 3.1 Função de Sumário de Saúde (Dashboard)

**Objetivo:** Retornar todos os dados do dashboard (score, streak, próximas doses) num único request JSON pequeno.

```sql
CREATE OR REPLACE FUNCTION get_mobile_dashboard_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'current_streak', (SELECT count(*) FROM v_daily_adherence WHERE user_id = p_user_id AND adherence_percentage = 100), -- Simplificado
        'today_adherence', (SELECT adherence_percentage FROM v_daily_adherence WHERE user_id = p_user_id AND log_date = CURRENT_DATE),
        'pending_doses', (SELECT count(*) FROM medication_logs WHERE user_id = p_user_id AND status = 'pending' AND created_at >= CURRENT_DATE)
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

```

---

## 📦 4. ESTRATÉGIA DE PAYLOAD MINIMALISTA

**Ação:** Configurar o agente para nunca fazer `select('*')` no código React.

### Instruções para o Coder:

1. **Refatorar Queries**: Em todos os hooks `useCachedQuery`, limitar as colunas ao estritamente necessário para a UI:
* *Errado*: `.select('*')`
* *Correto*: `.select('id, status, created_at, medication_name')`


2. **Garantir compressão GZIP**: Verificar se os headers da Vercel/Supabase estão a comprimir o JSON de resposta (essencial para conexões 3G/4G em Androids antigos).

---

## 🛡️ 5. INTEGRIDADE E CONSTRAINT UPGRADE

**Ação:** Prevenir "lixo" no banco que possa causar erros de processamento no mobile.

### Instruções para o Coder:

1. **Check Constraints**: Garantir que o campo `status` só aceite valores válidos:
```sql
ALTER TABLE medication_logs 
ADD CONSTRAINT check_valid_status 
CHECK (status IN ('taken', 'skipped', 'pending', 'late'));

```


2. **Cascade Deletes**: Garantir que ao apagar um protocolo, os logs órfãos não fiquem ocupando espaço desnecessário.

---

## ✅ CHECKLIST DE VALIDAÇÃO (DB GATES)

1. **Explain Analyze**: O coder deve rodar um `EXPLAIN ANALYZE` na query de logs e garantir que o tempo de execução é < 50ms para 50.000 linhas.
2. **Payload Size**: O sumário do dashboard via RPC deve ter menos de 2KB.
3. **Concurrency**: Testar se a inserção de uma nova dose (Write) não bloqueia a leitura do histórico (Read).

---

### Plano de Execução Técnica: Hook de Sincronização Server-Centric

O plano abaixo foca em converter o dashboard de uma colcha de retalhos de múltiplas requisições para um **ponto único de sincronização**. Isso é vital para iPhone 13 e Androids legados, pois reduz o rádio do telemóvel (consumo de bateria) e evita "flickering" de dados na tela.

Este plano deve ser executado pelo agente IA coder para implementar o hook `useDashboardSync`.

---

# SPRINT D -- PLANO DE EXECUÇÃO: HOOK DE SINCRONIZAÇÃO RPC (DASHBOARD)

**Objetivo:** Centralizar o estado do Dashboard mobile em uma única chamada RPC, minimizando o processamento de CPU no dispositivo.

---

## 🏗️ 1. DEFINIÇÃO DA CAMADA DE SERVIÇO
**Arquivo:** `src/services/api/dashboardService.js` (Criar se não existir)

O agente deve implementar o método de chamada RPC garantindo tipagem e tratamento de erro silencioso para não interromper a experiência do usuário.

### Especificação:
```javascript
import { supabase } from '../../shared/utils/supabase';

export const fetchDashboardSummary = async (userId) => {
  if (!userId) throw new Error('User ID is required');

  const { data, error } = await supabase.rpc('get_mobile_dashboard_summary', {
    p_user_id: userId
  });

  if (error) {
    console.error('[DashboardService] RPC Error:', error);
    throw error;
  }

  return data;
};

```

---

## ⚛️ 2. IMPLEMENTAÇÃO DO HOOK CUSTOMIZADO

**Arquivo:** `src/features/dashboard/hooks/useDashboardSync.js`

Utilizar o padrão de cache já existente no projeto (`useCachedQuery`) para gerenciar o estado da RPC.

### Especificação Técnica para o Coder:

1. **Instanciar o Hook**: Utilizar `useCachedQuery` apontando para `fetchDashboardSummary`.
2. **Configuração de Refresh**:
* `refetchOnWindowFocus`: false (essencial para mobile).
* `staleTime`: 30000 (30 segundos de vida útil para dados de adesão).


3. **Mapeamento de Dados**: O hook deve retornar sub-objetos prontos para os widgets:
* `stats`: { score, streak, adherence }
* `schedule`: { pendingDosesCount }



---

## 🔄 3. INTEGRAÇÃO COM COMPONENTES (CONSUMO)

**Arquivo:** `src/views/Dashboard.jsx`

O agente deve substituir as chamadas individuais de `useLogs`, `useProtocols` e `useAdherence` pelo novo `useDashboardSync`.

### Lógica de Refatoração:

1. **Remover**: Hooks obsoletos que carregam dados brutos apenas para o resumo.
2. **Injetar**: `const { data: dashboard, isLoading } = useDashboardSync(user.id);`
3. **Prop Drilling**: Passar apenas as propriedades necessárias para `HealthScoreCard` e `QuickActionsWidget`.

---

## ⚡ 4. OTIMIZAÇÃO DE "RE-PAINT" NO MOBILE

Como a RPC retorna um objeto JSON único, o React pode tentar re-renderizar todo o Dashboard a cada atualização.

### Instruções para o Coder:

* Implementar um seletor de dados no hook: `const streak = useDashboardSync(userId, (data) => data.current_streak);`.
* Isso garante que o widget de "Streak" só mude se o número mudar, economizando bateria em processadores Android antigos.

---

## ✅ 5. PROTOCOLO DE VALIDAÇÃO (INTEGRATION GATES)

1. **Network Waterfall**: No DevTools, o carregamento do Dashboard deve mostrar apenas **uma** linha de requisição para `rpc/get_mobile_dashboard_summary`.
2. **Payload Size Check**: O JSON retornado deve ser inferior a **1.5KB**.
3. **CPU Spike Test**: Monitorar se a renderização inicial do dashboard no mobile não causa picos superiores a 150ms de bloqueio de thread.

---

### Explicação do meu raciocínio
Mover para RPC resolve o problema de **"Data Churn"**. Em dispositivos móveis, o custo de abrir uma conexão HTTPS é alto. Ao invés do telemóvel pedir "Logs", depois "Protocolos", depois "Perfil", ele faz um único pedido e o servidor do Supabase (que está na mesma rede que o banco de dados) resolve tudo em microssegundos.

### Alternativas de Perspectiva
* **Web Workers**: Se os gráficos do dashboard (Sparkline) ainda estiverem pesados, podemos mover o `mapping` final do JSON para um Web Worker, liberando a Main Thread para o scroll.
* **Real-time Subscriptions**: Podemos adicionar um listener no Supabase para invalidar o cache do hook automaticamente sempre que uma nova dose for inserida, garantindo atualização instantânea sem polling.

### Plano de Ação Imediato
1.  Agente coder cria o arquivo `src/services/api/dashboardService.js`.
2.  Em seguida, executa o SQL da RPC fornecido no passo anterior no painel do Supabase.
3.  Substituição dos hooks no componente `Dashboard.jsx`.

---

