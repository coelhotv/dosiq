# Feature Specification: Liquid Medications UI/UX & Telegram Bot

**Feature Directory**: `plans/specs/024-liquid-medications-ui-bot`  
**Created**: 2026-06-01  
**Status**: Spec Draft (Wave M2)  
**Migration Status**: migrated  
**Legacy Sources**:
- `plans/specs/022-liquid-medications-db-backend/`
- `plans/specs/023-liquid-medications-core-api/`
- `plans/dose_instances_refactor/LIQUID_MEDICATIONS_EPIC_DRAFT.md`

---

## Context

Com o banco de dados e a camada do core devidamente estabelecidos, precisamos projetar e implementar as **interfaces responsivas (PWA Web e Mobile)** e a integração com o **Bot do Telegram** para oferecer uma experiência de ponta a ponta que encante e atenda o paciente ("Dona Maria") de forma exemplar.

As principais responsabilidades desta especificação atômica de apresentação são:
1. **Interfaces Dinâmicas e Premium**: Adaptar os formulários de Medicamento e Protocolo de Tomada para ocultar/exibir condicionalmente campos baseados na natureza líquida do medicamento, fornecendo dropdowns e inputs coerentes.
2. **Hints Visuais e Cadastro Amigável de Estoque**: Exibir de forma inteligível que as compras numéricas de líquidos representam frascos e ml (ex: `2 frascos / 50 ml cada um`), adaptável a apresentações futuras.
3. **Banner de Fim de Frasco (Estoque Baixo)**: Apresentar avisos amigáveis quando o frasco ativo estiver prestes a acabar.
4. **Alinhamento do Bot do Telegram**: Adaptar o dispatcher de notificações e os botões rápidos de ação (`Tomei`) no Bot do Telegram para exibir a dose na unidade real do paciente (ex: `"Tomar 15 gotas"`) e debitar o volume físico correspondente via API FIFO transacional.

---

## User Scenarios & Testing

### User Story 1 — UX Premium de Cadastro e Preço Total (PWA & Mobile) (Priority: P1)
**Why this priority**: Evitar confusões visuais no paciente, explicitar quando o formulário se adapta a líquidos e solicitar preços de forma natural.  
**Independent Test**: No formulário de protocolo, selecionar um medicamento líquido. Verificar que a UI exibe o badge "Apresentação Líquida", que o input de dose agora exibe ao lado o dropdown de unidade (`gotas`, `ml`, `UI`). No formulário de estoque, verificar que ao lado do preço a label solicita o "Preço Total da Compra" com hints contextuais claros.

**Acceptance Scenarios**:
1. Given que o usuário está criando um protocolo de Dipirona Gotas (concentração `'mg/ml'`),  
   When a tela é renderizada,  
   Then o formulário exibe em destaque o badge `💧 Apresentação Líquida` e expõe o dropdown de unidade de tomada contendo: `gotas`, `ml`, `UI`.
2. Given que o usuário está cadastrando estoque de xarope,  
   When o formulário é renderizado,  
   Then ele exibe em destaque o badge `💧 Inventário de Líquidos` e exibe campos numéricos decorados com os hints: `[ X ] frascos` / `[ Y ] ml cada um` e o campo `Preço Total da Compra (R$)`.

---

### User Story 2 — Alerta de Estoque Crítico (Dona Maria) (Priority: P2)
**Why this priority**: Alertar o paciente com antecedência de que seu frasco ativo está no fim para que ele adquira um novo a tempo.  
**Independent Test**: Configurar o estoque do medicamento com `1.5 ml` restantes. Agendar uma dose de `5 ml`. Verificar que o painel exibe um banner de aviso amigável alertando sobre o fim do frasco.

**Acceptance Scenarios**:
1. Given que o saldo de volume do frasco ativo em estoque é menor do que a dose da próxima ocorrência de `dose_instances`,  
   When o usuário abre a timeline do aplicativo,  
   Then o sistema apresenta um aviso em destaque: *"⚠️ Seu frasco ativo está no fim (restam apenas 1,5 ml). Lembre-se de abrir um novo frasco!"*.

---

### User Story 3 — Confirmar Tomada no Telegram (Priority: P1)
**Why this priority**: Garantir consistência nas tomadas registradas via chat do Telegram com débito físico de volume.  
**Independent Test**: Disparar um alerta de dose individual de Dipirona Gotas (`15 gotas`) no chat do Telegram, clicar no botão inline `✅ Tomei` e certificar-se de que a mensagem é editada com sucesso e que a API debitou `0.75 ml` (conversão baseada em 20 gotas/ml) do estoque de forma silenciosa.

**Acceptance Scenarios**:
1. Given que o paciente recebe um alarme no Telegram: *"🔔 Hora da sua Dipirona! Tomar 15 gotas agora."*,  
   When ele clica em `✅ Tomei`,  
   Then o bot processa a confirmação da dose materializada, persiste o log e debita exatamente `0.75 ml` do estoque, editando a mensagem com: *"✅ Dipirona confirmada!"*.

---

## Edge Cases

- **Inativação de Lote Pendente no Telegram**: Se o paciente confirmar a dose pelo Telegram mas o estoque estiver zerado por inativação manual simultânea no PWA, o bot não deve travar nem emitir exceções técnicas. Ele apenas deve registrar a dose tomada no histórico de forma best-effort e enviar uma mensagem amigável no chat: *"Registrei sua tomada, mas verifiquei que seu estoque está zerado no app!"*.

---

## Requirements

### Functional Requirements

- **FR-001**: O formulário `MedicineForm` na Web e Mobile deve filtrar o dropdown de unidades para `['mg', 'mcg', 'g', 'mg/ml', 'ui/ml', 'ui']`, usar o label correto **"Concentração"** e exibir o badge contextual `💧 Apresentação Líquida` para unidades terminadas em `/ml`.
- **FR-002**: O formulário `ProtocolForm` na Web e Mobile deve exibir condicionalmente o dropdown de unidade de tomada (`intake_unit`) contendo `gotas`, `ml` e `UI` acompanhado da mensagem informativa: *"💧 Você está configurando um medicamento líquido. Defina a dose na unidade de tomada recomendada (gotas ou ml)."* apenas se o medicamento selecionado for líquido.
- **FR-003**: O formulário `StockForm` de líquidos deve exibir em destaque o cabeçalho contextual `💧 Inventário de Líquidos` e campos numéricos decorados com os hints `[ X ] frascos` e `[ Y ] ml cada um` e o campo `Preço Total da Compra (R$)`.
- **FR-004**: O dispatcher de notificações e callbacks no Bot do Telegram (`server/bot/callbacks/doseActions.js` e `api/notify.js`) deve ser atualizado para formatar as mensagens utilizando o helper `formatDose` em português.


### Key Entities

- **UI Medicine / Protocol Forms**: Componentes Web/Mobile atualizados.
- **UI Stock List Dashboard**: Indicador de saldo e banners de estoque baixo.
- **Telegram Bot Webhook**: Dispatcher e callback handlers atualizados.

---

## Success Criteria

- **SC-001**: Dropdowns dinâmicos e hints visuais operam de forma impecável e harmoniosa no formulário do PWA e Mobile.
- **SC-002**: Notificações e tomadas no Bot do Telegram ocorrem com formatação de dosagem contínua em português brasileiro.
- **SC-003**: 100% de conformidade com as diretrizes de a11y e responsividade móvel.
