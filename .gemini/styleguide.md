# Style Guide: Dosiq

Este documento contém as diretrizes e convenções de código que o Gemini Code Assist deve seguir ao revisar Pull Requests para este repositório.

## 🏗️ Arquitetura e Frameworks

- **React 19**: Utilizamos React 19 com hooks modernos. Evite padrões antigos.
- **Vite**: Ferramenta de build principal.
- **Supabase**: Backend-as-a-Service. Verifique se as chamadas ao Supabase seguem os padrões de RLS.
- **Zod**: Toda entrada de dados (especialmente nos Services) DEVE ser validada com Zod antes de ser enviada ao banco ou usada na lógica.

## 📋 Regras de Ouro (Golden Rules)

> **Sistema de memória: DEVFLOW** — skill `/devflow` (processo oficial do projeto)
> Regras completas (DEVFLOW): `.agent/memory/rules.json` + `rules_detail/` (107 regras R-NNN)
> Anti-patterns (DEVFLOW): `.agent/memory/anti-patterns.json` + `anti-patterns_detail/` (93 AP-NNN)
> `.memory/` está **aposentado** desde 2026-04-08 — não referenciar como fonte de regras.

**Top 5 (referência rápida):**

1. **Arquivos duplicados** (R-001): Sempre verificar com `find src -name "*File*"` antes de modificar.
2. **Ordem dos Hooks** (R-010): States -> Memos -> Effects -> Handlers (previne TDZ).
3. **Timezone** (R-020): Sempre `parseLocalDate()`, nunca `new Date('YYYY-MM-DD')` direto.
4. **Zod Enums** (R-021): Sempre em Português. Código em Inglês, UI/erros em Português.
5. **Dosagem** (R-022): Registrar em comprimidos (não mg), `quantity_taken` <= 100.

**Outras regras importantes:**
- Cache: usar `useCachedQuery` (SWR customizado), invalidar após mutações.
- Telegram: `callback_data` < 64 bytes (usar índices, não UUIDs).
- MarkdownV2: sempre usar `escapeMarkdownV2()` (R-031).

## 🔍 Foco da Revisão

- **Segurança**: Verifique vulnerabilidades de RLS e validação de input.
- **Performance**: Identifique re-renders desnecessários e falta de memoização em cálculos pesados.
- **Manutenibilidade**: Sugira refatorações se uma função tiver mais de 30 linhas ou lógica muito aninhada.

## ⚠️ Salvaguardas

- Não sugira alterações que quebrem a compatibilidade com o plano gratuito do Supabase ou Vercel.
- Respeite a estrutura de diretórios existente.
