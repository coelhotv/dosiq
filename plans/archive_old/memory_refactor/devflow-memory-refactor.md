# DEVFLOW Memory Refactor

## Objetivo

Reduzir o custo de bootstrap do `/devflow` sem perda real de qualidade de software, preservando os guardrails operacionais mais relevantes e movendo regras e anti-padrões específicos, derivados ou históricos para camadas de carregamento sob demanda.

## Problema Atual

O DEVFLOW atual assume carga integral de:

- `.agent/memory/rules.json`
- `.agent/memory/anti-patterns.json`
- `.agent/memory/knowledge.json`

O desenho conceitual é index-first, mas na prática existem quatro problemas:

1. Cardinalidade alta demais no bootstrap padrão.
2. Repetição semântica entre regras e anti-padrões.
3. Itens específicos de campanha, componente ou incidente convivendo com guardrails universais.
4. Drift estrutural da memória:
   - títulos do índice divergindo dos arquivos em `rules_detail/`
   - `related_rule` inválidos em `anti-patterns.json`
   - referências legadas a `.memory/*.md`

## Resultado Esperado

Ao fim do refactor, o DEVFLOW deve operar com três camadas de memória:

- `quente`: sempre carregada no bootstrap
- `morna`: carregada por contexto/goal/tags
- `fria`: histórico, exemplos, incidentes específicos e conhecimento arquivado

Meta operacional:

- reduzir em pelo menos 75% o volume de `rules + anti-patterns` carregado no bootstrap base
- manter cobertura dos guardrails que previnem regressões recorrentes
- tornar o carregamento dependente de contexto, e não de volume bruto
- corrigir integridade estrutural da memória antes de otimizar a lógica de bootstrap

## Escopo

Inclui:

- redefinição da taxonomia de memória DEVFLOW
- consolidação de regras redundantes
- consolidação de anti-padrões derivados
- criação de camada `core/hot`
- separação de packs contextuais
- arquivamento de itens históricos ou específicos demais
- correção de inconsistências de índice
- atualização da skill `/devflow` e da documentação de operação

Não inclui:

- reescrita completa de `knowledge.json`
- distill/export global base
- mudança de contratos, ADRs ou journal além do mínimo necessário para coerência documental

## Artefatos em Escopo

- `.agent/DEVFLOW.md` (symlink para a versão original em ~/SKILLS/devflow)
- `/Users/coelhotv/SKILLS/devflow/SKILL.md`
- `.agent/memory/rules.json`
- `.agent/memory/anti-patterns.json`
- `.agent/memory/knowledge.json`
- `.agent/memory/rules_detail/*`
- `.agent/memory/anti-patterns_detail/*`
- `AGENTS.md`

## Diagnóstico Consolidado

### Números observados

- `rules.json`: 107 entradas
- `anti-patterns.json`: 97 entradas
- tamanho bruto combinado: ~94.5 KB
- estimativa de bootstrap bruto atual: ~23.6k tokens

### Oportunidade de redução

Bootstrap quente proposto:

- 24 regras core
- 12 anti-padrões core

Estimativa:

- redução de 82.4% das entradas carregadas no bootstrap base
- economia aproximada de ~20k tokens por sessão

### Inconsistências a corrigir

- dezenas de `rules_detail/R-xxx.md` não correspondem semanticamente ao índice
- há `related_rule` inválidos, vazios, compostos ou apontando para AP em `anti-patterns.json`
- `R-065` e itens em `knowledge.json` ainda referenciam `.memory/rules.md` e `.memory/anti-patterns.md`
- parte da memória mistura:
  - guardrails universais
  - regras de wave
  - heurísticas de design
  - tech debt conhecido
  - postmortems de componente

## Princípios do Refactor

1. Qualidade primeiro.
   O objetivo é reduzir tokens, não reduzir proteção.

2. Guardrail universal sempre vence heurística local.
   O bootstrap quente só deve conter regras que valem para a maioria das sessões.

3. Anti-padrão derivado não precisa competir com a regra-mãe no índice quente.
   Sempre que possível, o AP vira exemplo negativo da regra.

4. Regra específica de componente não entra no core.
   Ela deve ser carregada apenas quando o contexto tocar aquele componente/domínio.

5. Histórico não deve poluir bootstrap operacional.
   Incidentes passados continuam disponíveis, mas em camada fria.

