# Plano de Execução: Correção do Cálculo de Adesão para Protocolos Novos

**Versão:** 1.0.0  
**Data:** 2026-02-18  
**Baseado em:** [`ADHERENCE_SCORE_FIX_SPEC.md`](ADHERENCE_SCORE_FIX_SPEC.md)

---

## 1. Prioritized Task Breakdown

### Fase 1: Banco de Dados (P0 - Bloqueante)
| # | Tarefa | Dependências | Esforço |
|---|--------|--------------|---------|
| 1.1 | Criar migração SQL para adicionar `start_date` e `end_date` à tabela `protocols` | Nenhuma | Small |
| 1.2 | Executar migração no Supabase | 1.1 | Small |
| 1.3 | Validar migração com dados existentes | 1.2 | Small |

### Fase 2: Schema Zod (P0 - Bloqueante)
| # | Tarefa | Dependências | Esforço |
|---|--------|--------------|---------|
| 2.1 | Adicionar campos `start_date` e `end_date` ao `protocolSchema.js` | 1.2 | Small |
| 2.2 | Atualizar `protocolFullSchema` com novos campos | 2.1 | Small |

### Fase 3: Funções de Cálculo (P0 - Bloqueante)
| # | Tarefa | Dependências | Esforço |
|---|--------|--------------|---------|
| 3.1 | Modificar [`calculateAdherenceStats()`](../src/utils/adherenceLogic.js:54) para filtrar dias anteriores ao `start_date` | 2.2 | Medium |
| 3.2 | Modificar [`calculateExpectedDoses()`](../src/utils/adherenceLogic.js:14) para calcular dias efetivos | 2.2 | Medium |
| 3.3 | Modificar [`calculateExpectedDoses()`](../src/services/api/adherenceService.js:309) no service | 2.2 | Medium |
| 3.4 | Modificar [`getDailyAdherence()`](../src/services/api/adherenceService.js:238) para filtrar por data | 2.2 | Medium |
| 3.5 | Modificar [`calculateDailyExpectedDoses()`](../src/services/api/adherenceService.js:349) para considerar datas | 2.2 | Small |

### Fase 4: Testes (P0 - Bloqueante)
| # | Tarefa | Dependências | Esforço |
|---|--------|--------------|---------|
| 4.1 | Criar testes unitários para `calculateAdherenceStats()` com protocolos novos | 3.1 | Medium |
| 4.2 | Criar testes unitários para `calculateExpectedDoses()` com datas de início | 3.2, 3.3 | Medium |
| 4.3 | Criar testes de integração para `getDailyAdherence()` | 3.4 | Medium |
| 4.4 | Validar critérios de aceitação da spec | 4.1, 4.2, 4.3 | Small |

### Fase 5: UI e Service (P1 - Importante)
| # | Tarefa | Dependências | Esforço |
|---|--------|--------------|---------|
| 5.1 | Atualizar `protocolService.js` para incluir novos campos nas queries | 2.2 | Small |
| 5.2 | Atualizar `ProtocolForm.jsx` com campo opcional `start_date` | 5.1 | Small |
| 5.3 | Atualizar `useDashboardContext.jsx` se necessário | 3.1-3.5 | Small |

### Fase 6: Documentação (P2 - Opcional)
| # | Tarefa | Dependências | Esforço |
|---|--------|--------------|---------|
| 6.1 | Atualizar [`DATABASE.md`](../docs/architecture/DATABASE.md) com novos campos | 1.2 | Small |
| 6.2 | Atualizar `CHANGELOG.md` com a correção | 4.4 | Small |

---

## 2. Files to Modify (Priority Order)

