# Spec de Execucao — Patch 1 do PDF Clinico de Consulta Medica

**Versao:** 1.0  
**Data:** 2026-03-24  
**Status:** Pronto para execucao via `/deliver-sprint`  
**Baseline:** PDF clinico novo ja integrado ao Modo Consulta e ao caminho `Perfil -> Relatorio PDF`  
**Escopo:** Correcao de bugs clinicos, refinamento visual/editorial e reducao de esforco cognitivo do PDF clinico  
**Objetivo:** Tornar o PDF novo confiavel, legivel e pedagogico sem regredir performance mobile  
**Referencia principal:** `plans/roadmap_v4/EXEC_SPEC_PDF_CONSULTA_MEDICA.md`

---

## 1. Contexto

O pipeline novo do PDF clinico ja substituiu o fluxo antigo e trouxe ganhos reais:

- tabela de tratamentos ativa com dose, frequencia e dose diaria;
- cabecalho/rodape e paginacao consistentes;
- separacao por secoes clinicas;
- remocao dos graficos antigos ilegiveis.

Porem, a primeira rodada de validacao do arquivo real `meus-remedios-consulta-medica-Últimos-7-dias-2026-03-24.pdf` mostrou bugs e lacunas que impedem considerar a entrega como polida e clinicamente confiavel.

Este patch existe para fechar esses gaps sem reabrir a discussao arquitetural principal.

---

## 2. Problemas Confirmados

### 2.1 Confiabilidade dos Dados

- A pagina de adesao mostra `360/360` por dia, valor incompatível com a realidade do tratamento.
- O topo apresenta inconsistencias entre KPI e metadados, ex.: `Alertas criticos = 0` enquanto o meta indica `1 em atencao`.
- `Pontualidade = 0%` parece pouco confiavel no contexto de alta adesao e precisa ser validado.
- O periodo selecionado no arquivo (`Ultimos 7 dias`) nao conversa bem com KPIs destacados de `30d` e `90d`.

### 2.2 Identificacao do Paciente

- O PDF sai com `Paciente` em vez de um identificador util.
- Hoje nao ha nome do paciente no banco para esse fluxo.
- E necessario um fallback paliativo seguro usando o handle do email antes do `@`.

### 2.3 Layout e Paginacao

- Na pagina 1, `Mensagem executiva` e `Notas clinicas` estao comprimidas e com colisao visual.
- Nas paginas 3 e 4, o cabecalho da tabela parece sobrepor a primeira linha de dados.
- A pagina de prescricoes pode sair completamente vazia e ainda assim ocupar uma pagina inteira.
- Paginas de titulacao e observacoes ficam excessivamente vazias em cenarios sem dados relevantes.
- O PDF ainda tem muito whitespace improdutivo em varias paginas.

### 2.4 Carga Cognitiva

- O novo PDF tem mais valor clinico que o anterior, mas perdeu elementos visuais de orientacao para o paciente leigo.
- So tabelas e numeros puros aumentam o esforco cognitivo para quem nao interpreta bem dados tabulares.
- Faz sentido adicionar um unico elemento visual hero na pagina 1, sem voltar aos graficos ruins do legado.

---

## 3. Diretriz de Produto

### 3.1 Recomendacao Aprovada

Manter o PDF novo como base definitiva e nao reintroduzir os graficos antigos.

### 3.2 Decisao Editorial

Adicionar um **hero card** na pagina 1 com visual de `ring gauge` para adesao principal.

Esse componente deve:

- destacar a adesao com valor percentual no centro;
- usar semaforo visual simples;
- servir como leitura imediata para paciente;
- coexistir com a tabela e os demais KPIs sem transformar o documento em dashboard.

### 3.3 Limite de Escopo

- 1 unico visual hero forte na pagina 1.
- Nenhum grafico de serie temporal denso nesta rodada.
- Nenhuma biblioteca pesada adicional sem necessidade comprovada.

---

## 4. Objetivos do Patch

1. Corrigir os bugs de dados que hoje reduzem a confiabilidade do PDF.
2. Eliminar colisao visual, sobreposicao de tabela e paginas vazias.
3. Melhorar a identificacao do paciente com fallback pragmatico.
4. Reduzir o esforco cognitivo do paciente com um hero visual simples.
5. Preservar o lazy loading do pipeline de PDF e a estrategia mobile.

---

## 5. Guardrails Obrigatorios

### 5.1 Tecnicos

- Manter `generateConsultationPDF()` como fluxo canonico.
- Nao reintroduzir `pdfGeneratorService.generatePDF()` no caminho visivel da app.
- Nao usar import estatico de libs pesadas novas.
- Validar com `npm run build` e garantir que o chunk de PDF continue lazy.

### 5.2 Dados

- Nenhum KPI pode contradizer outro campo do proprio PDF.
- Se um valor clinico nao puder ser calculado com confianca, mostrar estado explicito:
  - `Sem dados suficientes`
  - `Nao calculado`
  - `Nao informado`

### 5.3 Visual

- Nenhuma pagina deve existir sem carga de informacao suficiente.
- Nenhum header de tabela pode sobrepor primeira linha.
- Pagina 1 deve ser escaneavel em menos de 15 segundos.

