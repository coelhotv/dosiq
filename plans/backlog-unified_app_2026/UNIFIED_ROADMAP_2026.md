# Roadmap Unificado 2026 — Dosiq (v5.0)

> **Status:** Ativo  
> **Data de Atualização:** 29 de maio de 2026  
> **Modelo Principal:** Mobile-Led (App Nativo como condutor prioritário)  
> **Princípio Fundamental:** Custo operacional R$0 nas Fases 5 a 7. Suporte intensivo a Agentes de IA Coders.

---

## 1. Visão Estratégica Unificada

O Dosiq evoluiu de um PWA/Web pioneiro para um ecossistema **Mobile-Led**. O aplicativo nativo React Native é o canal primário de interação diária com o paciente devido à robustez das notificações locais, velocidade de interface e integração com hardware. 

Contudo, a versão PWA/Web não está obsoleta; ela assume o papel de **suporte clínico, emergência e acesso rápido para terceiros**, onde a instalação de aplicativos nativos seria uma barreira de fricção inaceitável.

```
                  ┌────────────────────────────────────────┐
                  │          ECOSISTEMA DOSIQ 2026         │
                  └──────────────────┬─────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
  📱 APP NATIVO (Paciente)    🌐 PWA/WEB (Suporte/Médicos)  🤖 BOTS (WhatsApp/Telegram)
  - Registro de doses         - Ficha Médica (Consulta)     - Alertas críticos a cuidadores
  - Alarmes offline           - Cartão de Emergência        - Digests semanais de adesão
  - Gestão de estoque         - Dashboard do Cuidador       - Chatbot de suporte rápido
  - Sensores (HealthKit)      - Serverless Webhook Host     - Interface dual-channel
```

---

## 2. Divisão de Papéis por Superfície

Para otimizar o tempo de desenvolvimento em um time enxuto e bootstraped, as features são distribuídas onde geram o maior valor possível com o menor custo de atrito:

| Feature / Domínio | App Nativo (Mobile) | PWA / Web | Bots (WA/TG) | Shared Core (`@dosiq/core`) |
| :--- | :--- | :--- | :--- | :--- |
| **Medicamentos & Estoque** | ✅ CRUD Completo + OCR | ✅ CRUD (Busca ANVISA) | ❌ Não | Repositories + Schemas Zod |
| **Registro de Doses** | ✅ Check-in local robusto | ✅ Check-in na Web | ✅ Check-in por chat | Logica de Validação |
| **Histórico & Aderência** | ✅ Calendário + Heatmap | ✅ Relatório de Consulta | ❌ Não | Cálculos Matemáticos SWR |
| **Ficha de Emergência** | ❌ Não (Apenas ativação) | ✅ Site público leve | ❌ Não | RLS e chaves de acesso |
| **Modo Cuidador** | ✅ Switch de perfil + Setup | ✅ Dashboard Desktop | ✅ Alertas críticos | `caregiver_links` RLS |
| **Chatbot IA** | ✅ Chat por voz/texto | ✅ Chat Window lateral | ✅ Chat direto text-only | Groq API Context |
| **Interações ANVISA** | ✅ Alerta local no cadastro | ✅ Alerta na Ficha Médica | ❌ Não | `interactions.json` estático |

---

## 3. Timeline de Evolução Híbrida (Fases 5 a 8)

```
2026       Sem 1-3          Sem 4-7           Sem 8-11           Sem 12-14
       ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │   FASE 5     │ │   FASE 6     │ │   FASE 7     │ │   FASE 8     │
       │  Analíticas  │ │  Avançadas   │ │ Comunicação  │ │  Experiência │
       │  & Histórico │ │  & Paridade  │ │  & Cuidador  │ │ Inteligente  │
       └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
          App Nativo:     PWA & Native:      WhatsApp &      IA via Groq,
          Calendários,     Ficha Médica,      Telegram,       Comandos Voz
          Streaks, SWR    Emergência QR,     Novo Cuidador,   ANVISA local,
          Ficha Consulta   PDF & LGPD Export  RLS Seguridade  Wow Factors
```

---

## 4. Guardrails e Gestão de Custos (Custo Zero - R$0)

O Dosiq opera em infraestrutura online 100% gratuita nas fases de escala inicial. Cada especificação no backlog unificado deve respeitar rigidamente os seguintes limites:

### 1. Vercel Hobby (Max 12 Serverless Functions - R-090)
*   **Ameaça:** Cada arquivo em `api/*.js` consome 1 slot de serverless.
*   **Mitigação:** Unificar múltiplos handlers de comunicação em um roteador único `api/webhooks.js`. Manter utilitários em pastas prefixadas com `_` (ex: `api/_utils/`), que são ignoradas pela Vercel como endpoints físicos.

### 2. Supabase Free Tier (500MB Database Size Limit)
*   **Ameaça:** Registros de doses e logs de notificações crescem de forma linear indefinida.
*   **Mitigação:** Implementar arquivamento local em `AsyncStorage` / `localStorage` para logs com mais de 90 dias, limpando a base do Supabase ou sumarizando métricas históricas de adesão em tabelas leves de agregação mensal.

### 3. Meta Cloud API (1.000 Conversas Gratuitas/Mês)
*   **Ameaça:** Enviar múltiplos lembretes de rotina diários por WhatsApp esgotará o limite gratuito em dias.
*   **Mitigação:** Estratégia **Push-First**. Lembretes comuns de doses usam push nativo. WhatsApp é reservado exclusivamente para:
    *   Alertas de emergência (quando a mãe atrasar a dose há mais de 30 minutos).
    *   Alertas de estoque crítico (<3 dias) ou renovação de receita.
    *   Digests semanais enviados para o canal do cuidador.

---

## 5. Diretrizes para Agentes de IA Coders

Como o Dosiq é desenvolvido com forte apoio de agentes de IA coders, todo trabalho de implementação deve seguir as regras do **Standard Quality Protocol (SQP v2.0)**:
*   **Checklist Obrigatório:** Antes de codificar, o agente deve expor o checklist `[ ]` das tarefas.
*   **Gate Loop G1 ➔ G2 ➔ G3:** Toda funcionalidade comum deve começar local no Native (G1), ser extraída em formato de *Factory* purificada no `@dosiq/core` (G2) e finalmente adotada pela Web (G3).
*   **Validação Contínua:** Nenhum PR é aceito sem rodar o linter (`rtk lint`) e a suíte crítica de testes (`rtk npm run validate:agent`).
*   **Zero Auto-Aprovação (R-060):** O agente nunca faz merge de código funcional por conta própria; ele cria o PR e aguarda a revisão e homologação do humano.

---

*Documento estratégico do Roadmap Dosiq 2026.*  
*Versão 5.0 — Supersede ROADMAP_v4.md.*
