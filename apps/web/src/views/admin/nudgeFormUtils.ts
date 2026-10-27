// apps/web/src/views/admin/nudgeFormUtils.ts
// Utilitários do formulário de nudge — destinos e payload `navigate` vêm do core
// (`NUDGE_DESTINATIONS`, fonte única com o app mobile; 028 emenda 2026-10).

import { NUDGE_DESTINATIONS, buildNudgeNavigatePayload } from '@dosiq/core'

// Opções do dropdown "Tela para Navegar": valor = nome da rota no app, rótulo em PT-BR
export function getRouteOptions() {
  return NUDGE_DESTINATIONS.map((d) => ({
    value: d.screen,
    label: d.requiresStock ? `${d.label} — só p/ quem usa estoque` : d.label,
  }))
}

// Montar payload navigate conforme o destino canônico
export function buildNavigatePayload({ selectedRoute, label, emoji }) {
  if (!selectedRoute) return {}
  return buildNudgeNavigatePayload(selectedRoute, { label, emoji })
}
