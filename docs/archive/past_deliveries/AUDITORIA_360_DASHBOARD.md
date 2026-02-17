# Auditoria 360°: Dashboard Health Command Center

**Data:** 05/02/2026  
**Status:** CONCLUÍDO  
**Responsável:** Arquiteto de Soluções Sênior  

---

## 1. Consistência de Fluxos de Dados (Gap Analysis)

### 1.1 Cálculo de Health Score: Client-side vs Server-side
- **Estado Atual:** O [`src/services/api/adherenceService.js`](src/services/api/adherenceService.js) realiza queries diretas ao Supabase (`.from('protocols')`, `.from('medicine_logs')`) para cada cálculo.
- **Proposta PRD:** Requisito de "Custo Zero" exige cálculo 100% client-side em memória.
- **Gap Crítico:** Existe uma desconexão entre a implementação atual (reativa/SQL) e a visão futura (preditiva/In-memory). É necessário migrar a lógica de `calculateExpectedDoses` e `calculateAdherence` para operar sobre o cache do SWR.
- **Resiliência:** O cálculo atual é vulnerável a dados corrompidos ou parciais no cache. Se o `queryCache` atingir o limite de 50 entradas (LRU), dados críticos para o Score de 30 dias podem ser descartados, gerando scores imprecisos.

---

## 2. Cobertura de Casos de Borda (Edge Cases)

### 2.1 Fuso Horário e Sincronização
- **Positivo:** O [`src/services/api/logService.js`](src/services/api/logService.js:302) já utiliza `Date.UTC` para evitar problemas de timezone em buscas mensais.
- **Gap (Offline):** A proposta de PRD cita "Suporte a registro offline", mas o [`src/lib/queryCache.js`](src/lib/queryCache.js) é estritamente em memória (`Map`).
    - **Risco:** Se o usuário realizar um Swipe offline e recarregar o PWA antes da sincronização, o registro será perdido.
    - **Recomendação:** Implementar persistência do cache no `LocalStorage` ou `IndexedDB` para a fila de mutações otimistas.

### 2.2 Protocolos Complexos e Interrupções
- **Gap:** O sistema de `Batch Registration` (UC-02) não prevê rollback parcial atômico se apenas 3 de 4 medicamentos forem confirmados pela API.
- **Solução:** O `createBulk` no `logService` precisa de uma lógica de compensação ou retry exponencial para garantir a integridade do protocolo.

---

## 3. Viabilidade de Performance & Segurança

### 3.1 Escalabilidade do SWR (Performance)
- **Análise:** O uso de `Array.reduce` para centenas de registros em 30 dias é performático (< 10ms).
- **Gargalo:** O limite de `MAX_ENTRIES: 50` no [`src/lib/queryCache.js`](src/lib/queryCache.js:16) é muito baixo para o "Health Command Center".
    - Um único usuário com 5 medicamentos, 3 protocolos e visualização mensal de logs pode facilmente estourar 50 chaves de cache (considerando chaves compostas por ID e parâmetros).
    - **Recomendação:** Elevar o limite para 200 entradas ou implementar namespaces de cache prioritários.

### 3.2 Segurança e RLS
- **Auditado:** Todas as interações em `logService.js` e `protocolService.js` utilizam `getUserId()` e filtros `.eq('user_id', ...)`.
- **Garantia:** O RLS do Supabase está corretamente espelhado na camada de serviço, impedindo vazamento de dados entre usuários mesmo se o cache falhar.

---

## 4. Maturidade para Desenvolvimento

### 4.1 Status: **BLOQUEADO (Pendências Críticas)**
O projeto **não deve iniciar a implementação da UI** sem resolver:
1. **Ausência do `useDashboardContext`**: A orquestração dos dados (unir Medicines + Protocols + Logs) ainda não existe. Sem este "cérebro", os widgets serão componentes burros sem dados consistentes.
2. **Definição de Haptics**: A API do browser para vibração precisa de um fallback para iOS (onde a `navigator.vibrate` é restrita).

---

## 5. Roadmap de Execução de Precisão

### Fase 1: Core de Inteligência (Semana 1)
- [ ] Implementar `src/hooks/useDashboardContext.js`.
- [ ] Refatorar `adherenceService.js` para aceitar dados injetados (In-memory calculation).
- [ ] Implementar persistência de cache (LocalStorage) para suporte Offline.

### Fase 2: UI & Gestos (Semana 2)
- [ ] Desenvolver `AccordionTreatment` com Framer Motion.
- [ ] Implementar `SwipeRegisterItem` com threshold de 70%.
- [ ] Integrar `Optimistic UI` em todos os registros de dose.

### Fase 3: Gamificação & Insights (Semana 3)
- [ ] Criar motor de `Health Insight` (ex: correlação café vs adesão).
- [ ] Implementar micro-animações de sucesso (Confete/Neon).

---

## 6. Conclusão da Auditoria
O design visual e funcional é excelente, mas a **infraestrutura de cache e o motor de cálculo precisam de um "upgrade" de resiliência** para suportar a carga cognitiva reduzida prometida no PRD. O foco deve ser a criação do `useDashboardContext` como Single Source of Truth.

---
*Assinado: Arquiteto de Soluções Sênior*
