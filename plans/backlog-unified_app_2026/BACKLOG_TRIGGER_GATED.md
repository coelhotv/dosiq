# Backlog Futuro & Gatilhos de Ativação (Dosiq 2026)

> **Versão:** 1.1 — Revisão de 30/05/2026  
> **Changelog v1.0→v1.1:** BT-01 (Banner Ads P0), BT-02 (trigger afiliação ajustado), BT-03 (Premium Família), BT-04 (OCR → ML Kit), BT-05 (Offline → WatermelonDB/expo-sqlite).

Este documento descreve as funcionalidades de longo prazo do ecossistema Dosiq. Estas features não possuem data definida para desenvolvimento e **só serão desbloqueadas após a validação de gatilhos quantitativos de tração ou demanda real**, respeitando o foco estratégico em manter a operação robusta, enxuta (bootstraped) e com custo zero.

---

## 💰 1. Candidatos de Monetização (Receita)

Features que transformam a tração do produto em receita financeira recorrente, mantendo as funcionalidades essenciais do paciente sempre 100% gratuitas.

> **Princípio ético:** 100% das funcionalidades de saúde são gratuitas para sempre. Monetização é sobre conveniência e gestão profissional, nunca sobre limitar funcionalidades críticas de saúde.

| Feature ID | Nome Comercial | Gatilho de Ativação | Esforço Est. | Abordagem Estratégica |
| :--- | :--- | :--- | :--- | :--- |
| **B00** | **Banner Ads (AdMob/AdSense)** | `50+ MAU` (mínimo para aprovação AdMob) | 5 SP | **P0 de monetização — one-size-fits-all, zero negociação comercial.** Banner fixo na parte inferior da tela de Estoque (contexto: reposição). NUNCA na tela de registro de doses (experiência crítica de saúde). 1 banner por sessão, não-intrusivo. Disclaimer: "Anúncios ajudam a manter o Dosiq gratuito para todos." Revenue estimada: eCPM Brasil ~R$ 5-15 para healthtech. Opt-out futuro via Premium. |
| **B01** | **Afiliação de Farmácias (CPA)** | `200+ MAU com dados de estoque + parceria local validada` | 8 SP | Quando o estoque virtual do paciente estiver < 5 dias, exibe o botão "Comprar Agora" direcionando para drogarias parceiras ou comparadores de preço (CliqueFarma, Consulta Remédios). Dosiq ganha comissão de afiliação. **Nota:** Programas de afiliação com farmácias têm necessidade de play local gigante para a extensão do Brasil — cada região tem redes diferentes. Por isso, trigger mais alto e validação de parceria como prerequisito. |
| **B02** | **Portal Clínico Profissional (B2B)** | `10+ Médicos usando role Observer (7A) + demanda explícita` | 13 SP | Evolução do Médico Observador (Fase 7A) para um dashboard web robusto com integração a prontuários EHR. Modelo de assinatura Premium para clínicas (R$ 49,90/mês por profissional, até 50 pacientes). |
| **B03** | **Backup Criptografado em Nuvem** | `50+ Usuários solicitando transferência de celular` | 8 SP | Backup de segurança semanal automático do histórico do paciente criptografado localmente no dispositivo via Web Crypto API (AES-256-GCM) antes de subir ao Supabase. Funcionalidade vendida sob assinatura premium barata. |
| **B04** | **Dosiq Premium Família** | `Ads revenue estável + 500+ MAU + 10%+ usando modo cuidador` | 8 SP | Assinatura mensal (R$ 9,90/mês) que inclui: multi-perfil ilimitado (free: 1 paciente vinculado), backup em nuvem automático, relatórios PDF customizados (logo, cores), suporte prioritário. **Nota:** Gestão de assinaturas demanda operação própria (billing, churn, suporte) — só viável após receita de ads estabilizada. |

---

## 🚀 2. Candidatos de Expansão e Engenharia

Funcionalidades de expansão de escopo geográfico, arquitetura técnica avançada ou ferramentas de usabilidade baseadas em hardware nativo.

| Feature ID | Nome Comercial | Gatilho de Ativação | Esforço Est. | Abordagem Estratégica |
| :--- | :--- | :--- | :--- | :--- |
| **L01** | **Internacionalização (i18n)** | `Primeiro piloto fora do Brasil confirmado` | 8 SP | Implementação da biblioteca `react-i18next` e separação das strings no monorepo para suportar Espanhol (LATAM) e Inglês. Pré-requisito para expansão de mercado. |
| **F7.4** | **OCR de Receitas Local (Câmera)** | `Taxa de abandono no Onboarding > 20%` | 21 SP | Utilização da câmera nativa do dispositivo no App Nativo para ler a receita médica física e preencher os medicamentos automaticamente. **Em 2026, ML Kit do Google (on-device) é mais maduro e preciso que Tesseract.js** — suporta `TextRecognition` com detecção de scripts em PT-BR e processamento 100% local (sem envio de dados para servidores). Lib: `@react-native-ml-kit/text-recognition`. Evita digitação complexa e acelera o Onboarding. |
| **F6.3** | **Suporte a Multi-Perfil de Família** | `Demanda provada por cuidadores de múltiplos lares` | 13 SP | Permite a um único paciente gerenciar perfis locais independentes no mesmo aparelho (ex: casal de idosos compartilhando o mesmo celular). Exige migração estrutural em todas as tabelas transacionais do Supabase. |
| **F6.2** | **Offline-First Avançado com Sincronia** | `Evidência recorrente de perda de logs por falta de conexão` | 21 SP | Sistema de sincronização assíncrona robusta. **No mobile, WatermelonDB ou `expo-sqlite` são mais viáveis que IndexedDB** (performance nativa, suporte SQLite embutido, melhor integração com React Native). Na PWA, IndexedDB permanece como opção. Resolução automática de conflitos por delta-sync. Muito complexo e postergado para o futuro. |

---

## 🚫 3. Funcionalidades Descartadas (Justificativas)

Para manter o foco nítido, algumas ideias antigas foram permanentemente descartadas pelo Product Owner:

*   **Drug Database Global por País:** Complexidade gigantesca de manutenção de bases regulatórias médicas em múltiplos servidores. A base da ANVISA/RENAME nacional atende com perfeição o mercado brasileiro.
*   **Offline-First Complexo na V1:** A fila de sincronização local de doses existente no mobile nativo e no PWA já atende 99% das quedas comuns de internet em trânsito no dia a dia.
*   **Tradução para Português de Portugal (PT-PT):** Foco geográfico absoluto no Brasil para validação completa de Product-Market Fit (PMF) local primeiro.
*   **Fluxo "Paciente convida Cuidador":** Descartado na revisão v1.1. No Brasil, idosos que precisam de cuidador geralmente não têm letramento digital suficiente para configurar apps e convidar outras pessoas. O fluxo principal é Cuidador→Paciente(s).
*   **Parceiro de Responsabilidade (C02):** Descartado na revisão v1.1. O PO decidiu priorizar o desenvolvimento de vez do **Modo Cuidador Completo (Fase 7A)**, que atende ao caso de uso familiar robusto. O interesse real será avaliado previamente de forma barata por meio do **Termômetro de Demanda (P0.2)** (painted door test) no perfil do usuário, eliminando a necessidade de construir uma versão "leve" intermediária que adicionaria complexidade extra e custos desnecessários de manutenção de cota de bot.

---

*Especificação sob demanda e análise de gatilhos Dosiq 2026.*  
*Versão 1.1 — Banner Ads P0, Premium Família, techs atualizadas, item descartado documentado.*
