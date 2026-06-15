# Feature Specification: Complete Data Export (LGPD)

**Feature Directory**: `plans/specs/008-complete-data-export-lgpd`  
**Created**: 2026-06-01 · **Revised**: 2026-06-15
**Status**: draft — **absorve conceitos do épico 012 (descope da Fase E, 2026-06-15): biomarkers + colunas de líquidos/injetáveis no inventário do export**
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/backlog-unified_app_2026/PHASE_5_6_PARITY_AND_BEYOND.md` §F6.3

> **✅ Absorve 012 (2026-06-15 — promovido de nota a requisito, FR-006):** o épico 012 (Fase C, em
> prod) criou a tabela **`biomarkers_log`** (glicemia/peso/PA — **dado sensível de saúde**); as Fases
> A/B/D adicionaram colunas de líquidos/injetáveis. O export LGPD **DEVE** incluir `biomarkers_log`
> (todas as colunas, incl. `value_secondary` p/ PA) **e** as colunas novas do 012 em
> `medicines`/`protocols`/`stock`/`purchases` — compliance LGPD, não opcional. Ver FR-006.

---

## Context

Para garantir a total soberania de dados de saúde do paciente em plena conformidade com a **Lei Geral de Proteção de Dados (LGPD)**, o Dosiq deve prover um mecanismo de exportação completa, estruturada e legível por máquina de todas as informações armazenadas. Esta feature permite ao usuário baixar seus dados em formatos populares (JSON ou CSV) sem onerar a infraestrutura do Supabase, processando e compactando as informações diretamente no cliente.

---

## User Scenarios & Testing

### User Story 1 - Exportação de Dados no Celular (Priority: P1)
**Why this priority**: Crucial para conformidade regulatória LGPD e portabilidade de dados pessoais.
**Independent Test**: Ir em *Configurações > Privacidade*, selecionar todos os checkboxes de dados, escolher o formato "JSON" e clicar em "Exportar", conferindo que o arquivo `.json` gerado na pasta temporária é disponibilizado para compartilhamento nativo.

**Acceptance Scenarios**:
1. Given que Dona Maria quer trocar de aplicativo, When ela acessar a seção de Privacidade no app móvel e selecionar "Exportar Dados em JSON", Then o aplicativo deve extrair e estruturar seus cadastros e histórico do AsyncStorage local e gerar o arquivo compilado legível.

### User Story 2 - Seletividade da Exportação (Priority: P2)
**Why this priority**: Permite baixar apenas frações específicas dos dados (ex: apenas histórico de estoque).
**Independent Test**: Marcar apenas o checkbox "Histórico de Estoque" e verificar se o arquivo gerado (CSV ou JSON) contém exclusivamente as colunas referentes ao saldo e consumo, sem colunas de dosagem de medicamentos.

**Acceptance Scenarios**:
1. Given que Dona Maria deseja compartilhar apenas seu estoque com a farmácia, When ela desmarcar os outros checkboxes e gerar a exportação em CSV, Then o arquivo correspondente deve conter apenas linhas de compras e saldos estimados.

---

## Edge Cases

- **Incompatibilidade de APIs de Navegador em React Native:** O uso clássico de `Blob` de navegador e elementos `<a>` com atributo `download` **não funciona e causa quebras** no ambiente React Native móvel nativo. A exportação mobile deve utilizar rigorosamente as APIs de filesystem nativo (`expo-file-system`) e compartilhamento nativo (`expo-sharing`).
- **Grandes Históricos de Medicamentos:** Consultar dezenas de milhares de logs de doses pode exaurir a memória Javascript do celular. Os dados de histórico de doses devem ser lidos e estruturados em formato compactado e em blocos assíncronos locais.

---

## Requirements

### Functional Requirements

- **FR-001:** Adicionar tela de exportação de dados em *Configurações > Privacidade e Dados* no App Nativo e Web.
- **FR-002:** Exibir checkboxes de seleção: Perfil e Configurações, Histórico Completo de Doses, Lista de Medicamentos, Histórico de Estoque, e **Medidas/Biomarcadores** (012 — glicemia/peso/PA).
- **FR-003:** Suporte à exportação estruturada nos formatos **JSON** ou **CSV** com processamento inteiramente client-side.
- **FR-004:** A exportação móvel nativa deve utilizar `expo-file-system` para escrever o arquivo em diretório temporário local (`FileSystem.cacheDirectory`) e `expo-sharing` para abrir o menu do sistema.
- **FR-005:** O PWA/Web deve manter sua implementação funcional isolada usando as APIs do browser (`Blob` e `URL.createObjectURL`).
- **FR-006 (012 — absorvido da Fase E descoped):** o inventário do export **DEVE** incluir
  obrigatoriamente (compliance LGPD — dado sensível de saúde):
  - **`biomarkers_log`** — todas as colunas, incl. `value_secondary` (PA), `type`, `unit`, `context`,
    `source`, `measured_at`, `notes`.
  - colunas do 012 em **`medicines`** (`presentation`, `units_per_ml`, `shelf_life_days`,
    `injection_container` se ainda em medicine, `concentration_volume_ml`), **`protocols`**
    (`intake_unit`, `titration_*`), **`stock`**/**`purchases`** (`opened_at`, `injection_container`).
  - O export é **fiel ao schema atual** — ao adicionar colunas no futuro, o inventário deve
    acompanhar (nota de manutenção no Planning). Vale p/ JSON **e** CSV; mobile **e** web.

---

## Success Criteria

- **SC-001:** Exportação gerada localmente em menos de 2 segundos.
- **SC-002:** Zero requisições de renderização no backend da Vercel (processamento estritamente local no dispositivo).
- **SC-003 (012):** o bundle exportado contém `biomarkers_log` (incl. `value_secondary`) e as colunas
  de líquidos/injetáveis do 012 — nenhum dado sensível de saúde fica de fora (compliance LGPD); JSON e CSV, mobile e web.
