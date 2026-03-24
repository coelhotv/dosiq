# Spec de Execucao — Redesign do Relatorio PDF de Consulta Medica

**Versao:** 1.0  
**Data:** 2026-03-24  
**Status:** Pronto para execucao via `/deliver-sprint`  
**Baseline:** v3.3.0+ (Modo Consulta Medica e PDF legado ja existentes)  
**Escopo:** Redesenho funcional, visual e arquitetural do PDF de consulta medica  
**Objetivo:** Entregar um PDF clinicamente util para paciente e medico, sem regressao de performance mobile  
**Referencias:** `plans/archive_old/roadmap_v4/PRD_FASE_5_ROADMAP_2026.md`, `plans/archive_old/roadmap_v4/PRD_FASE_5_ROADMAP_2026_STATUS.md`, `docs/standards/MOBILE_PERFORMANCE.md`, `.memory/rules.md`, `.memory/anti-patterns.md`, `AGENTS.md`

---

## 1. Resumo Executivo

O PDF atual de consulta medica cumpre parcialmente a promessa da Fase 5, mas falha em tres dimensoes criticas:

1. **Confiabilidade dos dados:** o PDF de consulta reutiliza um gerador generico e nao o dataset clinico consolidado do Modo Consulta.
2. **Utilidade clinica:** o documento nao prioriza informacoes acionaveis para consulta periodica, titulacao, risco de estoque e acompanhamento longitudinal.
3. **Legibilidade visual:** os graficos estao inadequados para impressao/leitura rapida e algumas tabelas omitiram dados essenciais de dose e contexto.

Este exec spec redefine o PDF como um **Resumo Clinico de Consulta**. O alvo nao e apenas "gerar um PDF bonito"; e gerar um artefato confiavel, legivel e orientado a decisao.

---

## 2. Problemas Confirmados no Estado Atual

### 2.1 Dados

- O botao do Modo Consulta chama `pdfGeneratorService.generatePDF()` com `period: 'last30days'`, valor fora do contrato esperado do service (`7d|30d|90d|all`).
- O PDF nao usa `consultationDataService` como fonte canonica, mesmo o Modo Consulta ja agregando adesao 30d/90d, alertas de estoque, prescricoes e titulacoes.
- A tabela de medicamentos/protocolos nao monta o nome clinico esperado: `[tratamento] - [medicacao]`.
- A dose esta incompleta: faltam apresentacao, quantidade por tomada, frequencia e dose diaria total.
- O calculo de estoque usa heuristica simplificada e pode distorcer dias restantes.

### 2.2 UX / Visual

- Topo com baixo poder de sintese e sem contexto do periodo.
- Grafico de adesao com densidade excessiva para A4 portrait.
- Grafico de estoque com sobreposicao severa, truncamento e escala dominada por outliers.
- Rodape, cabecalho e paginacao insuficientes para um documento medico.

### 2.3 Produto

- O PDF atual esta mais proximo de um "dump de dados" do que de um resumo para consulta.
- O documento serve mal tanto ao paciente quanto ao medico:
  - paciente nao entende prioridades;
  - medico nao tem rapidamente sinais de adesao, mudancas, riscos e contexto terapeutico.

---

## 3. Objetivos do Redesign

### 3.1 Objetivos Primarios

1. Transformar o PDF em um **Resumo Clinico de Consulta**.
2. Garantir **paridade conceitual** entre Modo Consulta e PDF.
3. Melhorar a **qualidade de leitura em tela e papel**.
4. Preservar a estrategia de **lazy loading / code splitting** do pipeline de PDF.

### 3.2 Objetivos Secundarios

1. Tornar o documento compartilhavel e confiavel para revisao medica periodica.
2. Explicitar lacunas de dados em vez de renderizar zeros silenciosos.
3. Criar base arquitetural para futuras secoes clinicas:
   - interacoes medicamentosas;
   - observacoes do paciente;
   - evolucao entre consultas;
   - anexos e comparativos.

