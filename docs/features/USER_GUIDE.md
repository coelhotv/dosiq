# 📖 Guia do Usuário

Bem-vindo ao **Dosiq**! Este guia explica como utilizar as principais funcionalidades do aplicativo.

## 🔑 1. Autenticação e Perfil

Ao acessar o app pela primeira vez, você precisará criar uma conta.
- **Registro**: Use um email válido e senha de no mínimo 6 caracteres.
- **Configurações**: Clique no seu nome/avatar no canto superior direito para trocar senha ou configurar o Telegram.
- **Migração**: Se você usou o app na fase "piloto" (sem login), vá em Configurações e clique em **"Migrar Dados Antigos"** para trazer seus dados para sua nova conta.

## 💊 2. Cadastrando Medicamentos

Vá na aba **Remédios** para cadastrar o que você toma.
- O campo **"Dosagem por Unidade"** deve refletir quanto cada comprimido/gota contém (ex: 50mg).
- Isso é fundamental para calcular o estoque e o consumo corretamente.

## 📋 3. Criando Protocolos

O protocolo define *como* e *quando* você toma o remédio.
- **Planos de Tratamento**: Você pode agrupar vários remédios sob um único plano (ex: "Protocolo Anti-Inflamatório").
- **Horários**: Você pode definir múltiplos horários por dia.
- **Titulação**: Se você precisa aumentar a dose gradualmente, ative a **Titulação de Dose** e defina os estágios (ex: 1 comprimido por 7 dias, depois 2 comprimidos).

## 📦 4. Gerindo o Estoque

Na aba **Estoque**, você registra as caixas que comprou.
- O app utiliza o método **PEPS (Primeiro que Entra, Primeiro que Sai)**. Ele descontará sempre da caixa mais antiga registrada.
- Quando você registra uma tomada (Log), o estoque é reduzido automaticamente.

## 🗓️ 5. Dashboard e Calendário

O **Início** (Dashboard) mostra o que você tem para tomar hoje.
- **Cores**: Verde (tomado), Amarelo (pendente/horário passou), Branco (futuro).
- **Calendário**: No Dashboard, clique em qualquer data no calendário para ver o que foi tomado naquele dia específico.

## 🤖 6. Bot do Telegram

Vincule seu Telegram para receber lembretes.
1. Vá em **Configurações > Integração Telegram**.
2. Clique em **Gerar Código**.
3. Clique no link para abrir o Bot e envie o comando `/start SEU_CODIGO`.
4. O Bot enviará botões de **"Tomado"** nos horários agendados. Ao clicar, o registro é feito automaticamente no app!

## 📊 7. Histórico e Edições

Na aba **Histórico**, você vê tudo o que tomou.
- Você pode editar a quantidade ou o horário de uma dose já registrada.
- Ao excluir um log, o remédio volta automaticamente para o seu estoque.