6. Integridade vem antes de otimização.
   Não faz sentido acelerar bootstrap se o índice aponta para detalhes errados.

## Nova Arquitetura de Memória

### Camada 1: Hot Core

Carregada em toda sessão DEVFLOW.

Critérios:

- previne regressão frequente
- vale para a maioria dos goals
- é operacionalmente acionável
- não depende de contexto muito específico

### Camada 2: Warm Packs

Carregada por goal, tags, stack ou arquivos em escopo.

Exemplos:

- `react-ui`
- `supabase-data`
- `infra-api`
- `telegram`
- `adherence-reporting`
- `design-system`
- `testing-deep`

### Camada 3: Cold Archive

Não participa do bootstrap normal.

Contém:

- regras de campanha/wave
- tech debt conhecido
- incidentes históricos
- APs órfãos
- exemplos negativos absorvidos por regras-mãe
- heurísticas muito específicas de componente/persona/layout

## Taxonomia Proposta

### Hot Core Rules

Estas devem permanecer no bootstrap padrão:

- `R-001` Duplicate File Check
- `R-002` Path Alias Verification
- `R-003` Import Existence Check
- `R-010` Hook Declaration Order
- `R-020` Timezone / Local Dates
- `R-051` Validate Before Push
- `R-060` No Self-Merge for Code Agents
- `R-061` Mandatory Review Pause
- `R-062` Quality Over Speed
- `R-063` Process as Protection
- `R-065` Read Memory Before Coding
- `R-070` No setTimeout in act() Blocks
- `R-071` Mock External Services in Hook Tests
- `R-072` Always Resolve Dangling Promises
- `R-073` Use Fake Timers for Timer-Dependent Tests
- `R-074` Use validate:agent for Agent Sessions
- `R-082` Zod-SQL Schema Synchronization
- `R-089` Database Column Existence Check
- `R-092` Spec Path Verification Before Edit
- `R-104` `||` vs `??` para zero válido
- `R-106` testes com `Date` e `setHours`
- `R-110` guard clauses após hooks
- `R-121` Zod Validation for Service Parameters
- `R-131` parseLocalDate em queries de data ao Supabase

### Hot Core Anti-Patterns

Estes devem permanecer no bootstrap padrão:

- `AP-001`
- `AP-004`
- `AP-005`
- `AP-012`
- `AP-S01`
- `AP-S08`
- `AP-T02`
- `AP-T06`
- `AP-T07`
- `AP-T10`
- `AP-094`
- `AP-095`

### Warm Packs de Regras

#### Pack A: File / Path Integrity

- `R-001`
- `R-002`
- `R-003`
- `R-092`

Observação:
este pack praticamente coincide com o core e pode ser referenciado internamente como subgrupo lógico, sem duplicar dados.

#### Pack B: Review / Validation Protocol

- `R-051`
- `R-060`
- `R-061`
- `R-062`
- `R-063`
- `R-065`
- `R-074`

#### Pack C: Date / Timezone Safety

- `R-020`
- `R-106`
- `R-114`
- `R-129`
- `R-131`

#### Pack D: Test Async / Cleanup Hygiene

- `R-070`
- `R-072`
- `R-073`
- `R-076`
- `R-077`
- `R-078`
- `R-079`
- `R-081`

#### Pack E: Schema / Data Contract Safety

- `R-021`
- `R-022`
- `R-082`
- `R-085`
- `R-089`
- `R-121`
- `R-130`

#### Pack F: React Interface / Hook Safety

- `R-010`
- `R-103`
- `R-107`
- `R-109`
- `R-110`
- `R-133`
- `R-134`
- `R-136`

#### Pack G: Infra / API Constraints

- `R-040`
- `R-041`
- `R-042`
- `R-083`
- `R-084`
- `R-086`
- `R-087`
- `R-088`
- `R-090`
- `R-091`
- `R-132`

#### Pack H: Adherence / Reporting / Mobile

- `R-024`
- `R-025`
- `R-025-1`
- `R-026`
- `R-111`
- `R-112`
- `R-113`
- `R-115`
- `R-117`
- `R-125`
- `R-126`
- `R-127`
- `R-128`
- `R-146`
- `R-148`
- `R-149`
- `R-150`
- `R-155`

#### Pack I: Telegram

- `R-030`
- `R-031`
- `R-032`
- `R-157`