### 3.3 Nao Objetivos

- Nao migrar o projeto inteiro para outra engine de PDF nesta primeira entrega sem necessidade comprovada.
- Nao alterar a logica central do Dashboard fora do necessario para expor dados canonicamente.
- Nao sacrificar first load mobile para enriquecer exportacoes pouco usadas.

---

## 4. Principios de Produto

### 4.1 Para o Paciente

O PDF deve responder:

- Quais tratamentos estao ativos hoje?
- Estou aderindo bem?
- Ha algo preocupante antes da proxima consulta?
- Meu estoque ou prescricao exigem acao?

### 4.2 Para o Medico

O PDF deve responder em 30-60 segundos:

- Quais medicamentos/tratamentos o paciente esta seguindo?
- Qual foi a adesao recente e sua tendencia?
- Ha sinais de irregularidade, risco de desabastecimento ou prescricao vencendo?
- Existe titulacao em andamento ou mudanca de regime terapeutico?

### 4.3 Principio Editorial

O documento deve ser:

- denso em sinal;
- baixo em ruido;
- clinico sem ser frio;
- acionavel sem parecer diagnostico automatizado.

---

## 5. Regras Criticas e Guardrails

## 5.1 Regras do Projeto que se Aplicam Diretamente

| Regra | Aplicacao neste exec spec |
|-------|---------------------------|
| `R-001` | Checar duplicatas antes de tocar qualquer arquivo do pipeline de PDF |
| `R-002` | Verificar aliases e caminhos canonicos de services |
| `R-003` | `npm run build` obrigatorio antes de PR |
| `R-020` | Datas sempre com `parseLocalDate()` ou equivalente local |
| `R-022` | Quantidades operacionais em comprimidos/unidades; nao confundir com mg |
| `R-051` | Validacao obrigatoria antes do push |
| `R-060` | Agente nao mergeia proprio PR |
| `R-061` | Pausas de revisao entre sprints |
| `R-062` | Qualidade acima de velocidade |
| `R-065` | Ler `.memory/` antes de codar |
| `R-074` | Em sessao de agente, usar `npm run validate:agent` |
| `R-117` | Lazy loading e isolamento de dependencias pesadas |

## 5.2 Anti-Patterns a Evitar

| Anti-Pattern | Como evitar neste projeto |
|-------------|---------------------------|
| `AP-005` | Nunca `new Date('YYYY-MM-DD')` |
| `AP-B03` | Nao importar estaticamente componentes ou services pesados de PDF |
| `AP-B04` | Nao usar barrel exports para services pesados |
| `AP-P12` | Nao repetir queries identicas em sub-funcoes |
| `AP-P13` | Nao saturar o first paint com queries nao criticas |
| `AP-P15` | Nao criar loops pesados de `new Date()` em series historicas |
| `AP-P16` | Nao montar ranges UTC manualmente ignorando fuso local |

## 5.3 Guardrails de Performance Mobile

Estas regras sao obrigatorias e fazem parte do aceite:

1. Toda biblioteca pesada nova usada apenas para exportacao deve ser carregada por `import()` dinamico no handler/servico de geracao.
2. Nenhuma dependencia de PDF pode ir para o bundle inicial da app.
3. Se novas libs forem adicionadas, `vite.config.js` deve manter chunk dedicado para PDF/export.
4. E proibido importar pipeline de PDF por barrel compartilhado.
5. O Modo Consulta continua lazy-loaded e o PDF continua sob demanda.
6. Qualquer enriquecimento visual deve ser avaliado contra impacto real de bundle, modulepreload e parse/compile mobile.

---

## 6. Visao de Arquitetura Alvo

## 6.1 Decisao Arquitetural Principal

Criar um pipeline especifico para PDF de consulta medica, em vez de continuar estendendo o gerador generico legado.

### Arquitetura alvo

