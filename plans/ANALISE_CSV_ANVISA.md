# Analise: CSV ANVISA para Sprint 5.B — Meus Remedios

**Data:** 06/03/2026
**Arquivo analisado:** `public/medicamentos-ativos-anvisa.csv`
**Objetivo:** Avaliar viabilidade para F5.6, decidir arquitetura de armazenamento,
e mapear outros usos no projeto e roadmap.

---

## 1. Estrutura do CSV

### Metricas

| Metrica | Valor |
|---------|-------|
| Total de linhas | 10.206 medicamentos (+ 1 cabecalho) |
| Tamanho em disco | 1.1 MB |
| Completude | 99%+ (1 campo vazio identificado em PRINCIPIO_ATIVO) |
| Separador | `;` (ponto-e-virgula) |
| Encoding | UTF-8 com acentuacao portuguesa |

### Colunas disponiveis

| Coluna | Tipo | Exemplo | Uso no app |
|--------|------|---------|------------|
| `NOME_PRODUTO` | String | "LOSARTANA POTASSICA" | `name` |
| `PRINCIPIO_ATIVO` | String | "losartana potassica" | `active_ingredient` |
| `EMPRESA_DETENTORA_REGISTRO` | String | "BRAINFARMA INDUSTRIA QUIMICA" | `laboratory` |
| `CATEGORIA_REGULATORIA` | Enum | "Generico", "Biologico", "Similar" | `type` (aproximacao) |
| `CLASSE_TERAPEUTICA` | String | "ANTI-HIPERTENSIVOS", "ANALGESICOS NAO NARCOTICOS" | F8.2 interacoes |

### O que NAO esta no CSV

- `dosage_per_pill` — nao discrimina "Losartana 25mg" vs "50mg"
- `dosage_unit` — nao tem mg, mcg, ml
- `form` — nao tem "comprimido", "capsula", "liquido"

Esta e a limitacao principal: o dataset ANVISA de registros de medicamentos nao inclui
informacoes de dosagem. Isso afeta diretamente o escopo do autocomplete (ver secao 3).

### Padrao de duplicatas

O mesmo medicamento aparece multiplas vezes — um registro por fabricante:

```
IBUPROFENO | Generico | ANALGESICOS NAO NARCOTICOS | IBUPROFENO | LEGRAND PHARMA
IBUPROFENO | Generico | ANALGESICOS NAO NARCOTICOS | IBUPROFENO | PRATI DONADUZZI
IBUPROFENO | Generico | ANALGESICOS NAO NARCOTICOS | IBUPROFENO | ALTHAIA S.A.
... (17 fabricantes)
```

Apos deduplicacao por `NOME_PRODUTO + PRINCIPIO_ATIVO`:
- **Real:** 6.816 medicamentos unicos
- **Real:** 278 laboratorios unicos
- **JSON gerado:** 816 KB (uncompressed), ~103 KB (gzipped via lazy-load)

---

## 2. Serve para Sprint 5.B (F5.6)?

**SIM, com ajuste na spec.**

### O que o autocomplete PODE preencher automaticamente

| Campo app | Fonte CSV | Exemplo |
|-----------|-----------|---------|
| `name` | `NOME_PRODUTO` | "Losartana Potassica" |
| `active_ingredient` | `PRINCIPIO_ATIVO` | "losartana potassica" |
| `laboratory` | `EMPRESA_DETENTORA_REGISTRO` | "EMS" |
| `type` | `CATEGORIA_REGULATORIA` | "Generico" → "medicamento" |

### O que o usuario AINDA precisa preencher manualmente

| Campo | Motivo |
|-------|--------|
| `dosage_per_pill` | Nao existe no CSV ANVISA |
| `dosage_unit` | Nao existe no CSV ANVISA |

### Impacto real no UX

