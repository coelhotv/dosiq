# Investigação Bug F5.4 - Calendário Visual de Doses Vazio

> Data: 2026-02-27
> Status: ✅ DIAGNÓSTICO CONFIRMADO - Aguardando correção
> Bug: Calendário renderiza estrutura mas células dos dias estão vazias

---

## ✅ Diagnóstico Final (Confirmado pelo usuário)

O problema persiste em ambiente de desenvolvimento. Duas causas identificadas:

### Causa 1: Bug de Timezone (R-020) - CRÍTICO

**Local:** `src/shared/components/ui/Calendar.jsx` linha 197-205

**Problema:** A comparação de datas mistura métodos UTC e locais, causando mismatch em GMT-3.

**Código problemático:**
```javascript
const hasLog = markedDates.some((dateStr) => {
  const dLog = new Date(dateStr)  // '2026-02-27' → UTC midnight
  return (
    dLog.getUTCFullYear() === dayDate.getFullYear() &&    // 2026 === 2026 ✅
    dLog.getUTCMonth() === dayDate.getMonth() &&          // 1 === 1 ✅
    dLog.getUTCDate() === dayDate.getDate()               // 27 !== 26 ❌
  )
})
```

**Análise do bug:**
| Expressão | Valor em GMT-3 | Problema |
|-----------|---------------|----------|
| `new Date('2026-02-27')` | 2026-02-26T21:00:00 (local) | Cria UTC midnight |
| `dLog.getUTCDate()` | 27 | Dia no UTC |
| `dayDate.getDate()` | 26 | Dia local (GMT-3) |
| **Resultado** | Sempre `false` | Nunca match! |

**Impacto:** Os indicadores coloridos (dots) nunca aparecem porque `hasLog` é sempre falso.

**Solução:** Usar parsing manual da string YYYY-MM-DD para evitar criar objetos Date:
```javascript
const hasLog = markedDates.some((dateStr) => {
  const [logYear, logMonth, logDay] = dateStr.split('-').map(Number)
  return (
    logYear === dayDate.getFullYear() &&
    logMonth - 1 === dayDate.getMonth() &&  // JS month é 0-indexed
    logDay === dayDate.getDate()
  )
})
```

### Causa 2: CSS dos Números dos Dias

**Local:** `src/shared/components/ui/Calendar.jsx` linha 213

**Problema:** Os números dos dias são renderizados como `<span className="day-number">{d}</span>`, mas não existe estilo `.day-number` no CSS. Isso pode causar herança de cor incorreta ou visibilidade comprometida.

**Solução:** Adicionar estilo explícito para `.day-number` garantindo visibilidade.

---

## ✅ Correções Aplicadas

### Correção 1: Timezone em Calendar.jsx
**Arquivo:** `src/shared/components/ui/Calendar.jsx`
**Linha:** 195-206

**Mudança:** Substituída comparação UTC por parsing manual de string YYYY-MM-DD

```javascript
// ANTES (bugado):
const hasLog = markedDates.some((dateStr) => {
  const dLog = new Date(dateStr)
  return (
    dLog.getUTCFullYear() === dayDate.getFullYear() &&
    dLog.getUTCMonth() === dayDate.getMonth() &&
    dLog.getUTCDate() === dayDate.getDate()
  )
})

// DEPOIS (corrigido):
const hasLog = markedDates.some((dateStr) => {
  const [logYear, logMonth, logDay] = dateStr.split('-').map(Number)
  return (
    logYear === dayDate.getFullYear() &&
    logMonth - 1 === dayDate.getMonth() &&
    logDay === dayDate.getDate()
  )
})
```

### Correção 2: CSS para day-number
**Arquivo:** `src/shared/components/ui/Calendar.css`
**Adicionado após linha 102:**

```css
/* Day number styling - garante visibilidade */
.day-number {
  color: var(--text-primary);
  font-weight: 500;
  font-size: var(--font-size-sm);
  line-height: 1;
}
```

---

## 🧪 Validação

### Status: Aguardando confirmação visual

Por favor, verifique no browser se:
1. ✅ Os números dos dias estão aparecendo (1, 2, 3...)
2. ✅ Os indicadores coloridos (dots) aparecem nos dias com doses
3. ✅ A legenda corresponde às cores dos indicadores
4. ✅ Clicar em um dia abre o painel de detalhes

