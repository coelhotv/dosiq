# Roadmap Unificado 2026 — Dosiq (v5.0)

> **Status:** Ativo  
> **Data de Atualização:** 30 de maio de 2026  
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
  📱 APP NATIVO (Paciente)    🌐 PWA/WEB (Suporte/Médicos)  🤖 BOTS (Telegram + WhatsApp*)
  - Registro de doses         - Ficha Médica (Consulta)     - Alertas críticos a cuidadores
  - Alarmes persistentes      - Cartão de Emergência        - Digests semanais de adesão
  - Gestão de estoque         - Dashboard Cuidador/Médico   - Chatbot de suporte rápido
  - Sensores (HealthKit)      - Serverless Webhook Host     - Interface dual-channel

  * WhatsApp = Fase 7B (requer Meta Business verification + MEI)
    Telegram = já operacional em produção
```

---

## 2. Divisão de Papéis por Superfície

Para otimizar o tempo de desenvolvimento em um time enxuto e bootstraped, as features são distribuídas onde geram o maior valor possível com o menor custo de atrito:

| Feature / Domínio | App Nativo (Mobile) | PWA / Web | Bots (WA/TG) | Shared Core (`@dosiq/core`) | Status Atual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Medicamentos & Estoque** | ✅ CRUD Completo + OCR | ✅ CRUD (Busca ANVISA) | ❌ Não | Repositories + Schemas Zod | 🟢 Mobile ✅ / PWA ✅ |
| **Registro de Doses** | ✅ Check-in local robusto | ✅ Check-in na Web | ✅ Check-in por chat | Lógica de Validação | 🟢 Mobile ✅ / PWA ✅ / TG ✅ |
| **Histórico & Aderência** | ✅ Calendário + Heatmap | ✅ Relatório de Consulta | ❌ Não | Cálculos via `dose_instances` | 🟡 Parcial — aguarda refactor Fase 3 |
| **Ficha de Emergência** | ❌ Não (Apenas ativação) | ✅ Site público leve | ❌ Não | RLS e chaves de acesso | 🟢 PWA ✅ / Mobile 🆕 Fase 6 |
| **Modo Cuidador** | ✅ Switch de perfil + Setup | ✅ Dashboard Desktop | ✅ Alertas críticos | `caregiver_links` RLS | 🔴 Não iniciado — Fase 7A |
| **Médico Observador** | ❌ Não | ✅ Dashboard read-only | ❌ Não | `caregiver_links.role='observer'` | 🔴 Não iniciado — Fase 7A |
| **Chatbot IA** | 🆕 Portar UI para mobile | ✅ Chat Window lateral | ✅ Chat direto text-only | Groq API Context | 🟢 PWA ✅ / TG ✅ / Mobile 🆕 Fase 8 |
| **Interações ANVISA** | ✅ Alerta local no cadastro | ✅ Alerta na Ficha Médica | ❌ Não | `interactions.json` estático | 🟡 Spike feito — execução Fase 8 |
| **Alarme Nativo Persistente** | ✅ P0 — AlarmManager/Critical Alerts | ❌ N/A (browser) | ❌ Não | — | 🔴 P0 — pré-Fase 5 |

> **Nota sobre `@dosiq/core`:** O monorepo `packages/core` com seus Repositories + Schemas Zod já está totalmente operacional e integrado ao ecossistema mobile. Toda nova lógica de negócios ou schema de dados compartilhável deve ser codificado e exposto diretamente no `@dosiq/core` usando aliases (`@dosiq/core/` ou `@core/`) para manter o alinhamento de qualidade e a paridade de contratos.

---

## 3. Timeline de Evolução Híbrida

```
2026       Pré-Fase 5     Sem 1-3          Sem 4-7           Sem 8-11           Sem 12-14
       ┌──────────────┐┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
       │   PRÉ-FASE   ││   FASE 5     │ │   FASE 6     │ │   FASE 7     │ │   FASE 8     │
       │  P0 Críticos ││  Analíticas  │ │  Avançadas   │ │ Comunicação  │ │  Experiência │
       │              ││  & Histórico │ │  & Paridade  │ │  & Cuidador  │ │ Inteligente  │
       └──────────────┘└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
        Alarme Nativo    App Nativo:     PWA & Native:      7A: Cuidador    IA via Groq
        Persistente      Calendários,     Ficha Médica,      + Médico Obs.   (portar p/ mobile)
        (8 SP) +         Streaks, SWR     Emergência QR,     (100% agente)   ANVISA local
        Termômetro       Ficha Consulta,  PDF & LGPD Export                  (executar spike)
        Cuidador (3 SP)  dose_instances                     7B: WhatsApp
                         Fase 3 refactor                    (pós Meta approval)
                                                            ← Meta Business verification →