---

## 6. Escopo de Implementacao

## 6.1 Sprint P0 — Correcao de Confiabilidade

### Entregas

- Corrigir a origem/calculo da tabela de adesao diaria.
- Corrigir inconsistencias entre KPIs e metadados do topo.
- Revisar calculo/exibicao de pontualidade.
- Garantir que o periodo selecionado influencie corretamente a narrativa do PDF.

### Criterios de aceite

- Nenhuma linha de adesao diaria pode mostrar totais impossiveis para o dia.
- `Alertas criticos` e respectivos metas/badges devem ser coerentes.
- Pontualidade `0%` so pode aparecer se o dataset realmente suportar esse valor.
- Arquivo de `7d` deve ter narrativa coerente com 7 dias, mesmo mantendo comparativos 30d/90d.

## 6.2 Sprint P0.5 — Identificacao do Paciente

### Entregas

- Tentar resolver nome do paciente a partir de `user_metadata.name`.
- Se ausente, usar fallback do handle do email antes do `@`.
- Se ainda ausente, mostrar `Paciente nao identificado`.

### Criterios de aceite

- O PDF nunca mais deve sair apenas com `Paciente` como placeholder generico.

## 6.3 Sprint P1 — Layout, Tabelas e Paginacao

### Entregas

- Corrigir sobreposicao do header da tabela nas paginas 3 e 4.
- Reorganizar pagina 1 para separar melhor `Mensagem executiva` e `Notas clinicas`.
- Nao renderizar pagina de prescricoes quando nao houver linhas.
- Colapsar titulacao e observacoes em secoes menores quando houver pouco conteudo.
- Reduzir whitespace improdutivo.

### Criterios de aceite

- Nenhuma tabela com header sobre a primeira linha.
- Nenhuma pagina completamente vazia.
- PDF final deve tender a menos paginas em cenarios com pouco conteudo.

## 6.4 Sprint P2 — Hero Visual da Pagina 1

### Entregas

- Criar um hero card de adesao com `ring gauge`.
- Posicionar esse hero como ancora visual do resumo executivo.
- Garantir leitura boa em tela e impressao.

### Requisitos do hero

- mostrar percentual no centro;
- legenda curta;
- cor por faixa;
- sem excesso de texto;
- sem depender de biblioteca nova se for viavel desenhar com jsPDF nativo.

### Criterios de aceite

- O paciente precisa conseguir identificar visualmente a adesao principal em 2-3 segundos.
- O hero nao pode deslocar nem esmagar o restante da pagina 1.

---

## 7. Mudancas Esperadas por Arquivo

| Arquivo | Mudanca esperada |
|--------|------------------|
| `src/features/reports/components/ReportGenerator.jsx` | somente ajustes de texto/periodo se necessarios |
| `src/features/reports/services/consultationPdfDataBuilder.js` | correcao de KPIs, adesao, nome do paciente e estados vazios |
| `src/features/reports/services/consultationPdfService.js` | correcao de layout, pagina 1, headers de tabela, paginacao condicional e hero ring gauge |
| `src/features/reports/services/__tests__/consultationPdfDataBuilder.test.js` | novos cenarios para KPI, paciente e adesao |
| `src/features/reports/services/__tests__/consultationPdfService.test.js` | cobertura de paginacao condicional e hero visual |

---

## 8. Casos de Teste Obrigatorios

1. `Paciente sem nome` mas com email presente -> usar handle do email.
2. `Paciente sem nome e sem email` -> `Paciente nao identificado`.
3. `Prescricoes vazias` -> nao gerar pagina exclusiva vazia.
4. `Sem titulacao e poucas observacoes` -> nao desperdiçar paginas.
5. `Periodo = 7d` -> narrativa e destaque coerentes.
6. `Alerta unico de estoque` -> KPI e bloco de atencao coerentes.
7. `Adesao realista` -> sem totais absurdos como `360/360` por dia.
8. `Tabela longa` -> header sem sobrepor primeira linha.

---

## 9. Riscos

- Corrigir adesao pode exigir revisar o contrato entre `consultationDataService`, `dashboardData` e `consultationPdfDataBuilder`.
- O fallback do nome via email handle melhora muito a identificacao, mas continua sendo paliativo.
- O hero `ring gauge` pode ficar enfeitado demais se nao for tratado como KPI editorial e nao como dashboard decorativo.

---

## 10. Definicao de Sucesso

Consideraremos este patch bem-sucedido quando:

1. o PDF nao tiver mais inconsistencias obvias de dados;
2. nao houver paginas vazias ou tabelas sobrepostas;
3. o paciente seja identificado de forma util;
4. a pagina 1 tenha uma leitura mais imediata para publico leigo;
5. o documento continue leve e coerente com os guardrails mobile.

---

## 11. Comando de Execucao Sugerido

```text
/deliver-sprint plans/roadmap_v4/EXEC_SPEC_PDF_CONSULTA_MEDICA_PATCH_1.md
```

O executor deve tratar esta entrega como **patch corretivo e editorial** do PDF clinico ja existente, priorizando P0 e P1 antes de qualquer embellishment visual.
