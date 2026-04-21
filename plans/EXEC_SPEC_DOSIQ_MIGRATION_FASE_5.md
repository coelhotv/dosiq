# Exec Spec Fase 5: Memória Devflow, Specs e Tooling Documental
> **Objetivo:** Adaptar toda a documentação da "consciência do repositório" (Agentic Memory) e da camada humana para as novas nomenclaturas, para que futuras interações não tenham alucinações legadas.

## 1. Escopo de Arquivos Modificados
- `README.md`, `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`
- `.agent/memory/rules.json` e `.agent/memory/knowledge.json`
- `plans/backlog-native_app/GUIA_ASO_E_CONTEUDOS_PLAY_STORE.md` (Adequar o que for dependente dessa nova onda).

## 2. Tarefas de Execução

### 2.1. Contexto Global de Memória
- Modificar os arquivos `.md` na root. Todos eles declaram intensivamente: "Meus Remédios é um PWA...". Refatorar tudo para "Dosiq é um PWA...".
- Atualizar URLs de Github declaradas de forma hardcoded nos manuais se pertinentes (e marcar as anotações alertando o clone path futuro).

### 2.2. Core Memory Files do Devflow
- O Agente (ou script em python se não puder ser direto via Node) deve abrir o `.agent/memory/knowledge.json` e realizar as modificações (strings contendo as identidades). O mesmo com `rules.json`.
- Adicionar ou formatar os logs no `.agent/state.json` para adicionar esse update ao sprint list que estiver ativo neste momento.

## 3. Validation Gate do Agente
- Rodar o `/devflow` ou as tools de agent verification de documentação local para garantir que a taxonomia Json não se afogou com erros de Parse com os replaces.
- O Agente deve esperar Aprovação do Usuário para unificar todo e qualquer Diff aberto na PR Oficial de Rebranding, terminando enfim a "Migração Local".