Após confirmação visual, rodarei `npm run validate:agent`.


---

## 📋 Resumo do Problema

O calendário visual de doses está renderizando:
- ✅ Header "Calendário de Doses"
- ✅ Estatísticas (85% ADESÃO, 18 DIAS COMPLETOS)
- ✅ Legenda de cores
- ✅ Navegação (Fevereiro 2026)
- ✅ Dias da semana (DOM, SEG, TER, etc.)
- ❌ Células dos dias estão vazias - sem números nem indicadores

---

## 🔍 Arquivos Analisados

### 1. Fluxo de Dados

```
Calendar.jsx (view)
  ↓ (lazy import)
DoseCalendar.jsx (component)
  ↓ (useDashboard hook)
logs, protocols (do contexto)
  ↓ (useMemo)
calculateMonthlyDoseMap() (service)
  ↓
doseMap: { '2026-02-01': { expected, taken, status }, ... }
  ↓ (useMemo)
markedDates: ['2026-02-01', '2026-02-02', ...]
  ↓ (prop)
Calendar.jsx (ui component)
  ↓
Renderização dos dias
```

### 2. DoseCalendar.jsx

**Local:** `src/features/calendar/components/DoseCalendar.jsx`

**Pontos críticos:**
- Linha 56: `const { logs, protocols } = useDashboard()`
- Linha 62-67: Calcula `doseMap` via `calculateMonthlyDoseMap(logs, protocols, year, month)`
- Linha 80-85: Gera `markedDates` filtrando dias com `expected > 0`
- Linha 244-252: Passa `markedDates` para componente `Calendar`

**Problema potencial:** Se `logs` ou `protocols` forem null/undefined/vazios, o `doseMap` pode não ter dados com `expected > 0`, resultando em `markedDates` vazio.

### 3. doseCalendarService.js

**Local:** `src/features/calendar/services/doseCalendarService.js`

**Funções principais:**
- `calculateMonthlyDoseMap(logs, protocols, year, month)` - Linha 232
  - Inicializa mapa com todos os dias do mês (expected: 0, taken: 0, status: 'sem_doses')
  - Para cada protocolo ativo, calcula doses esperadas e tomadas
  - Retorna objeto indexado por data

- `calculateMonthlyStats(doseMap)` - Linha 299
  - Calcula estatísticas agregadas

**Possíveis problemas:**
1. Se `protocols` for null/undefined, retorna mapa vazio (linha 247)
2. `shouldExpectDosesOnDate()` pode retornar false para todos os protocolos
3. Problema de timezone nas datas (R-020)

### 4. Calendar.jsx (componente UI)

**Local:** `src/shared/components/ui/Calendar.jsx`

**Pontos críticos:**
- Linha 17-26: Props incluem `markedDates` (array de strings de data)
- Linha 185-217: Loop que renderiza cada dia do mês
- Linha 197-205: Verifica se há doses registradas no dia usando `markedDates.some()`

**Lógica de verificação (CRÍTICO):**
```javascript
const hasLog = markedDates.some((dateStr) => {
  const dLog = new Date(dateStr)
  // Use UTC comparison para evitar problemas de timezone
  return (
    dLog.getUTCFullYear() === dayDate.getFullYear() &&
    dLog.getUTCMonth() === dayDate.getMonth() &&
    dLog.getUTCDate() === dayDate.getDate()
  )
})
```

**⚠️ PROBLEMA CONFIRMADO - Bug de Timezone (R-020):**

A comparação mistura métodos UTC e locais, causando mismatch em GMT-3:

| Operação | Valor (ex: '2026-02-27') | Problema |
|----------|-------------------------|----------|
| `new Date('2026-02-27')` | 2026-02-27T00:00:00Z (UTC) | Cria UTC midnight |
| `dLog.getUTCDate()` | 27 | Dia UTC |
| `dayDate.getDate()` | 26 ou 27 | Dia local (GMT-3) |
| **Resultado** | ❌ NUNCA MATCH em GMT-3 | 27 !== 26 |

