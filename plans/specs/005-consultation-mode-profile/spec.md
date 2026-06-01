# Feature Specification: Consultation Mode Profile

**Feature Directory**: `plans/specs/005-consultation-mode-profile`  
**Created**: 2026-06-01  
**Status**: Migrated Draft  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §M1.3

---

## Context

Dona Maria, idosa com múltiplos medicamentos ativos, muitas vezes tem dificuldades de relatar com precisão sua rotina posológica e taxas de adesão na consulta presencial ao geriatra. O **Modo Consulta** resolve esse atrito clínico gerando uma tela limpa, de alta legibilidade e contraste aumentado (acessibilidade AAA) no celular, e um link temporário seguro para visualização em navegadores desktop do médico.

---

## User Scenarios & Testing

### User Story 1 - Exibição no Consultório (Priority: P1)
**Why this priority**: Ajuda Dona Maria a mostrar sua ficha médica física ao geriatra durante a consulta.
**Independent Test**: Abrir o Modo Consulta no mobile, travar a tela em modo full-screen retrato e validar se o contraste AAA e as abas agrupadas (Medicamentos, Histórico, Aderência e Estoque) renderizam perfeitamente com fontes grandes.

**Acceptance Scenarios**:
1. Given que Dona Maria está na consulta médica, When ela tocar no botão "Modo Consulta" na tela de perfil, Then o app deve abrir uma visualização em tela cheia com fontes aumentadas, agrupando medicamentos ativos e histórico dos últimos 30 dias em abas simples.

### User Story 2 - Compartilhamento Clínico Web (Priority: P1)
**Why this priority**: Permite ao médico visualizar a ficha do paciente diretamente no computador do consultório de forma segura.
**Independent Test**: Gerar o link de consulta no celular, enviá-lo pelo Share nativo e carregar a rota correspondente (`dosiq.app/consult/patient_id?key=xxx`) na web, atestando que ela expira após 24 horas.

**Acceptance Scenarios**:
1. Given que o médico prefere ver na tela grande da clínica, When o paciente clicar em "Compartilhar com o Médico", Then o sistema deve gerar um link com token temporário de 24h e abrir o compartilhamento nativo do celular (`Share` API).
2. Given um link de Modo Consulta que foi gerado há mais de 24 horas, When o médico tentar acessá-lo na clínica, Then o sistema web deve retornar erro de permissão negada "Acesso Expirado".

---

## Edge Cases

- **Legibilidade em baixo brilho:** A paleta de cores deve possuir contraste de taxa superior a 7:1 entre texto e fundo, garantindo legibilidade extrema mesmo se a tela do celular estiver com economia de energia ativa ou brilho reduzido.
- **Segurança de dados sensíveis:** O link temporário expõe apenas dados posológicos e históricos, sem expor endereço física ou credenciais do usuário. O token dinâmico é armazenado temporariamente em banco de dados e invalidado rigidamente no servidor após 24h.

---

## Requirements

### Functional Requirements

- **FR-001:** Desenhar interface com alto contraste (Acessibilidade AAA, fontes grandes e botões visíveis).
- **FR-002:** Interface Mobile full-screen travada em modo retrato contendo abas agrupadas: Medicamentos Ativos, Histórico (últimos 30 dias), Aderência e Estoque.
- **FR-003:** Botão de Compartilhamento Nativo no mobile que aciona o módulo nativo `Share` do React Native para enviar o link seguro temporário.
- **FR-004:** Geração no backend de um token temporário com prazo exato de expiração de 24 horas.
- **FR-005:** Rota web pública temporária `dosiq.app/consult/:patient_id?key=:token` que consome o token e exibe a ficha clínica em formato read-only amigável para navegadores desktop.

### Key Entities

- **ConsultationToken:** Entidade de tokens temporários com timestamp de expiração.
- **PatientProfile:** Perfil do paciente e sua rotina de tratamentos.

---

## Success Criteria

- **SC-001:** Contraste de cores do texto principal de no mínimo 7:1.
- **SC-002:** Expiração automática e rígida do link de visualização web 24 horas após sua criação no servidor.
