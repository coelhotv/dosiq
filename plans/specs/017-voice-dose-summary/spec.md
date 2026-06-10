# Feature Specification: Voice Dose Summary

**Feature Directory**: `plans/specs/017-voice-dose-summary`  
**Created**: 2026-06-01  
**Status**: draft
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_8_SMART_WOW_FACTOR.md` §2. Registro e Resumo de Doses por Voz, §2. V02

---

## Context

Para deficientes visuais e idosos com dificuldades de leitura de grades de tabelas clínicas no celular, o Dosiq deve prover um sintetizador falado de dados posológicos. Esta feature especifica a síntese de voz nativa (TTS - Text to Speech) na web e no celular, ditando as doses pendentes do dia ou dando feedback de parabéns quando todas as tarefas diárias já tiverem sido devidamente cumpridas.

---

## User Scenarios & Testing

### User Story 1 - Leitura Falada das Pendências (Priority: P1)
**Why this priority**: Oferece acessibilidade imediata e autonomia ao paciente idoso que não consegue ler a tela.
**Independent Test**: Clicar no botão "Ouvir Pendências" na Home, verificar se o sintetizador de voz do celular dita de forma audível as doses atrasadas e pendentes do dia na ordem correta em fuso local.

**Acceptance Scenarios**:
1. Given que Dona Maria possui pendentes a Losartana das 22:00 e Metformina das 22:00, When ela clicar no ícone de som, Then o sintetizador local do SO deve ditar em português pt-BR de forma clara: *"Você ainda precisa tomar a Losartana às 22 horas e a Metformina às 22 horas."*.

### User Story 2 - Feedback de Cumprimento Total (Priority: P2)
**Why this priority**: Estimula e premia psicologicamente o paciente pelo cumprimento fiel de seu tratamento (Wow Factor).
**Independent Test**: Concluir todos os registros do dia e clicar no ícone de som, verificando que dita a mensagem de sucesso e parabeniza o usuário.

**Acceptance Scenarios**:
1. Given que todas as instâncias de doses de hoje de Dona Maria já estão com o status `taken`, When ela clicar no ícone de áudio da Home, Then o sintetizador do celular deve reproduzir: *"Parabéns! Você já tomou todas as doses agendadas para hoje."*.

---

## Edge Cases

- **Ausência de Mecanismo de Áudio no Dispositivo:** Em raros aparelhos antigos sem síntese de voz instalada, as chaves `expo-speech` ou `SpeechSynthesis` do navegador podem retornar erros ou falhas silenciosas. O aplicativo deve interceptar a exceção de forma segura e alertar por texto de acessibilidade alternativo na tela.
- **Dispositivo no Modo Silencioso (Vibrar/DND):** Se o aparelho do paciente estiver com o volume de mídia zerado, a reprodução de voz será inaudível. A UI do botão deve alertar de forma visual: *"Para ouvir as posologias, certifique-se de aumentar o volume de som do seu celular."*.

---

## Requirements

### Functional Requirements

- **FR-001:** Adicionar ícone de áudio proeminente (mínimo de 60px) na área do indicador de progresso diário da Home.
- **FR-002:** Síntese de voz local (TTS) em português `pt-BR` no mobile nativo utilizando a biblioteca canônica `expo-speech`.
- **FR-003:** Síntese de voz no PWA/Web utilizando o wrapper nativo da **SpeechSynthesis API** do navegador.
- **FR-004:** O script de síntese de voz deve ler dinamicamente o array de `dose_instances` de hoje filtrado no fuso GMT-3 do usuário, consolidando pendências.
- **FR-005:** Tratamento amigável e graceful fallback para aparelhos sem suporte de áudio embarcado.

### Key Entities

- **PendingDoseText:** String concatenada contendo nomes de medicamentos e horários a serem ditados.

---

## Success Criteria

- **SC-001:** Síntese de áudio iniciada em menos de 300ms após o toque no ícone de som.
- **SC-002:** Leitura inteligível e sem cortes das posologias clínicas e nomes de remédios em pt-BR.
