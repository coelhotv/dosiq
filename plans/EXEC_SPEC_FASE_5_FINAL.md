# Spec de Execucao — Fase 5: Fechamento (Features Restantes)

**Versao:** 1.0
**Data:** 06/03/2026
**Tipo:** Especificacao de Execucao para Agentes Autonomos
**Baseline:** v3.1.0 (8/10 features da Fase 5 entregues)
**Escopo:** ~21 SP | 2 features + 1 spike de pesquisa | 2 sprints
**Referencias:** `plans/ROADMAP_v4.md`, `plans/PHASE_6_SPEC.md`, `plans/UX_VISION_EXPERIENCIA_PACIENTE.md`

---

## 1. Contexto

A Fase 5 esta 90% completa. Restam 2 features (F5.10 Analise de Custo + Spike/F5.6 ANVISA) para fechar a fase e tagar v3.2.0. Este documento detalha EXATAMENTE o que fazer, como fazer, como testar e qual processo seguir.

---

## 2. Regras Obrigatorias

Antes de qualquer codigo, o agente DEVE ler:
- `CLAUDE.md` (raiz do projeto)
- `.memory/rules.md` (R-001 a R-109)
- `.memory/anti-patterns.md` (AP-001 a AP-W17)

Regras criticas para esta fase:
- **R-020:** Usar `parseLocalDate()` para datas, NUNCA `new Date('YYYY-MM-DD')`
- **R-021:** Enums Zod em portugues
- **R-074:** Rodar `npm run validate:agent` antes de push
- **R-060:** Agentes NUNCA mergeiam seus proprios PRs
- **R-078:** `afterEach(() => { vi.clearAllMocks(); vi.clearAllTimers() })` obrigatorio
- **R-079:** Arquivo de teste <= 300 linhas
- **R-090/R-091:** Vercel Hobby max 12 serverless functions; utilitarios em `_dirs`

---

## 3. Estrutura de Sprints

```
Sprint 5.A — Analise de Custo (5 SP)
  F5.10-1: costAnalysisService.js (service)
  F5.10-2: CostChart evolucao (componente)
  F5.10-3: Integracao na tab Estoque
  F5.10-4: Testes

Sprint 5.B — Spike ANVISA + Integracao Base (2-3 + 13 SP condicional)
  SPIKE-1: Pesquisa de fontes de dados ANVISA
  SPIKE-2: Prototipo de viabilidade
  F5.6-1: Base de medicamentos (se viavel)
  F5.6-2: Autocomplete no formulario (se viavel)
  F5.6-3: Testes
```

---

## 4. Sprint 5.A — Analise de Custo (5 SP)

### Objetivo
Calcular e exibir o custo mensal de tratamento por medicamento, usando dados de `unit_price` ja existentes no `stockSchema`.

### F5.10-1: costAnalysisService.js

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Criar** | `src/features/stock/services/costAnalysisService.js` |
| **Testar** | `src/features/stock/services/__tests__/costAnalysisService.test.js` |
| **Dependencias** | Nenhuma nova (matematica pura sobre dados existentes) |

**Implementacao:**

```javascript
// src/features/stock/services/costAnalysisService.js

/**
 * Servico de analise de custo de tratamento.
 * Calcula custo mensal por medicamento usando unit_price do estoque
 * e consumo diario dos protocolos ativos.
 *
 * PRINCIPIO: Zero chamadas ao Supabase — recebe dados ja carregados.
 */

/**
 * Calcula custo mensal por medicamento.
 * @param {Array} medicines - Lista de medicamentos (com stock[] embeddado)
 * @param {Array} protocols - Protocolos ativos
 * @returns {{ items: Array<{medicineId, name, dailyIntake, avgUnitPrice, monthlyCost}>, totalMonthly: number, projection3m: number }}
 */
export function calculateMonthlyCosts(medicines, protocols) {
  // Para cada medicamento com protocolo ativo:
  // 1. Calcular dailyIntake = SUM(dosage_per_intake * timesPerDay) dos protocolos do med
  // 2. Calcular avgUnitPrice = media ponderada dos stock entries com quantity > 0
  //    avgUnitPrice = SUM(unit_price * quantity) / SUM(quantity)
  //    Se nenhum stock com preco: avgUnitPrice = 0
  // 3. monthlyCost = dailyIntake * avgUnitPrice * 30
}

/**
 * Calcula projecao de custo para N meses.
 * @param {number} monthlyCost - Custo mensal total
 * @param {number} months - Numero de meses (default: 3)
 * @returns {number}
 */
export function calculateProjection(monthlyCost, months = 3) {
  return monthlyCost * months
}

/**
 * Formata valor em BRL.
 * @param {number} value
 * @returns {string} Ex: "R$ 187,50"
 */
export function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
```

