# Guia Completo: Cadastro e Gerenciamento de Protocolos em Titulação

Este guia explica como cadastrar medicamentos em regime de titulação e registrar suas doses no sistema **Dosiq**.

## 📊 Entendendo o Sistema de Titulação

### O que é Titulação?
Titulação é o processo gradual de ajuste de dosagem de um medicamento ao longo do tempo, geralmente aumentando progressivamente até atingir a dose de manutenção ideal.

### Como o Sistema Funciona?

O sistema armazena no banco de dados (tabela `protocols`):

- **`titration_status`**: Estado do protocolo (`'estável'`, `'titulando'`, `'alvo_atingido'`)
- **`titration_schedule`**: Array JSON com as etapas da titulação
- **`current_stage_index`**: Índice da etapa atual (começa em 0)
- **`stage_started_at`**: Data/hora de início da etapa atual
- **`dosage_per_intake`**: Dose por horário programado
- **`time_schedule`**: Horários de tomada (array JSON, ex: `["08:00", "20:00"]`)

### Estrutura de Cada Etapa de Titulação

Cada etapa no `titration_schedule` é um objeto com:

```json
{
  "duration_days": 7,     // Duração da etapa em dias (inteiro, 1-365)
  "dosage": 1.5,          // Dose por horário (suporta decimais)
  "description": "75mg 2x ao dia"  // Descrição/objetivo da etapa (max 500 chars)
}
```

---

## 🎯 Exemplo Prático: Selozok em Titulação

Vamos cadastrar o **Selozok (Succinato de Metoprolol)** com o seguinte protocolo de titulação:

1. **Atual** (7 dias): 100mg/dia → 2x 50mg (manhã e noite)
2. **Próxima semana** (14 dias): 150mg/dia → 2x 75mg (manhã e noite)
3. **Dose de manutenção** (contínuo): 200mg/dia → 2x 100mg (manhã e noite)

---

## 📝 Passo a Passo Completo

### **Passo 1: Cadastrar o Medicamento**

1. Navegue até **Medicamentos** no menu
2. Clique em **"+ Cadastrar Medicamento"**
3. Preencha os campos:
   - **Nome Comercial**: `SeloZok`
   - **Laboratório**: `AstraZeneca` (ou o fabricante do seu)
   - **Princípio Ativo**: `Succinato de Metoprolol`
   - **Dosagem por Comprimido**: `50` (se o seu comprimido for de 50mg)
   - **Unidade**: `mg`
   - **Tipo**: `Medicamento` (padrão)
   - **Preço Pago** (opcional): ex: `45.00`
4. Clique em **"Criar Medicamento"**

✅ **O medicamento está cadastrado!**

---

### **Passo 2: Cadastrar o Protocolo com Titulação**

1. Navegue até **Protocolos** no menu
2. Clique em **"+ Novo Protocolo"**

#### 2.1 Informações Básicas

- **Medicamento**: Selecione `SeloZok (50mg)` no dropdown
- **Plano de Tratamento** (opcional): Se você tem um plano como "Tratamento Cardiomiopatia", selecione aqui. Caso contrário, deixe "Nenhum (Protocolo isolado)"
- **Nome do Protocolo**: `BB - Metoprolol` (ou o que preferir)
- **Frequência**: `2x ao dia`
- **Dose por Horário (qtd)**: `1` 
  - ⚠️ **IMPORTANTE**: Este campo representa **quantos comprimidos por horário** você toma **na etapa atual**. No seu caso, na 1ª etapa você toma 1 comp de 50mg = 50mg/horário.

#### 2.2 Configurar a Titulação

Marque a opção **"📈 Regime de Titulação Inteligente"**

O painel de titulação será exibido. Agora você vai adicionar cada etapa:

##### **Etapa 1: Dose Inicial (100mg/dia)**
- **Duração**: `7` dias
- **Dose (comps)**: `1` comprimido por horário
- **Nota / Objetivo**: `50mg 2x ao dia` ou `Dose inicial`
- Clique em **"➕ Adicionar Etapa"**

##### **Etapa 2: Titulação Intermediária (150mg/dia)**
- **Duração**: `14` dias (ou 7, conforme seu protocolo médico)
- **Dose (comps)**: `1.5` comprimidos por horário
- **Nota / Objetivo**: `75mg 2x ao dia`
- Clique em **"➕ Adicionar Etapa"**

##### **Etapa 3: Dose de Manutenção (200mg/dia)**
- **Duração**: `365` dias (ou um número grande, já que é a fase de manutenção)
- **Dose (comps)**: `2` comprimidos por horário
- **Nota / Objetivo**: `100mg 2x ao dia - Manutenção`
- Clique em **"➕ Adicionar Etapa"**

> **Observação**: O sistema mostrará o **tempo total previsto** somando todas as etapas.

