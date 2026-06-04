# Requirements Checklist — Sistema de Feedback do Usuário e Admin

> "Unit tests" da escrita dos requisitos (completude/clareza/consistência/cobertura/
> mensurabilidade/rastreabilidade). NÃO testam comportamento de implementação.

## Completude
- [x] Toda funcionalidade descrita na proposta tem FR + task + SC associados.
- [x] Consolidado serverless (renomeação `api/dlq.js` -> `api/admin.js`) e rewrites detalhados no plano.
- [x] RLS fechado (Write-Only) e grants para service_role declarados.
- [x] Restrição estrita de UI/form de envio exclusivamente para o Mobile (sem formulário na Web).
- [x] Coluna de controle de resolução (`is_resolved`) incluída no schema.

## Clareza
- [x] Regra de gating admin baseada em `telegram_chat_id` vs `ADMIN_CHAT_ID` clara e sem ambiguidades.
- [x] Limites máximos de caracteres (`subject`: 100, `comment`: 2000) explícitos para UI e Zod.
- [x] Roteamento por query param `resource` no serverless unificado detalhado.

## Consistência
- [x] spec ↔ plan ↔ tasks concordam em caminhos e responsabilidades.
- [x] Nomes de tabelas e colunas em inglês com validações de erro Zod em português (R-021).
- [x] Extensão `.js` obrigatória em todos os imports de módulos serverless (AP-129).

## Mensurabilidade
- [x] SC-001..SC-004 são verificáveis (testes do core, rtk lint, smoke mobile/web).
- [x] Cenários de aceitação (Given/When/Then) escritos em formato testável.

## Rastreabilidade
- [x] FR→task→SC mapeados.
- [x] Regras R-221 (SQP), R-247 (maxLength), R-021 (Portuguese Zod) associadas.

## Pendências (gate antes do código)
- [ ] Criar especificação detalhada de testes para o repositório e Zod schema.
- [ ] Aprovação formal do plano técnico e da spec por parte do usuário.