```

---

## 4. Guardrails e Gestão de Custos (Custo Zero - R$0)

O Dosiq opera em infraestrutura online 100% gratuita nas fases de escala inicial. Cada especificação no backlog unificado deve respeitar rigidamente os seguintes limites:

### 1. Vercel Hobby (Max 12 Serverless Functions - R-090)
*   **Status Atual:** 6/12 slots ocupados. Margem de 6 functions.
*   **Ameaça:** Cada arquivo em `api/*.js` consome 1 slot de serverless. WhatsApp Bot (Fase 7B) + roteador unificado exigirão 1-2 slots adicionais.
*   **Mitigação:** Unificar múltiplos handlers de comunicação em um roteador único `api/webhooks.js`. Manter utilitários em pastas prefixadas com `_` (ex: `api/_utils/`), que são ignoradas pela Vercel como endpoints físicos.

### 2. Supabase Free Tier (500MB Database Size Limit)
*   **Ameaça:** Registros de doses e logs de notificações crescem de forma linear indefinida. A tabela `dose_instances` (materializada, ~1140 instâncias/mês para 34 protocolos) adiciona volume.
*   **Mitigação:** Implementar `dose_adherence_monthly` como rollup de agregação (já planejado no refactor). Arquivamento local em `AsyncStorage` / `localStorage` para logs com mais de 90 dias.

### 3. Meta Cloud API (1.000 Conversas Gratuitas/Mês)
*   **Ameaça:** Enviar múltiplos lembretes de rotina diários por WhatsApp esgotará o limite gratuito em dias.
*   **Mitigação:** Estratégia **Push-First**. Lembretes comuns de doses usam push nativo (Alarme Persistente). WhatsApp é reservado exclusivamente para:
    *   Alertas de emergência (quando a mãe atrasar a dose há mais de 30 minutos).
    *   Alertas de estoque crítico (<3 dias) ou renovação de receita.
    *   Digests semanais enviados para o canal do cuidador.
*   **Prerequisito:** Meta Business verification exige MEI (CNPJ). Processo administrativo de 4-8 semanas — iniciar em paralelo com desenvolvimento.

### 4. Alarme Nativo Persistente (P0 — Pré-Fase 5)
*   **Contexto:** Push notifications comuns são silenciáveis pelo Doze mode (Android) e DND (iOS). Para um app de medicamentos crônicos, **alarme nativo persistente é diferenciação competitiva #1**.
*   **iOS:** Solicitar entitlement de Critical Alerts à Apple (apps de saúde, 2-4 semanas de aprovação).
*   **Android:** `AlarmManager.setExactAndAllowWhileIdle()` via `@notifee/react-native`.
*   **Impacto:** Diferença entre 3★ e 5★ na Play Store. Pillo tem 4.7★ especificamente por alarmes persistentes.

---

## 5. Métricas de Sucesso por Fase

| Fase | KPI | Meta | Como medir |
|------|-----|------|-----------|
| Pré-Fase | Alarme nativo funcional em Android + iOS | 100% confiabilidade em Doze mode | Teste manual em 3 devices |
| Pré-Fase | Termômetro cuidador (clicks no botão) | Medir % de MAU que clicam | Analytics event `caregiver_interest_tap` |
| Fase 5 | % de usuários com >1 medicamento | >40% | Query Supabase `protocols` |
| Fase 5 | Adesão diária (doses confirmadas vs planejadas) | >70% | `dose_instances` status ratio |
| Fase 6 | Retenção 7/30/90 dias | 60% / 30% / 15% | Cohort analysis |
| Fase 6 | PDF Médico gerado por usuário/mês | >0.5 | Analytics event |
| Fase 7A | Vínculos cuidador ativos | >10% dos MAU | `caregiver_links` count |
| Fase 7B | Mensagens WhatsApp enviadas/mês | <1000 (free tier) | Meta Cloud API dashboard |
| Fase 8 | Uso do chatbot por MAU | >20% | API calls per user |

---

## 6. Diretrizes para Agentes de IA Coders

Como o Dosiq é desenvolvido com forte apoio de agentes de IA coders, todo trabalho de implementação deve seguir as regras do **Standard Quality Protocol (SQP v2.0)**:
*   **Checklist Obrigatório:** Antes de codificar, o agente deve expor o checklist `[ ]` das tarefas.
*   **Gate Loop G1 ➔ G2 ➔ G3:** Toda funcionalidade comum deve começar local no Native (G1), ser extraída em formato de *Factory* purificada no `@dosiq/core` (G2) e finalmente adotada pela Web (G3).
*   **Decommission do Expo Go (Builds de Desenvolvimento Nativas):** O Dosiq utiliza dependências nativas (notifee, firebase, push notifications) incompatíveis com o cliente Expo Go padrão. Os agentes IA devem **abandonar qualquer expectativa de rodar no Expo Go** e trabalhar exclusivamente gerando e testando Builds de Desenvolvimento nativas no simulador ou device real (`rtk expo run:android` ou `rtk expo run:ios`).
*   **Tags de Superfície Obrigatórias:** Todo item do backlog DEVE ter tags `[PORTAR]` (já existe em outra plataforma), `[NOVO]` (criar do zero), `[REFATORAR]` (reescrever existente), ou `[N/A]` por plataforma.
*   **Validação Contínua:** Nenhum PR é aceito sem rodar o linter (`rtk lint`) e a suíte crítica de testes (`rtk npm run validate:agent`).
*   **Zero Auto-Aprovação (R-060):** O agente nunca faz merge de código funcional por conta própria; ele cria o PR e aguarda a revisão e homologação do humano.

---

*Documento estratégico do Roadmap Dosiq 2026.*  
*Versão 5.0 — Supersede ROADMAP_v4.md   
*Changelog v5.0: U-01 (status column), U-02 (termômetro + alarme na timeline), U-03 (WhatsApp tagged 7B), U-04 (6/12 serverless), U-05 (KPIs), U-06 (@dosiq/core note), U-07 (alarme P0).*
