# Master Specification: Dosiq Migration
> **Contexto:** Migração completa do Monorepo "Meus Remédios" para a marca "Dosiq".
> **Status:** PLANEJADO
> **Objetivo:** Orquestrar de forma estruturada a renomeação, atualização de pacotes e reposicionamento da plataforma, sem corromper a arquitetura existente.

## 1. Visão Geral do Projeto de Migração
A plataforma mudará de "Meus Remédios" (e suas variações nos slugs) para "Dosiq". Esta mudança engloba o root do Monorepo, pacotes internos (`@dosiq/web`, etc.), App Híbrido Mobile (`com.coelhotv.dosiq`), o Web PWA (`dosiq.vercel.app`), dependências do Backend (Telegram `dosiq_bot`), e toda a documentação interna. 

O repositório atual na máquina do desenvolvedor não terá sua raiz alterada fisicamente nesta etapa para manter a consistência do DEVEFLOW/IDE, até que os PRs sejam aprovados.

## 2. Abordagem de Multi-Agentes
A execução foi dividida em Fases Atômicas, geradas isoladamente para que múltiplos agentes de código operem paralelamente ou em fila, com fronteiras rigorosas predefinidas para não haver corrupção do repositório.

| Fase | Foco | Arquivo de Especificação |
|---|---|---|
| **Fase 1** | Node, Monorepo & Pacotes | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_1.md` |
| **Fase 2** | App Híbrido & Expo | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_2.md` |
| **Fase 3** | App Web, SEO & PWA | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_3.md` |
| **Fase 4** | Integrações (Bot/Supabase)| `EXEC_SPEC_DOSIQ_MIGRATION_FASE_4.md` |
| **Fase 5** | Doc, Devflow e Repo | `EXEC_SPEC_DOSIQ_MIGRATION_FASE_5.md` |

## 3. Gestão de Qualidade e Gates (R-060, R-062)
Os Agentes Executores **devem** seguir as regras vitais de DEVFLOW:
1. **Gate Inicial:** O Agente deve usar `/devflow` antes de prosseguir. Sem DEVFLOW bootado = aborto.
2. **Quality Gates Intermediários:** Ao fim de cada macro-task (ex: alterar imports/namespaces), rodar `npm run lint` e `npm run validate:agent`.
3. **Bloqueio de PR:** Nenhum agente deve auto-aprovar merges em master. 
4. **Verificação de Regressão Mock/Testes:** Se pacotes renomeados quebrarem setups do Vitest (`test:changed`), o Agente *pausa* e corrige, e não pula a pipeline.

## 4. O Que os Agentes NÃO Devem Fazer
- Mudar a paleta de cores ou design base do sistema.
- Alterar nome de tabelas no banco de dados (o ORM e consultas ao Supabase se mantém, lidando apenas com slugs/URIs).
- Renomear fisicamente a pasta base `/Users/coelhotv/git-icloud/meus-remedios/` via comando de sistema (Ações do HD serão feitas manualmente pelo usuário).

---

Abaixo, inicie as Sprints designando ou chamando os Agentes conforme cada Fase detalhada.