```text
Consultation.jsx
  -> consultationDataService (fonte clinica canonica)
  -> consultationPdfService.generateConsultationPdf()
      -> dynamic import de engine/libs de PDF
      -> consultationPdfDataBuilder
      -> consultationPdfLayout
      -> consultationPdfCharts
      -> Blob final
```

## 6.2 Responsabilidades dos Modulos

| Modulo | Responsabilidade |
|--------|------------------|
| `consultationDataService` | Fonte clinica canonica para tela e PDF |
| `consultationPdfDataBuilder` | Normalizar e enriquecer dados para o documento |
| `consultationPdfService` | Orquestracao, imports dinamicos, geracao do Blob |
| `consultationPdfLayout` | Secoes, pagina, tipografia, tabelas, hierarchy |
| `consultationPdfCharts` | Graficos/tabelas visuais com densidade controlada |
| `pdfGeneratorService` legado | Mantido apenas para relatorio generico, se necessario |

## 6.3 Decisoes de Compatibilidade

- O relatorio generico pode continuar existindo.
- O PDF de consulta passa a ter seu proprio entrypoint.
- A UX da tela de consulta deve exportar o mesmo modelo conceitual que apresenta ao usuario.

---

## 7. Estrutura Alvo do Novo Documento

## 7.1 Pagina 1 — Resumo Executivo

### Conteudo obrigatorio

- titulo: `Resumo Clinico de Consulta`
- paciente: nome, idade se disponivel, data/hora de geracao
- periodo coberto
- resumo em cards ou blocos de alta leitura:
  - adesao 30d
  - adesao 90d
  - pontualidade
  - doses tomadas/esperadas
  - tratamentos ativos
  - alertas criticos
- bloco de "Atencao nesta consulta":
  - estoque critico/baixo
  - prescricoes vencendo/vencidas
  - titulacoes ativas/transicao pendente

## 7.2 Pagina 2 — Tratamentos Ativos

Cada linha deve trazer, quando disponivel:

- `tratamento - medicacao`
- apresentacao: ex. `10 mg por comprimido`
- dose por tomada: ex. `2 comprimidos`
- frequencia: ex. `2x/dia`
- dose diaria total: ex. `40 mg/dia`
- status
- observacoes curtas relevantes

## 7.3 Pagina 3 — Adesao

- visualizacao principal simplificada e legivel
- media do periodo
- tendencia curta
- tabela complementar por tratamento quando fizer sentido
- aviso explicito quando houver dados insuficientes

## 7.4 Pagina 4 — Estoque e Prescricoes

- tabela ordenada por urgencia, nao por ordem alfabetica
- dias restantes
- quantidade atual
- consumo diario estimado
- data de vencimento de prescricao
- classificacao visual por severidade

## 7.5 Pagina 5 — Titracao e Contexto Clinico

- tratamentos em titulacao
- etapa atual
- progresso
- proxima transicao
- notas do estagio quando existirem

## 7.6 Rodape e Metadata

- numero da pagina
- data/hora de geracao
- aviso de uso informativo
- versao do relatorio

---

## 8. Requisitos Funcionais

## 8.1 RF-01 Fonte de Dados Canonica

O PDF deve consumir `consultationDataService` como base canonica do resumo clinico.

## 8.2 RF-02 Periodo Valido e Explicitado

O periodo do documento deve usar contrato valido e aparecer no cabecalho do PDF.

## 8.3 RF-03 Tratamentos com Nome Clinico Completo

Sempre que houver nome de tratamento/protocolo e medicacao, o label deve ser:

`[tratamento] - [medicacao]`

Fallbacks:

1. `tratamento - medicacao`
2. `protocolo - medicacao`
3. `medicacao`

## 8.4 RF-04 Dose Clinicamente Util

O documento deve mostrar:

- apresentacao do medicamento;
- quantidade por tomada;
- frequencia;
- dose diaria total quando calculavel;
- observacao de lacuna quando nao calculavel.

## 8.5 RF-05 Graficos ou Visualizacoes Legiveis

Nenhuma visualizacao pode ter:

