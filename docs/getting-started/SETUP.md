# Meus Remédios - Guia de Configuração

Este guia vai te ajudar a configurar todos os serviços necessários para rodar o projeto.

## 📋 Pré-requisitos

- Conta no GitHub (gratuita)
- Conta no Supabase (gratuita)
- Conta no Vercel (gratuita)

---

## 🗄️ Passo 1: Configurar Supabase (Banco de Dados)

### 1.1 Criar conta no Supabase

1. Acesse: https://supabase.com
2. Clique em "Start your project"
3. Faça login com sua conta do GitHub (recomendado)

### 1.2 Criar novo projeto

1. No dashboard do Supabase, clique em "New Project"
2. Preencha:
   - **Name**: `meu-remedio`
   - **Database Password**: Crie uma senha forte (anote ela!)
   - **Region**: Escolha `South America (São Paulo)` para menor latência
   - **Pricing Plan**: Free (gratuito)
3. Clique em "Create new project"
4. Aguarde ~2 minutos enquanto o projeto é criado

### 1.3 Obter credenciais do projeto

1. No menu lateral, clique em **Settings** (ícone de engrenagem)
2. Clique em **API**
3. Você verá duas informações importantes:
   - **Project URL**: algo como `https://xxxxx.supabase.co`
   - **anon public**: uma chave longa começando com `eyJ...`
4. **ANOTE ESSAS DUAS INFORMAÇÕES** - você vai precisar delas!

### 1.4 Criar as tabelas do banco de dados (SQL Consolidado)

1. No menu lateral, clique em **SQL Editor**
2. Clique em "New query"
3. Cole o seguinte SQL (que já inclui Planos de Tratamento e Titulação):

```sql
-- 1. Tabela de medicamentos
CREATE TABLE medicines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  laboratory TEXT,
  active_ingredient TEXT,
  dosage_per_pill NUMERIC,
  dosage_unit TEXT DEFAULT 'mg',
  type TEXT DEFAULT 'medicine',
  price_paid NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
);

-- 2. Tabela de Planos de Tratamento (Agrupadores)
CREATE TABLE treatment_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
);

-- 3. Tabela de protocolos
CREATE TABLE protocols (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
  treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  frequency TEXT,
  time_schedule JSONB,
  dosage_per_intake NUMERIC,
  target_dosage NUMERIC,
  titration_status TEXT DEFAULT 'estável',
  titration_schedule JSONB,
  current_stage_index INTEGER DEFAULT 0,
  stage_started_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
);

-- 4. Tabela de estoque
CREATE TABLE stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL,
  purchase_date DATE,
  expiration_date DATE,
  unit_price NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
);

-- 5. Tabela de logs de medicamentos tomados
CREATE TABLE medicine_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_id UUID REFERENCES protocols(id) ON DELETE SET NULL,
  medicine_id UUID REFERENCES medicines(id) ON DELETE CASCADE,
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quantity_taken NUMERIC NOT NULL,
  notes TEXT,
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
);

-- Índices para melhor performance
CREATE INDEX idx_protocols_medicine ON protocols(medicine_id);
CREATE INDEX idx_protocols_plan ON protocols(treatment_plan_id);
CREATE INDEX idx_stock_medicine ON stock(medicine_id);
CREATE INDEX idx_logs_protocol ON medicine_logs(protocol_id);
CREATE INDEX idx_logs_medicine ON medicine_logs(medicine_id);
CREATE INDEX idx_logs_taken_at ON medicine_logs(taken_at DESC);

-- 6. Tabela de configurações de usuário (Telegram)
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' UNIQUE,
  telegram_chat_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insere configuração padrão para o usuário piloto
INSERT INTO user_settings (user_id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
```

4. Clique em **Run** (ou pressione Ctrl+Enter)
5. Você deve ver "Success. No rows returned". 🎉

---

## 🔑 Passo 2: Configurar variáveis de ambiente locais