**Calculo de dailyIntake (referencia `adherenceLogic.js`):**
```javascript
import { calculateDailyIntake } from '@utils/adherenceLogic'
// calculateDailyIntake(medicineId, protocols) ja existe
// Retorna: SUM(timesPerDay * dosage_per_intake) para protocolos ativos do med
```

**Calculo de avgUnitPrice:**
```javascript
function calculateAvgUnitPrice(stockEntries) {
  const activeEntries = stockEntries.filter(s => s.quantity > 0 && s.unit_price > 0)
  if (activeEntries.length === 0) return 0

  const totalValue = activeEntries.reduce((sum, s) => sum + s.unit_price * s.quantity, 0)
  const totalQty = activeEntries.reduce((sum, s) => sum + s.quantity, 0)
  return totalQty > 0 ? totalValue / totalQty : 0
}
```

**Criterios de aceite:**
1. Funcao pura — recebe dados, retorna resultado. Zero side effects.
2. Retorna `{ items, totalMonthly, projection3m }` com items ordenados por monthlyCost DESC
3. Medicamentos sem preco (avgUnitPrice === 0) incluidos com monthlyCost = 0 e flag `hasPriceData: false`
4. Medicamentos sem protocolo ativo excluidos
5. `formatBRL()` usa locale pt-BR

**Cenarios de teste (>=90% cobertura):**

```javascript
describe('costAnalysisService', () => {
  afterEach(() => { vi.clearAllMocks() })

  it('calcula custo mensal com dados completos', () => {
    // 2 meds, protocolos ativos, stock com unit_price
    // Verificar: items.length, totalMonthly, projection3m
  })

  it('retorna monthlyCost 0 para med sem preco', () => {
    // Med com stock.unit_price = 0 ou null
    // Verificar: item.monthlyCost === 0, item.hasPriceData === false
  })

  it('exclui medicamentos sem protocolo ativo', () => {
    // Med sem protocolo ou protocolo inativo
    // Verificar: items nao contem esse med
  })

  it('calcula media ponderada corretamente', () => {
    // 2 stock entries: (qty=30, price=1.50) + (qty=60, price=2.00)
    // avgPrice = (30*1.50 + 60*2.00) / 90 = 165/90 = 1.833...
  })

  it('ordena items por monthlyCost DESC', () => {
    // 3 meds com custos diferentes
    // Verificar: items[0].monthlyCost >= items[1].monthlyCost
  })

  it('retorna objeto vazio quando nao ha medicamentos', () => {
    // Verificar: items = [], totalMonthly = 0, projection3m = 0
  })

  it('calcula projecao para N meses', () => {
    // calculateProjection(100, 3) === 300
    // calculateProjection(100, 6) === 600
  })

  it('formata BRL corretamente', () => {
    // formatBRL(187.5) === 'R$ 187,50' ou 'R$\u00a0187,50'
  })
})
```

### F5.10-2: CostChart Evolucao

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Modificar** | `src/features/stock/components/CostChart.jsx` |
| **Dependencias** | F5.10-1 (costAnalysisService) |

**O componente CostChart ja existe** como componente de display. Evoluir para:

1. Receber dados de `costAnalysisService.calculateMonthlyCosts()`
2. Exibir barras horizontais por medicamento com valor R$
3. Exibir total mensal em destaque
4. Exibir projecao 3 meses
5. Empty state: "Adicione precos no estoque para ver custos" com CTA para tab Estoque
6. Usar `formatBRL()` do service para valores

**Props esperadas (verificar e ajustar):**
```javascript
{
  items: [{ medicineId, name, monthlyCost, hasPriceData }],
  totalMonthly: number,
  projection3m: number,
  onItemClick: (medicineId) => void,  // Navega para estoque do med
}
```

