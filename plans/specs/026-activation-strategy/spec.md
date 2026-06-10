# Feature Specification: Estratégia de Ativação (Épico)

**Feature Directory**: `plans/specs/026-activation-strategy`
**Created**: 2026-06-06 · **Revised**: 2026-06-06
**Status**: in-progress — Fase 1 entregue (PR #653); demais fases pendentes
**Tier**: 2 (épico — DB + API + UI + E-mail cross-platform)
**Artifacts**: `spec.md` · `tasks.md`

---

## Context

Com base nos dados reais do Dosiq, **52% dos usuários cadastrados estão "silenciosos"** (não possuem token de push ativo nem bot do Telegram configurado), e **7 desses usuários possuem tratamentos ativos em andamento** sem receber qualquer notificação do servidor. Adicionalmente, há uma grande fragmentação de versões mobile do iOS/Android na base ativa de dispositivos, privando muitos usuários de features essenciais como os Alarmes Críticos (Notifee v2).

Esta especificação define uma **Estratégia de Ativação** integrada que visa:
1. Promover atualizações de versão e novas features via **Nudges Dinâmicos In-App** configuráveis pelo banco de dados (Supabase).
2. Facilitar o reuso de **Nudges Locais** gerados por hooks no frontend (como o nudge de fuso horário no Perfil).
3. Implementar uma **Régua de E-mails Transacionais** para ativar usuários "silenciosos" e engajar tratamentos ativos órfãos de notificações.

---

## User Stories

### US1: Comunicação Dinâmica In-App
> **Como** administrador do Dosiq,
> **Quero** cadastrar mensagens in-app dinâmicas diretamente no banco de dados, especificando filtros de versão do app, fuso horário ou plataforma,
> **Para** comunicar avisos importantes (como atualizações obrigatórias do app nas lojas) sem precisar publicar um novo build.

#### Cenário 1: Exibição de nudge de atualização
*   **Given** que o administrador cadastrou um nudge de atualização com `min_app_version = '0.13.0'` e `target_view = 'dashboard'`.
*   **When** um usuário abrir o aplicativo usando a versão `0.12.0` na tela Dashboard (Hoje).
*   **Then** o aplicativo deve exibir o banner de aviso sugerindo a atualização do aplicativo.
*   **And** ao clicar no botão de ação, deve abrir o link correspondente da loja de aplicativos (App Store / Google Play).

#### Cenário 2: Persistência local de descarte (Dismiss)
*   **Given** que um nudge dinâmico não-obrigatório está sendo exibido na tela do usuário.
*   **When** o usuário clicar no botão "Fechar" ou "Ignorar".
*   **Then** o aplicativo deve ocultar o banner imediatamente.
*   **And** salvar o ID do nudge localmente no dispositivo (`AsyncStorage` / `localStorage`) para que este mesmo banner nunca mais seja exibido a este usuário.

---

### US2: Componente Reutilizável de Nudges
> **Como** desenvolvedor do Dosiq,
> **Quero** um componente unificado `<NudgeBanner targetView="..." />` que receba e organize tanto nudges vindos do servidor quanto nudges calculados localmente pelo app,
> **Para** evitar duplicação de layouts e centralizar a lógica de renderização e priorização de avisos em views como Hoje (Dashboard), Perfil e Configurações.

#### Cenário 1: Priorização entre múltiplos nudges
*   **Given** que há um nudge remoto do servidor ativo (prioridade 10) e um nudge local de inconsistência de fuso horário (prioridade 20) elegíveis para exibição no Perfil.
*   **When** a tela de Perfil for renderizada.
*   **Then** o `<NudgeBanner targetView="profile" />` deve exibir apenas o nudge de maior prioridade (o de timezone, prioridade 20).

---

### US3: Régua de Ativação por E-mail
> **Como** gestor do Dosiq,
> **Quero** que o servidor envie e-mails automáticos segmentados para usuários inativos ou sem canais de notificação configurados,
> **Para** garantir que pacientes com tratamentos ativos voltem a receber alertas de seus medicamentos.

#### Cenário 1: Alerta de tratamento órfão de alertas
*   **Given** que um usuário possui pelo menos um tratamento marcado como ativo no banco de dados.
*   **And** ele não possui nenhum token de push ativo nem chat do Telegram conectado.
*   **When** o cron diário executar a verificação de e-mails.
*   **Then** o sistema deve enviar um e-mail transacional ao usuário alertando-o de que seus lembretes estão desativados e ensinando-o a reativar as permissões no app.

---

## Functional Requirements

### Nudges Dinâmicos (Supabase)
*   **FR-001**: Criar tabela `in_app_nudges` no Supabase com suporte a RLS (leitura pública para autenticados, escrita apenas por administradores/service role).
*   **FR-002**: A tabela de nudges deve conter colunas de segmentação e controle: `version` (integer), `min_app_version`, `max_app_version`, `platform` (ios/android/web/all), `target_view` (dashboard/profile/any), `start_at` e `end_at`.
*   **FR-003**: Implementar suporte a comparação de versão semântica (SemVer) no cliente para validar se a versão atual do app satisfaz as regras de versão do nudge.
*   **FR-004**: Salvar os descartes localmente via `AsyncStorage` (Mobile) e `localStorage` (Web) sob a chave combinada `{nudge_id}:{version}`. Se a versão do nudge no banco for incrementada, o descarte é invalidado automaticamente, forçando uma nova exibição (ex: nudge de "Atualize seu App" reativado após nova release).

### Componente NudgeBanner (Shared UI)
*   **FR-005**: Criar componente `<NudgeBanner targetView="..." />` em `@shared/components/` reutilizável em PWA Web e Mobile.
*   **FR-006**: Posicionar o `<NudgeBanner targetView="dashboard" />` na timeline principal (Dashboard/Hoje), ocupando visualmente o espaço do `HeroDoseCard` / `PriorityDoseCard` apenas quando não houver nenhuma dose prioritária ou pendente ativa.
*   **FR-007**: Posicionar o `<NudgeBanner targetView="profile" />` na aba Perfil, ocupando exatamente o mesmo slot do atual nudge local de fuso horário (tz), unificando layouts e priorizando qual mensagem deve aparecer baseando-se nas regras locais.

### Régua de E-mails (Brevo API)
*   **FR-008**: Configurar a integração de contatos via **Brevo API (REST)**, enviando atualizações de atributos de contatos (`HAS_ACTIVE_TREATMENT`, `HAS_ACTIVE_PUSH_TOKEN`, `TELEGRAM_CONNECTED`) a partir do servidor do Dosiq.
*   **FR-009**: Integrar a rotina de sincronização de contatos no Brevo API no endpoint cron `/api/notify.js` (ou `/api/admin.js`) rodando diariamente.
*   **FR-010**: Definir os 3 fluxos da régua de ativação:
    1.  **Boas-vindas (D+1)**: Usuário cadastrado há 24h sem nenhum token/canal de push cadastrado no banco.
    2.  **Tratamento Órfão (Semanal/Quinzenal)**: Usuário com protocolos ativos mas sem canal de push/Telegram cadastrado.
    3.  **Atualização de Versão (Eventual/Sob Demanda)**: Usuário ativo em dispositivo com versão inferior a uma versão crítica.

---

## Success Criteria

*   **SC-001**: 100% das mensagens cadastradas na tabela `in_app_nudges` elegíveis são exibidas corretamente nos clientes sem requerer novos builds.
*   **SC-002**: O descarte de um nudge oculta-o instantaneamente e persiste mesmo após fechar e reabrir o app, a menos que a versão do nudge seja incrementada no servidor.
*   **SC-003**: Execução automatizada e sem falhas do cron diário de sincronização com o Brevo API, permitindo que a régua de automação execute perfeitamente no painel do Brevo.

---

## Edge Cases

1.  **Sincronização de Descarte Sem Internet**: Se o descarte de nudges for puramente local, funciona offline. Caso dependa do banco, o estado offline deve fazer fallback para o cache local.
2.  **App Sem Versão Mapeada (Simulador)**: Fallback seguro caso o `app_version` seja nulo ou indefinido no simulador (ignora filtros de versão para não quebrar a UI de desenvolvimento).
3.  **Envio Duplicado de E-mail**: A régua de e-mail deve registrar em tabela de log/controle para garantir que o e-mail de "Tratamento Órfão" ou "Boas-vindas" não seja enviado mais de uma vez na mesma semana para o mesmo e-mail.

---

## Key Entities (Data Model)

### Tabela `in_app_nudges`
```sql
CREATE TABLE public.in_app_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1, -- controle de versionamento/reset de descarte
  title text NOT NULL,
  body text NOT NULL,
  target_view text NOT NULL, -- 'dashboard', 'profile', 'any'
  action_type text NOT NULL, -- 'navigate', 'open_url', 'dismiss_only'
  action_payload jsonb,      -- {"route": "Settings"} ou {"url": "https://..."}
  min_app_version text,      -- ex: '0.13.0'
  max_app_version text,
  platform text NOT NULL DEFAULT 'all', -- 'ios', 'android', 'web', 'all'
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Tabela `user_email_marketing_logs`
```sql
CREATE TABLE public.user_email_marketing_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text NOT NULL, -- 'welcome_nudge', 'orphan_treatment', 'version_upgrade'
  sent_at timestamptz DEFAULT now()
);
```

---

## Decisions of Architecture & Design

### 1. Provedor de Envio de E-mails
*   **Decisão**: Utilização da **Brevo API (REST - Marketing Automation)**. O Dosiq sincronizará os dados e atributos de ativação dos contatos no Brevo diariamente. A régua de e-mails em si e os templates visuais serão desenhados e disparados de forma 100% gerenciada e automatizada dentro do painel do Brevo.
*   **Vantagem**: Reduz o tráfego e risco de timeout na Vercel (apenas uma chamada HTTP de atualização por lote de contatos). Permite a edição visual rápida dos e-mails no painel do Brevo sem necessidade de novos builds e deploys do Dosiq.

### 2. Sincronização de Descarte de Nudges (Multi-device)
*   **Decisão**: O estado de descarte (dismiss) do nudge será salvo localmente no dispositivo (`AsyncStorage` / `localStorage`) concatenando o ID do nudge e sua versão no formato `{nudge_id}:{version}`.
*   **Vantagem**: Garante carregamento instantâneo offline-first (Zero-Network read) ao abrir as telas. O incremento de `version` no Supabase permite expirar descartes de forma global e instantânea.

### 3. Roteamento do Nudge Banner na Interface
*   **Aba Hoje**: Renderizado inline no espaço do `HeroDoseCard` / `PriorityDoseCard` apenas se o paciente não tiver nenhuma dose pendente ou prioritária a tomar. Isso garante que a área de destaque na tela Hoje continue útil e dinâmica mesmo para usuários engajados com a adesão em dia.
*   **Aba Perfil**: Integrado no mesmo slot físico do nudge local de fuso horário. O hook de renderização cuidará de unificar nudges remotos e locais, exibindo o de maior prioridade.