1. No projeto, copie o arquivo `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Abra o arquivo `.env` e preencha com as credenciais do Supabase:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

3. Adicione também a configuração do Telegram (obtenha seu token com o [@BotFather](https://t.me/botfather)) e a chave master do Supabase (para o Bot):
   ```
   TELEGRAM_BOT_TOKEN=seu_token_aqui
   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
   ```

4. Salve o arquivo

---

## 🐙 Passo 3: Criar repositório no GitHub

### 3.1 Criar repositório privado

1. Acesse: https://github.com/new
2. Preencha:
   - **Repository name**: `meu-remedio`
   - **Description**: "Aplicativo de gerenciamento de medicamentos"
   - **Visibility**: Private (privado)
   - **NÃO** marque "Add a README file"
3. Clique em "Create repository"

### 3.2 Conectar o projeto local ao GitHub

O GitHub vai mostrar instruções. Use estas (já adaptadas):

```bash
cd /Users/coelhotv/.gemini/antigravity/playground/glacial-photosphere/meu-remedio
git add .
git commit -m "Initial commit: Meu Remédio setup"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/meu-remedio.git
git push -u origin main
```

**Substitua `SEU-USUARIO` pelo seu nome de usuário do GitHub!**

---

## 🚀 Passo 4: Deploy no Vercel

### 4.1 Criar conta no Vercel

1. Acesse: https://vercel.com
2. Clique em "Sign Up"
3. Escolha "Continue with GitHub"
4. Autorize o Vercel a acessar sua conta do GitHub

### 4.2 Importar projeto

1. No dashboard do Vercel, clique em "Add New..." → "Project"
2. Você verá uma lista dos seus repositórios do GitHub
3. Encontre `meu-remedio` e clique em "Import"
4. Configure o projeto:
   - **Framework Preset**: Vite (deve detectar automaticamente)
   - **Root Directory**: `./` (deixe como está)
   - **Build Command**: `npm run build` (já preenchido)
   - **Output Directory**: `dist` (já preenchido)

### 4.3 Adicionar variáveis de ambiente

1. Expanda a seção **Environment Variables**
2. Adicione as mesmas variáveis do arquivo `.env`:
   - **Name**: `VITE_SUPABASE_URL`
   - **Value**: Cole a URL do Supabase
   - Clique em "Add"
   
   - **Name**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: Cole a chave anon do Supabase
   - Clique em "Add"

   - **Name**: `TELEGRAM_BOT_TOKEN`
   - **Value**: Cole seu token do bot do Telegram
   - Clique em "Add"

   - **Name**: `CRON_SECRET`
   - **Value**: Crie uma senha qualquer (ex: `super-secreto-123`)
   - Clique em "Add"

3. Clique em "Deploy"

### 4.4 Ativar Notificações (Telegram Webhook)

Após o deploy no Vercel, você precisa avisar ao Telegram para onde enviar as mensagens:

1. Copie a URL gerada pelo Vercel (ex: `https://seu-app.vercel.app`)
2. Execute o seguinte comando no seu terminal local (substituindo a URL e o TOKEN se não tiver o .env configurado):
   ```bash
   curl "https://api.telegram.org/bot$(grep TELEGRAM_BOT_TOKEN .env | cut -d '=' -f2)/setWebhook?url=https://meus-remedios.vercel.app/api/telegram"
   ```
3. No Telegram, abra seu bot e envie o comando `/start`.

### 4.5 Configurar Agendamento Externo (Grátis)

Como o plano gratuito do Vercel tem limites de Cron Jobs, usaremos um serviço externo gratuito para "apertar" o gatilho a cada minuto:

1. Crie uma conta em **[cron-job.org](https://cron-job.org/en/)** (é grátis).
2. Clique em **"Create Cronjob"**.
3. **URL**: `https://seu-app.vercel.app/api/notify`
4. **Execution schedule**: Every minute (`* * * * *`).
5. Em **Advanced**, seção **Headers**:
   - Key: `Authorization`
   - Value: `Bearer super-secreto-123` (a mesma senha que você colocou no Vercel no passo 4.3)
6. Salve o job.

1. O Vercel vai começar a fazer o build e deploy
2. Aguarde ~1-2 minutos
3. Quando terminar, você verá "Congratulations!" 🎉
4. Clique no link para ver seu app online!

---

## ✅ Verificação

Se tudo deu certo, você deve conseguir:

1. Acessar o app no link do Vercel (algo como `meu-remedio.vercel.app`)
2. Ver a interface em português
3. O tema deve estar escuro (se seu sistema estiver em dark mode)

---

## 🆘 Problemas comuns

### "Failed to fetch" ou erro de conexão
- Verifique se as variáveis de ambiente estão corretas no Vercel
- Verifique se o projeto do Supabase está ativo

### Página em branco
- Abra o console do navegador (F12)
- Veja se há erros relacionados a variáveis de ambiente

### Deploy falhou no Vercel
- Verifique se o build funciona localmente: `npm run build`
- Veja os logs de erro no dashboard do Vercel

---

## 🧪 Passo 5: Testes Unitários

Para garantir que tudo está funcionando corretamente após a instalação:

1. No terminal, execute:
   ```bash
   npm test
   ```
2. Você verá o resultado dos testes unitários para os serviços de API e componentes principais.
3. Mantenha os testes passando ao realizar novas modificações!

---

## 📞 Próximos passos

Depois que tudo estiver funcionando, você pode:

1. Testar o app localmente: `npm run dev`
2. Rodar a suíte de testes: `npm test`
3. Começar a adicionar remédios e protocolos
4. Reportar bugs ou sugerir melhorias

---

**Dúvidas?** Pergunte ao desenvolvedor! 😊
