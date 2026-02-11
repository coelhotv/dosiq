# 💊 Meus Remédios

**Aplicativo de gerenciamento de medicamentos em português brasileiro**

Gerencie seus medicamentos, protocolos de tratamento e estoque de forma simples e eficiente. Agora com **Autenticação Multi-usuário**, **Planos de Tratamento complexos** e **Titulação de Dose**.

![Version](https://img.shields.io/badge/version-2.6.0-blue?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B3?style=for-the-badge&logo=zod&logoColor=white)
![Coverage](https://img.shields.io/badge/coverage-110%2B%20tests-brightgreen?style=for-the-badge)

---

## 🎯 Funcionalidades (v2.7.0)

### Core
- ✅ **Autenticação Segura**: Login e registro via Supabase Auth (Email/Senha).
- ✅ **Isolamento de Dados**: Sistema multi-usuário com Row-Level Security (RLS) rigoroso.
- ✅ **Perfil de Usuário**: Gerenciamento de conta, troca de senha e vínculo de Telegram.
- ✅ **Migração Pilot-to-Auth**: Ferramenta automática para migrar dados da fase piloto para conta autenticada.

### Fase 3.6 - Consolidação de Componentes
- ✅ **~783 linhas de código removidas** através da consolidação de 6 grupos de componentes
- ✅ **MedicineForm Unificado**: Consolidado com FirstMedicineStep via props de onboarding (`autoAdvance`, `onSuccess`)
- ✅ **ProtocolForm com Modos**: Suporte a `mode='full'|'simple'` para formulários completos e onboarding simplificado
- ✅ **Calendar Consolidado**: Features opcionais via props (`enableLazyLoad`, `enableSwipe`, `enableMonthPicker`)
- ✅ **AlertList Componente Base**: Componente genérico em `ui/` para SmartAlerts e StockAlertsWidget
- ✅ **LogForm UX Padronizada**: Experiência unificada entre Dashboard e History (botão "Plano Completo")
- ✅ **100% Backward Compatibility**: Todas as mudanças mantêm compatibilidade total com código existente
- ✅ **Zero Breaking Changes**: APIs públicas preservadas, apenas adições de props opcionais

### Fase 3.5 - Design Uplift
- ✅ **Glassmorphism Hierárquico**: 4 níveis de intensidade (light, standard, heavy, hero) com diferentes opacidades e blur
- ✅ **Gradientes Temáticos**: Gradientes para insight (cyan→purple), hero, alert-critical e success
- ✅ **Micro-interações**: Scale effects, glow transitions, hover/active states em todos os componentes interativos
- ✅ **Tokens CSS Completos**: Sistema de tokens para colors, borders, shadows, spacing e transitions
- ✅ **InsightCard**: Componente com 11 variantes de insight dinâmico (streak_motivation, stock_alert, adherence_drop, etc.)
- ✅ **useAdherenceTrend**: Hook para cálculo de tendência de adesão
- ✅ **useInsights**: Hook para geração dinâmica de insights do usuário
- ✅ **adherenceTrendService**: Serviço para processamento de dados de tendência
- ✅ **insightService**: Serviço com 11 variantes de insight

### Onda 1 - Qualidade & Performance
- ✅ **Validação Zod Runtime**: 23 testes de validação eliminando erros silenciosos.
- ✅ **Cache SWR**: 95% de melhoria no carregamento do dashboard (30s stale time).
- ✅ **[Onboarding 4 Steps](./docs/QUICKSTART.md#onboarding-wizard)**: Wizard guiado para novos usuários:
  1. **Boas-vindas** - Apresentação do app
  2. **Medicamento** - Cadastro do primeiro remédio
  3. **Protocolo** - Configuração da primeira rotina
  4. **Telegram** - Integração com bot de lembretes
- ✅ **View Otimizada de Estoque**: `medicine_stock_summary` com 5x mais performance.
- ✅ **Persistência de Sessões Bot**: TTL 30min para sessões conversacionais do Telegram.

### Gerenciamento de Tratamento
- ✅ **Integração Telegram 2.0**: Vínculo seguro via token temporário e suporte multi-usuário no bot.
- ✅ **Calendário Interativo**: Visualização mensal de doses tomadas com navegação e seleção de data.
- ✅ **Histórico Completo**: Visualização detalhada integrada ao calendário com suporte a edições rápidas.
- ✅ **Edição e Exclusão**: Flexibilidade total para ajustar registros passados com restauração automática de estoque.
- ✅ **Registros Retroativos**: Registro de doses em qualquer data/hora com ajuste de fuso horário local.
- ✅ **Dashboard Premium**: Interface Neo-Glass com saudações dinâmicas e indicadores em tempo real.
- ✅ **Garantia de Qualidade**: Suíte de testes unitários com Vitest (110+ testes) e linting rigoroso.

## 🚀 Roadmap Futuro

- 🤖 **IA Médico-Assistente**: Insights sobre os protocolos com base em diretrizes médicas.
- 📊 **Relatórios de Titulação**: Gráficos de evolução da dosagem ao longo do tempo.
- 🔒 **Backup Criptografado**: Exportação e importação de dados de forma segura.

---

## 🛠️ Tecnologias

- **Frontend**: React 19 + Vite (ES Modules nativo)
- **Backend**: Supabase (PostgreSQL + REST API + Auth)
- **Validação**: Zod 4.x (Schemas runtime com TypeScript-like inference)
- **Cache**: SWR (Stale-While-Revalidate) customizado - 95% mais rápido
- **Styling**: CSS Vanilla com design system customizado
- **Deployment**: Vercel (Frontend, API Webhooks & Cron Jobs) + Supabase (Database)
- **Testes**: Vitest + React Testing Library (110+ testes)
- **Custo**: R$ 0 (tier gratuito)

---

## 📦 Instalação

### Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase (gratuita)
- Conta no Vercel (gratuita, opcional para deploy)
- Conta no GitHub (gratuita, para versionamento)

### Passo a Passo

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/SEU-USUARIO/meu-remedio.git
    cd meu-remedio
    ```

2.  **Instale as dependências**:
    ```bash
    npm install
    ```

3.  **Configure o Supabase**:
    - Siga o guia completo em [SETUP.md](./docs/SETUP.md)
    - Crie um projeto no Supabase
    - Execute o SQL para criar as tabelas
    - Copie as credenciais

4.  **Configure as variáveis de ambiente**:
    ```bash
    cp .env.example .env
    ```
    
    Edite o arquivo `.env` e adicione suas credenciais do Supabase:
    ```
    VITE_SUPABASE_URL=https://seu-projeto.supabase.co
    VITE_SUPABASE_ANON_KEY=sua-chave-aqui
    ```

5.  **Rode o servidor de desenvolvimento**:
    ```bash
    npm run dev
    ```

6.  **Acesse o app**:
    Abra [http://localhost:5173](http://localhost:5173) no navegador

---

## 📚 Documentação

### 🚀 Para Começar
- **[SETUP.md](./docs/SETUP.md)**: Guia completo de configuração do Supabase, GitHub e Vercel
- **[docs/QUICKSTART.md](./docs/QUICKSTART.md)**: Início rápido para desenvolvedores (inclui onboarding)

### 🏗️ Arquitetura & Design
- **[docs/ARQUITETURA.md](./docs/ARQUITETURA.md)**: Visão geral da arquitetura do projeto
- **[docs/PADROES_CODIGO.md](./docs/PADROES_CODIGO.md)**: Padrões e convenções de código
- **[docs/past_deliveries/DECISOES_TECNICAS.md](./docs/past_deliveries/DECISOES_TECNICAS.md)**: Decisões técnicas da Onda 1 (Zod, SWR, React 19)

### 💻 Referência Técnica
- **[docs/API_SERVICES.md](./docs/API_SERVICES.md)**: APIs internas dos services (com exemplos)
- **[docs/HOOKS.md](./docs/HOOKS.md)**: Hooks customizados documentados
- **[docs/past_deliveries/SCHEMAS_VALIDACAO.md](./docs/past_deliveries/SCHEMAS_VALIDACAO.md)**: Documentação dos schemas Zod (23 testes)
- **[docs/database-schema.md](./docs/database-schema.md)**: Esquema completo do banco de dados

### 📊 Performance & Benchmarks
- **[docs/past_deliveries/BENCHMARK_CACHE_SWR.md](./docs/past_deliveries/BENCHMARK_CACHE_SWR.md)**: Performance do cache SWR (95% melhoria)
- **[docs/past_deliveries/BENCHMARK_STOCK_VIEW.md](./docs/past_deliveries/BENCHMARK_STOCK_VIEW.md)**: Otimização de consultas de estoque

### 🎯 Funcionalidades Específicas
- **[docs/GUIA_TITULACAO.md](./docs/GUIA_TITULACAO.md)**: Tutorial prático de protocolos em titulação
- **[docs/TRANSICAO_AUTOMATICA.md](./docs/TRANSICAO_AUTOMATICA.md)**: Sistema de transição automática de doses
- **[docs/user-guide.md](./docs/user-guide.md)**: Guia do usuário em português

---

## 🏗️ Estrutura do Projeto

```
meu-remedio/
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes reutilizáveis consolidados 🆕
│   │   │   ├── Button, Card, Modal, Loading
│   │   │   ├── Calendar.jsx        # Features opcionais: lazyLoad, swipe
│   │   │   └── AlertList.jsx       # Componente base para alertas 🆕
│   │   ├── medicine/        # Componentes de medicamentos
│   │   │   └── MedicineForm.jsx    # Consolidado com FirstMedicineStep
│   │   ├── protocol/        # Componentes de protocolos
│   │   │   └── ProtocolForm.jsx    # Modo 'full'|'simple'
│   │   ├── stock/           # Componentes de estoque
│   │   ├── log/             # Componentes de registro
│   │   │   └── LogForm.jsx         # UX padronizada
│   │   ├── dashboard/       # Widgets do dashboard
│   │   │   ├── SmartAlerts.jsx     # Usa AlertList
│   │   │   └── StockAlertsWidget.jsx # Usa AlertList
│   │   ├── adherence/       # Componentes de adesão
│   │   └── onboarding/      # Wizard de onboarding (4 steps)
│   │       ├── FirstMedicineStep.jsx   # Wrapper de MedicineForm
│   │       └── FirstProtocolStep.jsx   # Wrapper de ProtocolForm
│   ├── hooks/
│   │   └── useCachedQuery.js # Hook SWR para cache de queries
│   ├── lib/
│   │   ├── supabase.js      # Cliente Supabase
│   │   └── queryCache.js    # Implementação SWR (Stale-While-Revalidate)
│   ├── schemas/             # Validação Zod
│   │   ├── index.js         # Exportações dos schemas
│   │   ├── medicineSchema.js
│   │   ├── protocolSchema.js
│   │   ├── stockSchema.js
│   │   ├── logSchema.js
│   │   └── validationHelper.js
│   ├── services/
│   │   ├── api/             # Serviços da API com validação Zod
│   │   │   ├── cachedServices.js  # Wrappers com cache SWR
│   │   │   ├── medicineService.js
│   │   │   ├── protocolService.js
│   │   │   ├── stockService.js
│   │   │   ├── logService.js
│   │   │   └── treatmentPlanService.js
│   │   └── api.js           # Exportações principais
│   ├── styles/
│   │   ├── tokens.css       # Design tokens (cores, espaçamentos)
│   │   └── index.css        # Estilos globais
│   ├── views/               # Páginas principais
│   ├── App.jsx              # Componente principal
│   └── main.jsx             # Entry point
├── docs/                    # Documentação técnica expandida 📚
│   ├── ARQUITETURA.md       # Visão arquitetural incluindo padrões consolidados
│   ├── PADROES_CODIGO.md    # Convenções e padrões de componentes
│   ├── API_SERVICES.md      # APIs dos services
│   ├── CSS_ARCHITECTURE.md  # Arquitetura CSS com AlertList patterns
│   └── HOOKS.md             # Hooks customizados
├── server/                  # Bot do Telegram (Node.js)
│   └── bot/
├── api/                     # API Serverless (Vercel)
├── .migrations/             # Migrações SQL
├── .env.example             # Template de variáveis de ambiente
├── SETUP.md                 # Guia de configuração
└── README.md                # Este arquivo
```

> 🆕 = Componentes consolidados na Fase 3.6 (Component Consolidation Wave)

---

## 🎨 Design System

O app usa um design system customizado com:

- **Cores Neon**: Cyan (#00f0ff), Magenta (#ff00ff), Purple (#b000ff)
- **Tema Escuro**: Suporte automático baseado nas preferências do sistema
- **Glass-morphism**: Efeitos de vidro com blur e transparência
- **Animações**: Transições suaves e micro-interações
- **Responsivo**: Mobile-first design

---

## 🧪 Garantia de Qualidade

O projeto utiliza uma suíte de testes unitários moderna para garantir a confiabilidade das regras de negócio:

- **Framework**: [Vitest](https://vitest.dev/) (Velocidade e compatibilidade com Vite)
- **Library**: [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- **Cobertura**: Services (API/Lógica de Negócio) e Componentes Críticos.

## 🧪 Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run preview      # Preview do build
npm run lint         # Linter ESLint
npm test             # Executa a suíte de testes unitários (Vitest)
npm run bot          # Inicia o bot do Telegram localmente (para desenvolvimento)
```

---

## 🚀 Deploy

### Deploy no Vercel

1. Conecte seu repositório GitHub ao Vercel
2. Configure as variáveis de ambiente no dashboard do Vercel
3. Deploy automático a cada push na branch `main`

Veja instruções detalhadas em [SETUP.md](./docs/SETUP.md#passo-4-deploy-no-vercel)

---

## 🤝 Contribuindo

Este é um projeto piloto em desenvolvimento. Sugestões e feedback são bem-vindos!

---

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes

---

## 👨‍💻 Desenvolvedor

Desenvolvido com ❤️ usando Google Antigravity, Kilo Code e Roo Code.

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique a documentação em [SETUP.md](./docs/SETUP.md)
2. Abra uma issue no GitHub
3. Entre em contato com o desenvolvedor

---

---

## 📝 Changelog

### v2.2.1 - Correções do Bot Telegram (2026-01-31)
- ✅ **Corrigido**: Bot agora funciona com múltiplos usuários (removido MOCK_USER_ID)
- ✅ **Corrigido**: Cron jobs notificam todos os usuários com Telegram vinculado
- ✅ **Adicionado**: Sistema de logs estruturados (ERROR → TRACE)
- ✅ **Adicionado**: Health checks via comando `/health`
- ✅ **Adicionado**: Reconexão automática em erros de rede
- ✅ **Adicionado**: Validação de token do Telegram na inicialização
- ✅ **Melhorado**: Tratamento de erros nos comandos do bot
- ✅ **Melhorado**: Cache de protocolos por usuário
- ✅ **Configuração**: Compatível com cron-job.org (GET requests com Authorization header)

### v2.0.0 - Multi-User Auth (Janeiro 2026)
- ✅ Autenticação segura via Supabase Auth
- ✅ Isolamento de dados com RLS
- ✅ Integração Telegram 2.0 com tokens temporários

---

**Versão**: 2.7.0 (Component Consolidation Wave)
**Última atualização**: 11 Fevereiro 2026