- texto sobreposto;
- eixo inutilmente extenso;
- legenda truncada;
- contraste inadequado para A4;
- densidade acima da capacidade de leitura rapida.

## 8.6 RF-06 Alertas Clinicos e Operacionais

O PDF deve destacar:

- estoque critico;
- estoque baixo;
- prescricoes vencendo;
- prescricoes vencidas;
- titulacoes ativas;
- dados insuficientes.

## 8.7 RF-07 Compartilhamento sem Regressao

O PDF novo deve continuar compativel com download e compartilhamento existentes.

---

## 9. Requisitos Nao Funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | Nao aumentar o bundle inicial da webapp |
| RNF-02 | Manter lazy loading / dynamic import do pipeline PDF |
| RNF-03 | Build sem modulepreload indevido de dependencias de PDF |
| RNF-04 | Geracao do PDF com tempo percebido aceitavel em mobile |
| RNF-05 | Legibilidade boa em tela e impressao |
| RNF-06 | Falhas de dados geram estados explicitos, nao PDF enganoso |
| RNF-07 | Estrutura testavel por unidade e por regressao visual/manual |

---

## 10. Estrategia de Entrega via `/deliver-sprint`

Cada sprint abaixo foi desenhado para poder ser executado por um agente usando a skill `deliver-sprint`, respeitando:

- branch por sprint;
- validacao local;
- PR com revisao;
- pausa obrigatoria para aprovacao humana;
- atualizacao de documentacao e memoria.

### Branch naming sugerido

```text
feature/pdf-consulta-s1-arquitetura
feature/pdf-consulta-s2-dados
feature/pdf-consulta-s3-layout
feature/pdf-consulta-s4-validacao
```

---

## 11. Sprint 1 — Arquitetura, Fonte Canonica e Guardrails

**Objetivo:** separar o PDF de consulta do gerador generico e blindar performance mobile desde o inicio.

### Tarefa S1-1: Discovery Tecnico e Confirmacao de Arquivos Canonicos

| Campo | Valor |
|-------|-------|
| Agente | Coder |
| Acao | Rodar checagem de duplicatas nos arquivos de PDF/consulta e confirmar imports reais |
| Criterios de aceite | Arquivos canonicos identificados; nenhum arquivo legado indevido usado no novo plano |

### Tarefa S1-2: Definir Novo Entry Point de PDF de Consulta

| Campo | Valor |
|-------|-------|
| Output | `src/features/reports/services/consultationPdfService.js` ou path canonico equivalente |
| Descricao | Criar servico dedicado para PDF de consulta, sem reaproveitar a API generica como entry point |
| Criterios de aceite | `Consultation.jsx` deixa de chamar diretamente o gerador generico legado |

### Tarefa S1-3: Preservar Lazy Loading do Pipeline

| Campo | Valor |
|-------|-------|
| Input | `docs/standards/MOBILE_PERFORMANCE.md`, `vite.config.js`, imports atuais do pipeline |
| Descricao | Garantir `import()` dinamico para engine/libs de PDF e evitar imports estaticos transitiveiros |
| Criterios de aceite | Nenhum import top-level de libs pesadas de PDF no path do first load |

### Tarefa S1-4: Especificar Chunk Strategy

| Campo | Valor |
|-------|-------|
| Descricao | Revisar se `vendor-pdf` atual basta ou se novas libs exigem ajuste de `manualChunks` |
| Criterios de aceite | Estrategia documentada e pronta para implementacao sem regressao de bundle |

### Gate S1

- arquitetura alvo definida;
- fonte canonica definida;
- caminho de geracao desacoplado do service legado;
- guardrails de performance explicitamente implementaveis.

---

## 12. Sprint 2 — Modelo de Dados Clinicos e Builder do Documento

**Objetivo:** garantir que o documento represente o Modo Consulta com fidelidade clinica.

### Tarefa S2-1: Expandir `consultationDataService`