#### 2.3 Configurar Horários

- No campo **"Horários"**, adicione:
  - Digite `08:00` e clique em **"➕ Adicionar"**
  - Digite `20:00` e clique em **"➕ Adicionar"**

Você verá os chips com os horários: `08:00` e `20:00`

#### 2.4 Observações (Opcional)

- **Observações**: `Protocolo de titulação conforme orientação cardio. Monitorar FC e PA.`

#### 2.5 Finalizar

- Mantenha **"Protocolo ativo"** marcado
- Clique em **"Criar Protocolo"**

✅ **Protocolo de titulação criado!** O sistema automaticamente:
- Define `titration_status = 'titulando'`
- Salva o `titration_schedule` com as 3 etapas
- Inicia `current_stage_index = 0` (primeira etapa)
- Registra `stage_started_at` com a data/hora atual

---

### **Passo 3: Adicionar Estoque (Opcional, mas Recomendado)**

Para que o sistema possa calcular quantos dias de estoque você tem:

1. Navegue até **Estoque**
2. Clique em **"+ Adicionar ao Estoque"**
3. Preencha:
   - **Medicamento**: `SeloZok (50mg)`
   - **Quantidade**: `60` (comprimidos)
   - **Data de Compra**: Data de hoje
   - **Data de Validade**: Data do rótulo
   - **Preço Unitário** (opcional): preço por comprimido
   - **Observações** (opcional): `Caixa com 60 comprimidos`
4. Clique em **"Adicionar"**

✅ **Estoque cadastrado!** O dashboard mostrará quantos dias restam baseado no consumo diário.

---

## 🔄 Passo 4: Registrando Doses Durante a Titulação

Existem **3 formas** de registrar doses:

### **Opção A: Registro Rápido pelo Dashboard (Recomendado)**

1. No **Dashboard**, você verá o card com seu protocolo
2. Se estiver em um **Plano de Tratamento**:
   - Expanda o plano clicando no título
   - Veja a lista de protocolos com checkbox
   - Marque os que deseja tomar
   - Clique em **"✅ Tomar (X)"** no canto superior direito
3. Se for um **Protocolo Avulso**:
   - No card "Protocolos Avulsos", clique no protocolo

### **Opção B: Registro Manual Detalhado**

1. No **Dashboard**, clique em **"➕ Registrar Dose"**
2. Preencha:
   - **Protocolo**: Selecione `BB - Metoprolol`
   - **Data e Hora**: Será preenchido automaticamente com a hora atual (ou edite se necessário)
   - **Quantidade Tomada**: O sistema preenche automaticamente com a dose do protocolo (`1` ou `1.5` ou `2`, dependendo da etapa atual)
   - **Observações** (opcional): ex: `Dose da manhã`
3. Clique em **"Registrar"**

### **Opção C: Registro pelo Calendário**

1. Navegue até **Histórico**
2. No calendário, clique no dia desejado
3. Clique em **"+ Novo Registro"**
4. Preencha como na Opção B

✅ **Efeito do Registro**:
- Cria um log na tabela `medicine_logs`
- **Decrementa automaticamente o estoque** pela quantidade tomada
- Atualiza o histórico e calendário

---

## 📈 Como o Sistema Gerencia as Transições de Etapas

### Acompanhamento no Dashboard

Quando um protocolo está em titulação, o Dashboard exibe:

- **Etapa atual**: `Etapa 1/3`
- **Progresso**: Barra de progresso com percentual
- **Dias**: `Dia 3/7`
- **Nota da etapa**: `50mg 2x ao dia`

### Transição Automática (Comportamento Atual)

⚠️ **Importante**: Atualmente, o sistema **NÃO** avança automaticamente para a próxima etapa. Você precisa:

1. Quando a etapa terminar (ex: após 7 dias), **editar o protocolo manualmente**
2. Ir em **Protocolos** → encontrar o protocolo → clicar em **Editar**
3. **Remover a primeira etapa** do `Regime de Titulação`
4. Atualizar o campo **"Dose por Horário"** para refletir a nova dose
5. Salvar

> 🔮 **Funcionalidade Futura**: Nas próximas versões, o sistema poderá alertar automaticamente quando uma etapa terminar e permitir avançar diretamente do Dashboard.

### Alternativa Manual (Recomendada para agora)

Como a transição não é automática ainda, você pode:

**Abordagem Simples**: 
- Após os 7 dias, editar o protocolo e **ajustar manualmente** o campo `dosage_per_intake` para `1.5`
- **Não usar o wizard de titulação**, apenas ajustar manualmente a cada mudança de dose

**Abordagem com Wizard**:
- Cadastrar todas as etapas como mostrado acima
- Ter visibilidade do progresso
- Quando a etapa terminar, editar e remover a etapa concluída