**Criterios de aceite:**
1. Barras proporcionais ao maior custo (item.monthlyCost / max * 100%)
2. Items sem preco mostram "Sem preco" em texto muted
3. Total e projecao formatados em BRL
4. Empty state quando TODOS os items tem hasPriceData === false
5. Acessibilidade: `aria-label` nas barras com valor

### F5.10-3: Integracao na Tab Estoque

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Modificar** | `src/views/Stock.jsx` |
| **Dependencias** | F5.10-1, F5.10-2 |

**O que fazer:**
1. Importar `calculateMonthlyCosts` do service
2. Calcular custos a partir de `medicines` e `protocols` ja carregados na view
3. Renderizar `CostChart` como nova secao "Custo Mensal" no final da tab Estoque
4. Secao colapsavel (expandida por padrao)

**Padrao de integracao:**
```javascript
import { calculateMonthlyCosts } from '@stock/services/costAnalysisService'
import CostChart from '@stock/components/CostChart'

// Dentro do componente, APOS states e antes de effects:
const costData = useMemo(
  () => calculateMonthlyCosts(medicines, protocols),
  [medicines, protocols]
)
```

**Criterios de aceite:**
1. CostChart visivel na tab Estoque abaixo das secoes existentes
2. Dados recalculados quando medicines ou protocols mudam (useMemo)
3. Nenhuma chamada adicional ao Supabase
4. Layout responsivo (funciona em mobile 360px+)

### F5.10-4: Testes de Integracao

| Campo | Valor |
|-------|-------|
| **Agente** | Tester |
| **Criar** | `src/features/stock/services/__tests__/costAnalysisService.test.js` |
| **Verificar** | `npm run validate:agent` passa |

Testes do service ja detalhados em F5.10-1. Alem disso:
- Verificar que `npm run test:critical` inclui o novo service
- Verificar que `npm run validate:agent` passa sem regressoes
- Verificar Lighthouse Performance >= 90 apos adicionar CostChart

### Quality Gate Sprint 5.A

- [ ] `costAnalysisService.js` criado com testes (>=90% cobertura)
- [ ] `CostChart.jsx` evoluido e integrado na tab Estoque
- [ ] `npm run validate:agent` passa
- [ ] Nenhuma chamada nova ao Supabase (verificar Network tab)
- [ ] Lighthouse Performance >= 90
- [ ] Commit semantico: `feat(stock): add cost analysis service and chart (#F5.10)`
- [ ] PR criado, aguardar review

---

## 5. Sprint 5.B — Spike ANVISA + Integracao (2-3 SP spike + 13 SP condicional)

### Objetivo
Pesquisar viabilidade de integrar com bases de dados ANVISA para auto-complete de medicamentos e, se viavel, implementar a integracao.

### SPIKE-1: Pesquisa de Fontes de Dados ANVISA

| Campo | Valor |
|-------|-------|
| **Agente** | Researcher (ou Coder com foco em pesquisa) |
| **Output** | Documento `plans/SPIKE_ANVISA_RESULTADO.md` |
| **Tempo maximo** | 4 horas de pesquisa |
| **Dependencias** | Nenhuma |

**O que pesquisar:**

1. **dados.gov.br** — Portal de dados abertos do governo brasileiro
   - Buscar datasets relacionados a medicamentos, ANVISA, bulario
   - URL base: `https://dados.gov.br/dados/conjuntos-dados`
   - Verificar: formato (CSV, JSON, XML), tamanho, frequencia de atualizacao, licenca

2. **Bulario Eletronico ANVISA**
   - URL: `https://consultas.anvisa.gov.br/#/bulario/`
   - Verificar se ha API publica ou export de dados
   - Verificar estrutura dos dados (nome comercial, principio ativo, dosagem, forma farmaceutica)

3. **API de Consulta de Registros ANVISA**
   - URL: `https://consultas.anvisa.gov.br/#/medicamentos/`
   - Investigar se ha API REST por tras da interface web
   - Verificar rate limits, autenticacao, termos de uso

4. **Bases alternativas abertas**
   - CMED (Camara de Regulacao do Mercado de Medicamentos) — tabela de precos
   - Lista RENAME (Relacao Nacional de Medicamentos Essenciais)
   - OpenFDA (referencia de formato, nao de dados BR)
   - Repositorios GitHub com dados de medicamentos brasileiros

