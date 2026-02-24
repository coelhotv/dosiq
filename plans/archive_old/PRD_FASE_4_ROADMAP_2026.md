# PRD Fase 4: Instalabilidade e Navegacao

**Versao:** 1.0  
**Status:** DRAFT  
**Data:** 08/02/2026  
**Fase do Roadmap:** 4 de 7  
**Baseline:** Fase 3 concluida  
**Principio:** Custo operacional R$ 0  

---

## 1. Visao Geral e Objetivos Estrategicos

A Fase 4 torna o Meus Remedios instalavel como PWA, implementa navegacao compartilhavel via deep links e habilita notificacoes push nativas do navegador. Tambem inclui refatoracao tecnica do bot e organizacao de features para sustentabilidade do codigo.

### Objetivos Estrategicos

| ID | Objetivo | Metrica Primaria |
|----|----------|-----------------|
| OE4.1 | Tornar o app instalavel em dispositivos moveis | Instalacoes PWA > 30% usuarios mobile |
| OE4.2 | Habilitar notificacoes push nativas | Opt-in push > 50% usuarios |
| OE4.3 | Permitir navegacao compartilhavel e deep linking | Deep links utilizados > 20% sessoes |
| OE4.4 | Melhorar sustentabilidade do codigo (bot + features) | Reducao de duplicacao > 30% |

### Pre-requisitos

- Fase 3 concluida (para deep links referenciarem novas telas)
- Vercel Hobby tier operacional
- Telegram Bot API funcional
- Service Worker basico (sera criado nesta fase)

---

## 2. Escopo de Features

| ID | Feature | Prioridade | Story Points | Novas Dependencias |
|----|---------|------------|-------------|-------------------|
| F4.1 | Hash Router + Deep Linking | P0 | 8 | Nenhuma (custom hook) |
| F4.2 | PWA (manifest, service worker, cache) | P0 | 13 | vite-plugin-pwa (~50KB) |
| F4.3 | Push Notifications (Web Push + VAPID) | P0 | 8 | web-push (~30KB, server) |
| F4.4 | Analytics Local - Integracao PWA | P1 | 3 | Nenhuma |
| F4.5 | Padronizacao Bot (code standards) | P1 | 5 | Nenhuma |
| F4.6 | Organizacao Features (refactor) | P1 | 5 | Nenhuma |

**Esforco Total:** 42 story points  
**Novas dependencias npm:** vite-plugin-pwa (client), web-push (server)  

### Fora de Escopo

- Modo offline completo com sync (Fase 6)
- Notificacoes avancadas para cuidador (Fase 6/7)
- Alteracoes no modelo de dados Supabase
- App stores (Google Play, App Store)

---

## 3. Descricao Detalhada de Features

### F4.1 Hash Router + Deep Linking

**Titulo:** Sistema de rotas baseado em hash com suporte a deep linking  
**Rastreabilidade:** Roadmap 2026 - Fase 4, P11  

**Descricao:**  
Implementar roteamento baseado em hash (`#/rota`) para permitir navegacao compartilhavel e deep linking a partir do bot Telegram. Cada tela principal do app tera uma rota unica que pode ser compartilhada via URL. O bot podera enviar links diretos para telas especificas (ex: `#/estoque`, `#/relatorio`).

**Requisitos Tecnicos:**
- Hook `src/hooks/useHashRouter.js` (leitura/escrita de hash, historico)
- Componente `src/components/navigation/HashRouter.jsx` (renderiza rota ativa)
- Mapeamento de rotas em `src/constants/routes.js`
- Suporte a parametros: `#/medicamento/:id`, `#/relatorio/:periodo`
- Integracao com bot: links no formato `https://app.url/#/rota`
- Fallback para rota padrao (`#/dashboard`) se rota invalida

**Rotas Definidas:**

| Rota | Tela | Parametros |
|------|------|-----------|
| `#/dashboard` | Dashboard (HCC) | - |
| `#/medicamentos` | Lista de medicamentos | - |
| `#/medicamento/:id` | Detalhe do medicamento | id |
| `#/estoque` | Gestao de estoque | - |
| `#/historico` | Historico de doses | - |
| `#/historico/:periodo` | Historico filtrado | periodo (7d/30d/90d) |
| `#/protocolos` | Lista de protocolos | - |
| `#/perfil` | Perfil e configuracoes | - |
| `#/onboarding` | Wizard de onboarding | - |

