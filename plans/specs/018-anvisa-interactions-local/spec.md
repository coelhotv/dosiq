# Feature Specification: ANVISA Local Interactions

**Feature Directory**: `plans/specs/018-anvisa-interactions-local`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §3. Base de Interações Medicamentas, §3. Implementação
- `plans/backlog-unified_app_2026/ANALISE_FONTES_INTERACOES.md`

---

## Context

Para proteger o paciente e seu cuidador contra erros posológicos potencialmente graves (como a inativação de anti-hipertensivos ou hemorragias causadas pela administração conjunta de anticoagulantes e anti-inflamatórios), o Dosiq deve incorporar um motor de análise clínica local. Esta feature especifica o validador de interações medicamentosas baseado em um seed estático contendo pares clínicos selecionados, executado inteiramente sob demanda por importações dinâmicas (lazy-loading) no formulário de cadastro de remédios.

---

## User Scenarios & Testing

### User Story 1 - Alerta Crítico de Interação (Priority: P1)
**Why this priority**: Evita riscos imediatos de saúde ao paciente por automedicação.
**Independent Test**: Tentar cadastrar Ibuprofeno no formulário de medicamentos tendo Losartana já ativa na lista de Dona Maria, verificando que um modal de SmartAlert Moderado de cor de advertência é exibido antes de concluir o cadastro.

**Acceptance Scenarios**:
1. Given que Dona Maria possui cadastrado "Losartana potássica" nos seus medicamentos ativos, When ela tentar adicionar "Ibuprofeno" no formulário de cadastro, Then o sistema deve carregar o motor de interações e disparar o SmartAlert.
2. The SmartAlert deve exibir a descrição clínica em português: *"AINEs podem reduzir o efeito anti-hipertensivo e aumentar o risco de lesão renal."* e a recomendação *"Monitorar pressão arterial. Preferir paracetamol para dor."*.
3. The modal deve exibir em destaque o disclaimer obrigatório: *"Base parcial de interações conhecidas. Consulte seu médico para referência completa."*.

### User Story 2 - Cadastro Sem Conflitos (Priority: P1)
**Why this priority**: Permite um fluxo fluido e sem atritos de formulário para medicamentos seguros.
**Independent Test**: Cadastrar "Metformina" tendo "Losartana potássica" ativa, verificando que o cadastro é concluído instantaneamente sem modais de aviso.

**Acceptance Scenarios**:
1. Given "Losartana potássica" ativa, When Dona Maria cadastrar "Metformina", Then o formulário deve salvar com sucesso sem exibir modais de interações.

---

## Edge Cases

- **Comparação Fonética/Fuzzy de Nomes:** Pacientes podem digitar nomes comerciais com variações (ex: *"Losartana"*, *"Losartan"*, *"Aradois"*). O motor de interações deve normalizar os nomes clínicos, removendo acentos e convertendo para minúsculas, e usar buscas fonéticas parciais para casar contra a substância ativa do JSON (losartana potássica).
- **Sobrecarga de Bundle Inicial:** A base JSON de interações medicamentosas pode inflar o tamanho do download de entrada do PWA se importada diretamente. A importação da base e do serviço de validação deve ser realizada de forma 100% dinâmica (lazy-loaded, AP-B03) apenas no evento de submissão do formulário.

---

## Requirements

### Functional Requirements

- **FR-001:** Mapear e carregar o arquivo estático com 50-80 pares de alta relevância clínica no Brasil: `packages/core/src/interactions/interactions.json`.
- **FR-002:** Toda a validação de interações deve ser executada inteiramente no cliente (client-side) de forma assíncrona e lazy-loaded sob demanda no submit do formulário de medicamentos.
- **FR-003:** Exibição de modal SmartAlert dinâmico colorido codificado por gravidade do conflito (Leve, Moderada, Grave, Contraindicada).
- **FR-004:** Inclusão obrigatória de disclaimer clínico legível na modal de alerta.
- **FR-005:** Exibir as interações conhecidas em destaque no Modo Consulta para a equipe médica.

### Key Entities

- **InteractionPair:** Mapeamento do par de substâncias ativas, descrição, gravidade e recomendação de conduta.
- **FormMedicine:** Dados provisórios inseridos no formulário.

---

## Success Criteria

- **SC-001:** Cobertura de 100% de testes unitários de isolamento sobre a engine de casamentos fuzzy no core.
- **SC-002:** Bundle principal de download gzip do PWA inalterado (lazy-loading obrigatório).