5. **Web scraping**
   - Viabilidade legal (termos de uso ANVISA)
   - Complexidade tecnica (SPA? Captcha? Rate limit?)
   - Frequencia necessaria de atualizacao

**Template do documento de resultado:**

```markdown
# Resultado do Spike ANVISA

## Fontes Avaliadas

### Fonte 1: [Nome]
- URL: ...
- Formato: CSV / JSON / API / HTML
- Campos disponiveis: nome, principio_ativo, dosagem, forma_farmaceutica, laboratorio
- Tamanho: N registros
- Licenca: aberta / restrita / desconhecida
- Atualizacao: diaria / mensal / anual / desconhecida
- Viabilidade: ALTA / MEDIA / BAIXA
- Notas: ...

### Fonte 2: ...

## Recomendacao

### Cenario A: Viavel com custo zero
- Fonte recomendada: ...
- Formato de integracao: JSON estatico / API call / download periodico
- Tamanho estimado do dataset: N registros, ~X KB
- Plano: importar para JSON local, servir como autocomplete

### Cenario B: Parcialmente viavel
- Base seed manual de ~500 medicamentos mais comuns
- Fonte para enriquecimento futuro: ...

### Cenario C: Inviavel
- Motivos: ...
- Alternativa: manter cadastro manual, mover F5.6 para Fase 8
```

**Criterios de aceite do spike:**
1. Documento criado com pelo menos 3 fontes avaliadas
2. Recomendacao clara (cenario A, B ou C)
3. Se cenario A: prototipo minimo de download/parse dos dados
4. Decisao documentada para prosseguir ou nao com F5.6

### SPIKE-2: Prototipo de Viabilidade (se cenario A ou B)

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Output** | Script de prova de conceito (nao precisa ser produtizavel) |
| **Tempo maximo** | 2 horas |

**O que fazer:**
1. Baixar/parsear amostra dos dados da fonte recomendada
2. Extrair campos: `nome_comercial`, `principio_ativo`, `dosagem`, `forma_farmaceutica`, `laboratorio`
3. Gerar JSON com formato alvo:
```json
[
  {
    "name": "Losartana Potassica",
    "activeIngredient": "losartana potassica",
    "dosages": ["25mg", "50mg", "100mg"],
    "form": "comprimido",
    "laboratory": "EMS"
  }
]
```
4. Verificar: quantos registros? Tamanho do JSON? Qualidade dos dados?

### F5.6-1: Base de Medicamentos (13 SP — condicional)

**PRE-CONDICAO: Spike retornou cenario A ou B.**

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Criar** | `src/features/medications/data/medicineDatabase.json` |
| **Criar** | `src/features/medications/services/medicineDatabaseService.js` |
| **Testar** | `src/features/medications/services/__tests__/medicineDatabaseService.test.js` |

**Implementacao do service:**

```javascript
// src/features/medications/services/medicineDatabaseService.js

/**
 * Servico de busca na base de medicamentos ANVISA.
 * Dados carregados via lazy import do JSON estatico.
 * Busca por nome comercial ou principio ativo com fuzzy matching.
 */

let _database = null

/**
 * Carrega a base sob demanda (lazy loading para nao impactar bundle inicial).
 */
async function loadDatabase() {
  if (!_database) {
    const module = await import('@medications/data/medicineDatabase.json')
    _database = module.default
  }
  return _database
}

/**
 * Busca medicamentos por termo (nome ou principio ativo).
 * @param {string} query - Termo de busca (minimo 3 caracteres)
 * @param {number} limit - Maximo de resultados (default: 10)
 * @returns {Promise<Array<{name, activeIngredient, dosages, form, laboratory}>>}
 */
export async function searchMedicines(query, limit = 10) {
  if (!query || query.length < 3) return []

  const db = await loadDatabase()
  const normalizedQuery = normalizeText(query)

  return db
    .filter(med =>
      normalizeText(med.name).includes(normalizedQuery) ||
      normalizeText(med.activeIngredient).includes(normalizedQuery)
    )
    .slice(0, limit)
}

/**
 * Retorna detalhes de um medicamento especifico.
 * @param {string} name - Nome exato do medicamento
 * @returns {Promise<Object|null>}
 */
export async function getMedicineDetails(name) {
  const db = await loadDatabase()
  return db.find(med => normalizeText(med.name) === normalizeText(name)) || null
}

/**
 * Normaliza texto para busca (remove acentos, lowercase).
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
```

