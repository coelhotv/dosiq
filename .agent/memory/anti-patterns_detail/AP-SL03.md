# AP-SL03 — Message router sem fallback para casos não-capturados

**Category:** Schema
**Status:** active
**Related Rule:** R-132
**Applies To:** all

## Problem

Listeners específicos (com patterns/sessão) capturam algumas mensagens, outras caem silenciosamente. Usuário envia texto livre → nenhum handler responde → sem feedback

## Prevention

Event-driven routers SEMPRE precisam de `else` catch-all. Se múltiplos `bot.on()` listeners, último deve ser fallback genérico com logging
