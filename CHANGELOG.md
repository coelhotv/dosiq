# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [2.3.0] - 2026-02-03

### Onda 1 - Fundação: Testes, Validação, Cache e Onboarding

Esta release foca em fundamentos técnicos sólidos para suportar o crescimento do aplicativo, incluindo testes automatizados, validação de dados robusta, melhorias de performance e uma experiência de primeiro uso guiada.

### Adicionado

#### Validação Robusta com Zod (Tarefa 1.2)
- Schemas de validação completos para:
  - Medicamentos (`medicineSchema.js`) - 23 testes de validação
  - Protocolos (`protocolSchema.js`) - regras complexas de horários
  - Estoque (`stockSchema.js`) - validação de quantidades e datas
  - Logs (`logSchema.js`) - registro de doses tomadas
- Helper de validação (`validationHelper.js`) com mensagens de erro em português brasileiro
- Integração completa com todos os formulários existentes
- 23 testes unitários cobrindo edge cases e cenários de erro

#### Cache SWR - 95% Melhoria no Dashboard (Tarefa 1.5)
- Sistema de cache em memória com `QueryCache` (`src/lib/queryCache.js`)
- Hook React `useCachedQuery` com stale-while-revalidate
- Deduplicação automática de requests simultâneos
- Serviços cacheados (`cachedServices.js`) para medicines, protocols e logs
- **Resultado**: 95% de melhoria no carregamento do Dashboard (de ~2s para ~100ms)
- Revalidação background após 30 segundos (stale time)
- Prevenção de memory leak com limite de 50 entradas no cache

#### Onboarding Wizard - 4 Passos (Tarefa 1.4)
- Wizard mobile-first com interface intuitiva
- 4 passos guiados:
  1. **WelcomeStep** - Boas-vindas e apresentação do app
  2. **FirstMedicineStep** - Cadastro do primeiro medicamento
  3. **FirstProtocolStep** - Configuração da primeira rotina
  4. **TelegramIntegrationStep** - Integração com bot de lembretes
- Persistência de progresso no localStorage
- Validação em tempo real com Zod
- Componente `OnboardingProvider` para controle de estado
- Estilos dedicados para cada step (CSS modules)

#### Persistência de Sessões do Bot Telegram (Tarefa 1.3)
- `SessionManager` com persistência no Supabase (`server/services/sessionManager.js`)
- TTL configurável de 30 minutos para sessões conversacionais
- Cache local em memória para performance
- Auto-cleanup de sessões expiradas
- Suporte a múltiplos usuários simultâneos
- Testes de persistência simulando restart do servidor

#### View Otimizada de Estoque - 5x Mais Rápida (Tarefa 1.6)
- View SQL `medicine_stock_summary` no banco de dados
- Agregação em tempo real de quantidades por medicamento
- Índices otimizados para queries rápidas
- Políticas RLS integradas para segurança
- **Resultado**: 5x mais rápida que consultas anteriores (de ~500ms para ~100ms)
- Métodos no service: `getStockSummary()` e `getLowStockMedicines()`

#### Suíte de Testes Unitários - 110+ Testes (Tarefa 1.1)
- Setup completo com Vitest + jsdom + Testing Library
- Testes de componentes UI:
  - `Button.test.jsx` - interações e estados
  - `Card.test.jsx` - renderização e props
  - `Modal.test.jsx` - abertura/fechamento
- Testes de hooks:
  - `useCachedQuery` - cache e revalidação
- Testes de serviços:
  - `logService.test.js` - CRUD de logs
  - `stockService.test.js` - manipulação de estoque
- Testes de schemas:
  - `validation.test.js` - 23 casos de validação Zod
- Cobertura total: **~75%** (aumento de +65%)

### Melhorado

- **Performance do Dashboard**: Carregamento em < 100ms com cache ativo
- **Query de Estoque**: Tempo de resposta reduzido em 80%
- **Validação de Formulários**: Validação dupla (cliente + servidor) para segurança
- **Sessões Bot**: Persistência garantida após restart do servidor
- **Experiência de Primeiro Uso**: Onboarding guiado reduz abandono inicial

### Documentação

- `docs/BENCHMARK_CACHE_SWR.md` - Documentação detalhada da implementação SWR
- `docs/BENCHMARK_STOCK_VIEW.md` - Especificações da view otimizada
- `docs/SCHEMAS_VALIDACAO.md` - Guia de uso dos schemas Zod
- `docs/HOOKS.md` - Documentação dos hooks customizados
- `docs/QUICKSTART.md` - Guia rápido incluindo onboarding
- Atualização do README com métricas de performance

### Banco de Dados

#### Novas Tabelas/Views
```sql
-- View otimizada de estoque
medicine_stock_summary

-- Tabela de sessões do bot
bot_sessions (via SessionManager)
```

#### Migrações Necessárias
Execute as migrations na ordem:
1. `.migrations/create_medicine_stock_summary_view.sql`

### Segurança

- Validação de inputs em todos os endpoints
- Sanitização de dados com Zod antes de envio ao Supabase
- Proteção contra injeção via schemas tipados
- RLS policies atualizadas para novas views

### Breaking Changes

Nenhuma. Esta é uma release minor (`2.2.1` → `2.3.0`) com adição de funcionalidades mantendo compatibilidade total.

### Como Atualizar

1. **Aplicar migrações SQL**:
   ```bash
   # Execute no Supabase SQL Editor
   .migrations/create_medicine_stock_summary_view.sql
   ```

2. **Instalar dependências**:
   ```bash
   npm install
   ```

3. **Verificar instalação**:
   ```bash
   npm test
   npm run build
   ```

### Métricas da Release

| Métrica | Valor |
|---------|-------|
| Versão Anterior | 2.2.1 |
| Versão Atual | 2.3.0 |
| Tipo | Minor |
| Testes Adicionados | 110+ |
| Cobertura de Testes | ~75% |
| Melhoria Dashboard | 95% |
| Melhoria Query Estoque | 5x |
| Arquivos Criados | 25+ |
| Documentações | 4 novas |

---

## [2.2.1] - 2026-01-30

### Adicionado
- Autenticação segura via Supabase Auth
- Sistema multi-usuário com RLS
- Integração Telegram 2.0
- Dashboard Premium (Neo-Glass)
- Calendário interativo
- Histórico completo de doses

[2.3.0]: https://github.com/seu-usuario/meus-remedios/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/seu-usuario/meus-remedios/releases/tag/v2.2.1