**Estrutura do JSON (`medicineDatabase.json`):**
```json
[
  {
    "name": "Losartana Potassica 50mg",
    "activeIngredient": "losartana potassica",
    "dosagePerPill": 50,
    "dosageUnit": "mg",
    "form": "comprimido",
    "laboratory": "EMS",
    "type": "medicamento"
  }
]
```

**Criterios de aceite:**
1. JSON lazy-loaded (nao impacta bundle inicial)
2. Busca funciona com acentos e sem acentos ("losartana" = "Losartana")
3. Busca por nome comercial E por principio ativo
4. Minimo 3 caracteres para buscar (evitar queries muito amplas)
5. Maximo 10 resultados por default
6. Testes: busca com acento, sem acento, parcial, sem resultado, limite

### F5.6-2: Autocomplete no Formulario de Medicamento

| Campo | Valor |
|-------|-------|
| **Agente** | Coder |
| **Modificar** | `src/features/medications/components/MedicineForm.jsx` |
| **Criar** | `src/features/medications/components/MedicineAutocomplete.jsx` |

**O que fazer:**

1. Criar componente `MedicineAutocomplete` que:
   - Recebe `onSelect(medicine)` como prop
   - Exibe input de texto com debounce de 300ms
   - Chama `searchMedicines(query)` apos debounce
   - Mostra dropdown com resultados
   - Ao selecionar, preenche campos do formulario automaticamente

2. Integrar no `MedicineForm`:
   - Substituir input de nome por `MedicineAutocomplete`
   - Ao selecionar medicamento da base:
     - Preenche `name` com `med.name`
     - Preenche `active_ingredient` com `med.activeIngredient`
     - Preenche `dosage_per_pill` com `med.dosagePerPill`
     - Preenche `dosage_unit` com `med.dosageUnit`
     - Preenche `type` com `med.type`
   - Manter edicao manual de todos os campos (autocomplete e sugestao, nao imposicao)
   - Mostrar label "Fonte: Base ANVISA" quando preenchido automaticamente

**Padrao do componente:**
```jsx
// src/features/medications/components/MedicineAutocomplete.jsx

import { useState, useCallback } from 'react'
import { searchMedicines } from '@medications/services/medicineDatabaseService'

export default function MedicineAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)

  // Debounce de 300ms para busca
  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (query.length < 3) {
        setSuggestions([])
        return
      }
      const results = await searchMedicines(query)
      setSuggestions(results)
      setIsOpen(results.length > 0)
    }, 300),
    []
  )

  const handleInputChange = (e) => {
    onChange(e.target.value)
    debouncedSearch(e.target.value)
  }

  const handleSelect = (medicine) => {
    onSelect(medicine)
    setIsOpen(false)
    setSuggestions([])
  }

  return (
    <div className="autocomplete-container">
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder="Digite o nome do medicamento..."
        autoComplete="off"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown" role="listbox">
          {suggestions.map((med, i) => (
            <li
              key={i}
              role="option"
              onClick={() => handleSelect(med)}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(med)}
              tabIndex={0}
            >
              <strong>{med.name}</strong>
              <span className="text-muted"> — {med.activeIngredient}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
```

**Criterios de aceite:**
1. Dropdown aparece apos 3 caracteres com debounce de 300ms
2. Selecao preenche TODOS os campos automaticamente
3. Campos continuam editaveis apos preenchimento automatico
4. Se paciente digita nome que nao esta na base, formulario funciona normalmente (manual)
5. Acessibilidade: `role="listbox"`, `role="option"`, navegacao por teclado
6. Mobile: dropdown nao ultrapassa viewport

### F5.6-3: Testes

