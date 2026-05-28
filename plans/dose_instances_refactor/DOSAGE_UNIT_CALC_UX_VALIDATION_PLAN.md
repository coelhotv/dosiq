# Plano de Validação de UX — Unidades de Dosagem e Cálculos (Dosiq)

Este plano atua como guia estruturado de testes manuais para garantir que a experiência visual e interativa dos clientes esteja impecável e que os cálculos matemáticos em tempo real ajudem ativamente o usuário durante o uso do app (Mobile e Web/PWA).

---

## 🧪 Roteiro de Testes — Mobile (Prioritário)

### 📱 Cenário M-1: Cadastro de Novo Tratamento (Fórmulas em Tempo Real)
* **Objetivo:** Garantir que ao cadastrar a dosagem e o protocolo de tomada, o usuário veja com exatidão a carga total ingerida de princípio ativo.
* **Passos para Validação:**
  1. No menu lateral, acesse **Tratamentos** ➔ Clique em **Novo Tratamento** (ou no FAB).
  2. Selecione o medicamento previamente cadastrado **Insulina Lantus (100 UI por unidade)**.
  3. No campo **Dose por tomada**, digite `1,5`.
  4. **Verificação de UX:**
     * Certifique-se de que surge instantaneamente o hint descritivo: `✨ 1,5 x 100 UI = 150 UI` em destaque visual.
     * Mude o valor para `2`. O hint deve atualizar instantaneamente para `✨ 2 x 100 UI = 200 UI`.
     * Apague o valor. O hint deve sumir ou retornar ao helper text padrão sem erros visuais.
  5. Repita o mesmo teste selecionando **Dipirona (500 mg por unidade)**. Ao digitar `2`, deve aparecer: `✨ 2 x 500 mg = 1000 mg` (ou `1 g` se aplicável, no nosso caso a multiplicação direta mantém a coerência das unidades: `1000 mg`).

### 📱 Cenário M-2: Detalhes de Estoque (Micro-hints nos KPIs)
* **Objetivo:** Validar se a quantidade física e o consumo diário são traduzidos em miligramagem/unidade ativa na tela de indicadores.
* **Passos para Validação:**
  1. No menu inferior, acesse **Estoque** ➔ Selecione o medicamento cadastrado no cenário anterior (**Insulina Lantus**).
  2. **Verificação de UX:**
     * No bloco superior de **Saldo**, o valor deve estar no formato: `30 un.` acompanhado de um micro-hint legível: `30 un. = 3000 UI`.
     * No bloco de **Consumo / dia**, certifique-se de que o consumo (ex: 2 turnos de 1,5 unidades = 3 un.) exibe: `3 un.` com o micro-hint: `3 un. = 300 UI`.
     * Garanta que o contraste das cores do texto de hint esteja de acordo com o design system (cor secundária/muted, em tamanho menor e sutil).

### 📱 Cenário M-3: Registro de Compra de Estoque
* **Objetivo:** Assegurar que no ato da compra de novas embalagens, o total de princípio ativo adquirido fique claro.
* **Passos para Validação:**
  1. Na tela de detalhes do estoque, clique no FAB **Registrar compra** (`+`).
  2. No campo **Quantidade (un.)**, digite `60` (unidades físicas de ampolas ou comprimidos).
  3. **Verificação de UX:**
     * Valide que o hint dinâmico de ajuda exibe: `✨ Equivale a 60 un. = 6000 UI no total`.
     * Altere para `120 un.` e garanta a reatividade imediata do cálculo (`12000 UI`).

### 📱 Cenário M-4: Registro de Dose Diária (Hoje / FAB e Modais)
* **Objetivo:** Garantir a eliminação do termo estático "comprimidos" e a inclusão das unidades corretas ao registrar tomadas.
* **Passos para Validação:**
  1. Na aba principal **Hoje**, localize a timeline de doses.
  2. **Verificação de UX (Timeline):**
     * O subtexto da dose do medicamento deve conter: `1,5 un. (150 UI) de 100 UI` (em vez do antigo `1,5 un. de 100 UI`).
  3. Clique em **Tomar** no item individual da timeline.
  4. **Verificação de UX (Modal de Confirmação):**
     * O label do campo de input deve se adaptar para: `"Quantidade (unidades)"` (pois a Insulina Lantus é 'UI').
     * Abaixo do campo de entrada de quantidade, deve constar a fórmula: `✨ 1,5 x 100 UI = 150 UI`.
  5. Feche o modal e abra a confirmação em lote (clique no FAB `+` da aba Hoje):
     * A listagem de doses pendentes deve exibir cada linha com a respectiva quantidade física e dosagem ativa: ex: `1,5 un. (150 UI)` em vez de `1,5 cp`.

---

## 🧪 Roteiro de Testes — Web/PWA

### 💻 Cenário W-1: Cadastro de Tratamento no PWA
* **Objetivo:** Validar o cálculo em tempo real no formulário web.
* **Passos para Validação:**
  1. Acesse o formulário de **Novo Tratamento** no PWA.
  2. Selecione o medicamento **Insulina Lantus (100 UI)**.
  3. No input de **Dose por Horário (qtd)**, insira `1.5`.
  4. **Verificação de UX:**
     * Um pequeno hint estilizado deve aparecer logo abaixo do input: `✨ 1,5 x 100 UI = 150 UI`.

### 💻 Cenário W-2: Visualização de Estoque (StockCard e Redesign)
* **Objetivo:** Garantir que o redesign visual do estoque para Carlos (Complex) e Dona Maria (Simple) reflita a dosagem correta.
* **Passos para Validação:**
  1. Acesse a tela de **Estoque** no PWA.
  2. **Verificação de UX (Modo Complex):**
     * O card do medicamento deve exibir a quantidade total física com a conversão em princípio ativo: `30 un. (= 3000 UI)`.
     * No indicador de barra de estoque (`StockIndicator`), garanta que exiba: `30 un. (= 3000 UI)`.
  3. Mude a densidade para o modo Simple:
     * Valide que o subtexto de "última compra" e as informações estejam limpas e legíveis, ocultando dados secundários, mas mantendo a paridade visual e o status correto do estoque.

### 💻 Cenário W-3: Timeline de Doses no PWA
* **Objetivo:** Eliminar a palavra hardcoded "comprimidos" em todos os widgets e timelines do PWA.
* **Passos para Validação:**
  1. Acesse o **Dashboard** do PWA.
  2. **Verificação de UX (Cards e Timeline):**
     * No widget **CronogramaDoseItem**, deve constar a dose formatada: `1,5 UI` ou `1,5 un. (150 UI)` de acordo com a unidade, nunca `1,5 comprimidos`.
     * No widget de prioridades (**PriorityDoseCard**), certifique-se de que a listagem de doses urgentes também mostre as unidades corretas (`1,5 UI` ou `1 comp.` ou `1 gota`).
     * Ao abrir o modal de detalhes do dia (**DailyDoseModal**), certifique-se de que cada item de dose na lista (`DoseListItem`) exiba a abreviação semântica correta (`1,5 UI`, `2 comp.`, `5 gotas`), nunca generalizando como comprimidos.
