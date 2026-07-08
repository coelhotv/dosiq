---
title: "Guia de Nudges"
description: "Guia prático para criação, controle de dismiss e exibição contextual de banners (nudges) via painel administrativo no Dosiq."
version: "1.0.0"
status: archived
category: guide
audience:
  - ops
  - dev
tags:
  - nudges
  - banners
  - remote-config
created_at: "2026-07-08"
updated_at: "2026-07-08"
---

# Guia — Nudges (In-App Banners)

## Visão Geral

**Nudges** são banners contextuais que aparecem nas aplicações (web/mobile) para notificar, engajar ou instruir usuários. O dosiq implementa um sistema completo de nudges **admin-managed** e **data-driven**:

- **Admin Panel**: painel web em Configurações → Administração → Nudges para criar, editar, ativar/desativar
- **JSON Builder**: construtor visual de payloads para ações (navegar, abrir URL, apenas descartar)
- **Filtering**: filtros por data/hora, plataforma (iOS/Android/Web/Todos), versão de app, tela alvo
- **Remote Config**: nudges armazenados no Supabase; apps buscam e exibem em tempo real
- **Client-Side Dismissed**: registro de dismissals local (AsyncStorage mobile, localStorage web)

---

## Workflow: Criar um Nudge

### 1. Abrir o Painel Admin

1. Acesse a aplicação web dosiq como **administrador** (detectado via `VITE_ADMIN_CHAT_ID`)
2. Vá para **Perfil → Configurações** (ícone ⚙️)
3. Desça até **Administração** → clique em **"Nudges (In-App)"**

### 2. Criar Novo Nudge

Clique em **"+ Novo Nudge"** (botão verde, topo)

### 3. Preencher Formulário

#### Conteúdo (obrigatório)
| Campo | Limites | Exemplo |
|-------|---------|---------|
| **Título** | 100 caracteres | `"Nova feature: Consulta Rápida"` |
| **Corpo** | 200 caracteres | `"Acesse seus atendimentos médicos em segundos — tudo sincronizado."` |

#### Direcionamento
| Campo | Opções | Padrão |
|-------|--------|--------|
| **Tela Alvo** | Dashboard / Perfil / Qualquer | Dashboard |
| **Tipo de Ação** | Navegar / Abrir URL / Descartar Apenas | Descartar |
| **Plataforma** | iOS / Android / Web / Todos | Todos |
| **Prioridade** | 0–100 (maior = topo) | 0 |

#### Ação Específica (depende de **Tipo**)

**Navegar:**
- Dropdown de telas do app (ex: Tratamentos, Estoque, Perfil)
- Payload gerado: `{ screen: "Treatments" }`

**Abrir URL:**
- URL obrigatória (ex: `https://dosiq.app/blog/novo-recurso`)
- Rótulo de botão (opcional, ex: `"Saiba Mais"`)
- Emoji (opcional, ex: `"📖"`)
- Payload gerado: `{ url: "...", label: "...", emoji: "..." }`

**Descartar Apenas:**
- Emoji (opcional, ex: `"👍"`)
- Sem navegação — apenas uma confirmação visual
- Payload: `{ emoji: "..." }` ou `{}`

#### Período de Exibição (opcional)
- **Data/Hora Inicial**: quando o nudge começa a aparecer (GMT-3)
- **Data/Hora Final**: quando desaparece
- **Vazio** = sempre ativo

#### Compatibilidade de Versão (opcional)
- **Versão Mínima**: ex `1.0.0` — nudge só aparece em app ≥ 1.0.0
- **Versão Máxima**: ex `2.0.0` — nudge só aparece em app < 2.0.0
- **Vazio** = sem restrição

### 4. Preview e Validação

- Campo de **Preview** mostra o JSON final do payload
- Validações automáticas indicam erros (ex: URL inválida, campo obrigatório vazio)
- Clique **"Criar Nudge"** para salvar

---

## Gerenciar Nudges

### Lista de Nudges

Após criar, o painel exibe:

| Coluna | Descrição |
|--------|-----------|
| **Título** | Nome do nudge (com badge de plataforma) |
| **Tela Alvo** | Dashboard / Perfil / Qualquer |
| **Tipo de Ação** | Navegar / Abrir URL / Descartar |
| **Status** | Ícone toggle (verde = ativo, cinza = inativo) |
| **Ações** | Editar, Deletar (futura), toggle ativo/inativo |

### Filters

| Filtro | Opções |
|--------|--------|
| **Status** | Todos / Ativos / Inativos |
| **Tela Alvo** | Todas / Dashboard / Perfil / Qualquer |

### Paginação

- 20 nudges por página
- Botões "Anterior" / "Próximo" e indicador de página

### Editar Nudge

1. Clique no botão **"Editar"** (lápis) no card
2. Modal abre com valores atuais pré-preenchidos
3. Modifique e clique **"Atualizar"**

### Toggle Ativo/Inativo

- Clique no ícone **toggle** (esquerda do card)
- Nudge desativa/ativa imediatamente (sem modal)
- Apps refetch nudges a cada 10 min (mobile) ou página carregada (web)

---

## Comportamento em Produção

### Web

