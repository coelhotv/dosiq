# Technical Plan — Sistema de Feedback do Usuário e Admin

**Feature Directory**: `plans/specs/023-user-feedback`
**Spec**: `spec.md`
**Created**: 2026-06-04
**Tier**: 2 (envolve novas tabelas, consolidando API em 1 slot serverless e fluxo cross-platform)
**Input**: Plano de implementação aprovado.
**Rules & Standards**: R-221 (SQP), R-247 (maxLength), R-021 (Portuguese Zod/UI), R-202 (Admin settings check bypass via telegram_chat_id / AP-135).

---

## Summary

Este plano descreve os detalhes técnicos de implementação do sistema de feedbacks.
O usuário logado no aplicativo móvel poderá enviar feedbacks diretamente ao banco Supabase. O banco de dados terá a tabela `feedbacks` protegida por políticas de Row Level Security (RLS) fechadas (Write-Only para usuários finais).
O administrador do Dosiq poderá acessar o painel de feedbacks no PWA Web, que busca dados por meio do endpoint serverless unificado `api/admin.js` (unificando DLQ e feedbacks sob o mesmo slot físico para economizar funções na Vercel). O admin também poderá marcar feedbacks como resolvidos (`is_resolved = true`).

---

## Technical Context

Verificação de código real no repositório:

| Área | Arquivo/Dados (Canônico) | Finalidade / Implicação |
|------|--------------------------|-------------------------|
| **Serverless Vercel** | `/api/dlq.js` | Será renomeado para `/api/admin.js` e se tornará o entrypoint único de administração (DLQ + Feedbacks), poupando Slots de Serverless Functions (limite Hobby: 12, R-090). |
| **Gating de Admin** | `server/utils/auth.js:18` | A função `verifyAdminAccess(authHeader)` já está pronta. Ela busca o usuário, carrega seu `telegram_chat_id` em `user_settings` e valida contra `process.env.ADMIN_CHAT_ID`. Será reutilizada no `api/admin.js`. |
| **Banco de Dados** | `docs/migrations/` | Nova migração de banco será criada no padrão do Dosiq, declarando explicitamente a remoção de acessos (`REVOKE ALL`) para `anon` e `authenticated` exceto a escrita (`INSERT`) para logados. |
| **Web Router** | `apps/web/src/AppViewRouter.jsx` | A rota `'admin-dlq'` já está estruturada. Adicionaremos `'admin-feedbacks'` seguindo o mesmo padrão de lazy-load/Suspense (R-117). |
| **Mobile Stack** | `apps/mobile/src/navigation/ProfileStack.jsx` | Stack que gerencia telas de Perfil, Configurações e Segurança. Adicionaremos a tela `FeedbackScreen` sob o stack do Perfil. |

---

## Constitution Check

- **I. Health Data Safety**: Os dados de feedback não expõem dados clínicos confidenciais além de e-mails/nomes dos usuários. RLS garante que nenhum usuário possa ler os feedbacks de outros usuários.
- **II. Mobile-First Reliability**: O formulário mobile será simples, sem carregar listas pesadas, usando inputs nativos e com `maxLength` explícito para evitar bugs ou travamentos com o teclado.
- **V. Contract and ADR Discipline**: Não há quebra de contratos de APIs existentes, as mudanças são puramente aditivas e a API DLQ mantém suas assinaturas de rotas através do rewrite de URLs.
- **VI. Release and SQP Discipline**: Alinhado com R-221: SemVer patch para a Web (apenas admin) e SemVer minor para o Mobile (nova funcionalidade de envio ao usuário final). As versões serão bumped adequadamente e o `CHANGELOG.md` será atualizado em português.

---

## Proposed Database Schema

```sql
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  comment text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'other')),
  device text,
  app_version text,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can insert own feedbacks" ON public.feedbacks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Restrição estrita de SELECT/UPDATE/DELETE para anon/authenticated
REVOKE ALL ON public.feedbacks FROM anon;
REVOKE ALL ON public.feedbacks FROM authenticated;
GRANT INSERT ON public.feedbacks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedbacks TO service_role;
```

