# Alarme de Remédio no Silencioso: Como Fazer Tocar

> Guia técnico sobre Alertas Críticos da Apple no iOS e canais prioritários de alarme no Android para garantir pontualidade em tratamentos essenciais.

## O Problema das Notificações Comuns
Notificações push convencionais são silenciadas sumariamente quando o botão físico do iPhone está no modo silencioso ou quando o Android está em Não Perturbe. Em tratamentos de janela estreita (imunossupressores, anticoagulantes, insulina basal ou antibióticos), doses esquecidas trazem severos riscos clínicos.

## A Solução Técnica
- **No iPhone (iOS):** Utilização do entitlement de Alertas Críticos (Critical Alerts), permissão especial auditada pela Apple para soar audível mesmo no Silencioso, Foco ou Não Perturbe. Inclui Live Activity na tela bloqueada e Ilha Dinâmica.
- **No Android:** Emissão via canal com atributo `USAGE_ALARM` e isenção de restrições de bateria (Doze Mode), contornando a suspensão agressiva em aparelhos Samsung, Motorola e Xiaomi.

## Como Configurar
- **iOS:** Ajustes > dosiq > Notificações > Ativar "Alertas Críticos".
- **Android:** Configurações > Aplicativos > dosiq > Bateria > "Sem restrições".

## Aviso Legal (SaMD)
Este guia tem caráter técnico e educativo. O dosiq não substitui a responsabilidade do paciente no cumprimento de receitas médicas.
DOSIQ DIGITAL HEALTH WEB DESIGN LTDA · CNPJ 68.335.606/0001-11