O autocomplete ainda entrega valor significativo: elimina os campos mais dificeis de
digitar corretamente (nome comercial exato, principio ativo com grafia correta, laboratorio).
O usuario ainda preenche a dosagem, que e especifica da sua prescricao de qualquer forma —
duas pessoas com o mesmo medicamento podem tomar doses diferentes.

---

## 3. JSON local vs Tabela Supabase — Decisao

**Escolha: JSON local gerado por ETL script.**

### Comparacao

| Criterio | JSON Local | Supabase Table |
|----------|-----------|---------------|
| Custo operacional | R$0 | Chamadas API (quota free tier) |
| Latencia de busca | 0ms (in-memory) | 100-500ms (rede) |
| Funciona offline | Sim | Nao |
| Tamanho pos-ETL | ~200-400 KB (lazy-loaded) | N/A |
| Atualizacao | Script ETL + redeploy | Upload SQL |
| Principio do projeto | Zero calls extras ao Supabase | Viola principio |
| Complexidade | Baixa | Alta (RLS, indices, migracoes) |

### Implementacao do ETL — Dois arquivos separados

Criar `scripts/process-anvisa.js`:

1. Le `public/medicamentos-ativos-anvisa.csv`
2. Cria dois Maps de deduplicacao:
   - `medicines`: deduplica por `NOME_PRODUTO + PRINCIPIO_ATIVO` (remove duplicatas de fabricante)
   - `laboratories`: deduplica por `EMPRESA_DETENTORA_REGISTRO`
3. Normaliza (trim, lowercase onde necessario, fix encoding)
4. Gera dois arquivos JSON separados

**Formato de saida (medicineDatabase.json):**

```json
[
  {"name":"Losartana Potassica","activeIngredient":"losartana potassica","therapeuticClass":"ANTI-HIPERTENSIVOS"},
  {"name":"Epysqli","activeIngredient":"eculizumabe","therapeuticClass":"AGENTE IMUNOSUPRESSOR"}
]
```

**Real:** 6.816 entradas unicas, 802 KB (uncompressed), ~103 KB (gzipped)

**Formato de saida (laboratoryDatabase.json):**

```json
[
  {"laboratory":"EMS"},
  {"laboratory":"LEGRAND PHARMA"}
]
```

**Real:** 278 entradas unicas, 14 KB

**Vantagens da deduplicacao em dois arquivos:**
- Autocomplete de medicamento sem duplicacao de nomes
- Autocomplete de laboratorio separado (futuro: comparador de precos)
- Base ANVISA normalizada no source (menos processamento em runtime)
- Integracoes futuras com CMED (preco por laboratorio) ficam mais simples

Nota: `therapeuticClass` nao estava na spec original, mas e incluido porque habilita
F8.2 (interacoes medicamentosas na Fase 8) sem necessidade de fonte de dados adicional.

---

## 4. Outros usos dos dados ANVISA no projeto

### Usos planejados no roadmap

| Feature | Fase | Dados ANVISA usados |
|---------|------|---------------------|
| F5.6 Autocomplete | 5 | NOME_PRODUTO, PRINCIPIO_ATIVO, EMPRESA_DETENTORA |
| F8.2 Interacoes | 8 | CLASSE_TERAPEUTICA (mapear pares de interacao) |

### F8.2 — CLASSE_TERAPEUTICA resolve 80% do problema

Para alertas de interacoes medicamentosas (Fase 8), o dataset ANVISA ja fornece
a classificacao terapeutica de cada medicamento. Basta um segundo arquivo estatico
`interactions.json` mapeando pares de classes:

```json
[
  {
    "classA": "ANTI-HIPERTENSIVOS",
    "classB": "ANALGESICOS NAO NARCOTICOS",
    "severity": "moderate",
    "description": "AINEs podem reduzir efeito anti-hipertensivo"
  },
  {
    "classA": "ANTICOAGULANTES",
    "classB": "ANALGESICOS NAO NARCOTICOS",
    "severity": "severe",
    "description": "Risco aumentado de sangramento"
  }
]
```