#### Pack J: Design / UI Heuristics

- `R-095`
- `R-096`
- `R-097`
- `R-098`
- `R-099`
- `R-100`
- `R-101`
- `R-102`
- `R-105`
- `R-108`
- `R-116`
- `R-118`
- `R-119`
- `R-120`
- `R-135`
- `R-137`
- `R-138`
- `R-139`
- `R-140`
- `R-151`
- `R-152`
- `R-153`
- `R-154`
- `R-156`

### Cold Archive Candidates

Estas regras devem sair do bootstrap normal e ir para camada fria ou packs contextuais estritos:

- `R-011`
- `R-032`
- `R-050`
- `R-093`
- `R-095`
- `R-098`
- `R-099`
- `R-100`
- `R-101`
- `R-102`
- `R-108`
- `R-116`
- `R-118`
- `R-119`
- `R-135`
- `R-137`
- `R-138`
- `R-139`
- `R-140`
- `R-151`
- `R-152`
- `R-153`
- `R-154`
- `R-155`
- `R-156`
- `R-157`

Motivos predominantes:

- incident count zero ou baixo demais
- especificidade de componente
- regra de campanha/redesign
- utilidade restrita a contexto local

### Anti-Patterns para Absorção pela Regra-Mãe

Estes APs podem deixar de existir como índice quente e virar exemplos negativos em `rules_detail/`:

- `AP-002`
- `AP-003`
- `AP-006`
- `AP-007`
- `AP-008`
- `AP-009`
- `AP-010`
- `AP-011`
- `AP-A02`
- `AP-A04`
- `AP-S02`
- `AP-S04`
- `AP-S05`
- `AP-S06`
- `AP-S07`
- `AP-S09`
- `AP-S11`
- `AP-T03`
- `AP-T04`
- `AP-T05`

### Anti-Patterns para Camada Fria

Estes devem ser arquivados por serem históricos, órfãos ou específicos demais:

- `AP-A03`
- `AP-W04`
- `AP-W08`
- `AP-W09`
- `AP-W18`
- `AP-W20`
- `AP-W21`
- `AP-W22`
- `AP-W23`
- `AP-D04`
- `AP-D05`
- `AP-D06`
- `AP-B01`
- `AP-B02`
- `AP-B04`
- `AP-P17`
- `AP-T08`
- `AP-T09`
- `AP-H01`
- `AP-H02`
- `AP-H03`
- `AP-W24`
- `AP-W25`

## Fases de Execução

## Fase 0 — Preparação e Segurança

Objetivo:
congelar a baseline e evitar refactor em memória corrompida.

Tarefas:

- criar branch específica para o refactor
- registrar spec e objetivo em `state.json` se for executado dentro do DEVFLOW
- inventariar arquivos existentes em `.agent/memory/`
- salvar snapshot de:
  - `rules.json`
  - `anti-patterns.json`
  - `knowledge.json`
  - `rules_detail/`
  - `anti-patterns_detail/`
- mapear referências a `.memory/*.md` no repositório

Entregáveis:

- snapshot local ou commit-base seguro
- checklist de inconsistências estruturais

Critério de aceite:

- existe baseline reversível antes de qualquer mutação

## Fase 1 — Saneamento Estrutural

Objetivo:
garantir integridade mínima dos índices antes da reorganização.

Tarefas:

- corrigir `related_rule` inválido, vazio, composto ou apontando para AP
- corrigir entradas malformadas:
  - `AP-W12`
  - `AP-B02`
  - `AP-P16`
  - `AP-096`
  - `AP-97`
- alinhar títulos e conteúdo entre `rules.json` e `rules_detail/`
- alinhar títulos e conteúdo entre `anti-patterns.json` e `anti-patterns_detail/`
- criar `R-157` detail se a regra permanecer ativa
- remover referências a `.memory/rules.md` e `.memory/anti-patterns.md` de:
  - `R-065`
  - `knowledge.json`
  - `knowledge_detail` relevante

Entregáveis:

- índices coerentes
- detalhes coerentes
- zero referências operacionais ao legado `.memory/*.md`

Critério de aceite:

- toda regra ativa aponta para detalhe válido e semanticamente correto
- todo AP ativo possui relacionamento coerente

## Fase 2 — Reclassificação Hot / Warm / Cold

Objetivo:
separar o que é bootstrap obrigatório do que é carregamento contextual.