| Prioridade | Arquivo | Mudanças | Risco | Testes |
|------------|---------|----------|-------|--------|
| **P0** | [`src/utils/adherenceLogic.js`](../src/utils/adherenceLogic.js) | Adicionar filtro de `start_date`/`end_date` em `calculateAdherenceStats()` (L86-102) e `calculateExpectedDoses()` (L14-45) | **Medium** - Lógica core de adesão | Unit tests obrigatórios |
| **P0** | [`src/services/api/adherenceService.js`](../src/services/api/adherenceService.js) | Modificar `calculateExpectedDoses()` (L309-342), `getDailyAdherence()` (L238-300), `calculateDailyExpectedDoses()` (L349-356) | **Medium** - Service de adesão | Unit tests obrigatórios |
| **P0** | [`src/schemas/protocolSchema.js`](../src/schemas/protocolSchema.js) | Adicionar campos `start_date` e `end_date` ao schema | **Low** | Schema validation tests |
| **P1** | [`src/services/api/protocolService.js`](../src/services/api/protocolService.js) | Incluir novos campos nas queries de criação/atualização | **Low** | Service tests |
| **P1** | [`src/components/protocol/ProtocolForm.jsx`](../src/components/protocol/ProtocolForm.jsx) | Adicionar campo de data de início (opcional) | **Low** | Component tests |
| **P2** | [`docs/architecture/DATABASE.md`](../docs/architecture/DATABASE.md) | Documentar novos campos na tabela `protocols` | **Low** | N/A |

---

## 3. New Files to Create

### 3.1 Migration SQL
**Arquivo:** `.migrations/add_protocol_start_date.sql`

```sql
-- Adicionar campo start_date à tabela protocols
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS start_date DATE;

-- Adicionar campo end_date à tabela protocols
ALTER TABLE protocols 
ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;

-- Migração: Copiar created_at para start_date em registros existentes
UPDATE protocols 
SET start_date = DATE(created_at)
WHERE start_date IS NULL;

-- Tornar start_date obrigatório após migração
ALTER TABLE protocols 
ALTER COLUMN start_date SET NOT NULL;

-- Criar índice para consultas por data
CREATE INDEX IF NOT EXISTS idx_protocols_start_date 
ON protocols(start_date) 
WHERE active = true;

-- Comentários documentais
COMMENT ON COLUMN protocols.start_date IS 'Data de início do protocolo. Obrigatório.';
COMMENT ON COLUMN protocols.end_date IS 'Data de término do protocolo. Opcional.';
```

### 3.2 Test Files
**Arquivo:** `src/utils/__tests__/adherenceLogic.start_date.test.js`
- Testes para `calculateAdherenceStats()` com protocolos novos
- Testes para `calculateExpectedDoses()` com diferentes datas de início
- Testes de edge cases (protocolo retroativo, múltiplos protocolos)

**Arquivo:** `src/services/api/__tests__/adherenceService.start_date.test.js`
- Testes para `getDailyAdherence()` com filtro de data
- Testes de integração com dados mockados

---

## 4. Migration Strategy

### 4.1 SQL Migration Steps
1. **Backup**: Criar backup da tabela `protocols` antes da migração
2. **Add Columns**: Adicionar colunas `start_date` e `end_date` como nullable
3. **Data Migration**: Popular `start_date` com `DATE(created_at)` para registros existentes
4. **Add Constraints**: Tornar `start_date` NOT NULL após migração
5. **Create Index**: Criar índice parcial para consultas otimizadas

### 4.2 Data Migration Approach
```sql
-- Verificar quantos registros serão afetados
SELECT COUNT(*) FROM protocols WHERE start_date IS NULL;

-- Executar migração em batches se necessário (para tabelas grandes)
-- Para este projeto, UPDATE direto é suficiente
UPDATE protocols 
SET start_date = DATE(created_at)
WHERE start_date IS NULL;

-- Validar migração
SELECT COUNT(*) FROM protocols WHERE start_date IS NULL; -- Deve retornar 0
```

### 4.3 Rollback Plan
```sql
-- Rollback em caso de problemas
ALTER TABLE protocols DROP COLUMN IF EXISTS start_date;
ALTER TABLE protocols DROP COLUMN IF EXISTS end_date;
DROP INDEX IF EXISTS idx_protocols_start_date;
```

---

## 5. Risk Assessment