**Explicação:**
- `new Date('2026-02-27')` em GMT-3 = 2026-02-26T21:00:00 (local)
- `dLog.getUTCDate()` retorna 27 (do UTC)
- `dayDate.getDate()` retorna 26 (do local)
- **Sempre dá falso** para todas as datas!

**Por que as células estão "vazias":**
Na verdade os números dos dias estão sendo renderizados (linha 213: `<span className="day-number">{d}</span>`), mas o indicador colorido (`log-dot`) só aparece quando `hasLog === true`. Como `hasLog` é sempre falso devido ao bug de timezone, nenhum dia mostra indicador de status.

---

## 🎯 Hipóteses de Causa Raiz

### H1: Dados do Dashboard vazios
**Verificação:** Verificar se `logs` e `protocols` estão chegando corretamente do `useDashboard()`
**Probabilidade:** ALTA
**Como testar:** Adicionar console.log para inspecionar dados

### H2: Formato de data inconsistente entre doseMap e markedDates
**Verificação:** `doseMap` usa `formatLocalDate()` que retorna YYYY-MM-DD. `markedDates` é array dessas strings.
**Probabilidade:** MÉDIA

### H3: Bug na comparação de datas no Calendar.jsx
**Verificação:** Linha 197-205 usa UTC vs local inconsistência
**Probabilidade:** MÉDIA

### H4: Problema de timezone (R-020)
**Verificação:** `new Date(dateStr)` pode interpretar como UTC causando offset
**Probabilidade:** MÉDIA

### H5: CSS escondendo os números
**Verificação:** Verificar se `.day-number` está com visibility/opacity issues
**Probabilidade:** BAIXA

---

## 📝 Próximos Passos

1. [ ] Verificar dados do useDashboard() - adicionar logs
2. [ ] Verificar formato das datas em doseMap vs markedDates
3. [ ] Testar comparação de datas no Calendar.jsx
4. [ ] Verificar CSS do day-number
5. [ ] Corrigir bug identificado
6. [ ] Validar visualmente

---

## 🔧 Possíveis Correções

### Se H3 confirmado (comparação UTC):
**Arquivo:** `src/shared/components/ui/Calendar.jsx`
**Linha:** 197-205

```javascript
// PROBLEMA (atual):
const hasLog = markedDates.some((dateStr) => {
  const dLog = new Date(dateStr)
  return (
    dLog.getUTCFullYear() === dayDate.getFullYear() &&
    dLog.getUTCMonth() === dayDate.getMonth() &&
    dLog.getUTCDate() === dayDate.getDate()
  )
})

// CORREÇÃO:
const hasLog = markedDates.some((dateStr) => {
  // dateStr está em formato YYYY-MM-DD (local)
  const [logYear, logMonth, logDay] = dateStr.split('-').map(Number)
  return (
    logYear === dayDate.getFullYear() &&
    logMonth - 1 === dayDate.getMonth() &&  // month é 0-indexed em JS
    logDay === dayDate.getDate()
  )
})
```

---

## 🔍 Novos Achados (2026-02-27 03:30)

### Log do Console Analisado

**Arquivo:** `bug_logs/console_calendar.txt`

**Dados confirmados:**
```
[DEBUG Calendar] Building days for: 2026 1 totalDays: 28 firstDay: 0
[DEBUG Calendar] markedDates: (28) ['2026-02-01', '2026-02-02', ... '2026-02-28']
[DEBUG Calendar] viewDate: 2026-02-27T03:29:37.334Z
```

**Análise:**
- ✅ Dados estão chegando corretamente (28 markedDates)
- ✅ Total de dias (28) e primeiro dia (0=Domingo) estão corretos
- ⚠️ **NOVA HIPÓTESE:** O problema pode ser o **skeleton de loading**

### Nova Hipótese: Skeleton Sempre Ativo

**Local:** `src/shared/components/ui/Calendar.jsx` linha 281-291

O código renderiza o skeleton quando `isLoading && enableLazyLoad`:
```javascript
{isLoading && enableLazyLoad ? (
  <div className="calendar-skeleton">
    {Array(35).fill(0).map((_, i) => (
      <div key={i} className="skeleton-day"></div>
    ))}
  </div>
) : (
  days
)}
```

