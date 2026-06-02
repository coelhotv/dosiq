# Implementation Plan: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`  
**Spec**: `spec.md`  
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/specs/023-liquid-medications-core-api/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Technical Context

Este plano implementa as interfaces do usuário no PWA (React) e Mobile (React Native) para os formulários de cadastro de medicamentos, protocolos e estoque, integrando hints visuais de frascos/ml e os banners de estoque baixo, bem como atualiza as rotas e handlers de callbacks do Bot do Telegram para processar e formatar as tomadas contínuas.

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| visual-hierarchy | ✅ | Layouts responsivos e harmoniosos com hints e selects dinâmicos sem ruídos. |
| mobile-performance | ✅ | Componentes de views lazy-loaded para garantir carregamentos em < 100ms. |

---

## UI/UX & Telegram Integration Design

### 1. Web & Mobile Forms

#### Cadastro de Medicamentos (`MedicineForm.jsx` / `.tsx`)
* Modificamos o select de `dosage_unit` para exibir `['mg', 'mcg', 'g', 'mg/ml', 'ui/ml', 'ui']`.
* O formulário exibe o input `"Concentração"` mapeado para a coluna física `dosage_per_pill` e oculta o termo antigo "Dose por comprimido".
* Exibe dinamicamente o badge de sinalização visual `💧 Apresentação Líquida` ao lado do campo de concentração sempre que a unidade selecionada for `'mg/ml'` ou `'ui/ml'`.

#### Cadastro de Protocolos (`ProtocolForm.jsx` / `.tsx`)
* Escutamos as alterações no medicamento selecionado.
* Se a `dosage_unit` do medicamento contiver `/ml`:
  * Exibimos o select de `intake_unit` contendo `['gotas', 'ml', 'UI']`.
  * Apresentamos um banner de hint contextual e amigável: *"💧 Você está configurando um medicamento líquido. Defina a dose na unidade de tomada recomendada (gotas ou ml)."*
  * Se for sólido, o select de unidade e o banner informativo permanecem ocultos.

#### Cadastro de Estoque (`StockForm.jsx` / `.tsx`)
* Se for líquido:
  * Em vez de perguntar *"Quantidade (unidades)"*, o formulário exibe dois inputs numéricos com hints em formato grid responsivo acompanhados do cabeçalho `💧 Inventário de Líquidos`:
    * Input 1: `[ 2 ] frascos`
    * Input 2: `[ 50 ] ml cada um`
  * O campo de preço passa a se chamar **"Preço Total da Compra (R$)"** em vez de solicitar preço unitário por frasco.
* Ao submeter, o payload estruturado contendo a quantidade de frascos, o volume nominal de cada um e o preço total é despachado para a API do `stockService`.

---

### 2. Painel de Estoque & Banners (`StockAlertInline.jsx`)
Adicionamos um componente ou helper visual que:
1. Compara o volume restante do frasco ativo (`stock.quantity`) com a dosagem da próxima ocorrência materializada em `dose_instances.expected_dose`.
2. Se `stock.quantity < expected_dose`, renderiza um banner visual de destaque premium com o aviso de frasco no fim e link rápido para registrar nova compra de estoque.

---

### 3. Integração com Bot do Telegram (`server/bot/callbacks/doseActions.js`)
* Ao disparar notificações agendadas de lembrete em `api/notify.js`, o texto do alarme é formatado com o helper `formatDose(expected_dose, intake_unit)`.
  * Exemplo de Mensagem: `"🔔 Hora do seu Ibuprofeno! Tomar 2,5 ml agora."`
* O handler de callback da ação rápida `✅ Tomei` intercepta e executa o log de tomada passando o valor decimal da dose para o backend, que executa transacionalmente o FIFO físico em ml no Supabase.

---

## Target Files

| Path | Purpose | Source Evidence |
|------|---------|-----------------|
| `apps/web/src/features/medicines/components/MedicineForm.jsx` | Modificar select de unidades e comportamento condicional de líquidos. | UI Medicine Form |
| `apps/mobile/src/features/medicines/components/MedicineForm.tsx` | Modificar select de unidades e comportamento condicional mobile. | UI Medicine Form |
| `apps/web/src/features/protocols/components/ProtocolForm.jsx` | Adicionar select dinâmico `intake_unit` para líquidos. | UI Protocol Form |
| `apps/web/src/features/stock/components/StockForm.jsx` | Adicionar inputs numéricos com hints responsivos de frascos/ml. | UI Stock Form |
| `apps/web/src/features/dashboard/components/StockAlertInline.jsx` | Adicionar banner e micro-copywriting de fim de frasco. | UI Stock Alerts |
| `server/bot/callbacks/doseActions.js` | Atualizar dispatcher de notificações e callback handler de tomada. | Telegram Bot |