**Testes do service (`medicineDatabaseService.test.js`):**
```javascript
describe('medicineDatabaseService', () => {
  afterEach(() => { vi.clearAllMocks() })

  it('retorna resultados para busca por nome comercial', async () => {
    const results = await searchMedicines('losartan')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].name.toLowerCase()).toContain('losartan')
  })

  it('retorna resultados para busca por principio ativo', async () => {
    const results = await searchMedicines('metformina')
    expect(results.length).toBeGreaterThan(0)
  })

  it('busca funciona sem acentos', async () => {
    const results = await searchMedicines('losarta')
    expect(results.length).toBeGreaterThan(0)
  })

  it('retorna vazio para query com menos de 3 caracteres', async () => {
    const results = await searchMedicines('lo')
    expect(results).toEqual([])
  })

  it('respeita limite de resultados', async () => {
    const results = await searchMedicines('comp', 5)
    expect(results.length).toBeLessThanOrEqual(5)
  })

  it('getMedicineDetails retorna null para med inexistente', async () => {
    const result = await getMedicineDetails('XYZ_INEXISTENTE')
    expect(result).toBeNull()
  })
})
```

### Quality Gate Sprint 5.B

- [ ] Spike ANVISA concluido com documento de resultado
- [ ] Decisao documentada (cenario A, B, ou C)
- [ ] Se cenario A/B: base JSON criada, service implementado, autocomplete funcionando
- [ ] Se cenario C: decisao de mover F5.6 para Fase 8 documentada no ROADMAP_v4
- [ ] `npm run validate:agent` passa
- [ ] Testes com cobertura >= 90% para services novos
- [ ] Bundle size aumento maximo: +200KB (JSON da base)
- [ ] Commit semantico: `feat(medications): add ANVISA medicine database and autocomplete (#F5.6)`
- [ ] PR criado, aguardar review

---

## 6. Fechamento da Fase 5

Apos ambos sprints concluidos:

1. **Atualizar ROADMAP_v4.md** — marcar Fase 5 como 100% completa
2. **Atualizar CLAUDE.md** — seção "Versao atual" para v3.2.0
3. **Atualizar package.json** — version para "3.2.0"
4. **Registrar em `.memory/journal/`** — entrada de fechamento da Fase 5
5. **Atualizar contadores em `.memory/rules.md`** — se novas regras foram descobertas
6. **Tag git** — `v3.2.0`
7. **Commit** — `docs: close phase 5 — tag v3.2.0`

---

## 7. Mapa de Arquivos

### Novos
```
src/features/stock/services/costAnalysisService.js                     (F5.10)
src/features/stock/services/__tests__/costAnalysisService.test.js      (F5.10)
src/features/medications/data/medicineDatabase.json                    (F5.6, condicional)
src/features/medications/services/medicineDatabaseService.js           (F5.6, condicional)
src/features/medications/services/__tests__/medicineDatabaseService.test.js (F5.6, condicional)
src/features/medications/components/MedicineAutocomplete.jsx           (F5.6, condicional)
plans/SPIKE_ANVISA_RESULTADO.md                                        (Spike)
```

### Modificados
```
src/features/stock/components/CostChart.jsx         (F5.10 — evolucao)
src/views/Stock.jsx                                  (F5.10 — integracao CostChart)
src/features/medications/components/MedicineForm.jsx (F5.6 — autocomplete)
plans/ROADMAP_v4.md                                  (fechamento)
CLAUDE.md                                            (versao)
package.json                                         (versao)
```

---

## 8. Processo Git

```
1. git checkout -b feature/fase-5/cost-analysis     (Sprint 5.A)
2. Implementar F5.10-1 a F5.10-4
3. npm run validate:agent
4. git commit -m "feat(stock): add cost analysis service and chart (#F5.10)"
5. git push origin feature/fase-5/cost-analysis
6. Criar PR → aguardar Gemini review → merge

7. git checkout -b feature/fase-5/anvisa-spike       (Sprint 5.B)
8. Executar SPIKE-1 e SPIKE-2
9. git commit -m "docs: ANVISA integration spike results"
10. Se viavel: implementar F5.6-1 a F5.6-3
11. npm run validate:agent
12. git commit -m "feat(medications): add ANVISA medicine database (#F5.6)"
13. git push → PR → review → merge

14. git checkout -b chore/fase-5-closing
15. Atualizar version, docs, memory
16. git commit -m "docs: close phase 5 — tag v3.2.0"
17. git tag v3.2.0
18. git push → PR → review → merge
```

---

*Documento criado 06/03/2026.*