**Criterios de Aceitacao:**
- [ ] Navegacao entre telas atualiza o hash da URL
- [ ] Compartilhar URL com hash abre a tela correta
- [ ] Botao voltar do navegador funciona corretamente
- [ ] Rotas invalidas redirecionam para `#/dashboard`
- [ ] Parametros de rota acessiveis via hook
- [ ] Links do bot Telegram abrem a tela correta no app
- [ ] Transicao entre rotas < 100ms

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-4.1.1 | Usuario | Recebe link do bot `app.url/#/estoque` -> abre app na tela de estoque |
| UC-4.1.2 | Usuario | Navega para historico -> copia URL -> envia para medico -> medico abre na mesma tela |
| UC-4.1.3 | Usuario | Clica voltar no navegador -> retorna a tela anterior |
| UC-4.1.4 | Usuario | Acessa URL com rota invalida -> redirecionado para dashboard |

**Dependencias:** Nenhuma  
**Impacto Financeiro:** R$ 0  

---

### F4.2 PWA (Progressive Web App)

**Titulo:** Tornar o app instalavel como PWA com manifest, service worker e cache  
**Rastreabilidade:** Roadmap 2026 - Fase 4, P10  

**Descricao:**  
Configurar o Meus Remedios como Progressive Web App completo, permitindo instalacao na tela inicial de dispositivos moveis e desktop. Inclui manifest.json com icones, service worker com estrategia de cache StaleWhileRevalidate para API e CacheFirst para assets estaticos, e tela de splash.

**Requisitos Tecnicos:**
- Instalar `vite-plugin-pwa` e configurar em `vite.config.js`
- Criar `public/manifest.json` com metadados do app
- Icones em multiplas resolucoes: 72, 96, 128, 144, 152, 192, 384, 512px
- Service Worker com Workbox (via vite-plugin-pwa):
  - CacheFirst para assets estaticos (JS, CSS, imagens)
  - StaleWhileRevalidate para chamadas API Supabase
  - NetworkFirst para dados criticos (registros de dose)