Tarefas:

- adicionar metadado de camada em `rules.json`
- adicionar metadado de camada em `anti-patterns.json`
- classificar cada entrada como:
  - `hot`
  - `warm`
  - `cold`
- adicionar metadado opcional `pack`
- adicionar metadado opcional `derived_from` para APs absorvidos

Estrutura sugerida:

```json
{
  "id": "R-001",
  "title": "Duplicate File Check",
  "status": "active",
  "layer": "hot",
  "pack": "file-integrity",
  "bootstrap_default": true
}
```

Para AP derivado:

```json
{
  "id": "AP-003",
  "status": "active",
  "layer": "warm",
  "pack": "file-integrity",
  "related_rule": "R-003",
  "derived_from_rule": true
}
```

Entregáveis:

- índices enriquecidos com classificação operacional

Critério de aceite:

- toda entrada ativa pertence a uma camada
- todo item `hot` tem racional claro

## Fase 3 — Consolidação Semântica

Objetivo:
reduzir cardinalidade lógica sem perder cobertura.

Tarefas:

- fundir micro-regras sob regras-mãe por pack
- incorporar exemplos negativos nos `rules_detail/`
- reduzir APs derivados como entradas independentes do bootstrap
- manter ID legado apenas se houver valor histórico ou rastreabilidade necessária

Estratégia:

- preferir consolidar sem apagar imediatamente
- primeiro marcar como `cold` ou `derived`
- só remover entradas quando a nova representação estiver validada

Consolidações prioritárias:

- `R-051 + R-060 + R-061 + R-062 + R-063 + R-065 + R-074`
- `R-020 + R-106 + R-114 + R-129 + R-131`
- `R-070 + R-072 + R-073 + R-076 + R-077 + R-078 + R-079 + R-081`
- `R-021 + R-022 + R-082 + R-085 + R-089 + R-121 + R-130`
- `R-010 + R-103 + R-107 + R-109 + R-110 + R-133 + R-134 + R-136`

Entregáveis:

- packs consolidados
- detalhes revisados com exemplos e contraexemplos

Critério de aceite:

- a navegação conceitual da memória fica menor e mais clara do que a atual

## Fase 4 — Refactor do Bootstrap DEVFLOW

Objetivo:
fazer o `/devflow` carregar contexto útil em vez de contexto máximo.

Tarefas:

- alterar `/Users/coelhotv/SKILLS/devflow/SKILL.md`
- alterar `.agent/DEVFLOW.md`
- substituir a lógica “load all indexes” por:
  - carregar somente `hot`
  - identificar `packs` relevantes por goal/tags/arquivos
  - carregar `warm` sob demanda
  - ignorar `cold` no bootstrap

Fluxo proposto:

1. ler `state.json`
2. ler `rules.json` e `anti-patterns.json`
3. filtrar `layer == hot`
4. inferir packs por:
   - goal
   - tags
   - stack
   - arquivos em escopo
5. carregar subset `warm`
6. carregar detalhes apenas para `hot + warm` relevantes
7. não tocar em `cold` exceto quando explicitamente solicitado

Heurísticas mínimas de pack:

- arquivos em `src/features/*/components` → `react-ui`
- arquivos em `src/features/*/services`, `src/services`, `src/schemas` → `supabase-data`
- arquivos em `api/` → `infra-api`
- arquivos em `server/bot/` → `telegram`
- goal com `dashboard`, `adherence`, `pdf`, `consultation` → `adherence-reporting`
- goal com `css`, `layout`, `design`, `ux`, `modal`, `button` → `design-system`

Entregáveis:

- bootstrap reduzido e contextual

Critério de aceite:

- DEVFLOW não carrega mais todo o índice “por default”
- bootstrap base usa somente `hot`

## Fase 5 — Arquivamento Operacional

Objetivo:
retirar ruído sem perder rastreabilidade.

Tarefas:

- mover itens `cold` para estado explicitamente arquivado ou não-bootstrap
- manter histórico consultável
- criar convenção para regras/APs arquivados:
  - `status: archived`
  - ou `layer: cold`
- documentar política de expiração/revisão

Política recomendada:

- regra específica de campanha que não disparou em 2 ciclos de revisão vira `cold`
- AP histórico sem recorrência vira `cold`
- tech debt conhecido não entra em bootstrap; vira nota de contexto ou `cold`

