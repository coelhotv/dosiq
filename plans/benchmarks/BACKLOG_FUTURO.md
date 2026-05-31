# Backlog Futuro — Dosiq

**Data:** 06/03/2026
**Status:** Backlog — sem prazo definido
**Criterio de ativacao:** Product-market fit validado no Brasil (metricas de engajamento atingidas)

---

## Candidatos de Monetizacao

Estas features so devem ser priorizadas quando houver volume de usuarios que justifique investimento em receita.

| ID | Feature | SP Est. | Modelo | Descricao |
|----|---------|---------|--------|-----------|
| B02 | Afiliacao Farmacia | 8 | CPA | Deep links para farmacias parceiras quando estoque < 7 dias. Zero custo de integracao. Primeira oportunidade de receita. |
| B01 | Portal Profissional de Saude | 13 | Premium | Link read-only compartilhado pelo paciente (com consentimento LGPD). Medico ve adesao, protocolos, estoque. |
| F7.2 | Backup Automatico Criptografado | 8 | Premium | AES-256-GCM + PBKDF2, Web Crypto API. Backup semanal automatico. Potencial feature premium. |

## Candidatos de Expansao

Estas features expandem o produto para novos mercados ou casos de uso. Ativar apenas com evidencia de demanda.

| ID | Feature | SP Est. | Trigger | Descricao |
|----|---------|---------|---------|-----------|
| L01 | Arquitetura i18n | 8 | Demanda internacional validada | react-i18next, separacao de strings. Prerequisito para qualquer idioma adicional. |
| F7.4 | OCR Import | 21 | Friccao de onboarding confirmada | Tesseract.js client-side. Foto da receita → auto-preenche medicamento. >80% acuracia alvo. |
| F6.3 | Multi-perfil Familia | 13 | Cuidador nao resolve caso de uso | Ate 5 perfis por conta. Requer migracao de schema em todas as tabelas. |
| F6.2 | Offline-First | 21 | Evidencia de necessidade real | IndexedDB + delta sync. Complexo (conflict resolution). PWA cache ja atende cenario comum. |

## Permanentemente Descartado

| Feature | Justificativa |
|---------|---------------|
| L02 Portugues Portugal (PT-PT) | Prematuro. PMF no Brasil primeiro. |
| L03 Espanhol (LATAM) | Prematuro. PMF no Brasil primeiro. |
| L04 Drug Database por Pais | Presupoe i18n + multiplos paises. Anos de distancia. |
| F6.6-F6.8 Polish features | Polish sobre features nao construidas. Irrelevante. |

---

*Documento criado 06/03/2026.*