- Prompt de instalacao customizado (beforeinstallprompt)
- Componente `src/components/pwa/InstallPrompt.jsx`
- Meta tags para iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`

**Manifest:**

```json
{
  "name": "Meus Remedios",
  "short_name": "MeusRemedios",
  "description": "Gestao inteligente de medicamentos",
  "start_url": "/#/dashboard",
  "display": "standalone",
  "background_color": "#0a0a0f",
  "theme_color": "#6366f1",
  "orientation": "portrait",
  "categories": ["health", "medical"]
}
```

**Estrategias de Cache:**

| Recurso | Estrategia | TTL | Tamanho Max |
|---------|-----------|-----|-------------|
| JS/CSS bundles | CacheFirst | 30 dias | 50MB |
| Imagens/SVG | CacheFirst | 30 dias | 20MB |
| API Supabase (leitura) | StaleWhileRevalidate | 5 min | 10MB |
| API Supabase (escrita) | NetworkOnly | - | - |
| Fontes | CacheFirst | 90 dias | 5MB |

**Criterios de Aceitacao:**
- [ ] App instalavel em Android via "Adicionar a tela inicial"
- [ ] App instalavel em iOS via "Adicionar a tela de inicio" (Safari)
- [ ] App instalavel em desktop (Chrome, Edge)
- [ ] Service Worker registrado e funcional
- [ ] Cache de assets estaticos funcionando (navegacao offline parcial)
- [ ] Prompt de instalacao customizado exibido (Android/desktop)
- [ ] Lighthouse PWA score >= 90
- [ ] Splash screen exibida durante carregamento
- [ ] `start_url` abre no dashboard

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-4.2.1 | Usuario Android | Acessa app -> prompt "Instalar Meus Remedios?" -> aceita -> icone na tela inicial -> abre como app standalone |
| UC-4.2.2 | Usuario iOS | Acessa app no Safari -> toca "Compartilhar" -> "Adicionar a tela de inicio" -> icone criado |
| UC-4.2.3 | Usuario | Abre app instalado sem internet -> ve dados em cache -> tenta registrar dose -> fila para sync quando online |
| UC-4.2.4 | Usuario | Atualiza app -> service worker atualiza cache em background -> proxima visita usa versao nova |

**Dependencias:** F4.1 (Hash Router para start_url)  
**Impacto Financeiro:** R$ 0  

---

### F4.3 Push Notifications (Web Push + VAPID)

**Titulo:** Notificacoes push nativas via Web Push API com chaves VAPID  
**Rastreabilidade:** Roadmap 2026 - Fase 4, P10b  

**Descricao:**  
Implementar notificacoes push nativas do navegador usando Web Push API com autenticacao VAPID. Permite enviar lembretes de dose e alertas de estoque mesmo quando o app nao esta aberto. Complementa (nao substitui) as notificacoes do bot Telegram.

**Requisitos Tecnicos:**
- Gerar par de chaves VAPID (armazenar em env vars Vercel)
- Endpoint serverless `api/push-subscribe.js` (salvar subscription no Supabase)
- Endpoint serverless `api/push-send.js` (enviar notificacao)
- Tabela Supabase `push_subscriptions` (user_id, endpoint, keys, created_at)
- Service Worker handler para evento `push` e `notificationclick`
- Componente `src/components/pwa/PushPermission.jsx` (solicitar permissao)
- Consentimento explicito obrigatorio (LGPD compliance)
- Opcao de revogacao facil nas configuracoes

**Fluxo de Subscription:**

```
1. Usuario abre app -> PushPermission verifica status
2. Se nao inscrito -> exibe card explicativo com beneficios
3. Usuario aceita -> Notification.requestPermission()
4. Se granted -> serviceWorkerRegistration.pushManager.subscribe(VAPID)
5. Subscription enviada para api/push-subscribe.js -> salva no Supabase
6. Cron job existente (Vercel) envia push via api/push-send.js
```

**Tipos de Notificacao:**

| Tipo | Gatilho | Titulo | Corpo | Acao ao Clicar |
|------|---------|--------|-------|----------------|
| Lembrete de dose | Horario programado | "Hora do medicamento" | "{nome} - {dosagem}" | Abre `#/dashboard` |
| Dose atrasada | t+15min sem registro | "Dose atrasada" | "{nome} esta atrasado {min}min" | Abre `#/dashboard` |
| Estoque baixo | estoque <= 3 dias | "Estoque baixo" | "{nome}: restam {dias} dias" | Abre `#/estoque` |

**Criterios de Aceitacao:**
- [ ] Consentimento explicito solicitado antes de ativar push
- [ ] Notificacoes recebidas com app fechado (Android Chrome, desktop)
- [ ] Clicar na notificacao abre o app na tela correta
- [ ] Opcao de desativar push nas configuracoes
- [ ] Subscription persistida no Supabase com RLS
- [ ] VAPID keys armazenadas como env vars (nao no codigo)
- [ ] Fallback gracioso em iOS (push limitado no iOS PWA)
- [ ] Rate limit: maximo 10 push/dia/usuario

**Casos de Uso:**

| UC | Ator | Fluxo |
|----|------|-------|
| UC-4.3.1 | Usuario | Abre app -> card "Ativar lembretes?" -> aceita -> permissao concedida -> subscription salva |
| UC-4.3.2 | Usuario | App fechado -> recebe push "Hora do Losartana 50mg" -> toca -> app abre no dashboard |
| UC-4.3.3 | Usuario | Vai em configuracoes -> desativa push -> subscription removida do Supabase |
| UC-4.3.4 | Usuario iOS | Abre app -> push nao disponivel -> mensagem sugere usar bot Telegram |

**Dependencias:** F4.2 (PWA + Service Worker), Supabase (nova tabela)  
**Impacto Financeiro:** R$ 0 (VAPID e gratuito, Vercel cron no hobby tier)  

---

### F4.4 Analytics Local - Integracao PWA

**Titulo:** Estender analytics local para rastrear eventos PWA  
**Rastreabilidade:** Roadmap 2026 - Fase 4, N04  

**Descricao:**  
Estender o analyticsService (criado na Fase 3) para rastrear eventos especificos de PWA: instalacao, push opt-in/out, uso offline, e deep links acessados.