| Campo | Valor |
|-------|-------|
| Descricao | Expor tudo que o PDF precisa de forma canonica: labels clinicos, dose formatada, faltas de dados, prescricoes, titulacoes, estoque acionavel |
| Criterios de aceite | O PDF nao precisa montar regras clinicas improvisadas localmente se elas puderem viver no data service |

### Tarefa S2-2: Criar `consultationPdfDataBuilder`

| Campo | Valor |
|-------|-------|
| Descricao | Normalizar dataset da tela para o formato editorial do PDF |
| Output esperado | secoes prontas: `header`, `summary`, `treatments`, `adherence`, `stock`, `prescriptions`, `titration`, `disclaimers` |
| Criterios de aceite | Builder gera estados explicitos para dados ausentes/incompletos |

### Tarefa S2-3: Montar Nome Clinico do Tratamento

| Campo | Valor |
|-------|-------|
| Descricao | Implementar funcao canonica para label `[tratamento] - [medicacao]` |
| Criterios de aceite | Reaproveitavel em tela e PDF; fallback consistente |

### Tarefa S2-4: Canonizar Dose e Frequencia

| Campo | Valor |
|-------|-------|
| Descricao | Produzir representacoes humanas e clinicamente uteis de apresentacao, quantidade por tomada, frequencia e dose diaria |
| Criterios de aceite | Sem zeros silenciosos; sem misturar mg e comprimidos; lacunas explicitas |

### Tarefa S2-5: Revisar Calculo de Estoque

| Campo | Valor |
|-------|-------|
| Descricao | Trocar heuristica simplificada por calculo coerente com consumo diario esperado |
| Criterios de aceite | Dias restantes refletem quantidade por tomada e frequencia real |

### Gate S2

- builder pronto;
- dados do PDF coerentes com a tela;
- inconsistencias detectadas viram avisos, nao silencio.

---

## 13. Sprint 3 — Layout Editorial, Secoes e Visualizacoes

**Objetivo:** tornar o documento excelente em leitura rapida, compartilhamento e impressao.

### Tarefa S3-1: Redesenhar Pagina de Resumo Executivo

| Campo | Valor |
|-------|-------|
| Descricao | Reorganizar o topo do documento com mais densidade de sinal e melhor hierarchy |
| Criterios de aceite | Resumo clinico entendivel em menos de 1 minuto |

### Tarefa S3-2: Redesenhar Secao de Tratamentos

| Campo | Valor |
|-------|-------|
| Descricao | Tabela com colunas clinicamente relevantes e boa quebra de pagina |
| Criterios de aceite | Nenhum tratamento sem contexto minimo de dose/frequencia sem aviso explicito |

### Tarefa S3-3: Substituir ou Simplificar Grafico de Adesao

| Campo | Valor |
|-------|-------|
| Descricao | Reduzir densidade de labels, preferir agregacao semanal ou pontos limitados |
| Criterios de aceite | Sem sobreposicao; legenda compreensivel; contraste adequado em papel |

### Tarefa S3-4: Substituir Grafico de Estoque por Visualizacao Util

| Campo | Valor |
|-------|-------|
| Descricao | Priorizar tabela ordenada por urgencia com apoio visual simples |
| Criterios de aceite | Visualizacao legivel com nomes completos, sem truncamento destrutivo |

### Tarefa S3-5: Adicionar Prescricoes e Titracao ao Documento

| Campo | Valor |
|-------|-------|
| Descricao | Criar secoes clinicas hoje presentes na tela e ausentes no PDF |
| Criterios de aceite | Documento final cobre contexto terapeutico alem da adesao |

### Tarefa S3-6: Melhorar Cabecalho, Rodape e Paginacao

| Campo | Valor |
|-------|-------|
| Descricao | Adicionar metadata, pagina, versao e consistencia visual |
| Criterios de aceite | Todas as paginas tem identificacao e orientacao minima |

### Gate S3

- documento visualmente legivel;
- hierarquia editorial coerente;
- nenhuma secao critica ausente.

---