Ao cadastrar um medicamento com `therapeuticClass: "ANTI-HIPERTENSIVOS"`, o sistema
verifica se o paciente ja tem outro med com classe interagente. Zero nova fonte de dados.

### Usos potenciais nao planejados

| Uso | Dados usados | Valor | Esforco estimado |
|-----|-------------|-------|-----------------|
| **Deteccao de duplicatas por principio ativo** | PRINCIPIO_ATIVO | Alerta: "Voce ja tem Losartana cadastrada. Confirmar?" ao adicionar "Losartana Potassica EMS" | Baixo — no medicineDatabaseService, checar antes de gravar |
| **Emergency Card com principio ativo** | PRINCIPIO_ATIVO | PDF/card de emergencia com nome generico alem do comercial — critico para medicos | Baixo — adicionar campo ao card existente |
| **Categorizacao por classe terapeutica** | CLASSE_TERAPEUTICA | Agrupar meds por area (cardiovascular, diabetes, dor) no dashboard | Medio — novo campo + UI agrupada |
| **Busca por classe no bot** | CLASSE_TERAPEUTICA | WhatsApp: "Quais meus remedios pra pressao?" → filtra por ANTI-HIPERTENSIVOS | Medio — depende do Chatbot (Fase 8) |
| **Comparador de precos (CMED)** | PRINCIPIO_ATIVO | Cruzar com tabela CMED para mostrar "generico mais barato disponivel" | Alto — fonte de dados separada (CMED) |

### Usos no contexto WhatsApp/Cuidador (Fase 7)

O WhatsApp bot pode usar o `active_ingredient` (gravado no perfil do medicamento) para
mensagens mais informativas:

- "Hora do seu Losartana (losartana potassica) 50mg — 08:00"
- Cuidador recebe: "Maria nao tomou Metformina (metformina cloridrato) hoje"

---

## 5. Ajuste necessario no medicineSchema.js

Para armazenar `therapeuticClass` do medicamento (habilitando F8.2 futuro):

```javascript
// medicineSchema.js — adicionar campo opcional
therapeutic_class: z.string().trim().max(100).optional().nullable(),
```

Migration Supabase correspondente:

```sql
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS therapeutic_class TEXT;
```

**Decisao: incluir na F5.6 (Sprint 5.B) ou adiar para F8.2?**

Recomendacao: incluir na F5.6. Justificativa:
- Custo de adicionar agora: < 1 SP (campo opcional, sem breaking change)
- Custo de migrar depois: 2-3 SP (migration + redeploy + atualizacao de schema e testes)
- O dado ja existe no JSON gerado pelo ETL — seria desperdicado nao armazenar

---

## 6. Resumo Executivo

| Aspecto | Resposta |
|---------|----------|
| CSV serve para F5.6? | ✅ Sim, com ajuste: dosagem é manual |
| Arquitetura ideal | JSON local via ETL (duas databases) |
| Medicamentos unicos encontrados | 6.816 (não 2.000-4.000 estimado) |
| Laboratorios unicos encontrados | 278 (não 200-400 estimado) |
| Campos auto-preenchidos | name, active_ingredient, therapeutic_class (3 de 6) |
| Campos ainda manuais | dosage_per_pill, dosage_unit, laboratory (todos preenchidos separadamente) |
| Dado extra de alto valor | CLASSE_TERAPEUTICA → habilita F8.2 sem nova fonte |
| Tamanho medicineDatabase.json | 802 KB (uncompressed), ~103 KB (gzipped) |
| Tamanho laboratoryDatabase.json | 14 KB |
| Total gerado | 816 KB (mitigado: lazy-loaded + gzipped) |
| Maior oportunidade nao planejada | Deteccao de duplicatas por principio ativo |
| Campo de schema a adicionar | `therapeutic_class` opcional — melhor fazer agora |

---

*Analise realizada em 07/03/2026 com base no CSV baixado da ANVISA (10.206 registros). ETL executado com sucesso.*