**Requisitos Tecnicos:**
- Novos eventos no analyticsService: `pwa_installed`, `push_opted_in`, `push_opted_out`, `offline_session`, `deep_link_accessed`
- Tracking automatico do evento `beforeinstallprompt` e `appinstalled`
- Tracking de navegacao via hash router

**Criterios de Aceitacao:**
- [ ] Evento `pwa_installed` registrado quando usuario instala
- [ ] Evento `push_opted_in` registrado quando usuario aceita push
- [ ] Evento `deep_link_accessed` registrado com rota como propriedade
- [ ] getSummary() inclui metricas PWA

**Dependencias:** F3.6 (analyticsService), F4.1, F4.2, F4.3  
**Impacto Financeiro:** R$ 0  

---

### F4.5 Padronizacao Bot (Code Standards)

**Titulo:** Padronizar codigo do bot Telegram com convencoes consistentes  
**Rastreabilidade:** Roadmap 2026 - Fase 4, P12  

**Descricao:**  
Refatorar o codigo do bot Telegram para seguir convencoes consistentes: nomenclatura de comandos, estrutura de handlers, tratamento de erros, e formatacao de mensagens. Reduzir duplicacao e melhorar manutenibilidade.

**Requisitos Tecnicos:**
- Padronizar estrutura de handlers: `server/bot/handlers/{command}.js`
- Criar helper `server/bot/utils/messageFormatter.js` (MarkdownV2 centralizado)
- Criar helper `server/bot/utils/errorHandler.js` (tratamento padrao)
- Padronizar nomenclatura: camelCase para funcoes, UPPER_SNAKE para constantes
- Documentar comandos disponiveis em constante centralizada
- Garantir que todos os handlers usam commandWrapper existente

**Criterios de Aceitacao:**
- [ ] Todos os handlers seguem estrutura padrao
- [ ] Formatacao MarkdownV2 centralizada (sem duplicacao)
- [ ] Tratamento de erros consistente em todos os comandos
- [ ] Nenhuma regressao funcional nos comandos existentes
- [ ] Reducao de duplicacao de codigo > 30%

**Dependencias:** Nenhuma  
**Impacto Financeiro:** R$ 0  

---

### F4.6 Organizacao Features (Refactor)

**Titulo:** Reorganizar estrutura de features do frontend  
**Rastreabilidade:** Roadmap 2026 - Fase 4, P13  

**Descricao:**  
Reorganizar a estrutura de pastas do frontend para agrupar por feature/dominio ao inves de por tipo de arquivo. Facilita navegacao, reduz acoplamento e melhora a experiencia de desenvolvimento.

**Estrutura Proposta:**

```
src/
  features/
    dashboard/
      components/
      hooks/
      services/
      constants/
    medications/
      components/
      hooks/
      services/
    stock/
      components/
      hooks/
      services/
    adherence/
      components/
      hooks/
      services/
    protocols/
      components/
      hooks/
      services/
  shared/
    components/ui/
    hooks/
    services/
    constants/
    utils/
```

**Criterios de Aceitacao:**
- [ ] Componentes agrupados por feature/dominio
- [ ] Imports atualizados em todos os arquivos
- [ ] Aliases de path configurados no Vite (`@/features/...`)
- [ ] Nenhuma regressao funcional
- [ ] Testes existentes passando apos refactor
- [ ] Build sem erros

**Dependencias:** Nenhuma  
**Impacto Financeiro:** R$ 0  

---

## 4. Requisitos Nao-Funcionais

| Requisito | Especificacao | Metrica |
|-----------|--------------|---------|
| Performance | Navegacao entre rotas | < 100ms |
| Performance | Tempo de instalacao PWA | < 3s |
| Seguranca | VAPID keys em env vars | Nao expostas no client |
| Seguranca | Push subscription com RLS | Usuario so ve suas subscriptions |
| Privacidade | Consentimento explicito para push (LGPD) | 100% dos opt-ins |
| Compatibilidade | PWA instalavel | Android Chrome 90+, iOS Safari 16.4+, Desktop Chrome/Edge |
| Lighthouse | PWA score | >= 90 |
| Lighthouse | Performance score | >= 90 |
| Resiliencia | App funciona com cache quando offline | Assets estaticos disponiveis |

---

## 5. Plano de Testes