Entregáveis:

- índice ativo menor
- histórico preservado

Critério de aceite:

- o bootstrap operacional não depende de regras de wave antiga

## Fase 6 — Atualização da Documentação

Objetivo:
alinhar o comportamento do DEVFLOW com a documentação oficial do projeto.

Tarefas:

- atualizar `AGENTS.md`
- atualizar `/Users/coelhotv/SKILLS/devflow/SKILL.md`
- documentar:
  - conceito de `hot/warm/cold`
  - packs contextuais
  - como promover item novo para `hot`
  - quando arquivar um item

Entregáveis:

- documentação consistente e sem referências legadas

Critério de aceite:

- a documentação operacional descreve o comportamento real do bootstrap

## Fase 7 — Validação

Objetivo:
garantir que a redução de tokens não reduziu qualidade de decisão.

Tarefas:

- simular bootstrap em cenários diferentes:
  - refactor React UI
  - ajuste Supabase/schema
  - fix em `api/`
  - bug de timezone
  - ajuste Telegram
- verificar se os packs corretos são carregados
- comparar:
  - antes: contexto bruto
  - depois: contexto carregado
- validar se os guardrails críticos continuam aparecendo

Checklist de validação:

- duplicate files ainda é carregado no bootstrap
- timezone safety ainda aparece em goals de data
- validate/review/self-merge continuam no core
- testes async continuam protegidos no core
- schema/data contract continuam protegidos
- packs contextuais aparecem corretamente

Entregáveis:

- relatório curto de validação
- ajustes finais de classificação

Critério de aceite:

- nenhum dos cenários críticos fica sem guardrail equivalente

## Ordem Recomendada de Implementação

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 4
5. Fase 3
6. Fase 5
7. Fase 6
8. Fase 7

Justificativa:

- Fase 1 vem cedo porque não vale reorganizar índice inconsistente.
- Fase 2 precisa existir antes do bootstrap novo.
- Fase 4 pode ser aplicada assim que a taxonomia estiver pronta.
- Fase 3 pode continuar depois, consolidando sem bloquear o novo modelo.

## Estratégia de Rollout

### Etapa 1

Adicionar `layer` e `pack` sem mudar o comportamento do bootstrap.

### Etapa 2

Habilitar bootstrap `hot + warm` por feature flag documental ou regra temporária.

### Etapa 3

Desligar de vez o carregamento integral.

### Etapa 4

Arquivar itens frios e enxugar APs derivados.

## Riscos

### Risco 1

Arquivar cedo demais uma regra útil.

Mitigação:

- usar `cold` antes de remover
- validar em cenários reais

### Risco 2

Bootstrap novo deixar de carregar um pack relevante.

Mitigação:

- heurísticas por arquivo + goal
- fallback manual: “load additional packs”

### Risco 3

Quebra de rastreabilidade histórica.

Mitigação:

- não apagar IDs de imediato
- preservar mapping de consolidação

### Risco 4

Consolidação semântica esconder nuance importante.

Mitigação:

- manter nuance em `rules_detail/` como exemplos e notas

## Critérios de Aceite Finais

- bootstrap padrão não carrega mais todas as regras/APs ativas
- existe camada `hot`, `warm`, `cold` documentada e aplicada
- o core contém apenas guardrails universais
- regras específicas de campanha/componente estão fora do bootstrap base
- APs derivados deixam de inflar o índice quente
- referências a `.memory/*.md` foram eliminadas do fluxo oficial
- índices e details estão semanticamente alinhados
- DEVFLOW continua cobrindo os mesmos riscos críticos com menos contexto carregado

## Backlog Pós-Refactor

- aplicar a mesma lógica em `knowledge.json`
- criar script de auditoria de integridade para:
  - IDs sem detail
  - detail divergente do índice
  - `related_rule` inválido
  - regras sem `layer`
  - regras sem `pack`
- criar comando de distill específico para memória operacional
- avaliar export seletivo para `global_base`

## Definition of Done

O refactor estará concluído quando:

- o DEVFLOW carregar apenas o core quente por padrão
- packs mornos forem carregados por contexto
- itens frios estiverem fora do bootstrap
- a documentação refletir esse comportamento
- a integridade dos índices estiver saneada
- a qualidade de software preservada puder ser demonstrada em cenários de teste representativos
