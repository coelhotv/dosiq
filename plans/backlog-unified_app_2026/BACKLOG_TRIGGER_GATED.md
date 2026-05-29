# Backlog Futuro & Gatilhos de Ativação (Dosiq 2026)

Este documento descreve as funcionalidades de longo prazo do ecossistema Dosiq. Estas features não possuem data definida para desenvolvimento e **só serão desbloqueadas após a validação de gatilhos quantitativos de tração ou demanda real**, respeitando o foco estratégico em manter a operação robusta, enxuta (bootstraped) e com custo zero.

---

## 💰 1. Candidatos de Monetização (Receita)

Features que transformam a tração do produto em receita financeira recorrente, mantendo as funcionalidades essenciais do paciente sempre 100% gratuitas.

| Feature ID | Nome Comercial | Gatilho de Ativação | Esforço Est. | Abordagem Estratégica |
| :--- | :--- | :--- | :--- | :--- |
| **B01** | **Afiliação de Farmácias (CPA)** | `100+ Usuários Ativos Diários (DAU) no Brasil` | 8 SP | Quando o estoque virtual do paciente estiver < 5 dias, exibe o botão "Comprar Agora" direcionando para drogarias parceiras (Drogasil, Pague Menos). Dosiq ganha comissão de afiliação ou revenue-share direto nas vendas sem custo de integração. |
| **B02** | **Portal Clínico Profissional (B2B)** | `10+ Médicos solicitando relatórios via PDF` | 13 SP | Um dashboard web robusto para médicos acompanharem painéis integrados de múltiplos pacientes vinculados por consentimento LGPD. Modelo de assinatura Premium para a clínica médica, com integração a prontuários EHR. |
| **B03** | **Backup Criptografado em Nuvem** | `50+ Usuários solicitando transferência de celular` | 8 SP | Backup de segurança semanal automático do histórico do paciente criptografado localmente no dispositivo via Web Crypto API (AES-256-GCM) antes de subir ao Supabase. Funcionalidade vendida sob assinatura premium barata. |

---

## 🚀 2. Candidatos de Expansão e Engenharia

Funcionalidades de expansão de escopo geográfico, arquitetura técnica avançada ou ferramentas de usabilidade baseadas em hardware nativo.

| Feature ID | Nome Comercial | Gatilho de Ativação | Esforço Est. | Abordagem Estratégica |
| :--- | :--- | :--- | :--- | :--- |
| **L01** | **Internacionalização (i18n)** | `Primeiro piloto fora do Brasil confirmado` | 8 SP | Implementação da biblioteca `react-i18next` e separação das strings no monorepo para suportar Espanhol (LATAM) e Inglês. Pré-requisito para expansão de mercado. |
| **F7.4** | **OCR de Receitas Local (Câmera)** | `Taxa de abandono no Onboarding > 20%` | 21 SP | Utilização da câmera nativa do dispositivo no App Nativo para ler a receita médica física e preencher os medicamentos automaticamente com precisão de NLP local. Evita digitação complexa e acelera o Onboarding. |
| **F6.3** | **Suporte a Multi-Perfil de Família** | `Demanda provada por cuidadores de múltiplos lares` | 13 SP | Permite a um único paciente gerenciar perfis locais independentes no mesmo aparelho (ex: casal de idosos compartilhando o mesmo celular). Exige migração estrutural em todas as tabelas transacionais do Supabase. |
| **F6.2** | **Offline-First Avançado com Sincronia** | `Evidência recorrente de perda de logs por falta de conexão` | 21 SP | Sistema de sincronização assíncrona robusta utilizando `IndexedDB` no PWA e base local SQLite no Native App com resolução automática de conflitos por delta-sync. Muito complexo e postergado para o futuro. |

---

## 🚫 3. Funcionalidades Descartadas (Justificativas)

Para manter o foco nítido, algumas ideias antigas foram permanentemente descartadas pelo Product Owner:

*   **Drug Database Global por País:** Complexidade gigantesca de manutenção de bases regulatórias médicas em múltiplos servidores. A base da ANVISA/RENAME nacional atende com perfeição o mercado brasileiro.
*   **Offline-First Complexo na V1:** A fila de sincronização local de doses existente no mobile nativo e no PWA já atende 99% das quedas comuns de internet em trânsito no dia a dia.
*   **Tradução para Português de Portugal (PT-PT):** Foco geográfico absoluto no Brasil para validação completa de Product-Market Fit (PMF) local primeiro.

---

*Especificação sob demanda e análise de gatilhos Dosiq 2026.*
