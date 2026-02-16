# Style Guide: Meus Remédios

Este documento contém as diretrizes e convenções de código que o Gemini Code Assist deve seguir ao revisar Pull Requests para este repositório.

## 🏗️ Arquitetura e Frameworks

- **React 19**: Utilizamos React 19 com hooks modernos. Evite padrões antigos.
- **Vite**: Ferramenta de build principal.
- **Supabase**: Backend-as-a-Service. Verifique se as chamadas ao Supabase seguem os padrões de RLS.
- **Zod**: Toda entrada de dados (especialmente nos Services) DEVE ser validada com Zod antes de ser enviada ao banco ou usada na lógica.

## 📋 Regras de Ouro (Golden Rules)

1. **Idiomas**:
   - Código (variáveis, funções, classes): **Inglês**.
   - Mensagens de erro, labels de UI e comentários explicativos: **Português (Brasil)**.
   - Constantes de esquemas (Zod enums): **Português (Brasil)** para consistência na UI.

2. **Ordem dos Hooks**:
   - Respeite sempre a ordem: States → Memos → Effects → Handlers.

3. **Gerenciamento de Estado e Cache**:
   - Use obrigatoriamente `useCachedQuery` (SWR customizado) para buscas de dados.
   - Garanta a invalidação do cache após mutações.

4. **Bot do Telegram**:
   - Os dados de callback (`callback_data`) devem ser menores que 64 bytes. Use índices em vez de UUIDs.

5. **Estoque**:
   - Registre doses sempre em unidades (comprimidos, cápsulas), nunca em miligramas.

## 🔍 Foco da Revisão

- **Segurança**: Verifique vulnerabilidades de RLS e validação de input.
- **Performance**: Identifique re-renders desnecessários e falta de memoização em cálculos pesados.
- **Manutenibilidade**: Sugira refatorações se uma função tiver mais de 30 linhas ou lógica muito aninhada.

## ⚠️ Salvaguardas

- Não sugira alterações que quebrem a compatibilidade com o plano gratuito do Supabase ou Vercel.
- Respeite a estrutura de diretórios existente.
