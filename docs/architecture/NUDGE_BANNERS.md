---
title: "Nudge Banners"
description: "Guia operacional para criação, controle de dismiss e exibição contextual de banners (nudges) via banco de dados no Dosiq."
version: "1.0.0"
status: active
category: architecture
audience:
  - ops
  - dev
tags:
  - nudges
  - banners
  - database
created_at: "2026-07-08"
updated_at: "2026-07-08"
---

# Guia Operacional — Nudge Banners (Epic 026)

---

## O que é um nudge banner?

Banner contextual exibido no topo de uma view do app (mobile ou web) para comunicar ao usuário informações importantes, ações recomendadas ou novidades do produto. O banner desaparece quando o usuário o dispensa (X) ou clica no CTA, e não reaparece enquanto a chave de dismiss estiver salva localmente (`AsyncStorage` no mobile, `localStorage` na web).

---

## Estrutura da tabela `in_app_nudges`

| Coluna | Tipo | Obrigatório | Descrição |
|--------|------|-------------|-----------|
| `id` | uuid | auto | Identificador único. Gerado automaticamente. |
| `version` | integer | sim (padrão: 1) | Versão do nudge. Incrementar para reexibir a todos (reseta chave de dismiss). |
| `title` | text | sim | Título em negrito exibido no banner. Máx ~50 caracteres recomendados. |
| `body` | text | sim | Texto descritivo abaixo do título. Máx ~120 caracteres recomendados. |
| `target_view` | text | sim | Onde o banner aparece. Ver [Dicionário de Views](#dicionário-de-views). |
| `action_type` | text | sim | Tipo de ação do CTA. Ver [Tipos de Ação](#tipos-de-ação). |
| `action_payload` | jsonb | não | Dados da ação (rota, URL, emoji, label do CTA). Ver [Payloads](#payloads-por-action_type). |
| `platform` | text | sim (padrão: `all`) | Plataforma alvo: `ios`, `android`, `web`, `all`. |
| `priority` | integer | sim (padrão: 0) | Maior número = mais prioritário. Apenas o nudge de maior prioridade é exibido por vez. |
| `is_active` | boolean | sim (padrão: true) | `false` desativa sem deletar. Recomendado para arquivar nudges. |
| `start_at` | timestamptz | não | Data/hora de início da exibição (UTC). Nulo = exibe imediatamente. |
| `end_at` | timestamptz | não | Data/hora de encerramento (UTC). Nulo = sem data de fim. |
| `min_app_version` | text | não | Versão mínima do app (semver, ex: `0.3.0`). Nulo = sem restrição. |
| `max_app_version` | text | não | Versão máxima do app (semver, ex: `1.0.0`). Nulo = sem restrição. |
| `created_at` | timestamptz | auto | Data de criação. |

---

## Dicionário de Views

`target_view` controla em qual tela o banner é exibido.

| Valor | Tela no app | Observação |
|-------|-------------|------------|
| `dashboard` | Aba **Hoje** (TodayScreen) | Tela principal de doses do dia |
| `profile` | Aba **Perfil** (ProfileScreen) | Tela de perfil e configurações |
| `any` | **Todas as telas** que usem `useNudges` | Exibido em qualquer view registrada |

> **Atenção:** views que ainda não integram `useNudges` não exibem nudges mesmo com `target_view = 'any'`. Atualmente integradas: `dashboard` e `profile` (mobile).

---

## Dicionário de Rotas (campo `screen` e `tab`)

Use estes valores no `action_payload` para navegação cross-tab.

### Tabs (campo `tab`)

| Valor | Tab |
|-------|-----|
| `Hoje` | Aba Hoje |
| `Tratamentos` | Aba Tratamentos |
| `Estoque` | Aba Estoque |
| `Perfil` | Aba Perfil |

### Telas dentro de cada tab (campo `screen` ou `route`)

| Valor | Tela | Stack |
|-------|------|-------|
| `ProfileMain` | Perfil principal | Perfil |
| `Settings` | Configurações | Perfil |
| `NotificationPreferences` | Preferências de notificação | Perfil |
| `NotificationInbox` | Caixa de notificações | Perfil |
| `TelegramLink` | Vincular Telegram | Perfil |
| `ChangePassword` | Alterar senha | Perfil |
| `Feedback` | Enviar feedback | Perfil |
| `DoseHistory` | Histórico de doses | Perfil |
| `TreatmentsList` | Lista de tratamentos | Tratamentos |
| `TreatmentDetail` | Detalhe de tratamento | Tratamentos |
| `StockMain` | Estoque principal | Estoque |
| `StockDetail` | Detalhe de item no estoque | Estoque |

---

## Tipos de Ação

### `navigate` — Navegar para tela interna

Leva o usuário para outra tela do app.

**Campos obrigatórios no `action_payload`:**

- Navegação cross-tab (ex: dashboard → settings): usar `tab` + `screen`
- Navegação dentro da mesma tab: usar apenas `route`

```json
{
  "tab": "Perfil",
  "screen": "Settings",
  "label": "Configurar agora",
  "emoji": "⚙️"
}
```

```json
{
  "route": "NotificationPreferences",
  "label": "Ver preferências",
  "emoji": "🔔"
}
```

---

### `open_url` — Abrir URL externa

Abre link no navegador padrão do dispositivo.

```json
{
  "url": "https://dosiq.app/novidades",
  "label": "Saiba mais",
  "emoji": "🌐"
}
```

---

### `dismiss_only` — Apenas dispensar

Sem CTA clicável. Botão X ainda funciona.

```json
{
  "emoji": "ℹ️"
}
```

Ou `action_payload` nulo (omitir o campo).

---

## Payloads por `action_type`

| Chave | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `tab` | string | não | Tab de destino (ex: `Perfil`). Usar com `screen` para cross-tab. |
| `screen` | string | não | Tela dentro do stack do `tab`. |
| `route` | string | não | Rota direta (sem troca de tab). Alternativa a `tab+screen`. |
| `url` | string | para `open_url` | URL completa com protocolo (`https://`). |
| `emoji` | string | não | Emoji exibido à esquerda do banner (ex: `🔔`). |
| `label` | string | não | Texto do CTA. Padrão: `"Ver mais"`. |

---

## Lógica de Exibição

1. App busca nudges ativos (`is_active = true`) da view atual + `any`
2. Filtra por plataforma corrente (`platform`)
3. Filtra por janela de datas (`start_at` / `end_at`)
4. Filtra por versão do app (`min_app_version` / `max_app_version`)
5. Remove nudges já dispensados pelo usuário (salvo localmente)
6. Ordena por `priority` decrescente
7. Exibe apenas o **primeiro** da lista

> **Offline:** se a requisição ao Supabase falhar, o app usa cache local (AsyncStorage) do último fetch bem-sucedido.

---

## Chave de Dismiss

Formato: `<id>:<version>`

Exemplo: `3fa85f64-5717-4562-b3fc-2c963f66afa6:1`

Para **reexibir** um nudge já dispensado por todos os usuários: **incrementar `version`**. A nova versão gera nova chave, resetando o dismiss.

---

## Exemplos de Registros

### 1. Nudge de configuração de timezone (dashboard, mobile, permanente)

```sql
INSERT INTO public.in_app_nudges
  (title, body, target_view, action_type, action_payload, platform, priority)
VALUES (
  'Confirme seu fuso horário',
  'Seu horário pode estar diferente do configurado. Verifique em Configurações.',
  'dashboard',
  'navigate',
  '{"tab": "Perfil", "screen": "Settings", "label": "Verificar agora", "emoji": "🕐"}',
  'all',
  10
);
```

---

### 2. Nudge de novidade (todas as views, limitado por data)

```sql
INSERT INTO public.in_app_nudges
  (title, body, target_view, action_type, action_payload, platform, priority, start_at, end_at)
VALUES (
  'Novidade: histórico de doses',
  'Agora você pode visualizar todas as doses registradas em um só lugar.',
  'any',
  'navigate',
  '{"tab": "Perfil", "screen": "DoseHistory", "label": "Ver histórico", "emoji": "📋"}',
  'all',
  5,
  '2026-06-10T00:00:00Z',
  '2026-06-30T23:59:59Z'
);
```

---

### 3. Nudge informativo sem ação (apenas dismiss)

```sql
INSERT INTO public.in_app_nudges
  (title, body, target_view, action_type, action_payload, platform, priority)
VALUES (
  'Manutenção programada',
  'O app passará por manutenção no dia 15/06 entre 02h e 04h.',
  'any',
  'dismiss_only',
  '{"emoji": "🛠️"}',
  'all',
  20
);
```

---

### 4. Nudge exclusivo para iOS, versão mínima 0.3.0

```sql
INSERT INTO public.in_app_nudges
  (title, body, target_view, action_type, action_payload, platform, priority, min_app_version)
VALUES (
  'Ative notificações',
  'Receba lembretes de dose diretamente no seu iPhone.',
  'dashboard',
  'navigate',
  '{"route": "NotificationPreferences", "label": "Ativar", "emoji": "🔔"}',
  'ios',
  8,
  '0.3.0'
);
```

---

## Desativar / Arquivar um Nudge

Nunca deletar nudges ativos — usar `is_active = false` para preservar histórico.

```sql
UPDATE public.in_app_nudges
SET is_active = false
WHERE id = '<uuid-do-nudge>';
```

---

## Erros Comuns

### Banner não aparece

| Causa | Diagnóstico | Solução |
|-------|-------------|---------|
| `is_active = false` | Verificar coluna | Setar `true` |
| `target_view` errado | Ver [Dicionário de Views](#dicionário-de-views) | Corrigir valor |
| Fora da janela de datas | `start_at` futuro ou `end_at` passado | Ajustar datas |
| Usuário já dispensou | Chave `<id>:<version>` no AsyncStorage | Incrementar `version` |
| Versão do app incompatível | `min_app_version` maior que versão atual | Ajustar ou nulificar |
| `platform` errado | Ex: `ios` em build Android | Corrigir ou usar `all` |
| View não integra `useNudges` | Tela não tem o hook | Integrar na tela |

---

### CTA navega para lugar errado

| Causa | Solução |
|-------|---------|
| `screen` não existe no stack do `tab` | Consultar [Dicionário de Rotas](#dicionário-de-rotas-campo-screen-e-tab) |
| Usou `route` em vez de `tab+screen` para cross-tab | Usar ambos: `tab` + `screen` |
| Nome de rota com erro de digitação | Valores são case-sensitive; conferir em `routes.ts` |

---

### Banco recusa o INSERT

| Erro | Causa | Solução |
|------|-------|---------|
| `violates check constraint "in_app_nudges_target_view_check"` | `target_view` inválido | Usar `dashboard`, `profile` ou `any` |
| `violates check constraint "in_app_nudges_action_type_check"` | `action_type` inválido | Usar `navigate`, `open_url` ou `dismiss_only` |
| `violates check constraint "in_app_nudges_platform_check"` | `platform` inválido | Usar `ios`, `android`, `web` ou `all` |
| `permission denied` | Role sem permissão de escrita | Usar `service_role` |

---

## Prioridade — Referência Rápida

| Faixa | Uso sugerido |
|-------|-------------|
| `20+` | Avisos críticos (manutenção, segurança, urgência) |
| `10–19` | Ações importantes (onboarding, configuração essencial) |
| `5–9` | Novidades e features relevantes |
| `1–4` | Dicas e comunicações de baixa urgência |
| `0` | Padrão — sem prioridade especial |

Quando dois nudges têm o mesmo `priority`, o app exibe o que veio primeiro na query (por `created_at` implícito).

---

## Versionamento e Changelog

Qualquer nudge novo ou alteração relevante (novo `target_view`, mudança de rota) deve ser documentada como entrada no CHANGELOG da sprint correspondente sob `[Unreleased] > Operações`.

---

*Documento mantido pela equipe de produto/engenharia. Atualizar ao adicionar novas views ou rotas ao app.*