### 5.1 Testes Unitarios (Vitest)

| Componente | Cenarios |
|------------|----------|
| useHashRouter | Navegacao, parametros, fallback, historico |
| InstallPrompt | Exibe quando disponivel, oculta apos instalacao |
| PushPermission | Solicita permissao, trata denied, trata granted |
| analyticsService (PWA) | Novos eventos, integracao com existentes |

### 5.2 Testes de Integracao

| Cenario | Validacao |
|---------|-----------|
| Deep link do bot | Link Telegram -> app abre na rota correta |
| Instalacao PWA | Prompt -> aceita -> icone criado -> abre standalone |
| Push end-to-end | Subscribe -> cron dispara -> notificacao recebida -> click abre app |
| Navegacao + cache | Navega entre rotas -> dados em cache -> sem flash de loading |

### 5.3 Testes Manuais Obrigatorios

| Cenario | Dispositivo |
|---------|-------------|
| Instalacao PWA | Android Chrome, iOS Safari, Desktop Chrome |
| Push notification recebida | Android Chrome (app fechado) |
| Deep link via Telegram | Android + iOS |
| Offline com cache | Android Chrome (modo aviao) |

### 5.4 Cobertura Alvo

| Metrica | Meta |
|---------|------|
| Cobertura de linhas | > 80% (novos componentes) |
| Lighthouse PWA | >= 90 |
| Lighthouse Performance | >= 90 |

---

## 6. Indicadores de Sucesso

| KPI | Baseline | Meta | Ferramenta |
|-----|----------|------|------------|
| Instalacoes PWA | 0% | > 30% usuarios mobile | PWA install events |
| Opt-in push notifications | 0% | > 50% usuarios | Supabase query |
| Deep links utilizados | 0% | > 20% sessoes | Analytics local |
| Lighthouse PWA | N/A | >= 90 | Lighthouse CI |
| Duplicacao de codigo bot | Alta | Reducao > 30% | Code review |
| Testes passando | ~75% | > 82% | Vitest coverage |

---

## 7. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Push notifications bloqueadas por navegador | Media | Medio | Manter Telegram como canal primario, push como complementar |
| Baixa adocao de PWA em iOS | Alta | Medio | Focar em Android primeiro, manter web app funcional |
| Service Worker causa bugs de cache stale | Media | Alto | Estrategia de versionamento, botao "forcar atualizacao" |
| Refactor de features quebra imports | Media | Alto | Executar refactor com testes passando, CI obrigatorio |
| Vercel hobby tier limita cron jobs | Baixa | Medio | Otimizar frequencia de cron, agrupar notificacoes |
| VAPID keys expostas acidentalmente | Baixa | Alto | Env vars apenas, .env.example sem valores reais |

---

## 8. Migracoes de Banco de Dados

### Nova Tabela: push_subscriptions

```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);
```

---

## 9. Cronograma de Implementacao

| Ordem | Feature | Dependencia | Story Points |
|-------|---------|-------------|-------------|
| 1 | F4.1 Hash Router + Deep Linking | Nenhuma | 8 |
| 2 | F4.2 PWA (manifest + SW) | F4.1 | 13 |
| 3 | F4.3 Push Notifications | F4.2 | 8 |
| 4 | F4.4 Analytics PWA | F4.1, F4.2, F4.3 | 3 |
| 5 | F4.5 Padronizacao Bot | Nenhuma (paralelo) | 5 |
| 6 | F4.6 Organizacao Features | Nenhuma (paralelo) | 5 |

---

## 10. Definicao de Pronto (DoD)

- [ ] Codigo implementado e revisado
- [ ] Testes unitarios passando com cobertura > 80%
- [ ] Lighthouse PWA >= 90
- [ ] PWA instalavel em Android Chrome e iOS Safari
- [ ] Push notifications funcionando em Android Chrome
- [ ] Deep links funcionando a partir do bot Telegram
- [ ] Migracoes SQL aplicadas e RLS validado
- [ ] Sem regressao em funcionalidades existentes
- [ ] Build sem erros
- [ ] VAPID keys em env vars (nao no codigo)

---

*Documento elaborado em 08/02/2026*  
*Referencia: Roadmap 2026 v3.0 - Fase 4*  
*Proxima revisao: apos conclusao da Fase 4*