---

## 🧠 Explicação Técnica: Como os Dados São Armazenados

### Exemplo de Registro no Banco (JSON)

Quando você salva o protocolo do Selozok, o registro fica assim:

```json
{
  "id": "uuid-aqui",
  "medicine_id": "uuid-selozok",
  "treatment_plan_id": null,
  "name": "BB - Metoprolol",
  "frequency": "2x ao dia",
  "time_schedule": ["08:00", "20:00"],
  "dosage_per_intake": 1,
  "target_dosage": null,
  "titration_status": "titulando",
  "titration_schedule": [
    {
      "days": 7,
      "dosage": 1,
      "note": "50mg 2x ao dia"
    },
    {
      "days": 14,
      "dosage": 1.5,
      "note": "75mg 2x ao dia"
    },
    {
      "days": 365,
      "dosage": 2,
      "note": "100mg 2x ao dia - Manutenção"
    }
  ],
  "current_stage_index": 0,
  "stage_started_at": "2026-01-08T16:13:18Z",
  "notes": "Protocolo de titulação conforme orientação cardio.",
  "active": true,
  "created_at": "2026-01-08T16:13:18Z"
}
```

### Cálculo do Progresso (titrationUtils.js)

A função `calculateTitrationData()` é chamada pelo Dashboard e calcula:

- **Dias decorridos**: Diferença entre `stage_started_at` e hoje
- **Progresso %**: `(dias_decorridos / total_dias_etapa) * 100`
- **Indicador de transição**: Se `dias_decorridos > total_dias_etapa`

---

## ✅ Checklist Final

- [ ] Medicamento cadastrado com dosagem correta
- [ ] Protocolo criado com nome descritivo
- [ ] Titulação habilitada com todas as etapas configuradas
- [ ] Horários de tomada adicionados (`time_schedule`)
- [ ] Estoque adicionado (opcional, mas útil)
- [ ] Primeiro registro de dose realizado
- [ ] Dashboard mostrando progresso da titulação

---

## 🔧 Dicas e Boas Práticas

1. **Comprimidos Fracionados**: O sistema suporta doses decimais (ex: `1.5`). Ao registrar, ele decrementará corretamente do estoque.

2. **Nomeclatura Clara**: Use nomes de protocolos que sejam fáceis de identificar (ex: `BB - Metoprolol` ao invés de apenas "Selozok").

3. **Planos de Tratamento**: Se você toma vários medicamentos para a mesma condição (ex: "Cardiomiopatia"), agrupe-os em um Plano. Isso permite registrar todos de uma vez.

4. **Notas nas Etapas**: Use o campo "Nota / Objetivo" para documentar a dose total diária (ex: `75mg 2x ao dia`), facilitando a visualização.

5. **Monitoramento**: Acompanhe no Dashboard a barra de progresso. Quando chegar em 100%, prepare-se para a próxima etapa.

6. **Sincronização com Médico**: Sempre siga as orientações médicas. Este sistema é uma ferramenta de auxílio, não substitui consultas.

---

## ❓ Perguntas Frequentes

**P: E se eu esquecer de tomar uma dose?**  
R: Você pode registrar manualmente ajustando a data/hora no formulário de registro.

**P: Posso editar o protocolo depois de criado?**  
R: Sim! Vá em Protocolos → clique no protocolo → Editar. Mas lembre-se: alterar o `titration_schedule` pode afetar o cálculo de progresso.

**P: O que acontece quando a última etapa termina?**  
R: Você deve editar o protocolo, desmarcar "Regime de Titulação" e definir manualmente `titration_status` para `'alvo_atingido'`.

**P: Posso ter múltiplos protocolos para o mesmo medicamento?**  
R: Sim! Por exemplo, um para titulação e outro para manutenção (mas apenas um deve estar ativo por vez para evitar desconto duplo de estoque).

---

## 🚀 Próximos Passos (Sugestões de Melhoria)

Baseado na análise do código, aqui estão melhorias que podem ser implementadas:

1. **Transição Automática de Etapas**: Quando `isTransitionDue = true`, mostrar um banner no Dashboard com botão "Avançar para Próxima Etapa" que automaticamente:
   - Incrementa `current_stage_index`
   - Atualiza `stage_started_at` para hoje
   - Atualiza `dosage_per_intake` para a dose da nova etapa

2. **Alertas de Transição**: Notificação 1-2 dias antes do fim da etapa para preparar a próxima dose.

3. **Histórico de Etapas**: Registrar em uma tabela separada cada transição de etapa para auditoria.

4. **Visualização Gráfica**: Gráfico mostrando a evolução da dose ao longo do tempo.

---

**Desenvolvido com ❤️ para facilitar o gerenciamento de medicamentos complexos.**