## 14. Sprint 4 — Validacao, Performance, Regressao e Rollout

**Objetivo:** fechar a entrega com qualidade de software, sem regressao de UX e bundle.

### Tarefa S4-1: Testes Unitarios do Builder / Formatadores

| Campo | Valor |
|-------|-------|
| Descricao | Cobrir nome clinico, dose formatada, sinais de dados incompletos e ordenacao por urgencia |
| Criterios de aceite | Cenarios edge case cobertos |

### Tarefa S4-2: Testes do Service de PDF

| Campo | Valor |
|-------|-------|
| Descricao | Validar output minimo, tratamento de erro e contratos de secao |
| Criterios de aceite | Falhas de dados nao derrubam geracao silenciosamente |

### Tarefa S4-3: Checklist Visual Manual do PDF

| Campo | Valor |
|-------|-------|
| Descricao | Gerar PDFs com cenarios reais e inspecionar visualmente |
| Criterios de aceite | Zero sobreposicao, zero truncamento relevante, boa legibilidade |

### Tarefa S4-4: Verificacao de Performance Mobile

| Campo | Valor |
|-------|-------|
| Descricao | Confirmar que `vendor-pdf` permanece lazy e nao aparece no first load |
| Criterios de aceite | Build e Network confirmam chunk sob demanda |

### Tarefa S4-5: Compatibilidade com Compartilhamento

| Campo | Valor |
|-------|-------|
| Descricao | Validar download, compartilhamento nativo e fallback por link |
| Criterios de aceite | Sem quebra de UX ja existente |

### Gate S4

- validacao local completa;
- PDF visualmente aprovado;
- performance mobile preservada;
- pronto para PR e review.

---

## 15. Backlog de Implementacao por Arquivo

### Arquivos candidatos a criar

```text
src/features/reports/services/consultationPdfService.js
src/features/reports/services/consultationPdfDataBuilder.js
src/features/reports/services/consultationPdfLayout.js
src/features/reports/services/consultationPdfCharts.js
src/features/reports/services/__tests__/consultationPdfDataBuilder.test.js
src/features/reports/services/__tests__/consultationPdfService.test.js
```

### Arquivos candidatos a modificar

```text
src/views/Consultation.jsx
src/features/consultation/services/consultationDataService.js
src/features/reports/services/pdfGeneratorService.js
vite.config.js
docs/standards/MOBILE_PERFORMANCE.md
```

### Observacao

O agente executor deve confirmar caminhos canonicos reais antes da implementacao, seguindo `R-001` e `R-002`.

---

## 16. Criterios de Aceite Binarios

## 16.1 Produto

- [ ] O PDF de consulta nao usa mais o entry point generico legado como caminho principal.
- [ ] O resumo do topo inclui mais do que score/taken/expected/streak.
- [ ] A lista de tratamentos mostra dose clinicamente util.
- [ ] O nome do tratamento aparece como `[tratamento] - [medicacao]` quando houver dados.
- [ ] Prescricoes e titulacoes aparecem no documento.

## 16.2 Visual

- [ ] Nenhum grafico com legenda sobreposta.
- [ ] Nenhum eixo inutilmente longo.
- [ ] Nenhum nome essencial truncado a ponto de perder significado.
- [ ] PDF legivel em A4 portrait.
- [ ] Cabecalho e rodape consistentes.

## 16.3 Dados

- [ ] Periodo valido e exibido.
- [ ] Datas tratadas corretamente em timezone local.
- [ ] Dias restantes de estoque coerentes com consumo esperado.
- [ ] Lacunas de cadastro/dados sao explicitadas.

## 16.4 Performance

- [ ] Dependencias pesadas de PDF continuam em dynamic import.
- [ ] `vendor-pdf` ou chunk equivalente nao aparece no first load.
- [ ] Nenhum barrel export reintroduz modulepreload indevido.
- [ ] `npm run build` passa.

## 16.5 Processo

