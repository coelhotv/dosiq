# Glossário Dosiq — Termos UI ↔ Código

> **Status**: vivo (atualizar a cada fase)
> **Última atualização**: 2026-05-16 (Spike Pre-Fase-2)
> **Consulta obrigatória**: parte do brief padrão cavecrew (R-230) em todo spawn de implementação UI.

---

## 1. Convenções universais de string

Aplicam-se a TODA UI do app (mobile + web).

| Regra | Razão | Exemplos |
|-------|-------|----------|
| **Sem pronomes possessivos** em headers, placeholders, subtitles, CTAs (proibido: "meu/minha/meus/minhas/sua/seu/seus") | App pode ser usado por cuidadores/familiares; remédios/tratamentos não são "deles" | ❌ "Meus Tratamentos" → ✅ "Tratamentos" ❌ "Buscar nos meus medicamentos" → ✅ "Buscar em medicamentos" |
| **"Uso contínuo"** em vez de "Sem prazo" para `end_date` null em tratamentos | Termo mais claro para paciente — comunica intent | ❌ "Sem prazo" → ✅ "Uso contínuo" |
| **Unidades formatadas via helper** (`pluralizeDoseUnit`/`formatDoseUnit`) | Nunca hardcoded "comprimidos" — render correto baseado em `medicine.dosage_unit` | `formatDoseUnit(15, 'ml')` → `"15 ml"` `formatDoseUnit(2, 'mg')` → `"2 comprimidos"` |
| **Datas PT-BR** formato `"12 mar 2026"` (`DD MMM YYYY`, mês abreviado lowercase) | Padrão visual brasileiro | Via `formatDatePtBR` em `@dosiq/core/utils/dateFormat.js` |
| **Vírgula decimal** em valores numéricos exibidos | Convenção PT-BR | `15,5 ml` (não `15.5 ml`) — via helper manual `.replace('.', ',')` (Hermes default NÃO tem ICU completo; `toLocaleString('pt-BR')` cai em fallback US e mantém ponto) |
| **Sem ponto final** em microcopy curto (titles, CTAs, labels) | Estilo mobile-first | ❌ "Criar tratamento." → ✅ "Criar tratamento" |
| **Verbos de CTA no infinitivo** | Padrão | "Criar tratamento", "Excluir", "Salvar alterações" |
| **Termos médicos suaves** quando possível | App é para pacientes, não profissionais | "Tratamento" (não "protocolo terapêutico"), "Dose por tomada" (não "posologia") |

---

## 2. Tabela termo UI ↔ código (mobile + web)

### 2.1 Domínio: Medicamentos (Fase 1)

| Termo UI (PT) | Variável código (EN) | DB | Notas |
|---------------|---------------------|-----|-------|
| Medicamento(s) | `medicine(s)` | `medicines` | Não usar "remédio" |
| Princípio ativo | `active_ingredient` | string | Subtitle do card |
| Laboratório | `laboratory` | string | Mostrar apenas em detail, não em card listagem |
| Tipo | `type` | enum `'medicamento'\|'suplemento'` | Ícone Pill vs PillBottle |
| Classe terapêutica | `therapeutic_class` | string | Detail only |
| Categoria regulatória | `regulatory_category` | enum (Genérico, Similar, Novo, ...) | Detail only |
| Dose por unidade | `dosage_per_pill` | number | mg/mcg/g/ml/UI por comprimido/cápsula |
| Unidade | `dosage_unit` | enum `mg\|mcg\|g\|ml\|ui\|cp\|gotas` | Determina label de quantidade |
| Em estoque | `stock` (relation) | `stock` table | |
| Tratamentos associados | `protocols` (relation) | join | Card de listagem mostra contagem |

### 2.2 Domínio: Tratamentos (Fase 2)

| Termo UI (PT) | Variável código (EN) | DB | Notas |
|---------------|---------------------|-----|-------|
| Tratamento(s) | `protocol(s)` | `protocols` | Sempre "tratamento" em UI |
| Nome do tratamento | `name` | string | Ex: "SeloZok manhã/noite" |
| Plano terapêutico / Organização | `treatment_plan` | `treatment_plans` | "Plano" curto OU "Organização" em forms |
| Dose por tomada | `dosage_per_intake` | number | Em unidades farmacêuticas; render via `formatDoseUnit` |
| Frequência / Periodicidade | `frequency` | enum (`diario`, `dias_alternados`, `semanal`, `personalizado`, `quando_necessario`) | PT-BR snake_case |
| Horários | `time_schedule` | array `"HH:MM"` | min 1, max 10 |
| Dias da semana | `weekdays` | array enum `dom\|seg\|ter\|qua\|qui\|sex\|sab` | Required se frequency ∈ {semanal, personalizado} |
| Início | `start_date` | YYYY-MM-DD | Default `getTodayLocal()` |
| Término | `end_date` | YYYY-MM-DD nullable | `null` → render `"Uso contínuo"` via `formatEndDate` |
| Observações | `notes` | string | Max 1000 chars |
| Estado (titulação) | `titration_status` | enum (`estavel\|escalando\|descalando`) | Read-only no mobile v1 |
| Em uso há N dias | derivado | — | `differenceInDays(getNow(), start_date)` |
| Consumo diário | derivado | — | `dosage_per_intake × time_schedule.length` |