---

## API Consolidada (/api/admin.js)

O arquivo `api/admin.js` substituirá `api/dlq.js`. Ele funcionará como um roteador de recursos baseando-se no query parameter `resource` injetado pelo `vercel.json` rewrite:

```javascript
export default async function handler(req, res) {
  // 1. Valida acesso administrativo
  const authResult = await verifyAdminAccess(req.headers['authorization']);
  if (!authResult.authorized) {
    return res.status(401).json({ error: authResult.error });
  }

  const { resource, action } = req.query;

  // 2. Roteamento de Recursos
  if (resource === 'dlq') {
    return handleDLQ(req, res, action);
  } else if (resource === 'feedbacks') {
    return handleFeedbacks(req, res, action);
  }

  return res.status(400).json({ error: 'Recurso inválido' });
}
```

As regras de rewrite no `vercel.json` mapearão de forma transparente `/api/dlq` e `/api/feedbacks`.

---

## Target Files (Mapeamento de Modificações)

| File Path | Status | Purpose |
|-----------|--------|---------|
| `docs/migrations/20260604_create_feedbacks.sql` | [NEW] | Criação da tabela, RLS e privilégios. |
| `packages/core/src/schemas/feedbackSchema.js` | [NEW] | Schema Zod de validação do feedback. |
| `packages/core/src/schemas/index.js` | [MODIFY] | Exportar o schema de feedback. |
| `packages/core/src/repositories/createFeedbackRepository.js` | [NEW] | Repositório factory core de feedback. |
| `packages/core/src/repositories/index.js` | [MODIFY] | Exportar a factory do repositório feedback. |
| `api/admin.js` | [NEW] | Roteador único consolidado admin (DLQ + Feedbacks). |
| `api/dlq.js` | [DELETE] | Removido e unificado no `api/admin.js`. |
| `vercel.json` | [MODIFY] | Regras de rewrite unificadas direcionando para `api/admin.js`. |
| `apps/web/src/services/api/feedbackAdminService.js` | [NEW] | Serviço web cliente para buscar/resolver feedbacks. |
| `apps/web/src/views/redesign/settings/sections/AdminSection.jsx` | [MODIFY] | Adicionar link de feedbacks para o admin. |
| `apps/web/src/views/admin/FeedbackAdmin.jsx` | [NEW] | Painel de controle web de feedbacks. |
| `apps/web/src/AppViewRouter.jsx` | [MODIFY] | Registrar rota da view administrativa. |
| `apps/mobile/src/navigation/routes.js` | [MODIFY] | Adicionar constante de rota do feedback. |
| `apps/mobile/src/navigation/ProfileStack.jsx` | [MODIFY] | Registrar a tela de feedback no stack. |
| `apps/mobile/src/features/profile/screens/ProfileScreen.jsx` | [MODIFY] | Adicionar botão "Enviar feedback" no Hub. |
| `apps/mobile/src/features/profile/screens/FeedbackScreen.jsx` | [NEW] | Tela de formulário nativo mobile para envio. |

---

## Risks + Quality Gates

- **Risco**: Burlar segurança por parte dos clientes móveis para ler feedbacks de outros.
  - *Mitigação*: Testar explicitamente na suíte de testes do repositório/RPC que consultas `select` sem service_role falham na tabela feedbacks.
- **Risco**: Estouro de tamanho de string no banco de dados.
  - *Mitigação*: Uso de constraints de validação Zod no core (`maxLength` 100 e 2000) e propriedades `maxLength` nativas nos elementos de entrada Web e Mobile (R-247).
- **Risco**: Erros de importação transitivos em Node puro no Vercel API.
  - *Mitigação*: Seguir a regra R-262 (cold start smoke test local em Node puro) e AP-129 (sempre adicionar extensão `.js` nos arquivos ESM).
