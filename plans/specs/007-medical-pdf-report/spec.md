# Feature Specification: Medical PDF Report

**Feature Directory**: `plans/specs/007-medical-pdf-report`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §F6.2

---

## Context

Para facilitar a portabilidade física do histórico do tratamento aos profissionais de saúde, o aplicativo nativo e o PWA devem prover um gerador de relatórios clínicos em PDF de alta qualidade e com design limpo e estruturado. Enquanto o PWA já utiliza `jsPDF` com lazy-loading para esta entrega, o aplicativo nativo móvel deve portar esta funcionalidade utilizando as APIs de impressão nativa do sistema operacional (`expo-print`) para garantir performance fluida.

---

## User Scenarios & Testing

### User Story 1 - Geração de PDF no Celular (Priority: P1)
**Why this priority**: Permite ao paciente salvar ou enviar seu relatório clínico diretamente de seu smartphone para a equipe médica.
**Independent Test**: Clicar em "Gerar Relatório PDF" nas configurações/aba de histórico no aplicativo móvel nativo, verificar se abre o visualizador nativo de arquivos e se o PDF gerado é legível.

**Acceptance Scenarios**:
1. Given que Dona Maria deseja levar seu histórico impresso para a consulta, When ela tocar em "Exportar Relatório PDF" no seu celular, Then o aplicativo deve renderizar uma estrutura HTML clínica inline e gerar o arquivo PDF estilizado contendo tratamentos ativos e taxas de adesão do mês.

### User Story 2 - Compartilhamento Instantâneo (Priority: P1)
**Why this priority**: Facilita o envio por canais locais como WhatsApp ou e-mail.
**Independent Test**: Confirmar que o fluxo de geração móvel abre o menu nativo do sistema operacional (`Share` nativo) permitindo enviar o arquivo PDF gerado diretamente.

**Acceptance Scenarios**:
1. Given que o PDF de Dona Maria foi gerado com sucesso, When ela tocar em "Compartilhar", Then o menu nativo do sistema (iOS/Android Share Sheet) deve se abrir exibindo atalhos para WhatsApp, e-mail e salvar em arquivos.

---

## Edge Cases

- **Grandes Volumes de Dados:** Pacientes com dezenas de medicamentos cadastrados e centenas de instâncias de doses no histórico de 90 dias podem sobrecarregar a memória do dispositivo durante a compilação do relatório. O HTML inline que gera o PDF deve usar paginação simples ou tabelas enxutas e dinâmicas para evitar quebras.
- **Carregamento Assíncrono das Bibliotecas na Web:** No PWA/Web, o carregamento do módulo gerador `jsPDF` e `jspdf-autotable` deve ocorrer de forma 100% dinâmica (lazy-loaded, AP-B03), garantindo que o bundle principal de download da Home da web permaneça inalterado.

---

## Requirements

### Functional Requirements

- **FR-001:** Geração de PDF no aplicativo nativo móvel utilizando a API de impressão do sistema (`expo-print`) a partir de uma folha de estilo e HTML enxuta inline.
- **FR-002:** O layout do PDF gerado deve conter: cabeçalho com dados de identificação, lista detalhada de Medicamentos Ativos, gráficos/indicadores de Aderência e histórico cronológico resumido.
- **FR-003:** Integração no aplicativo nativo com a biblioteca `expo-sharing` para permitir o envio do arquivo PDF gerado localmente nas pastas temporárias.
- **FR-004:** O PWA/Web deve manter sua implementação funcional baseada em `jsPDF` + `jspdf-autotable` encapsulado em lazy-loading (AP-B03).

### Key Entities

- **TreatmentDetails:** Resumo das posologias e dosagens em vigor.
- **AdherenceAggregates:** Estatísticas de adesão consolidadas no fuso local.

---

## Success Criteria

- **SC-001:** PDF gerado e pronto para visualização/compartilhamento em menos de 1.5 segundos no celular.
- **SC-002:** Zero incremento no tamanho do bundle principal de download gzip do PWA (uso rigoroso de dynamic imports na web).