### 5.1 High-Risk Changes

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Scores mudam para usuários existentes | **Alta** | Médio | Comunicar como melhoria de precisão; testar com dados reais |
| Lógica de cálculo introduz bugs | Média | Alto | Testes unitários abrangentes; code review |
| Performance de cálculo degrada | Baixa | Baixo | Cálculo já é client-side; impacto mínimo |

### 5.2 Edge Cases to Test

| Cenário | Comportamento Esperado | Teste |
|---------|------------------------|-------|
| Protocolo criado hoje | Apenas hoje tem doses esperadas | Unit test |
| Protocolo com `start_date` em 16/02 | 15/02 não tem doses esperadas | Unit test |
| Protocolo existente migrado | `start_date` = `DATE(created_at)` | Migration test |
| Múltiplos protocolos com datas diferentes | Cada protocolo contribui apenas após sua data | Integration test |
| Protocolo com `end_date` definido | Doses após `end_date` não são esperadas | Unit test |
| Protocolo pausado (`active=false`) | Não contar como esperado (já implementado) | Unit test |

### 5.3 Mitigation Strategies

1. **Testes com Dados Reais**: Antes do deploy, rodar cálculo com dados de produção em ambiente de staging
2. **Feature Flag**: Considerar feature flag para ativar novo cálculo gradualmente (opcional)
3. **Comunicação**: Avisar usuários sobre melhoria de precisão nos scores

---

## 6. Suggested Branch Structure

### Recomendação: **Single PR com Commits Atômicos**

**Justificativa:**
- Mudanças são interdependentes (schema -> service -> cálculo)
- Migração SQL é pequena e sem risco de conflitos
- Facilita code review e testes integrados

### Branch Naming Convention
```
fix/adherence-score-start-date
```

### Commit Structure (Atômicos)
```
1. chore(db): add start_date and end_date columns to protocols table
2. feat(schema): add start_date and end_date to protocolSchema
3. fix(adherence): filter protocols by start_date in calculateAdherenceStats
4. fix(adherence): calculate effective days in calculateExpectedDoses
5. fix(service): filter by date in getDailyAdherence
6. test(adherence): add tests for start_date filtering
7. docs(db): document start_date and end_date in DATABASE.md
8. chore(changelog): update CHANGELOG.md with fix
```

### PR Title Template
```
fix(adherence): consider protocol start_date in adherence calculation

Fixes issue where new protocols showed artificially low adherence scores
for days before the protocol was created.

Closes: [Issue number se houver]
```

---

## 7. Validation Checklist

Antes do merge, validar:

- [ ] Migração SQL executada com sucesso no Supabase
- [ ] Todos os testes unitários passando (`npm run test:critical`)
- [ ] Lint sem erros (`npm run lint`)
- [ ] Build sem erros (`npm run build`)
- [ ] Testes manuais no dashboard com protocolos novos
- [ ] Critérios de aceitação da spec validados
- [ ] Code review aprovado
- [ ] Documentação atualizada

---

## 8. Estimated Timeline

| Fase | Duração Estimada |
|------|------------------|
| Fase 1: Banco de Dados | 30 min |
| Fase 2: Schema Zod | 15 min |
| Fase 3: Funções de Cálculo | 2-3 horas |
| Fase 4: Testes | 1-2 horas |
| Fase 5: UI e Service | 1 hora |
| Fase 6: Documentação | 30 min |
| **Total** | **5-7 horas** |

---

## 9. Acceptance Criteria (from Spec)

1. **Dado** um protocolo criado hoje  
   **Quando** calculo adesão dos últimos 7 dias  
   **Então** apenas hoje deve ter doses esperadas

2. **Dado** um protocolo com `start_date` em 16/02  
   **Quando** calculo adesão para 15/02  
   **Então** não deve haver doses esperadas

3. **Dado** um protocolo existente migrado  
   **Quando** o campo `start_date` foi populado via migração  
   **Então** deve conter a data de `created_at`

4. **Dado** múltiplos protocolos com diferentes datas de início  
   **Quando** calculo adesão geral  
   **Então** cada protocolo deve contribuir apenas para dias após sua data de início

