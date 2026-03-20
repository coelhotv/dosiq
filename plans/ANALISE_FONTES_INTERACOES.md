# Analise de Fontes — Seed de Interacoes Medicamentosas (F8.2)

**Data:** 20/03/2026
**Objetivo:** Identificar fontes viaveis para popular `interactions.json` com 50-80 pares de alta prevalencia no Brasil.
**Contexto:** O app ja possui `medicineDatabase.json` (6.771 medicamentos ANVISA, campos: `name`, `activeIngredient`, `therapeuticClass`). O matching de interacoes sera feito por `activeIngredient` (principio ativo).

---

## 1. Fontes Primarias (Recomendadas)

### 1A. Detecta Interacoes — CRF-MG (Conselho Regional de Farmacia de Minas Gerais)

| Campo | Valor |
|-------|-------|
| **URL** | https://imses.crfmg.org.br |
| **API** | https://imses.crfmg.org.br/api/docs/ (Swagger) |
| **Dados** | ~330 interacoes validadas por 37 especialistas brasileiros (tecnica Delphi) |
| **Idioma** | Portugues (DCB — Denominacao Comum Brasileira) |
| **Licenca** | Gratuito, sem fins lucrativos, acesso aberto |
| **Formato** | REST API (JSON), documentacao Swagger |
| **Severidade** | Foco em interacoes graves (clinicamente relevantes) |

**Por que e a melhor opcao:**
- Ja em portugues com nomes DCB (mesma nomenclatura do `activeIngredient` no nosso DB)
- Validado por especialistas clinicos brasileiros — alta credibilidade
- 330 interacoes e o tamanho ideal para filtrar 50-80 pares de alta prevalencia
- API REST gratuita com Swagger — extracao programatica simples
- Foco em interacoes graves alinha com o objetivo do app (alertar, nao sobrecarregar)

**Processo de extracao:**
1. Acessar API Swagger, listar endpoints disponiveis
2. Extrair todas as interacoes via GET requests
3. Filtrar para principios ativos presentes no `medicineDatabase.json`
4. Mapear para o schema `{ pair, severity, description, recommendation }`
5. Minimo de processamento necessario (dados ja em PT-BR)

**Riscos:**
- API pode ter rate limits nao documentados
- Swagger UI requer JavaScript rendering (usar curl/fetch direto)
- 330 interacoes pode nao cobrir todos os pares desejados

---

### 1B. Interage API — IntMed Software

| Campo | Valor |
|-------|-------|
| **URL** | https://api.interage.intmed.com.br/docs/ |
| **SDK** | https://github.com/IntMed/interage_python_sdk (Python) |
| **Dados** | 1.893 farmacos, 78.000+ interacoes |
| **Idioma** | Portugues |
| **Licenca** | Trial gratuito; pricing para acesso completo nao claro |
| **Formato** | REST/JSON, paginacao, 500 req/min |
| **Campos** | `gravidade`, `evidencia`, `acao`, `explicacao`, `principios_ativos` |

**Por que e excelente como complemento:**
- Maior base de interacoes brasileira (78K interacoes)
- Campos alinham perfeitamente com nosso schema:
  - `gravidade` → `severity` (Grave, Moderada, Leve, Nada esperado, Desconhecida)
  - `evidencia` → `evidenceLevel` (Teorica, Extensa, Caso, Estudo)
  - `acao` → `recommendation` (Ajustar, Monitorar, Informar, Evitar)
  - `explicacao` → `description`
  - `principios_ativos` → `pair`
- SDK Python facilita extracao programatica
- 500 req/min e suficiente para extracao one-shot

**Processo de extracao:**
1. Registrar para trial gratuito, obter API key
2. Listar top 40 principios ativos mais comuns no RENAME/SUS
3. Para cada principio ativo: `GET /v1/principios-ativos/{id}/interacoes/`
4. Coletar interacoes de severidade Grave e Moderada
5. Deduplicar pares (A+B == B+A) e selecionar 50-80 mais relevantes

