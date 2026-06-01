# Feature Specification: Voice Dose Registration

**Feature Directory**: `plans/specs/016-voice-dose-registration`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §2. Registro e Resumo de Doses por Voz, §2. V01

---

## Context

Para simplificar radicalmente a usabilidade diária e estender a acessibilidade para idosos com tremores, baixa acuidade visual ou pouca familiaridade digital, o Dosiq deve prover uma funcionalidade de controle de doses comandada por voz. Esta feature especifica o módulo de captura de áudio nativo (STT - Speech to Text) para mobile e web, acoplado a uma engine local de NLP Fuzzy que decodifica intenções e executa o check-in automático de medicamentos.

---

## User Scenarios & Testing

### User Story 1 - Check-in Rápido por Voz (Priority: P1)
**Why this priority**: Evita digitação e cliques complexos para o registro diário de medicamentos.
**Independent Test**: Clicar no botão de microfone, falar *"Tomei a Losartana agora"*, verificando se o transcritor capta a frase e a engine local registra com sucesso o check-in da Losartana na tabela `dose_instances`.

**Acceptance Scenarios**:
1. Given Dona Maria com o app aberto na Home, When ela segurar o botão de microfone e disser *"Tomei a Metformina"* no fuso GMT-3, Then o app deve transcrever a fala no idioma `pt-BR` e disparar a engine fuzzy.
2. When a engine fuzzy casar a intenção com o medicamento "Metformina" de forma unívoca, Then deve registrar a dose correspondente do período como tomada e emitir feedback sonoro/visual de confirmação.

### User Story 2 - Resolução Fuzzy e Ambiguidade (Priority: P2)
**Why this priority**: Protege contra registros errados quando há medicamentos parecidos cadastrados.
**Independent Test**: Falar *"Tomei o remédio de pressão"*, verificar que a engine Fuzzy local retorna opções explícitas de confirmação quando não consegue decidir de forma isolada.

**Acceptance Scenarios**:
1. Given que Dona Maria possui cadastrados "Losartana 50mg" e "Amlodipina 5mg", When ela disser *"Tomei o de pressão"*, Then o app deve exibir botões de escolha rápida para ela selecionar qual dos dois foi tomado.

---

## Edge Cases

- **Incompatibilidade Webkit/Safari iOS (PWA):** A Web Speech API (`SpeechRecognition`) possui sérias limitações de privacidade e não funciona em navegadores PWA se o site não estiver rodando sob protocolo HTTPS seguro, ou em webviews do iOS com restrição de media capabilities. O app web deve prover graceful degradation, ocultando o ícone de microfone caso as APIs do navegador retornem `undefined`.
- **Ruídos de Fundo Ambientais:** Em ambientes ruidosos a acurácia de transcrição cai. A engine fuzzy local deve possuir tolerância (limiar de distância Levenshtein adaptável) para casar fonemas próximos, minimizando falhas de match.

---

## Requirements

### Functional Requirements

- **FR-001:** Adicionar botão proeminente de microfone (mínimo de 60px) na Home e formulários do aplicativo móvel nativo e PWA.
- **FR-002:** Captura e reconhecimento de voz (STT) em português `pt-BR` nativo no mobile utilizando a biblioteca nativa `react-native-voice`.
- **FR-003:** Captura e reconhecimento de voz no PWA/Web utilizando o wrapper nativo da **Web Speech API** com graceful degradation de visibilidade.
- **FR-004:** Desenvolver engine local de NLP Fuzzy para processar strings transcritas e efetuar o casamento fuzzy (distância de edição Levenshtein) contra o nome dos medicamentos ativos.
- **FR-005:** Exibir confirmação e feedback de sucesso visível na tela e áudio tátil de vibração no mobile após check-in efetuado.

### Key Entities

- **TranscriptionResult:** Payload contendo a string transcrita e nível de confiança do SO.
- **MedicineName:** Nome de cadastro do medicamento ativo.

---

## Success Criteria

- **SC-001:** Casamento fuzzy com acurácia de intenção pt-BR superior a 85% em condições normais.
- **SC-002:** Feedback visual e registro de doses concluído em menos de 1 segundo após o término da fala do usuário.
