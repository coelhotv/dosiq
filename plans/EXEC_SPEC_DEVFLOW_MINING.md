# Exec Spec 4: Devflow Mining — Auditoria e Extração de APs

**Domínio:** Arquitetura / Metodologia Ágil dos Agentes
**Objetivo:** Efetuar análise intensiva da tabela morta de `gemini_reviews`, mapear e extrair lições (Erros Sistêmicos / Code Smells) recorrentes feitos pelos agentes coders, para evoluir a Memória Viva (DEVFLOW) do projeto e impedir retrocessos.

## 1. Contexto e Motivação
A tabela `gemini_reviews` é um depósito contendo as críticas técnicas que os agentes avaliadores geraram para o código criado pelos agentes desenvolvedores. Essa base de três meses de observação não deve ser descartada de maneira infrutífera. Como o banco vai sair do ar, o plano é drenar de seu histórico as falhas crônicas para formalizá-las em APs (Anti-Patterns) estruturados dentro do guia oficial do Dosiq.

## 2. Abordagem de Execução (O Processo)

### Fase A: Coleta de Dados (O Mining)
- Via terminal SQL, rodar ou extrair a exportação integral via queries (`SELECT description, suggestion FROM gemini_reviews WHERE ...`).
- Categorizar esses erros por vetores, exemplos observados:
  - Hook Rendering Smells (Problemas de deps / O(N) loops em memórias).
  - Validation Missing (Casos não passados pelo parser Zod).
  - Safety (Quebras de ponteiros indefinidos / optional chaining).
  - Estrutura de Retornos / Condicionais Frágeis.

### Fase B: Auditoria Cruzada (O Crosscheck)
- O desenvolvedor que executar esta tarefa DEVERÁ ler com profundidade a pasta `.agent/memory/anti-patterns/` (e a `RULES_INDEX`).
- Deve-se *validar e quantificar*: Quais falhas apontadas pelo mining *JÁ SÃO* regras declaradas no nosso ambiente?
  - A quantificação indicará: O Agente errou "Regra X" num montante de N vezes.

### Fase C: Extração Inédita (Criação de novos APs)
- Para cada padrão de erro inédito e altamente presente detectado nos dados (que passe pelo crivo da auditoria de "sinal real vs ruído"):
  - Criar um artefato dentro do ecossistema do DEVFLOW.
  - Preencher a identificação (Ex: `AP-038 - Ignorar estado derivado O(N) dentro de renderização passiva`).

## 3. Entregável Esperado
- Um relatório consolidador temporário documentado: `docs/reports/gemini_reviews_audit_2026.md`.
- Um conjunto de `AP-NNN.md` reais, perfeitamente descritos (Sintomas, Soluções Corretas e Explicações).
- Uma entrada sumarizando a operação no C5 do DEVFLOW Journal.