1. App carrega nudges ao montar `DashboardProvider`
2. `useNudges('dashboard' | 'profile')` busca do Supabase
3. Filtra por plataforma=web, datas, versão, dismissals locais
4. Renderiza em `NudgeCard` (card ou banner, conforme contexto)
5. Ao descartar: salva ID em `localStorage['dosiq_dismissed_nudges']`
6. Próximo carregamento: oculta nudges já dismissidos

### Mobile

1. App carrega nudges ao montar `RootNavigator`
2. `useNudges('dashboard' | 'profile')` busca do Supabase
3. Filtra por plataforma (iOS/Android), datas, versão, dismissals locais
4. Renderiza em `NudgeBanner` full-width (Dashboard, Profile)
5. Ao descartar: salva ID em `AsyncStorage['dosiq_dismissed_nudges']`
6. Próximo carregamento: oculta nudges já dismissidos

---

## Casos de Uso

### 1. Anunciar Nova Feature

**Título:** `"Novo: Análise de Custo"`  
**Corpo:** `"Veja quanto você gasta em medicamentos por mês — dados precisos, sem surpresas."`  
**Tela Alvo:** Dashboard  
**Ação:** Navegar → "Stock" (Estoque)  
**Plataforma:** Todos  
**Período:** Hoje → próximas 2 semanas  

✅ Aparece no Dashboard de todos os usuários por 14 dias; ao clicar, vai para Estoque.

---

### 2. Comunicado Importante (Descartar Apenas)

**Título:** `"Atualização de Segurança"`  
**Corpo:** `"Atualizamos a encriptação de dados — nenhuma ação necessária da sua parte."`  
**Tela Alvo:** Qualquer  
**Ação:** Descartar Apenas  
**Emoji:** `"🔒"`  
**Plataforma:** Todos  
**Data Início:** Agora  
**Data Fim:** Próximos 3 dias  

✅ Notificação de leitura única em todas as telas; dismissível em uma tela.

---

### 3. Engajar Usuários Mobile

**Título:** `"Push Notifications Ligado"`  
**Corpo:** `"Receba lembretes na hora de tomar seus medicamentos."`  
**Tela Alvo:** Profile (Perfil)  
**Ação:** Navegar → "NOTIFICATION_PREFERENCES"  
**Plataforma:** iOS, Android  
**Período:** Permanente  

✅ Aparece na tela de Perfil do app mobile; oferece caminho direto para ativar notificações.

---

### 4. Versioned Rollout (A/B Testing)

**Grupo A** — Versões 0.15.0 até 0.15.5:  
**Título:** `"Beta: Novo Design"`  
**Tela Alvo:** Dashboard  
**Ação:** Abrir URL → `https://dosiq.app/feedback/design`  
**Versão Mín/Máx:** `0.15.0` / `0.15.5`  

**Grupo B** — Versões 0.15.6+:  
**Título:** `"Design Redesenhado"`  
**Corpo:** `"Feedback? Nos conte!"`  
**Versão Mín:** `0.15.6`  

✅ Usuários em versões antigas veem uma mensagem, novos veem outra.

---

## Monitoramento

### Verificar Dismissals

Dismissals são **locais** (AsyncStorage/localStorage), não sincronizados ao servidor.  
Para auditar:

1. **Web**: Abra DevTools → Applications → localStorage → chave `dosiq_dismissed_nudges`
2. **Mobile**: Via Flipper → React Native inspector → AsyncStorage → `dosiq_dismissed_nudges`

### Métricas (Futuro)

Versão 4.2.0 não inclui analytics de nudges. Próxima iteração pode incluir:
- Impressões (quanto tempo visível)
- Click-through rate (ações disparadas)
- Dismissals por nudge

---

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| Nudge não aparece | Plataforma filtrada | Verifique plataforma no form |
| Nudge desaparece após refresco | Dismissado localmente | Limpe localStorage/AsyncStorage |
| Erro "URL inválida" | URL mal formatada | Use `https://...` completo |
| App antigo não vê nudge | Versão mín restrita | Remova limite ou atualize app |
| Título/corpo truncados | >100/200 chars | Reduza caracteres no form |

---

## Limites e Constraints

- **Nudges simultâneos por tela:** sem limite técnico (UI agrupa automaticamente)
- **Frequência de reload:** apps refetch 1x por 10 min (mobile) ou página (web)
- **Max chars título:** 100  
- **Max chars corpo:** 200  
- **Max chars rótulo botão:** 50  
- **Payload JSON:** max 5 KB (nenhuma validação, responsabilidade do admin)

---

## Referências

- **Painel Admin:** `/admin-nudges` (após login, role admin)
- **Schema Validação:** `packages/core/src/schemas/nudgeSchema.js`
- **Service API:** `apps/web/src/services/api/nudgeAdminService.js`
- **Hook:** `apps/web/src/views/admin/useNudgesAdminState.js`
- **Endpoints Vercel:** `api/admin.js` resource router (consolidado, R-090)
- **DB:** `in_app_nudges` table (RLS: leitura authenticated, escrita nenhuma — admin-only no app)

---

## Changelog

**Feature 028** (Fase 1, v4.1.0 em diante):
- ✅ Painel admin full-stack
- ✅ JSON builder condicional
- ✅ Filtros e paginação
- 📋 Analytics de impressões/clicks (Fase 2)
- 📋 Template library (Fase 2)
- 📋 A/B testing integrado (Fase 3)
