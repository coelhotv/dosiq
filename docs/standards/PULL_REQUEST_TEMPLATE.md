<!--
  ⚠️  IMPORTANTE: Este é um TEMPLATE de estrutura para Pull Requests.

  Este documento serve como GUIA para criar novas PRs. NÃO copie e cole
  este arquivo inteiro. Em vez disso, use a estrutura abaixo como
  referência para preencher sua própria descrição de PR.

  Instruções:
  1. Substitua todos os textos entre [colchetes] pelo conteúdo real
  2. Remova seções que não se aplicam ao seu caso
  3. Adapte a estrutura conforme necessário para o escopo da sua mudança
  4. Use checkboxes (\- [ ]) apenas para itens realmente concluídos
-->

# 📦 [Título da PR - Ex: feat(scope): descrição breve]

## 🎯 Resumo

<!--
  Descreva em 2-3 linhas o objetivo desta PR.
  O que está sendo entregue? Qual problema resolve?
-->

[Exemplo: Esta PR implementa o sistema de cache SWR para otimizar o carregamento do Dashboard, reduzindo o tempo de resposta em 95%.]

---

## 📋 Tarefas Implementadas

<!--
  Liste as tarefas/tickets concluídos nesta PR.
  Use checkboxes para indicar o status de cada item.
  Agrupe por categorias lógicas se houver muitas tarefas.
-->

### [Categoria 1 - Ex: Funcionalidades Principais]
- [ ] [Descrição da tarefa 1]
- [ ] [Descrição da tarefa 2]
- [ ] [Descrição da tarefa 3]

### [Categoria 2 - Ex: Testes e Qualidade]
- [ ] [Descrição do teste/validação 1]
- [ ] [Descrição do teste/validação 2]

<!--
  EXEMPLO REAL (para referência - NÃO copie):

  ### ✅ Testes Unitários
  - [x] Setup Vitest com jsdom
  - [x] Testes de componentes (Button, Modal)
  - [x] Testes de hooks (useCachedQuery)
  - [x] 110 testes cobrindo schemas e serviços

  ### ✅ Validação com Zod
  - [x] Schemas para medicamentos e protocolos
  - [x] Integração com formulários existentes
-->

---

## 📊 Métricas de Melhoria (se aplicável)

<!--
  Opcional: Inclua métricas quantitativas quando relevante.
  Compare "antes" vs "depois" quando possível.
  Remova esta seção se não houver métricas significativas.
-->

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| [Ex: Tempo de carregamento] | [~2s] | [~100ms] | [95%] |
| [Ex: Cobertura de testes] | [~10%] | [~75%] | [+65%] |
| [Ex: Tempo de query] | [~500ms] | [~100ms] | [5x] |

---

## 🔧 Arquivos Principais

<!--
  Liste os arquivos/diretórios mais importantes alterados.
  Use uma estrutura de árvore para facilitar a navegação.
  Foque nos arquivos que reviewers devem priorizar.
-->

```
[caminho/]
├── [diretorio/]
│   ├── [arquivo-modificado.js]     # [breve descrição da mudança]
│   └── [novo-arquivo.js]           # [breve descrição do novo arquivo]
└── [outro-diretorio/]
    └── [arquivo-alterado.jsx]
```

<!--
  EXEMPLO REAL (para referência - NÃO copie):

  src/
  ├── components/
  │   └── onboarding/          # Novo wizard de 4 passos
  ├── hooks/
  │   └── useCachedQuery.js    # Hook SWR customizado
  └── services/api/
      └── cachedServices.js    # Integração com cache
-->

---

## ✅ Checklist de Verificação

<!--
  Marque apenas os itens que foram VERIFICADOS nesta PR.
  Não marque por "achar que deve estar certo" - execute os comandos.
-->

### Código
- [ ] Todos os testes passam (`npm run test:critical`)
- [ ] Lint sem erros (`npm run lint`)
- [ ] Build bem-sucedido (`npm run build`)

### Funcionalidade
- [ ] [Verificação específica 1 - ex: "Onboarding funciona em mobile"]
- [ ] [Verificação específica 2 - ex: "Cache invalida após mutações"]

### Documentação
- [ ] [Código documentado com JSDoc quando necessário]
- [ ] [README atualizado se houver mudanças de API]

---

## 🚀 Como Testar

<!--
  Forneça instruções passo a passo para testar as mudanças.
  Seja específico - quais comandos executar, qual comportamento esperar.
-->

```bash
# 1. [Primeiro passo - ex: Instalar dependências]
[comando]

# 2. [Segundo passo - ex: Executar testes]
[comando]

# 3. [Terceiro passo - ex: Iniciar servidor de desenvolvimento]
[comando]
```

<!--
  Descreva o comportamento esperado para validação:

  **Resultado esperado:**
  - [Descrição do que o reviewer deve observar]
  - [Outra observação importante]
-->

---

## 🔗 Issues Relacionadas

<!--
  Liste issues/tickets que esta PR resolve ou relaciona.
  Use palavras-chave do GitHub para auto-fechar issues: Closes, Fixes, Resolves
-->

- Closes #[número-da-issue]
- Related to #[número-da-issue-relacionada]
- Fixes #[número-do-bug]

---

## 📝 Notas para Reviewers

<!--
  Adicione contexto adicional que ajude os reviewers a entenderem
  decisões técnicas, pontos de atenção ou áreas que precisam de
  revisão mais cuidadosa.

  Opcional: remova esta seção se não houver notas específicas.
-->

1. **[Tópico 1 - ex: Testes]:** [Instrução específica - ex: "Foco nos testes de integração do cache"]
2. **[Tópico 2 - ex: Performance]:** [Instrução específica - ex: "Verificar benchmarks em docs/"]
3. **[Tópico 3]:** [Instrução específica]

---

## 🏷️ Informações de Versionamento

<!--
  Opcional: Indique o tipo de versionamento sugerido.
  Remova se o versionamento for gerenciado automaticamente.
-->

**Tipo:** [Major / Minor / Patch]
**Plataformas afetadas:** [Web/PWA / Mobile / Shared/Core / Backend/Infra]
**Versão anterior:** [x.x.x]
**Versão sugerida:** [x.x.x]
**Changelog:** [CHANGELOG.md [Unreleased] atualizado / no-user-impact justificado]

---

<!--
  Abaixo estão exemplos de seções adicionais que podem ser
  incluídas conforme a necessidade da PR:

  ## 🔄 Mudanças de Breaking Change
  - [Descrição do que quebra e como migrar]

  ## 🛡️ Considerações de Segurança
  - [Descrição de medidas de segurança implementadas]

  ## 📸 Screenshots / GIFs
  [Inclua evidências visuais quando relevante]

  ## 🧪 Casos de Teste Específicos
  - [Caso de teste 1]
  - [Caso de teste 2]
-->

/cc @reviewers
/cc @gemini-code-assist
