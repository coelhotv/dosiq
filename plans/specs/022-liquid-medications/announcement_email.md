# E-mail de Anúncio - Medicamentos Líquidos (Spec 022)

**Assunto:** 💧 Novidade no Dosiq: Chegou o suporte completo para medicamentos líquidos! (Gotas, xaropes e injetáveis)

**Olá, [Nome do Cliente]!**

Se você utiliza medicamentos em gotas, xaropes, suspensões orais ou mesmo soluções injetáveis (como insulinas), temos uma excelente notícia para você. 

Sabemos que gerenciar medicamentos líquidos sempre foi um desafio. Registrar "15 gotas" como se fossem "15 comprimidos" ou tentar controlar o volume restante de um xarope no olho não era o ideal. 

Por isso, acabamos de liberar a maior atualização de usabilidade do Dosiq: o **suporte nativo e completo a medicamentos líquidos**! 

---

### 🌟 O que muda a partir de agora?

1. **Tomadas com a unidade certa:** Agora você configura e registra suas doses usando unidades reais como **gotas**, **ml** ou **UI** (Unidades Internacionais). No aplicativo e nos alarmes, você verá exatamente o que deve tomar: *"Tomar 15 gotas"* ou *"Tomar 2,5 ml"*, sem gambiarras.
2. **Inventário Inteligente (Frasco a Frasco):** Chega de registrar estoque somando tudo em um único lugar. Ao adicionar estoque de líquidos, você informa quantos frascos comprou, o volume de cada um (ex: 2 frascos de 50 ml) e o preço total. O Dosiq calcula o custo exato por mL e por dose do seu tratamento!
3. **Baixa Automática por FIFO:** Conforme você confirma suas tomadas, o sistema vai reduzindo os mililitros do seu frasco ativo. Ao acabar um frasco, ele abre o próximo do estoque automaticamente.
4. **Alerta de Fim de Frasco:** Quando o seu frasco ativo estiver quase no fim e o saldo não for suficiente para a próxima dose, o Dosiq exibirá um banner de aviso: *"Seu frasco ativo está no fim. Lembre-se de abrir um novo frasco!"*.
5. **Telegram muito mais prático:** Os lembretes e o botão `✅ Tomei` no Telegram agora exibem a dose exata (ex: *"Hora da sua Dipirona! Tomar 1 gota agora"*).
   > *Nota: Para garantir que o cálculo de gotas para ml e o estoque fiquem 100% corretos, o comando manual `/registrar` foi desativado no Telegram. Use sempre o botão rápido "Tomei" ou o aplicativo.*

---

### 🛠️ Passo a Passo: Como adaptar seus medicamentos líquidos hoje mesmo

Para que você possa usufruir de todos os benefícios, siga estes passos simples para ajustar suas configurações:

#### Passo 1: Revisar seus medicamentos existentes (Migrados)
Se você já tinha medicamentos como *Dipirona* ou *Ibuprofeno* cadastrados em "gotas" ou "ml", o Dosiq já realizou uma migração automática e segura para você:
* A concentração deles foi ajustada para o formato correto (`mg/ml`).
* **Dica de Ouro:** Se você quiser que o Dosiq mostre a quantidade de princípio ativo (massa em mg) nos relatórios médicos, edite o medicamento e preencha a concentração ativa do frasco (ex: 500 mg por mL). Se preferir, pode deixar em branco e controlar apenas pelas gotas/ml.

#### Passo 2: Configurar o seu Tratamento (Dose de Tomada)
Ao criar ou editar um tratamento de medicamento líquido:
1. Vá até a aba **Tratamentos** e edite o agendamento desejado.
2. Selecione a unidade física de tomada correta: **gotas**, **ml** ou **UI**.
3. Se você escolher **gotas** ou **UI**, informe a densidade do medicamento (ex: para gotas, o padrão de mercado é `20` gotas por ml; para insulinas U-100, o padrão é `100` UI por ml). Isso permite que o Dosiq faça a baixa exata de mL no seu estoque!

#### Passo 3: Cadastrar as novas compras no Estoque
Da próxima vez que comprar um medicamento líquido, use a nova seção **Inventário de Líquidos**:
1. Acesse o **Estoque** do medicamento.
2. Informe o número de **frascos** comprados e o **volume em ml** de cada um.
3. Digite o **Preço Total da Compra**. O sistema fará todo o cálculo de desmembramento de frascos e custo médio de forma transparente.

---

A atualização já está disponível na versão Web/PWA e nas lojas de aplicativos (App Store e Google Play). Atualize o seu aplicativo e comece a usar!

Dúvidas ou feedbacks? Responda a este e-mail ou use o canal de feedback diretamente no menu de Perfil do seu aplicativo.

Abraços,
**Equipe Dosiq**