**Riscos:**
- Trial pode ser time-limited
- Termos podem restringir redistribuicao de dados extraidos
- Necessita registro com dados

---

### 1C. DDInter 2.0 — Drug-Drug Interaction Database

| Campo | Valor |
|-------|-------|
| **URL** | https://ddinter2.scbdd.com |
| **Paper** | Nucleic Acids Research, 2024 (https://academic.oup.com/nar/article/53/D1/D1356/7740584) |
| **Download** | https://ddinter.scbdd.com/download/ |
| **Dados** | 302.516 interacoes, 2.310 farmacos, 8.398 mecanismos |
| **Idioma** | Ingles (nomes INN — International Nonproprietary Names) |
| **Licenca** | Gratuito, acesso aberto, uso academico/nao-comercial |
| **Formato** | TSV/CSV (bulk download) |

**Por que e util como validacao:**
- Maior base aberta de DDIs estruturadas (302K interacoes)
- Campos incluem severidade, mecanismo e recomendacao de manejo
- Bulk download disponivel — sem limites de API
- Excelente para cross-validar dados do Detecta Interacoes / Interage

**Processo de extracao:**
1. Download do bulk CSV/TSV
2. Filtrar para os ~200 principios ativos mais comuns no ANVISA DB
3. Criar tabela de mapping INN → DCB (ex: `losartan` → `losartana potassica`)
4. Selecionar pares de severidade Grave/Moderada
5. Traduzir descricoes e recomendacoes para PT-BR
6. Usar como validacao cruzada com fontes brasileiras

**Riscos:**
- Requer mapeamento INN → DCB (trabalho manual moderado)
- Traducao de descricoes necessaria
- Sem contexto brasileiro especifico

---

## 2. Fontes Suplementares

### 2A. Guias Clinicos Brasileiros (PDFs)

| Fonte | URL |
|-------|-----|
| Guia de Interacao Medicamentosa — Rio Saude (Ago/2024) | https://riosaude.prefeitura.rio/wp-content/uploads/sites/66/2024/09/guia-interacao-medicamentosa-ago24.pdf |
| Guia de Interacoes — UFG (Universidade Federal de Goias) | https://files.cercomp.ufg.br/weby/up/734/o/Guia_de_Interacoes_Medicamentosas.pdf |
| Guia de Interacao — UNIARA | https://www.uniara.com.br/arquivos/file/cursos/graduacao/farmacia/guias-de-medicamentos/guia-interacao-medicamentosa.pdf |

**Utilidade:** Excelentes para curacao manual das 50-80 interacoes mais relevantes no contexto brasileiro. Contem tabelas estruturadas com par de farmacos, severidade e recomendacao.

**Processo:** Transcricao manual das tabelas para JSON. Trabalho moderado (~2-3h) mas dados de altissima qualidade e relevancia clinica brasileira.

### 2B. RENAME 2024 (Relacao Nacional de Medicamentos Essenciais — SUS)

| Campo | Valor |
|-------|-------|
| **URL** | https://www.gov.br/saude/pt-br/composicao/sectics/rename |
| **PDF** | https://bvsms.saude.gov.br/bvs/publicacoes/relacao_nacional_medicamentos_2024.pdf |
| **Dados** | Lista de medicamentos essenciais do SUS com categorias terapeuticas |

**Utilidade:** NAO contem interacoes, mas serve como **filtro de priorizacao**. Os medicamentos do RENAME sao os mais usados no Brasil (distribuidos gratuitamente pelo SUS). Priorizar interacoes entre esses farmacos garante maxima cobertura da populacao-alvo.

**Processo:** Extrair lista de principios ativos do RENAME, cruzar com interacoes das fontes primarias, priorizar pares que envolvem esses farmacos.

### 2C. DrugBank (Open Data)

| Campo | Valor |
|-------|-------|
| **URL** | https://go.drugbank.com/releases/latest |
| **Parsers** | https://github.com/Zhangs996/DrugBankParser (Python) |
| **Licenca** | CC0 (identificadores) / CC BY-NC 4.0 (dados completos) |

**Utilidade:** Gold-standard internacional, mas requer registro/aprovacao e processamento pesado de XML. Melhor como fonte de validacao do que como fonte primaria.

### 2D. PharmaDB API

| Campo | Valor |
|-------|-------|
| **URL** | https://pharmadb.com.br |
| **Dados** | 192.000 interacoes, 27.000 produtos ANVISA, 5.700 principios ativos DCB |
| **Licenca** | Comercial — Free tier: 20 req/dia (apenas severidade), Starter: R$77/mes |

**Utilidade:** Maior base brasileira (192K interacoes) com referencias PubMed. Free tier muito limitado (20 req/dia, sem conteudo clinico). Viavel se o app monetizar no futuro.

---

## 3. Fontes Descartadas

| Fonte | Motivo |
|-------|--------|
| **ANVISA Dados Abertos** (api.anvisa.gov.br) | Publica dados de registro e farmacovigilancia, mas NAO tem dataset de interacoes medicamentosas |
| **Bulario Eletronico ANVISA** (consultas.anvisa.gov.br/#/bulario/) | Interacoes estao em texto livre dentro de PDFs de bulas — extracao automatica inviavel |
| **NLM RxNav Interaction API** | Descontinuada em janeiro 2024 |
| **OpenReact / FreeMedForms** | Sem cobertura brasileira, projeto aparentemente inativo |
| **OpenFDA Drug APIs** | Dados de eventos adversos (FAERS), nao interacoes estruturadas |

---

## 4. Estrategia Recomendada (Hybrid Approach)

### Passo 1 — Fonte primaria: Detecta Interacoes (CRF-MG)
- Extrair todas as ~330 interacoes via API
- Filtrar para principios ativos presentes no `medicineDatabase.json`
- Dados ja em PT-BR, nomes DCB, validados por especialistas
- **Output esperado:** ~40-60 pares relevantes

### Passo 2 — Complemento: Interage API (trial gratuito)
- Registrar, obter API key
- Consultar interacoes para os 30 principios ativos mais comuns do RENAME
- Preencher gaps do Detecta Interacoes com interacoes moderadas
- **Output esperado:** +20-30 pares adicionais

### Passo 3 — Priorizacao: RENAME 2024
- Cruzar pares extraidos com lista de medicamentos essenciais do SUS
- Garantir que as 50-80 interacoes finais cobrem os farmacos mais usados no Brasil
- Categorias prioritarias: anti-hipertensivos, antidiabeticos, AINEs, anticoagulantes, estatinas, IBPs

### Passo 4 — Validacao: DDInter bulk + Guias Clinicos
- Baixar bulk CSV do DDInter, mapear INN → DCB para os 50-80 pares
- Verificar severidades: se DDInter classifica como "severe" e Detecta Interacoes como "moderada", investigar
- Cross-check com guias clinicos brasileiros (Rio Saude, UFG) para confirmacao

### Passo 5 — Curacao Manual Final
- Revisar os 50-80 pares com atencao especial para:
  - Descricoes claras em portugues
  - Recomendacoes acionaveis pelo paciente (nao jargao medico)
  - Disclaimer "base parcial" em todas as telas
- Adicionar campo `source` em cada entrada para rastreabilidade

---

## 5. Schema Final do JSON

```json
[
  {
    "pair": ["losartana potássica", "ibuprofeno"],
    "severity": "moderada",
    "description": "AINEs podem reduzir o efeito anti-hipertensivo e aumentar o risco de lesão renal.",
    "recommendation": "Monitorar pressão arterial. Preferir paracetamol para dor.",
    "category": "anti-hipertensivo-aine",
    "source": "CRF-MG Detecta Interações"
  }
]
```

**Campos:**
- `pair`: Array de 2 strings — principios ativos em portugues (DCB), lowercase, sem acentos no matching
- `severity`: `leve` | `moderada` | `grave` | `contraindicada`
- `description`: Explicacao concisa do risco em linguagem acessivel ao paciente
- `recommendation`: Acao pratica que o paciente pode tomar
- `category`: Agrupamento terapeutico (para futuras expansoes)
- `source`: Fonte da informacao (para auditoria e credibilidade)

---

## 6. Categorias Prioritarias de Interacoes

Baseado na prevalencia de doencas cronicas no Brasil (hipertensao 32%, diabetes 8%, cardiovascular):

| Categoria | Exemplos de Pares | Prevalencia |
|-----------|-------------------|-------------|
| Anti-hipertensivo + AINE | Losartana/Enalapril + Ibuprofeno/Diclofenaco | Muito alta |
| Anticoagulante + AINE | Varfarina/Rivaroxabana + Ibuprofeno/AAS | Alta |
| Estatina + Fibrato | Sinvastatina + Genfibrozila/Fenofibrato | Alta |
| Antidiabetico + Alcool | Metformina + Etanol | Alta |
| IBP + Antiplaquetario | Omeprazol + Clopidogrel | Moderada |
| IECA + Diuretico poupador de K+ | Enalapril + Espironolactona | Moderada |
| Anticoagulante + Antibiotico | Varfarina + Metronidazol/Ciprofloxacino | Moderada |
| Antidepressivo + IMAO | Fluoxetina + Selegilina | Moderada |
| Benzodiazepínico + Opioide | Diazepam + Tramadol | Alta |
| Digoxina + Diuretico | Digoxina + Furosemida | Moderada |
| Levotiroxina + Calcio/Ferro | Levotiroxina + Carbonato de calcio | Alta |
| Metotrexato + AINE | Metotrexato + Ibuprofeno | Moderada |

---

## 7. Script de Extracao (Proposta)

```bash
scripts/
  seed-interactions/
    01-fetch-detecta.js       # Buscar dados do CRF-MG API
    02-fetch-interage.js      # Buscar dados do Interage API (requer API key)
    03-filter-rename.js       # Filtrar por principios ativos do RENAME
    04-validate-ddinter.js    # Cross-validar com DDInter bulk CSV
    05-generate-seed.js       # Gerar interactions.json final
    mapping-inn-dcb.json      # Tabela de mapping INN → DCB (para DDInter)
    rename-2024-ativos.json   # Lista de principios ativos do RENAME 2024
```

**Alternativa simplificada:** Se o acesso as APIs nao funcionar (rate limits, trial expirado), usar curacao manual a partir dos guias clinicos em PDF (Rio Saude + UFG). Trabalho de ~3-4h para transcrever 50-80 pares, mas resultado de alta qualidade.

---

## 8. Estimativa de Esforco

| Abordagem | Tempo | Qualidade | Risco |
|-----------|-------|-----------|-------|
| API Detecta + Interage (automatizada) | 4-6h | Alta | Medio (dependencia de APIs externas) |
| Curacao manual (guias clinicos PDF) | 3-4h | Muito alta | Baixo (dados publicos, sem dependencia) |
| Hibrida (API + manual) | 6-8h | Maxima | Baixo |

**Recomendacao:** Abordagem hibrida. Comecar pela API do CRF-MG (rapido, automatizado), complementar manualmente com guias clinicos para garantir cobertura e qualidade.

---

## 9. Consideracoes Legais

- **Dados de saude publica** (bulas, guias SUS, RENAME) sao de dominio publico no Brasil
- **APIs gratuitas** (CRF-MG, Interage trial) permitem uso nao-comercial; verificar ToS antes de redistribuir
- **DDInter** e acesso aberto para uso academico/nao-comercial
- **Disclaimer obrigatorio** no app: "Base parcial de interacoes conhecidas. Consulte seu farmaceutico para lista completa."
- O app NAO substitui aconselhamento farmaceutico — disclaimer deve estar visivel em toda tela de interacao

---

*Documento criado 20/03/2026.*
*Referencia: EXEC_SPEC_FASE_8.md (Sprint 8.4), PHASE_8_SPEC.md (F8.2)*
