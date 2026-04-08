# AP-SL02 — Mock/adapter object com interface incompleta

**Category:** Schema
**Status:** active
**Related Rule:** R-131
**Applies To:** all

## Problem

Handler chama `bot.sendChatAction()` que não existe no mock → `"is not a function"` error em produção. Testar localmente com bot mock não revela que métodos faltam até atingir a função real

## Prevention

Lista de checkout: todos os `bot.*` chamados em handlers DEVEM estar implementados no mock. Testar localmente com a mesma função de mock antes de deploy
