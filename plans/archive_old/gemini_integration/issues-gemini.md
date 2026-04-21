# ANALISE DO ESTADO ATUAL DA INTEGRACAO COM GEMINI

## PROBLEMAS ENCONTRADOS

### 1. Todo comentário/ revisão do Gemini está sendo automaticamente transformado em issue no Github, independente de sua prioridade/ severidade classificada pelo revisor.

**Exemplo do problema:** PR#159 e Issues#162-#164

**Comportamento esperado:**
- Comentários/ Sugestões com severidade _Critical_ ou _High Priority_ não devem virar issues automaticas, mas sim alertar o agente desenvolvedor para que sejam corrigidas imediatamente -- parar o workflow até que sejam corrigidas.
- Comentários/ Sugestões com severidade _High Priority_ que impactem diretamente a segurança ou degradem significativamente a performance da aplicação não devem virar issues automaticas, mas sim alertar o agente desenvolvedor para que sejam corrigidas imediatamente -- parar o workflow até que sejam corrigidas.
- Todos os outros comentários/ sugestões que não se enquadrem nas regras acima podem virar novas issues automaticamente no Github



### 2. Toda nova issue criada automaticamente no Github está carregando o prefixo [Refactor] ao invés de trazer a severidade/ prioridade do comentário do revisor Gemini.

**Exemplo do problema:** Issues#162-#164

**Comportamento esperado:**
- As novas issues criadas automaticamente no Github devem 'carregar' a classificação original do Gemini como seu prefixo; ex: [High] ou [Medium]. // 'criticals' não devem ser criadas como issues automaticas


### 3. Workflow automático está criando issues 'fantasmas' com os comentários do Gemini que elogiam as correções feitas no mesmo PR.

**Exemplo do problema:** PR#168 + Issues#169-#170 e depois Issues#171-#172

**Comportamento esperado:**
- Os filtros de classificação dos comentários do revisor Gemini deveriam exluir comentários que elogiam as correções ou que não tratam especificamente de problemas e bugs encontrados, não permitindo que tais comentários/revisões sejam transformados em issues automaticamente no Github.


### 4. Ao criar issues automáticas para cada revisão, o workflow está publicando comentários na 'timeline' da PR com a referência da issue.

**Exemplo do problema:** ([Issue#169 no PR#168](https://github.com/coelhotv/dosiq/pull/168#issuecomment-3959261129))

**Comportamento esperado:**
- Após criar issue automática o workflow deveria responder inline diretamente ao comentário/ revisão específico do Gemini com a referência da issue criada, iniciando sua resposta com "@gemini-code-assist" para que o revisor receba notificação do comentário.


### 5. A cada novo commit e re-review do Gemini o workflow edita o resumo e tabela de issues duplicando os mesmos comentários e linhas com problemas, gerando ruído no sumário.

**Exemplo do problema:** ([PR#168](https://github.com/coelhotv/dosiq/pull/168#issuecomment-3959223712))

**Comportamento esperado:**
- A cada nova execução do workflow, ele deveria verificar quais linhas já haviam sido reportadas e contabilizadas e não duplicar a sua contagem.