**Se `isLoading` estiver sempre `true`**, o skeleton (células vazias animadas) será renderizado ao invés dos dias reais. Isso explicaria exatamente o que vemos no screenshot!

**Possíveis causas para `isLoading` permanecer `true`:**
1. `onLoadMonth` não está resolvendo a Promise
2. Loop infinito de re-renderização
3. Erro silencioso no `onLoadMonth`

**Logs adicionados:**
- Verificar valor de `isLoading` e `enableLazyLoad` no render

---

## 📊 Status da Investigação

| Item | Status | Notas |
|------|--------|-------|
| Análise DoseCalendar.jsx | ✅ Concluído | Hook order correto (R-010) |
| Análise doseCalendarService.js | ✅ Concluído | Lógica parece correta |
| Análise Calendar.jsx | ✅ Concluído | Bug de comparação UTC identificado |
| Análise CSS | ✅ Concluído | `.day-number` adicionado |
| Teste com logs | ✅ Em andamento | Dados chegam, verificar isLoading |
| Correção Timezone | ✅ Aplicada | Parsing manual YYYY-MM-DD |
| Correção CSS | ✅ Aplicada | Estilo .day-number adicionado |
| Verificar skeleton | ✅ CONFIRMADO | isLoading sempre true - skeleton renderizado |
| Correção definitiva | ✅ APLICADA | Desabilitar lazy loading (dados já vêm do context) |
| Teste visual | ✅ PASSOU | Calendário aparecendo corretamente |
| Navegação | ⚠️ PARCIAL | Funciona mas clique em dias de outros meses não funciona |

## 🔄 Decisão do Usuário

**Data:** 2026-02-27 04:08

O usuário decidiu **remover a F5.4 (DoseCalendar)** ao invés de continuar corrigindo.

**Justificativa:**
- Já existe funcionalidade similar em `History.jsx` usando `CalendarWithMonthCache`
- Não compensa manter duas implementações de calendário
- A experiência do History.jsx é completa e funcional

## 🗑️ Ações de Remoção

### 1. View Calendar.jsx
**Status:** ✅ Atualizado para redirecionar para History

### 2. Componentes a remover (opcional):
- `src/features/calendar/components/DoseCalendar.jsx`
- `src/features/calendar/components/DoseCalendar.css`
- `src/features/calendar/services/doseCalendarService.js`
- Pasta `src/features/calendar/` completa

### 3. Calendar.jsx (shared)
**Status:** ✅ Revertido para comportamento original
- Mantida correção de timezone (R-020)
- Mantido CSS `.day-number`
- Revertida lógica de `controlsDisabled`

## ✅ Validação Final

**Comando:** `npm run validate:agent`
**Resultado:** ✅ 351 testes passaram (21 arquivos)
**Duração:** 38.71s

---

## 📝 Resumo das Mudanças

### Arquivos Modificados

1. **`src/views/Calendar.jsx`**
   - Removida implementação completa do calendário F5.4
   - Agora redireciona para `History.jsx` via `onNavigate`

2. **`src/shared/components/ui/Calendar.jsx`**
   - Mantida correção de timezone (R-020) - parsing manual de YYYY-MM-DD
   - Mantido CSS `.day-number` para visibilidade
   - Revertida lógica de `controlsDisabled` para comportamento original

3. **`src/shared/components/ui/Calendar.css`**
   - Adicionado estilo `.day-number` para garantir visibilidade dos números

### Arquivos Preservados (para referência)

- `src/features/calendar/components/DoseCalendar.jsx`
- `src/features/calendar/components/DoseCalendar.css`
- `src/features/calendar/services/doseCalendarService.js`
- Pasta `src/features/calendar/` completa

> **Nota:** Os arquivos da F5.4 foram mantidos para possível reuso futuro, mas não são mais utilizados na aplicação.

### Correções Técnicas Aplicadas

1. **R-020 - Timezone:** Comparar datas usando parsing manual de string YYYY-MM-DD ao invés de `new Date()` + métodos UTC
2. **CSS Visibilidade:** Adicionar estilo explícito para `.day-number`
3. **Remoção de Feature:** Ao invés de corrigir funcionalidade duplicada, redirecionar para implementação existente