- [ ] Execucao segue `/deliver-sprint`.
- [ ] `npm run validate:agent` executado antes de push.
- [ ] PR criado com pausa obrigatoria para review/aprovacao.
- [ ] Agente nao faz self-merge.

---

## 17. Protocolo de Validacao

### 17.1 Validacao Tecnica

```bash
npm run lint
npm run validate:agent
npm run build
```

### 17.2 Validacao de Bundle / Lazy Loading

```bash
npm run build 2>&1 | grep -E "vendor-pdf|jspdf|html2canvas"
```

Esperado:

- chunk de PDF separado;
- nada de `jspdf` no carregamento inicial da app.

### 17.3 Validacao Visual

Gerar e inspecionar cenarios:

1. paciente com 1 tratamento simples;
2. paciente com muitos tratamentos;
3. paciente com dose sem cadastro completo;
4. paciente com estoque critico;
5. paciente com prescricao vencendo;
6. paciente com titulacao ativa;
7. paciente com poucos logs recentes.

### 17.4 Validacao Clinica de Conteudo

Checklist manual:

- medico entende rapidamente tratamento atual?
- paciente entende prioridades antes da consulta?
- existe algum numero potencialmente enganoso?
- alguma lacuna de dados esta sendo mascarada?

---

## 18. Riscos e Mitigacoes

| Risco | Severidade | Mitigacao |
|------|------------|-----------|
| Continuar divergencia tela vs PDF | Alta | PDF usar `consultationDataService` como fonte canonica |
| Enriquecimento visual quebrar mobile performance | Alta | Dynamic import, chunk dedicado, verificacao pos-build |
| Dose diaria calculada incorretamente | Alta | Canonizar builder + testes de formatacao e calculo |
| PDF ficar longo demais e perder escaneabilidade | Media | Resumo executivo forte + ranking por prioridade |
| Reaproveitamento excessivo do service legado manter bugs | Alta | Novo entry point dedicado |
| Outliers destruirem escala de graficos | Media | Agregacao, bucketing ou substituicao por tabela |
| Dados ausentes serem lidos como zero real | Alta | Estados explicitos de dados insuficientes |

---

## 19. Estrategia de Rollback

Se a entrega parcial introduzir regressao:

1. manter o gerador legado disponivel como fallback temporario;
2. proteger o novo caminho por branch/PR e rollout controlado;
3. reverter apenas o entry point do Modo Consulta se necessario;
4. nunca remover a estrategia de lazy loading durante rollback.

---

## 20. Checklist do Orquestrador

Antes de iniciar cada sprint:

- [ ] Ler `.memory/rules.md`
- [ ] Ler `.memory/anti-patterns.md`
- [ ] Confirmar arquivos canonicos com `find`/`rg`
- [ ] Confirmar branch correta
- [ ] Confirmar guardrails de performance mobile

Antes de abrir PR:

- [ ] `npm run validate:agent`
- [ ] `npm run build`
- [ ] Revisao visual do PDF gerado
- [ ] Revisao de bundle/lazy loading
- [ ] Atualizacao de documentacao relevante

Antes de considerar a sprint concluida:

- [ ] PR criado
- [ ] Gemini review aguardado/aplicado
- [ ] Status reportado ao usuario
- [ ] Aguardando aprovacao humana para merge

---

## 21. Definicao de Sucesso

Consideraremos esta iniciativa bem-sucedida quando:

1. o PDF for claramente melhor que o atual para consulta medica real;
2. paciente e medico conseguirem extrair informacao acionavel rapidamente;
3. nao houver regressao de performance mobile;
4. o pipeline ficar preparado para evolucoes futuras sem improviso estrutural.

---

## 22. Comando de Execucao Sugerido

Para cada sprint:

```text
/deliver-sprint plans/roadmap_v4/EXEC_SPEC_PDF_CONSULTA_MEDICA.md
```

O agente executor deve indicar no inicio qual sprint/etapa esta implementando e respeitar os hard stops de review e aprovacao definidos pelo projeto.