### 2.3 Domínio: Estoque (Fase 3 — preview)

| Termo UI (PT) | Variável código (EN) | DB |
|---------------|---------------------|-----|
| Estoque | `stock` | `stock` |
| Lote | `batch_number` | string |
| Validade | `expiration_date` | YYYY-MM-DD |
| Quantidade | `quantity` | number |
| Preço | `unit_price` / `total_price` | `purchases` table |

### 2.4 Domínio: Doses / Adesão

| Termo UI (PT) | Variável código (EN) | DB |
|---------------|---------------------|-----|
| Dose | `dose_log` / `log` | `dose_logs` |
| Confirmada / Tomada | status `taken` | enum |
| Pendente | status `pending` | enum |
| Agendada (futuro) | derivada | — |
| Silenciada | status `silenced` | enum |
| Adesão | `adherence` | derivada |

---

## 3. Pares "evitar / preferir"

| Evitar | Preferir | Razão |
|--------|----------|-------|
| "Medicação" | "Medicamento" | Mais formal e específico |
| "Remédio" | "Medicamento" | Coloquial |
| "Protocolo" (UI) | "Tratamento" | Jargão médico; `protocol` continua no código |
| "Schedule" / "Cronograma" | "Horários" / "Frequência" | Localização |
| "Save" / "OK" | "Salvar" / "Confirmar" | PT-BR |
| "Cancel" | "Cancelar" | PT-BR |
| "Delete" | "Excluir" | PT-BR |
| "Edit" | "Editar" | PT-BR |
| "Loading..." | "Carregando..." | PT-BR |
| "Empty state" | "Sem [entidade] cadastrado(s)" | UI explícita |

---

## 4. Convenções de helpers (locale + plural + format)

| Helper | Local | Quando usar |
|--------|-------|-------------|
| `formatDoseUnit(qty, dosage_unit)` | `@dosiq/core/utils/doseUnit.js` (Fase 2) | Qualquer render de quantidade de dose em UI |
| `pluralizeDoseUnit(qty, dosage_unit)` | mesmo | Suffix de input dinâmico |
| `formatDatePtBR(isoDate)` | `@dosiq/core/utils/dateFormat.js` (Fase 2) | Qualquer render de data |
| `formatEndDate(isoDate)` | mesmo | `end_date` de tratamento (null → "Uso contínuo") |
| `getTodayLocal()` | `@dosiq/core/utils/dateUtils.js` (existente) | NUNCA usar `new Date()` direto (R-020) |
| `parseLocalDate(str)` | mesmo | Parse de "YYYY-MM-DD" para Date sem timezone bug |

---

## 5. Acessibilidade (labels)

Componentes interativos DEVEM ter `accessibilityLabel` em PT-BR, descritivo. Exemplos:

| Elemento | accessibilityLabel |
|----------|---------------------|
| Botão voltar | `"Voltar"` |
| FAB criar tratamento | `"Novo tratamento"` |
| Ícone editar | `"Editar tratamento"` |
| Ícone excluir | `"Excluir tratamento"` |
| Search bar | `"Buscar em medicamentos"` |
| Toggle dia da semana | `"Segunda-feira"` — estado via `accessibilityState={{ checked: true/false }}` (NÃO incluir "ativado/desativado" no label — leitor de tela anuncia o state nativamente, evita redundância) |

---

## 6. Mensagens de erro Zod (R-232 — Dona Maria friendly)

Locale global em `@dosiq/core/zodSetup.js` cobre defaults. Schemas só sobrescrevem quando regra dá info útil:

| Default global (não duplicar) | Quando sobrescrever |
|-------------------------------|---------------------|
| Campo vazio → "Este campo é obrigatório" | Mensagem específica de domínio |
| Número esperado → "Use apenas números" | Limite específico (ex: "Use entre 1 e 100") |
| String muito curta → "Use pelo menos N caracteres" | Quando N é regra de negócio |
| Valor abaixo do mínimo → "O valor deve ser maior que zero" | Quando mínimo > 0 |
| Data inválida → fallback do locale PT | Quando há cross-field (ex: "Data fim deve ser maior ou igual a início") |

---

## 7. Manutenção

Adicionar termo a este glossário sempre que:
- Nova entidade DB for criada
- Nova convenção UI estabelecida (ex: nova regra de pronome, nova padronização de formato)
- Termo gerar dúvida em revisão de PR

**Histórico**:
- 2026-05-16 — criado no Spike Pre-Fase-2 consolidando convenções implícitas Fase 0+1 e antecipando Fase 2.