5. **Dado** um protocolo com `end_date` definido  
   **Quando** calculo adesão para data após `end_date`  
   **Então** não deve haver doses esperadas

---

## 10. Code Snippets for Implementation

### 10.1 Modificação em `calculateAdherenceStats()` (adherenceLogic.js)

```javascript
// Linhas 86-102 - Adicionar filtro de data
protocols.forEach((protocol) => {
  // NOVO: Verificar se o protocolo estava ativo neste dia
  const protocolStartDate = protocol.start_date ? new Date(protocol.start_date) : null
  const protocolEndDate = protocol.end_date ? new Date(protocol.end_date) : null
  const currentDate = new Date(dateStr)
  
  // Ignorar protocolo se ainda não tinha começado
  if (protocolStartDate && currentDate < protocolStartDate) return
  
  // Ignorar protocolo se já terminou
  if (protocolEndDate && currentDate > protocolEndDate) return
  
  // Continua com lógica existente...
  const schedule = protocol.time_schedule || []
  dayExpected += schedule.length
  // ...
})
```

### 10.2 Modificação em `calculateExpectedDoses()` (adherenceLogic.js)

```javascript
export function calculateExpectedDoses(protocols, days, endDate = new Date()) {
  if (!protocols || protocols.length === 0) return 0

  return protocols.reduce((total, protocol) => {
    const timesPerDay = protocol.time_schedule?.length || 1
    const frequency = protocol.frequency || 'daily'

    let dailyDoses = timesPerDay
    // ... switch para frequência ...

    // NOVO: Calcular dias efetivos do protocolo
    const protocolStartDate = protocol.start_date ? new Date(protocol.start_date) : null
    const protocolEndDate = protocol.end_date ? new Date(protocol.end_date) : endDate
    
    if (!protocolStartDate) {
      // Fallback: usa todos os dias se não tiver start_date
      return total + dailyDoses * days
    }
    
    const periodStart = new Date(endDate)
    periodStart.setDate(periodStart.getDate() - days)
    
    // Calcular interseção entre período do protocolo e período de análise
    const effectiveStart = new Date(Math.max(protocolStartDate, periodStart))
    const effectiveEnd = new Date(Math.min(protocolEndDate || endDate, endDate))
    
    // Calcular dias efetivos
    let effectiveDays = 0
    if (effectiveEnd >= effectiveStart) {
      effectiveDays = Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1
    }

    return total + dailyDoses * Math.max(effectiveDays, 0)
  }, 0)
}
```

### 10.3 Modificação em `getDailyAdherence()` (adherenceService.js)

```javascript
// Linhas 272-297 - Calcular expected por dia com filtro de data
const dailyData = []
for (let i = days - 1; i >= 0; i--) {
  const date = new Date(endDate)
  date.setDate(date.getDate() - i)
  const dateKey = /* ... */

  // NOVO: Calcular expected apenas para protocolos ativos neste dia
  const dayExpected = protocols.reduce((total, protocol) => {
    const protocolStartDate = protocol.start_date ? new Date(protocol.start_date) : null
    const protocolEndDate = protocol.end_date ? new Date(protocol.end_date) : null
    const currentDate = new Date(dateKey)
    
    // Ignorar protocolo se ainda não tinha começado
    if (protocolStartDate && currentDate < protocolStartDate) return total
    
    // Ignorar protocolo se já terminou
    if (protocolEndDate && currentDate > protocolEndDate) return total
    
    // Considerar frequência
    const timesPerDay = protocol.time_schedule?.length || 1
    return total + timesPerDay
  }, 0)

  const taken = logsByDay.get(dateKey) || 0
  const adherence = dayExpected > 0 ? Math.round((taken / dayExpected) * 100) : 0

  dailyData.push({
    date: dateKey,
    taken,
    expected: Math.round(dayExpected),
    adherence: Math.min(adherence, 100),
  })
}
```

---

*Plano criado em 2026-02-18*